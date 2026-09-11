"""
Caché de estadísticas procesadas.

Guarda el resultado JSON de build_complete_statistics en SQLite para que
las consultas posteriores sean instantáneas (<100ms) sin reprocesar pandas.

Tabla stats_cache:
  id | location_key | start_date | end_date | generated_at | payload (JSON comprimido)
"""
import gzip
import json
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Optional, Dict, Any

from sqlalchemy import Column, Integer, Text, LargeBinary, MetaData, Table, create_engine, select, delete
from sqlalchemy.pool import StaticPool

_DB_PATH = Path(__file__).parent.parent.parent / "stats_cache.db"
_DB_URL = f"sqlite:///{_DB_PATH.as_posix()}"

_meta = MetaData()
_cache_table = Table(
    "stats_cache",
    _meta,
    Column("id", Integer, primary_key=True),
    Column("location_key", Text, nullable=False),   # "palermo" | "recoleta" | "ambas"
    Column("start_date", Text),                      # "2026-01-01" o None
    Column("end_date", Text),                        # "2026-04-29" o None
    Column("turno", Text),                           # "manana" | "noche" | None
    Column("generated_at", Text, nullable=False),    # ISO datetime
    Column("payload", LargeBinary, nullable=False),  # JSON gzippeado
)


@lru_cache(maxsize=1)
def _engine():
    return create_engine(
        _DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )


def _ensure():
    import sqlite3 as _sqlite3
    conn = _sqlite3.connect(str(_DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS stats_cache (
            id        INTEGER PRIMARY KEY,
            location_key TEXT NOT NULL,
            start_date   TEXT,
            end_date     TEXT,
            turno        TEXT,
            generated_at TEXT NOT NULL,
            payload      BLOB NOT NULL
        )
    """)
    # Migración: agregar columna turno si no existe
    existing = {r[1] for r in conn.execute("PRAGMA table_info(stats_cache)").fetchall()}
    if "turno" not in existing:
        conn.execute("ALTER TABLE stats_cache ADD COLUMN turno TEXT")
    conn.commit()
    conn.close()


_ensure()


def _key(location_key: str, start_date: Optional[date], end_date: Optional[date], turno: Optional[str] = None) -> tuple:
    return (
        location_key,
        start_date.isoformat() if start_date else None,
        end_date.isoformat() if end_date else None,
        turno if turno in ("manana", "noche") else None,
    )


def get_cached(
    location_key: str,
    start_date: Optional[date],
    end_date: Optional[date],
    turno: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Devuelve el resultado cacheado si existe, o None."""
    loc, sd, ed, tn = _key(location_key, start_date, end_date, turno)
    with _engine().connect() as conn:
        row = conn.execute(
            select(_cache_table).where(
                _cache_table.c.location_key == loc,
                _cache_table.c.start_date == sd,
                _cache_table.c.end_date == ed,
                _cache_table.c.turno == tn,
            ).order_by(_cache_table.c.generated_at.desc()).limit(1)
        ).fetchone()

    if not row:
        return None

    try:
        payload = gzip.decompress(row.payload)
        return json.loads(payload)
    except Exception:
        return None


def save_cache(
    location_key: str,
    start_date: Optional[date],
    end_date: Optional[date],
    data: Dict[str, Any],
    turno: Optional[str] = None,
) -> None:
    """Guarda el resultado en caché, reemplazando el anterior para el mismo rango."""
    loc, sd, ed, tn = _key(location_key, start_date, end_date, turno)
    payload = gzip.compress(json.dumps(data, ensure_ascii=False).encode())
    generated_at = datetime.now().isoformat()

    with _engine().begin() as conn:
        # Borrar entrada anterior para el mismo rango
        conn.execute(
            delete(_cache_table).where(
                _cache_table.c.location_key == loc,
                _cache_table.c.start_date == sd,
                _cache_table.c.end_date == ed,
                _cache_table.c.turno == tn,
            )
        )
        conn.execute(_cache_table.insert(), {
            "location_key": loc,
            "start_date": sd,
            "end_date": ed,
            "turno": tn,
            "generated_at": generated_at,
            "payload": payload,
        })


def invalidate(
    location_key: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> int:
    """
    Invalida entradas del caché.
    - Sin argumentos: borra todo
    - Con location_key: borra esa sucursal
    - Con fechas: borra entradas que se solapan con el rango
    """
    with _engine().begin() as conn:
        stmt = delete(_cache_table)
        conditions = []

        if location_key and location_key != "ambas":
            conditions.append(_cache_table.c.location_key == location_key)

        if start_date and end_date:
            # Invalida entradas cuyo rango se solapa con el período actualizado
            sd_str = start_date.isoformat()
            ed_str = end_date.isoformat()
            conditions.append(
                # Solapamiento: cache_start <= end_date AND cache_end >= start_date
                # O entradas sin fecha (historial completo)
                (_cache_table.c.start_date == None) |
                (
                    (_cache_table.c.start_date <= ed_str) &
                    ((_cache_table.c.end_date == None) | (_cache_table.c.end_date >= sd_str))
                )
            )

        if conditions:
            from sqlalchemy import and_
            stmt = stmt.where(and_(*conditions))

        result = conn.execute(stmt)
        return result.rowcount


def list_cache_entries() -> list:
    """Lista todas las entradas del caché con metadata (sin payload)."""
    with _engine().connect() as conn:
        rows = conn.execute(
            select(
                _cache_table.c.id,
                _cache_table.c.location_key,
                _cache_table.c.start_date,
                _cache_table.c.end_date,
                _cache_table.c.generated_at,
            ).order_by(_cache_table.c.generated_at.desc())
        ).fetchall()

    return [
        {
            "id": r.id,
            "location_key": r.location_key,
            "start_date": r.start_date,
            "end_date": r.end_date,
            "generated_at": r.generated_at,
        }
        for r in rows
    ]


def get_cache_size_mb() -> float:
    """Devuelve el tamaño del archivo de caché en MB."""
    try:
        return round(_DB_PATH.stat().st_size / 1024 / 1024, 2)
    except Exception:
        return 0.0
