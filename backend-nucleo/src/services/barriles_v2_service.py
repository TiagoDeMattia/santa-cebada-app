"""
Barriles V2 — base de datos SQLite propia, sin Google Sheets.
DB en .pm2/ para evitar ProtectHome=read-only del systemd.
"""
import logging
import os
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Any

from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)

_PM2_HOME = Path(os.environ.get("PM2_HOME", Path.home() / ".pm2"))
_DB_PATH = _PM2_HOME / "barriles.db"

MAX_CANILLAS = 20
TURNOS = ("Mañana", "Noche")
ESTADOS = ("En Camara", "Pinchada", "Para Retirar", "Retirada")


@lru_cache(maxsize=1)
def _get_engine():
    return create_engine(
        f"sqlite:///{_DB_PATH.as_posix()}",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=NullPool,
    )


def _migrate_birras_schema(conn):
    """Migra bv2_birras del esquema antiguo (UNIQUE estilo TEXT)
    al nuevo (proveedor_id FK + UNIQUE(estilo, proveedor_id))."""
    prov_rows = conn.execute(text(
        "SELECT DISTINCT proveedor FROM bv2_birras ORDER BY proveedor"
    )).fetchall()

    prov_name_to_id: Dict[str, int] = {}
    for prov_row in prov_rows:
        nombre = (prov_row[0] or '').strip() or 'Sin proveedor'
        existing = conn.execute(
            text("SELECT id FROM bv2_proveedores WHERE nombre = :n"), {'n': nombre}
        ).fetchone()
        if existing:
            pid = existing[0]
        else:
            r = conn.execute(
                text("INSERT INTO bv2_proveedores (nombre) VALUES (:n)"), {'n': nombre}
            )
            pid = r.lastrowid
        prov_name_to_id[(prov_row[0] or '').strip()] = pid
    conn.commit()

    default_id = prov_name_to_id.get('') or next(iter(prov_name_to_id.values()), None)
    if not default_id:
        r = conn.execute(text("INSERT INTO bv2_proveedores (nombre) VALUES ('Sin proveedor')"))
        default_id = r.lastrowid
        conn.commit()

    conn.execute(text("ALTER TABLE bv2_birras RENAME TO bv2_birras_old"))
    conn.execute(text("""
        CREATE TABLE bv2_birras (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            estilo           TEXT    NOT NULL,
            proveedor_id     INTEGER NOT NULL REFERENCES bv2_proveedores(id),
            tipo             TEXT    NOT NULL DEFAULT 'B',
            abv              TEXT    DEFAULT '',
            amargor          TEXT    DEFAULT '',
            descripcion      TEXT    DEFAULT '',
            palabras_destacar TEXT   DEFAULT '',
            activo           INTEGER NOT NULL DEFAULT 1,
            created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
            UNIQUE(estilo, proveedor_id)
        )
    """))

    old_rows = conn.execute(text(
        "SELECT id, estilo, proveedor, tipo, abv, amargor, descripcion, "
        "palabras_destacar, activo, created_at FROM bv2_birras_old"
    )).fetchall()

    for row in old_rows:
        d = dict(row._mapping)
        proveedor_nombre = (d.get('proveedor') or '').strip()
        pid = prov_name_to_id.get(proveedor_nombre) or default_id
        conn.execute(text("""
            INSERT INTO bv2_birras
                (id, estilo, proveedor_id, tipo, abv, amargor,
                 descripcion, palabras_destacar, activo, created_at)
            VALUES
                (:id, :estilo, :pid, :tipo, :abv, :amargor,
                 :desc, :palabras, :activo, :created_at)
        """), {
            'id': d['id'], 'estilo': d['estilo'], 'pid': pid,
            'tipo': d['tipo'], 'abv': d.get('abv', ''),
            'amargor': d.get('amargor', ''), 'desc': d.get('descripcion', ''),
            'palabras': d.get('palabras_destacar', ''),
            'activo': d['activo'], 'created_at': d['created_at'],
        })

    conn.execute(text("DROP TABLE bv2_birras_old"))
    conn.commit()


def ensure_schema():
    with _get_engine().connect() as conn:
        # ── 0. Proveedores ───────────────────────────────────────────────────
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bv2_proveedores (
                id     INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT    NOT NULL UNIQUE,
                activo INTEGER NOT NULL DEFAULT 1
            )
        """))
        conn.commit()

        # ── 1. bv2_birras: crear nuevo o migrar esquema antiguo ──────────────
        table_exists = conn.execute(text(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='bv2_birras'"
        )).fetchone()

        if table_exists:
            cols = [r[1] for r in conn.execute(text("PRAGMA table_info(bv2_birras)")).fetchall()]
            if 'proveedor_id' not in cols:
                _migrate_birras_schema(conn)
        else:
            conn.execute(text("""
                CREATE TABLE bv2_birras (
                    id               INTEGER PRIMARY KEY AUTOINCREMENT,
                    estilo           TEXT    NOT NULL,
                    proveedor_id     INTEGER NOT NULL REFERENCES bv2_proveedores(id),
                    tipo             TEXT    NOT NULL DEFAULT 'B',
                    abv              TEXT    DEFAULT '',
                    amargor          TEXT    DEFAULT '',
                    descripcion      TEXT    DEFAULT '',
                    palabras_destacar TEXT   DEFAULT '',
                    activo           INTEGER NOT NULL DEFAULT 1,
                    created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
                    UNIQUE(estilo, proveedor_id)
                )
            """))
            conn.commit()

        # ── 2. Resto de tablas ───────────────────────────────────────────────
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bv2_personal (
                id     INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT    NOT NULL UNIQUE,
                activo INTEGER NOT NULL DEFAULT 1
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bv2_precios (
                tipo              TEXT PRIMARY KEY,
                precio_normal     INTEGER DEFAULT 0,
                precio_hora_santa INTEGER DEFAULT 0
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bv2_barriles (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                birra_id           INTEGER NOT NULL REFERENCES bv2_birras(id),
                litros             INTEGER NOT NULL DEFAULT 30,
                codigo             TEXT    DEFAULT '',
                estado             TEXT    NOT NULL DEFAULT 'En Camara',
                canilla            INTEGER,
                ingreso_at         TEXT    NOT NULL DEFAULT (strftime('%d/%m/%Y','now')),
                fecha_pinchado     TEXT,
                nombre_pincho      TEXT,
                turno_pinchado     TEXT,
                fecha_despinchado  TEXT,
                nombre_despincho   TEXT,
                turno_despinchado  TEXT,
                fecha_retirado     TEXT,
                nota               TEXT    DEFAULT '',
                activo             INTEGER NOT NULL DEFAULT 1,
                created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
                updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bv2_visor_grupos (
                id      TEXT PRIMARY KEY,
                nombre  TEXT    NOT NULL,
                horario TEXT    DEFAULT '',
                orden   INTEGER NOT NULL DEFAULT 0,
                activo  INTEGER NOT NULL DEFAULT 1
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bv2_visor_items (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                grupo_id TEXT    NOT NULL REFERENCES bv2_visor_grupos(id),
                nombre   TEXT    NOT NULL,
                precio   TEXT    DEFAULT '',
                orden    INTEGER NOT NULL DEFAULT 0,
                activo   INTEGER NOT NULL DEFAULT 1
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bv2_menu_ejecutivo (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                label TEXT NOT NULL,
                value TEXT DEFAULT '',
                orden INTEGER NOT NULL DEFAULT 0
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS bv2_audit (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                barril_id  INTEGER,
                action     TEXT    NOT NULL,
                detalle    TEXT,
                usuario    TEXT,
                created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
            )
        """))
        conn.commit()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_date(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        d, m, y = str(s).strip().split('/')
        return datetime(int(y), int(m), int(d))
    except Exception:
        return None


def _today() -> str:
    from datetime import timezone, timedelta
    _ARG_TZ = timezone(timedelta(hours=-3))
    return datetime.now(_ARG_TZ).strftime('%d/%m/%Y')


def _now_ts() -> str:
    from datetime import timezone, timedelta
    _ARG_TZ = timezone(timedelta(hours=-3))
    return datetime.now(_ARG_TZ).strftime('%Y-%m-%d %H:%M:%S')


def _calc_estado(row: Dict) -> str:
    if row.get('fecha_retirado'):
        return 'Retirada'
    if row.get('fecha_despinchado'):
        return 'Para Retirar'
    if row.get('fecha_pinchado'):
        return 'Pinchada'
    return 'En Camara'


def _calc_dias_pinchado(row: Dict) -> Optional[int]:
    fp = _parse_date(row.get('fecha_pinchado'))
    if not fp:
        return None
    fd = _parse_date(row.get('fecha_despinchado'))
    end = fd if fd else datetime.now()
    return max(0, (end.date() - fp.date()).days)


def _calc_dias_retirado(row: Dict) -> Optional[int]:
    fr = _parse_date(row.get('fecha_retirado'))
    if fr:
        return max(0, (datetime.now().date() - fr.date()).days)
    fd = _parse_date(row.get('fecha_despinchado'))
    if fd:
        return max(0, (datetime.now().date() - fd.date()).days)
    return None


def _enrich(row: Dict, birras_map: Dict[int, Dict], precios_map: Optional[Dict] = None) -> Dict:
    birra = birras_map.get(row.get('birra_id'), {})
    result = dict(row)
    result.update({
        'estilo':           birra.get('estilo', ''),
        'proveedor':        birra.get('proveedor', ''),
        'proveedor_id':     birra.get('proveedor_id'),
        'tipo':             birra.get('tipo', ''),
        'abv':              birra.get('abv', ''),
        'amargor':          birra.get('amargor', ''),
        'descripcion':      birra.get('descripcion', ''),
        'palabras_destacar': birra.get('palabras_destacar', ''),
        'dias_pinchado':    _calc_dias_pinchado(row),
        'dias_retirado':    _calc_dias_retirado(row),
    })
    if precios_map is not None:
        tipo = birra.get('tipo', '')
        precio_info = precios_map.get(tipo, {})
        result['precio']             = precio_info.get('precio_normal', '')
        result['precio_hora_santa']  = precio_info.get('precio_hora_santa', '')
    return result


def _birras_map(conn) -> Dict[int, Dict]:
    rows = conn.execute(text(
        "SELECT b.id, b.estilo, p.nombre AS proveedor, b.proveedor_id, b.tipo, "
        "b.abv, b.amargor, b.descripcion, b.palabras_destacar "
        "FROM bv2_birras b LEFT JOIN bv2_proveedores p ON p.id = b.proveedor_id"
    )).fetchall()
    return {r[0]: dict(r._mapping) for r in rows}


def _precios_map(conn) -> Dict[str, Dict]:
    rows = conn.execute(text("SELECT * FROM bv2_precios")).fetchall()
    return {r[0]: dict(r._mapping) for r in rows}


# ─── Proveedores ─────────────────────────────────────────────────────────────

def get_proveedores(include_inactive: bool = False) -> List[Dict]:
    ensure_schema()
    cond = "" if include_inactive else "WHERE activo = 1"
    with _get_engine().connect() as conn:
        rows = conn.execute(text(
            f"SELECT * FROM bv2_proveedores {cond} ORDER BY nombre"
        )).fetchall()
    return [dict(r._mapping) for r in rows]


def create_proveedor(nombre: str) -> Dict:
    ensure_schema()
    with _get_engine().connect() as conn:
        r = conn.execute(text(
            "INSERT INTO bv2_proveedores (nombre) VALUES (:nombre)"
        ), {'nombre': nombre.strip()})
        row = conn.execute(text(
            "SELECT * FROM bv2_proveedores WHERE id = :id"
        ), {'id': r.lastrowid}).fetchone()
        conn.commit()
    return dict(row._mapping)


def update_proveedor(proveedor_id: int,
                     nombre: Optional[str] = None,
                     activo: Optional[int] = None) -> Optional[Dict]:
    ensure_schema()
    sets, params = [], {'id': proveedor_id}
    if nombre is not None:
        sets.append("nombre = :nombre"); params['nombre'] = nombre.strip()
    if activo is not None:
        sets.append("activo = :activo"); params['activo'] = activo
    if not sets:
        raise ValueError("Nada que actualizar")
    with _get_engine().connect() as conn:
        conn.execute(text(
            f"UPDATE bv2_proveedores SET {', '.join(sets)} WHERE id = :id"
        ), params)
        row = conn.execute(text(
            "SELECT * FROM bv2_proveedores WHERE id = :id"
        ), {'id': proveedor_id}).fetchone()
        conn.commit()
    return dict(row._mapping) if row else None


# ─── Birras ──────────────────────────────────────────────────────────────────

def get_birras(include_inactive: bool = False) -> List[Dict]:
    ensure_schema()
    cond = "" if include_inactive else "WHERE b.activo = 1"
    with _get_engine().connect() as conn:
        rows = conn.execute(text(f"""
            SELECT b.id, b.estilo, b.proveedor_id, p.nombre AS proveedor,
                   b.tipo, b.abv, b.amargor, b.descripcion, b.palabras_destacar,
                   b.activo, b.created_at
            FROM bv2_birras b
            LEFT JOIN bv2_proveedores p ON p.id = b.proveedor_id
            {cond}
            ORDER BY b.estilo
        """)).fetchall()
    return [dict(r._mapping) for r in rows]


def create_birra(estilo: str, proveedor_id: int, tipo: str = 'B',
                 abv: str = '', amargor: str = '', descripcion: str = '',
                 palabras_destacar: str = '') -> Dict:
    ensure_schema()
    with _get_engine().connect() as conn:
        r = conn.execute(text("""
            INSERT INTO bv2_birras
                (estilo, proveedor_id, tipo, abv, amargor, descripcion, palabras_destacar)
            VALUES
                (:estilo, :proveedor_id, :tipo, :abv, :amargor, :descripcion, :palabras)
        """), {
            'estilo': estilo.strip(), 'proveedor_id': proveedor_id,
            'tipo': tipo.strip().upper(), 'abv': abv.strip(),
            'amargor': amargor.strip(), 'descripcion': descripcion.strip(),
            'palabras': palabras_destacar.strip(),
        })
        row = conn.execute(text("""
            SELECT b.id, b.estilo, b.proveedor_id, p.nombre AS proveedor,
                   b.tipo, b.abv, b.amargor, b.descripcion, b.palabras_destacar,
                   b.activo, b.created_at
            FROM bv2_birras b
            LEFT JOIN bv2_proveedores p ON p.id = b.proveedor_id
            WHERE b.id = :id
        """), {'id': r.lastrowid}).fetchone()
        conn.commit()
    return dict(row._mapping)


def update_birra(birra_id: int, **kwargs) -> Optional[Dict]:
    ensure_schema()
    allowed = {'estilo', 'proveedor_id', 'tipo', 'abv', 'amargor',
               'descripcion', 'palabras_destacar', 'activo'}
    sets, params = [], {'id': birra_id}
    for k, v in kwargs.items():
        if k in allowed and v is not None:
            sets.append(f"{k} = :{k}")
            params[k] = v.strip() if isinstance(v, str) else v
    if not sets:
        raise ValueError("Nada que actualizar")
    with _get_engine().connect() as conn:
        conn.execute(text(f"UPDATE bv2_birras SET {', '.join(sets)} WHERE id = :id"), params)
        row = conn.execute(text("""
            SELECT b.id, b.estilo, b.proveedor_id, p.nombre AS proveedor,
                   b.tipo, b.abv, b.amargor, b.descripcion, b.palabras_destacar,
                   b.activo, b.created_at
            FROM bv2_birras b
            LEFT JOIN bv2_proveedores p ON p.id = b.proveedor_id
            WHERE b.id = :id
        """), {'id': birra_id}).fetchone()
        conn.commit()
    return dict(row._mapping) if row else None


# ─── Personal ────────────────────────────────────────────────────────────────

def get_personal(include_inactive: bool = False) -> List[str]:
    ensure_schema()
    cond = "" if include_inactive else "WHERE activo = 1"
    with _get_engine().connect() as conn:
        rows = conn.execute(text(f"SELECT nombre FROM bv2_personal {cond} ORDER BY nombre")).fetchall()
    return [r[0] for r in rows]


def get_personal_full(include_inactive: bool = False) -> List[Dict]:
    ensure_schema()
    cond = "" if include_inactive else "WHERE activo = 1"
    with _get_engine().connect() as conn:
        rows = conn.execute(text(f"SELECT * FROM bv2_personal {cond} ORDER BY nombre")).fetchall()
    return [dict(r._mapping) for r in rows]


def create_personal(nombre: str) -> Dict:
    ensure_schema()
    with _get_engine().connect() as conn:
        r = conn.execute(text("INSERT INTO bv2_personal (nombre) VALUES (:nombre)"),
                         {'nombre': nombre.strip()})
        row = conn.execute(text("SELECT * FROM bv2_personal WHERE id = :id"), {'id': r.lastrowid}).fetchone()
        conn.commit()
    return dict(row._mapping)


def update_personal(personal_id: int, nombre: Optional[str] = None,
                    activo: Optional[int] = None) -> Optional[Dict]:
    ensure_schema()
    sets, params = [], {'id': personal_id}
    if nombre is not None:
        sets.append("nombre = :nombre"); params['nombre'] = nombre.strip()
    if activo is not None:
        sets.append("activo = :activo"); params['activo'] = activo
    if not sets:
        raise ValueError("Nada que actualizar")
    with _get_engine().connect() as conn:
        conn.execute(text(f"UPDATE bv2_personal SET {', '.join(sets)} WHERE id = :id"), params)
        row = conn.execute(text("SELECT * FROM bv2_personal WHERE id = :id"), {'id': personal_id}).fetchone()
        conn.commit()
    return dict(row._mapping) if row else None


# ─── Precios ─────────────────────────────────────────────────────────────────

def get_precios() -> List[Dict]:
    ensure_schema()
    with _get_engine().connect() as conn:
        rows = conn.execute(text("SELECT * FROM bv2_precios ORDER BY tipo")).fetchall()
    return [dict(r._mapping) for r in rows]


def upsert_precio(tipo: str, precio_normal: int = 0,
                  precio_hora_santa: int = 0) -> Dict:
    ensure_schema()
    with _get_engine().connect() as conn:
        conn.execute(text("""
            INSERT INTO bv2_precios (tipo, precio_normal, precio_hora_santa)
            VALUES (:tipo, :pn, :phs)
            ON CONFLICT(tipo) DO UPDATE SET
                precio_normal     = excluded.precio_normal,
                precio_hora_santa = excluded.precio_hora_santa
        """), {'tipo': tipo.upper(), 'pn': precio_normal, 'phs': precio_hora_santa})
        row = conn.execute(text("SELECT * FROM bv2_precios WHERE tipo = :tipo"),
                           {'tipo': tipo.upper()}).fetchone()
        conn.commit()
    return dict(row._mapping)


def sync_precios_from_sheets() -> Dict:
    """Sincroniza precios desde la hoja PETS del Google Sheets público."""
    import csv, io, urllib.request

    URL = (
        'https://docs.google.com/spreadsheets/d'
        '/1P04HAcUGN4tE-wgyMCIe7rNsTa5qIbckL8fMW7meTzk'
        '/export?format=csv&gid=123985121'
    )
    NAME_TO_TIPO = {
        'pinta a': 'A', 'pinta b': 'B', 'pinta c': 'C',
        'pinta d': 'D', 'pinta e': 'E',
        'gin tonic tirado': 'GIN', 'tinto de verano': 'T',
    }

    req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        csv_text = resp.read().decode('utf-8')

    updated = []
    reader = csv.reader(io.StringIO(csv_text))
    for row in reader:
        if len(row) < 2:
            continue
        nombre = row[0].strip().lower()
        precio_str = (row[1].strip()
                      .replace('$', '').replace('.', '').replace(',', '').strip())
        tipo = NAME_TO_TIPO.get(nombre)
        if not tipo or not precio_str:
            continue
        try:
            precio = int(precio_str)
        except ValueError:
            continue
        upsert_precio(tipo, precio, 0)
        updated.append({'tipo': tipo, 'precio_normal': precio})

    return {'updated': updated, 'count': len(updated)}


# ─── Auditoría ───────────────────────────────────────────────────────────────

def get_audit(limit: int = 500, barril_id: Optional[int] = None) -> List[Dict]:
    ensure_schema()
    with _get_engine().connect() as conn:
        if barril_id is not None:
            rows = conn.execute(text(
                "SELECT a.id, a.barril_id, a.action, a.detalle, a.usuario, a.created_at, "
                "COALESCE(bi.estilo, '—') AS estilo "
                "FROM bv2_audit a "
                "LEFT JOIN bv2_barriles br ON br.id = a.barril_id "
                "LEFT JOIN bv2_birras bi ON bi.id = br.birra_id "
                "WHERE a.barril_id = :bid "
                "ORDER BY a.created_at DESC LIMIT :lim"
            ), {'bid': barril_id, 'lim': limit}).fetchall()
        else:
            rows = conn.execute(text(
                "SELECT a.id, a.barril_id, a.action, a.detalle, a.usuario, a.created_at, "
                "COALESCE(bi.estilo, '—') AS estilo "
                "FROM bv2_audit a "
                "LEFT JOIN bv2_barriles br ON br.id = a.barril_id "
                "LEFT JOIN bv2_birras bi ON bi.id = br.birra_id "
                "ORDER BY a.created_at DESC LIMIT :lim"
            ), {'lim': limit}).fetchall()
    return [dict(r._mapping) for r in rows]


# ─── Barriles ────────────────────────────────────────────────────────────────

_ESTADO_ORDER = "CASE estado WHEN 'Pinchada' THEN 0 WHEN 'En Camara' THEN 1 WHEN 'Para Retirar' THEN 2 ELSE 3 END"


def get_barriles(filtro: Optional[str] = None) -> List[Dict]:
    """filtro: 'activos' | 'historial' | None"""
    ensure_schema()
    ACTIVOS   = {'En Camara', 'Pinchada'}
    HISTORIAL = {'Para Retirar', 'Retirada'}

    with _get_engine().connect() as conn:
        bmap = _birras_map(conn)
        pmap = _precios_map(conn)
        rows = conn.execute(text(
            f"SELECT * FROM bv2_barriles WHERE activo = 1 "
            f"ORDER BY {_ESTADO_ORDER}, canilla, ingreso_at DESC"
        )).fetchall()

    result = []
    for r in rows:
        d = dict(r._mapping)
        if filtro == 'activos'   and d['estado'] not in ACTIVOS:   continue
        if filtro == 'historial' and d['estado'] not in HISTORIAL: continue
        result.append(_enrich(d, bmap, pmap))
    return result


def get_barril(barril_id: int) -> Optional[Dict]:
    ensure_schema()
    with _get_engine().connect() as conn:
        row = conn.execute(text("SELECT * FROM bv2_barriles WHERE id = :id"),
                           {'id': barril_id}).fetchone()
        if not row:
            return None
        bmap = _birras_map(conn)
        pmap = _precios_map(conn)
    return _enrich(dict(row._mapping), bmap, pmap)


def create_barril(birra_id: int, litros: int, codigo: str = '',
                  ingreso_at: Optional[str] = None, nota: str = '',
                  usuario: Optional[str] = None) -> Dict:
    ensure_schema()
    fecha = ingreso_at or _today()
    with _get_engine().connect() as conn:
        r = conn.execute(text("""
            INSERT INTO bv2_barriles (birra_id, litros, codigo, ingreso_at, nota, estado)
            VALUES (:birra_id, :litros, :codigo, :ingreso_at, :nota, 'En Camara')
        """), {'birra_id': birra_id, 'litros': litros,
               'codigo': codigo.strip(), 'ingreso_at': fecha, 'nota': nota.strip()})
        bid = r.lastrowid
        _audit(conn, bid, 'ingreso', f'{litros}L, ingreso {fecha}', usuario)
        conn.commit()
    return get_barril(bid)


def update_barril(barril_id: int, usuario: Optional[str] = None, **kwargs) -> Optional[Dict]:
    ensure_schema()
    UPDATABLE = {
        'litros', 'codigo', 'canilla', 'ingreso_at',
        'fecha_pinchado', 'nombre_pincho', 'turno_pinchado',
        'fecha_despinchado', 'nombre_despincho', 'turno_despinchado',
        'fecha_retirado', 'nota',
    }
    with _get_engine().connect() as conn:
        current = conn.execute(
            text("SELECT * FROM bv2_barriles WHERE id = :id"), {'id': barril_id}
        ).fetchone()
        if not current:
            return None
        curr = dict(current._mapping)

        sets   = ["updated_at = :_ts"]
        params: Dict[str, Any] = {'id': barril_id, '_ts': _now_ts()}
        changes = []

        for k, v in kwargs.items():
            if k not in UPDATABLE:
                continue
            old = curr.get(k)
            sets.append(f"{k} = :{k}")
            params[k] = v
            if str(old or '') != str(v or ''):
                changes.append(f"{k}: {old!r}→{v!r}")

        merged = {**curr, **{k: kwargs[k] for k in UPDATABLE if k in kwargs}}
        nuevo_estado = _calc_estado(merged)
        sets.append("estado = :_estado")
        params['_estado'] = nuevo_estado

        if 'fecha_despinchado' in kwargs and kwargs.get('fecha_despinchado'):
            if 'canilla' not in kwargs:
                sets.append("canilla = NULL")

        conn.execute(text(f"UPDATE bv2_barriles SET {', '.join(sets)} WHERE id = :id"), params)
        if changes:
            _audit(conn, barril_id, 'update', '; '.join(changes), usuario)
        conn.commit()
    return get_barril(barril_id)


def delete_barril(barril_id: int, usuario: Optional[str] = None) -> bool:
    ensure_schema()
    with _get_engine().connect() as conn:
        conn.execute(text(
            "UPDATE bv2_barriles SET activo = 0, updated_at = :ts WHERE id = :id"
        ), {'id': barril_id, 'ts': _now_ts()})
        _audit(conn, barril_id, 'delete', None, usuario)
        conn.commit()
    return True


def _audit(conn, barril_id: Optional[int], action: str,
           detalle: Optional[str], usuario: Optional[str]):
    conn.execute(text("""
        INSERT INTO bv2_audit (barril_id, action, detalle, usuario)
        VALUES (:bid, :action, :detalle, :usuario)
    """), {'bid': barril_id, 'action': action,
           'detalle': detalle, 'usuario': usuario})


# ─── Visor ───────────────────────────────────────────────────────────────────

def get_visor_barriles() -> List[Dict]:
    ensure_schema()
    with _get_engine().connect() as conn:
        bmap = _birras_map(conn)
        pmap = _precios_map(conn)
        rows = conn.execute(text(
            "SELECT * FROM bv2_barriles WHERE estado = 'Pinchada' AND activo = 1 ORDER BY canilla"
        )).fetchall()
    return [_enrich(dict(r._mapping), bmap, pmap) for r in rows]


def get_visor2() -> Dict:
    ensure_schema()
    with _get_engine().connect() as conn:
        grupos = conn.execute(text(
            "SELECT * FROM bv2_visor_grupos WHERE activo = 1 ORDER BY orden, id"
        )).fetchall()
        items = conn.execute(text(
            "SELECT * FROM bv2_visor_items WHERE activo = 1 ORDER BY grupo_id, orden, id"
        )).fetchall()
        menu = conn.execute(text(
            "SELECT * FROM bv2_menu_ejecutivo ORDER BY orden, id"
        )).fetchall()

    items_by_grupo: Dict[str, List] = {}
    for item in items:
        d = dict(item._mapping)
        items_by_grupo.setdefault(d['grupo_id'], []).append(
            {'id': d['id'], 'nombre': d['nombre'], 'precio': d['precio'], 'orden': d.get('orden', 0)}
        )

    from .promo_rules import is_group_visible
    groups = [{
        'id': gd['id'], 'nombre': gd['nombre'], 'horario': gd['horario'],
        'orden': gd.get('orden', 0),
        'items': items_by_grupo.get(gd['id'], []),
        'visible': is_group_visible(gd['nombre']),
    } for gd in (dict(g._mapping) for g in grupos)]

    return {
        'groups': groups,
        'menu_ejecutivo': [dict(m._mapping) for m in menu],
    }


def upsert_visor_grupo(grupo_id: str, nombre: str, horario: str = '',
                       orden: int = 0) -> Dict:
    ensure_schema()
    with _get_engine().connect() as conn:
        conn.execute(text("""
            INSERT INTO bv2_visor_grupos (id, nombre, horario, orden)
            VALUES (:id, :nombre, :horario, :orden)
            ON CONFLICT(id) DO UPDATE SET
                nombre  = excluded.nombre,
                horario = excluded.horario,
                orden   = excluded.orden
        """), {'id': grupo_id, 'nombre': nombre, 'horario': horario, 'orden': orden})
        conn.commit()
    return {'id': grupo_id, 'nombre': nombre, 'horario': horario, 'orden': orden}


def upsert_visor_item(grupo_id: str, nombre: str, precio: str = '',
                      orden: int = 0, item_id: Optional[int] = None) -> Dict:
    ensure_schema()
    with _get_engine().connect() as conn:
        if item_id:
            conn.execute(text("""
                UPDATE bv2_visor_items SET nombre = :nombre, precio = :precio, orden = :orden
                WHERE id = :id
            """), {'nombre': nombre, 'precio': precio, 'orden': orden, 'id': item_id})
            rid = item_id
        else:
            r = conn.execute(text("""
                INSERT INTO bv2_visor_items (grupo_id, nombre, precio, orden)
                VALUES (:grupo_id, :nombre, :precio, :orden)
            """), {'grupo_id': grupo_id, 'nombre': nombre, 'precio': precio, 'orden': orden})
            rid = r.lastrowid
        conn.commit()
    return {'id': rid, 'grupo_id': grupo_id, 'nombre': nombre, 'precio': precio}


def delete_visor_item(item_id: int) -> bool:
    ensure_schema()
    with _get_engine().connect() as conn:
        conn.execute(text("UPDATE bv2_visor_items SET activo = 0 WHERE id = :id"), {'id': item_id})
        conn.commit()
    return True


def upsert_menu_ejecutivo_item(item_id: Optional[int], label: str, value: str = '',
                               orden: int = 0) -> Dict:
    ensure_schema()
    with _get_engine().connect() as conn:
        if item_id:
            conn.execute(text("""
                UPDATE bv2_menu_ejecutivo SET label = :label, value = :value, orden = :orden
                WHERE id = :id
            """), {'label': label, 'value': value, 'orden': orden, 'id': item_id})
            rid = item_id
        else:
            r = conn.execute(text("""
                INSERT INTO bv2_menu_ejecutivo (label, value, orden) VALUES (:label, :value, :orden)
            """), {'label': label, 'value': value, 'orden': orden})
            rid = r.lastrowid
        conn.commit()
    return {'id': rid, 'label': label, 'value': value}


def delete_menu_ejecutivo_item(item_id: int) -> bool:
    ensure_schema()
    with _get_engine().connect() as conn:
        conn.execute(text("DELETE FROM bv2_menu_ejecutivo WHERE id = :id"), {'id': item_id})
        conn.commit()
    return True


# ─── Migración desde Google Sheets ───────────────────────────────────────────

def _get_or_create_proveedor(conn, nombre: str) -> int:
    nombre = (nombre or '').strip() or 'Sin proveedor'
    row = conn.execute(
        text("SELECT id FROM bv2_proveedores WHERE nombre = :n"), {'n': nombre}
    ).fetchone()
    if row:
        return row[0]
    r = conn.execute(
        text("INSERT INTO bv2_proveedores (nombre) VALUES (:n)"), {'n': nombre}
    )
    conn.commit()
    return r.lastrowid


def migrar_desde_sheets(usuario: Optional[str] = None) -> Dict:
    ensure_schema()
    log: List[str] = []

    try:
        from .barriles_service import (
            get_barriles as sheets_barriles,
            get_personal as sheets_personal,
            get_catalogo_birras,
            get_info_birras_con_precio,
            get_carteleria_visor2,
        )
    except Exception as e:
        return {'error': f'No se pudo cargar servicio de Sheets: {e}', 'log': []}

    with _get_engine().connect() as conn:

        # ── 1. Catálogo de birras ─────────────────────────────────────────────
        try:
            birras_sheet = get_catalogo_birras(sucursal_id="1")
            for b in birras_sheet:
                estilo = (b.get('estilo') or '').strip()
                if not estilo:
                    continue
                prov_nombre = (b.get('productor') or '').strip()
                pid = _get_or_create_proveedor(conn, prov_nombre)
                tipo = (b.get('tipo') or 'B').strip().upper() or 'B'
                conn.execute(text("""
                    INSERT OR IGNORE INTO bv2_birras (estilo, proveedor_id, tipo)
                    VALUES (:estilo, :pid, :tipo)
                """), {'estilo': estilo, 'pid': pid, 'tipo': tipo})
            conn.commit()
            log.append(f'Birras: {len(birras_sheet)} procesadas')
        except Exception as e:
            log.append(f'ERROR birras: {e}')

        # ── 2. Personal ───────────────────────────────────────────────────────
        try:
            personal_sheet = sheets_personal(sucursal_id="1")
            for nombre in personal_sheet:
                if nombre.strip():
                    conn.execute(text("INSERT OR IGNORE INTO bv2_personal (nombre) VALUES (:n)"),
                                 {'n': nombre.strip()})
            conn.commit()
            log.append(f'Personal: {len(personal_sheet)} procesados')
        except Exception as e:
            log.append(f'ERROR personal: {e}')

        # ── 3. Precios ────────────────────────────────────────────────────────
        try:
            info = get_info_birras_con_precio(sucursal_id="1")
            precios: Dict[str, int] = {}
            for b in info.get('birras', []):
                tipo = (b.get('codigo') or '').strip().upper()
                precio_str = str(b.get('precio') or '').replace('$', '').replace('.', '').replace(',', '').strip()
                if tipo and precio_str.isdigit():
                    precios[tipo] = int(precio_str)

            hs_str = str(info.get('hora_santa_precio') or '').replace('$', '').replace('.', '').replace(',', '').strip()
            hs = int(hs_str) if hs_str.isdigit() else 0

            for tipo, precio in precios.items():
                conn.execute(text("""
                    INSERT INTO bv2_precios (tipo, precio_normal, precio_hora_santa)
                    VALUES (:tipo, :pn, :phs)
                    ON CONFLICT(tipo) DO UPDATE SET
                        precio_normal = excluded.precio_normal,
                        precio_hora_santa = excluded.precio_hora_santa
                """), {'tipo': tipo, 'pn': precio, 'phs': hs if tipo == 'B' else 0})
            conn.commit()
            log.append(f'Precios: {len(precios)} tipos')
        except Exception as e:
            log.append(f'ERROR precios: {e}')

        # ── 4. Barriles (activos + historial) ────────────────────────────────
        try:
            # Map (estilo lower, proveedor_id) → birra_id
            birras_rows = conn.execute(text(
                "SELECT id, estilo, proveedor_id FROM bv2_birras"
            )).fetchall()
            estilo_to_id: Dict[str, int] = {r[1].lower(): r[0] for r in birras_rows}

            all_barriles: List[Dict] = []
            for filtro in ('activos', 'historial'):
                try:
                    all_barriles += sheets_barriles(filtro=filtro, sucursal_id='1')
                except Exception as e:
                    log.append(f'  WARN {filtro}: {e}')

            existing_count = conn.execute(
                text("SELECT COUNT(*) FROM bv2_barriles")
            ).fetchone()[0]

            if existing_count > 0:
                log.append(f'Barriles: ya existen {existing_count} — omitiendo reimportación')
            else:
                imported = skipped = 0
                ESTADO_MAP = {
                    'Pinchada': 'Pinchada', 'En Camara': 'En Camara',
                    'Para Retirar': 'Para Retirar', 'Retirada': 'Retirada', 'N/A': 'En Camara',
                }
                for b in all_barriles:
                    estilo = (b.get('estilo') or '').strip()
                    if not estilo:
                        continue

                    birra_id = estilo_to_id.get(estilo.lower())
                    if not birra_id:
                        tp = (b.get('tp') or 'B').strip().upper() or 'B'
                        prov = (b.get('proveedor') or '').strip()
                        pid = _get_or_create_proveedor(conn, prov)
                        conn.execute(text("""
                            INSERT OR IGNORE INTO bv2_birras (estilo, proveedor_id, tipo)
                            VALUES (:e, :pid, :t)
                        """), {'e': estilo, 'pid': pid, 't': tp})
                        conn.commit()
                        row = conn.execute(
                            text("SELECT id FROM bv2_birras WHERE estilo = :e"), {'e': estilo}
                        ).fetchone()
                        if not row:
                            skipped += 1
                            continue
                        birra_id = row[0]
                        estilo_to_id[estilo.lower()] = birra_id

                    litros_raw = b.get('litros_barril') or 30
                    try:
                        litros = int(float(str(litros_raw)))
                    except Exception:
                        litros = 30

                    estado_raw = (b.get('estado') or '').strip()
                    estado = ESTADO_MAP.get(estado_raw, 'En Camara')

                    canilla_raw = b.get('canilla', '')
                    canilla: Optional[int] = None
                    if canilla_raw:
                        try:
                            canilla = int(str(canilla_raw).strip())
                        except Exception:
                            pass

                    def _clean(v): return (str(v).strip() or None) if v else None

                    conn.execute(text("""
                        INSERT INTO bv2_barriles
                            (birra_id, litros, codigo, estado, canilla, ingreso_at,
                             fecha_pinchado, nombre_pincho, turno_pinchado,
                             fecha_despinchado, nombre_despincho, turno_despinchado,
                             fecha_retirado)
                        VALUES
                            (:birra_id, :litros, :codigo, :estado, :canilla, :ingreso_at,
                             :fp, :np, :tp,
                             :fd, :nd, :td, :fr)
                    """), {
                        'birra_id': birra_id, 'litros': litros,
                        'codigo': _clean(b.get('codigo')) or '',
                        'estado': estado, 'canilla': canilla,
                        'ingreso_at': _clean(b.get('ingreso')) or _today(),
                        'fp': _clean(b.get('fecha_pinchado')),
                        'np': _clean(b.get('nombre_pincho')),
                        'tp': _clean(b.get('turno_pinchado')),
                        'fd': _clean(b.get('fecha_despinchado')),
                        'nd': _clean(b.get('nombre_despincho')),
                        'td': _clean(b.get('turno_despinchado')),
                        'fr': _clean(b.get('fecha_retirado')),
                    })
                    imported += 1

                conn.commit()
                log.append(f'Barriles: {imported} importados, {skipped} omitidos')
        except Exception as e:
            import traceback
            log.append(f'ERROR barriles: {e}')
            log.append(traceback.format_exc()[:400])

        # ── 5. Visor grupos/items ─────────────────────────────────────────────
        try:
            visor2 = get_carteleria_visor2(sucursal_id="1")
            grupos_count = 0
            for i, g in enumerate(visor2.get('groups', [])):
                gid = g['id']
                conn.execute(text("""
                    INSERT INTO bv2_visor_grupos (id, nombre, horario, orden)
                    VALUES (:id, :nombre, :horario, :orden)
                    ON CONFLICT(id) DO UPDATE SET
                        nombre = excluded.nombre, horario = excluded.horario, orden = excluded.orden
                """), {'id': gid, 'nombre': g['nombre'],
                       'horario': g.get('horario', ''), 'orden': i})
                for j, item in enumerate(g.get('items', [])):
                    conn.execute(text("""
                        INSERT INTO bv2_visor_items (grupo_id, nombre, precio, orden)
                        VALUES (:gid, :nombre, :precio, :orden)
                    """), {'gid': gid, 'nombre': item['nombre'],
                           'precio': item.get('precio', ''), 'orden': j})
                grupos_count += 1

            for i, item in enumerate(visor2.get('menu_ejecutivo', [])):
                conn.execute(text("""
                    INSERT INTO bv2_menu_ejecutivo (label, value, orden)
                    VALUES (:label, :value, :orden)
                """), {'label': item['label'], 'value': item['value'], 'orden': i})

            conn.commit()
            log.append(f'Visor: {grupos_count} grupos importados')
        except Exception as e:
            log.append(f'ERROR visor: {e}')

        _audit(conn, None, 'migrar', ' | '.join(log), usuario)
        conn.commit()

    return {'success': True, 'log': log}
