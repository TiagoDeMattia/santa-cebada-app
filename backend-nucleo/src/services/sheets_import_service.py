"""
Importación del historial de ventas y productos desde el Google Sheet público de Santa Cebada.

Spreadsheet: https://docs.google.com/spreadsheets/d/1CI2edMeDDSBCZroYwUSAaomZJT2NHSWdussEqdIOx-M
  - Hoja 1 (gid=59529192): HISTORIAL DE FACTURACION  → tabla sheets_ventas
  - Hoja 2: HISTORIAL DE PRODUCTOS VENDIDOS          → tabla sheets_productos

Uso:
    from sheets_import_service import importar_todo, get_info
    result = importar_todo()
"""
import csv
import io
import sqlite3
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Optional

import requests

SHEET_ID = "1CI2edMeDDSBCZroYwUSAaomZJT2NHSWdussEqdIOx-M"
GID_VENTAS = "59529192"

# historial_sheets.db en el mismo nivel que stats_cache.db (backend/)
DB_PATH = Path(__file__).resolve().parent.parent.parent / "historial_sheets.db"


# ─── Fetch ────────────────────────────────────────────────────────────────────

def _fetch_by_gid(gid: str) -> str:
    """Export directo por GID (sin límite de filas)."""
    url = (
        f"https://docs.google.com/spreadsheets/d/{SHEET_ID}"
        f"/export?format=csv&gid={gid}"
    )
    r = requests.get(url, allow_redirects=True, timeout=120)
    r.raise_for_status()
    return r.content.decode("utf-8-sig", errors="replace")


def _fetch_by_name(sheet_name: str) -> str:
    """Fetch via gviz/tq por nombre de hoja (hasta ~10k filas)."""
    url = (
        f"https://docs.google.com/spreadsheets/d/{SHEET_ID}"
        f"/gviz/tq?tqx=out:csv&sheet={urllib.parse.quote(sheet_name)}"
    )
    r = requests.get(url, allow_redirects=True, timeout=120)
    r.raise_for_status()
    return r.content.decode("utf-8-sig", errors="replace")


# ─── Parsers ─────────────────────────────────────────────────────────────────

def _parse_mes_anio(s: str) -> tuple[Optional[str], Optional[str]]:
    """'2-20' o '11-20'  →  ('2020-02-01', '2020-02')"""
    try:
        parts = s.strip().split("-")
        if len(parts) != 2:
            return None, None
        mes, anio = int(parts[0]), int(parts[1])
        anio_full = 2000 + anio if anio < 100 else anio
        fecha = f"{anio_full:04d}-{mes:02d}-01"
        mes_anio = f"{anio_full:04d}-{mes:02d}"
        return fecha, mes_anio
    except Exception:
        return None, None


def _parse_fecha_dma(s: str) -> tuple[Optional[str], Optional[str]]:
    """'3/2/2020'  →  ('2020-02-03', '2020-02')  (formato DD/MM/YYYY argentino)"""
    for fmt in ("%d/%m/%Y", "%m/%d/%Y"):
        try:
            dt = datetime.strptime(s.strip(), fmt)
            return dt.strftime("%Y-%m-%d"), dt.strftime("%Y-%m")
        except Exception:
            pass
    return None, None


# ─── DB setup ────────────────────────────────────────────────────────────────

def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sheets_ventas (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_venta INTEGER UNIQUE,
            fecha        TEXT NOT NULL,
            mes_anio     TEXT NOT NULL,
            ingreso      REAL,
            sucursal     TEXT,
            imported_at  TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sheets_productos (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha       TEXT NOT NULL,
            mes_anio    TEXT NOT NULL,
            nombre      TEXT NOT NULL,
            cantidad    INTEGER,
            total       REAL,
            imported_at TEXT DEFAULT (datetime('now')),
            UNIQUE(nombre, mes_anio)
        )
    """)
    conn.commit()
    return conn


# ─── Import ventas ────────────────────────────────────────────────────────────

def importar_ventas() -> dict:
    """
    Lee HISTORIAL DE FACTURACION (gid=59529192) e inserta en sheets_ventas.
    Formato: NUMERO_VENTA | FECHA (M-YY) | INGRESO | SUCURSAL
    """
    csv_text = _fetch_by_gid(GID_VENTAS)
    rows = list(csv.reader(io.StringIO(csv_text)))

    conn = _get_conn()
    inserted = skipped = 0

    for i, row in enumerate(rows):
        if i == 0:  # fila de cabecera del sheet
            continue
        if len(row) < 3:
            continue

        nro_raw = row[0].strip()
        fecha_raw = row[1].strip() if len(row) > 1 else ""
        ingreso_raw = row[2].strip() if len(row) > 2 else ""
        sucursal = row[3].strip() if len(row) > 3 else "Santa Cebada - Recoleta"

        # Ignorar filas de metadata ("ULTIMA ACTUALIZACION:", totales, etc.)
        if not nro_raw or not nro_raw.isdigit():
            continue

        fecha, mes_anio = _parse_mes_anio(fecha_raw)
        if not fecha:
            skipped += 1
            continue

        try:
            nro = int(nro_raw)
            ingreso = float(ingreso_raw.replace(",", ".") or "0")
            conn.execute(
                "INSERT OR IGNORE INTO sheets_ventas "
                "(numero_venta, fecha, mes_anio, ingreso, sucursal) "
                "VALUES (?, ?, ?, ?, ?)",
                (nro, fecha, mes_anio, ingreso, sucursal),
            )
            inserted += 1
        except Exception:
            skipped += 1

    conn.commit()
    conn.close()
    return {"inserted": inserted, "skipped": skipped}


# ─── Import productos ─────────────────────────────────────────────────────────

def importar_productos() -> dict:
    """
    Lee HISTORIAL DE PRODUCTOS VENDIDOS e inserta en sheets_productos.
    Formato: RANK | NOMBRE | CANTIDAD | TOTAL | FECHA (D/M/YYYY)
    """
    csv_text = _fetch_by_name("HISTORIAL DE PRODUCTOS VENDIDOS")
    rows = list(csv.reader(io.StringIO(csv_text)))

    conn = _get_conn()
    inserted = skipped = 0

    for i, row in enumerate(rows):
        if i == 0:  # fila de cabecera
            continue
        if len(row) < 4:
            continue

        nombre = row[1].strip() if len(row) > 1 else ""
        cantidad_raw = row[2].strip() if len(row) > 2 else ""
        total_raw = row[3].strip() if len(row) > 3 else ""
        fecha_raw = row[4].strip() if len(row) > 4 else ""

        # Ignorar filas sin nombre de producto o con metadata
        if not nombre or nombre in ("Descripción", "ULTIMA ACTUALIZACION:"):
            continue
        if not fecha_raw or not cantidad_raw:
            continue

        fecha, mes_anio = _parse_fecha_dma(fecha_raw)
        if not fecha:
            skipped += 1
            continue

        try:
            cantidad = int(float(cantidad_raw.replace(",", ".")))
            total = float(total_raw.replace(",", ".") or "0")
            conn.execute(
                "INSERT OR IGNORE INTO sheets_productos "
                "(fecha, mes_anio, nombre, cantidad, total) "
                "VALUES (?, ?, ?, ?, ?)",
                (fecha, mes_anio, nombre, cantidad, total),
            )
            inserted += 1
        except Exception:
            skipped += 1

    conn.commit()
    conn.close()
    return {"inserted": inserted, "skipped": skipped}


# ─── Import completo ──────────────────────────────────────────────────────────

def importar_todo() -> dict:
    """Importa ambas hojas. Idempotente (INSERT OR IGNORE)."""
    v = importar_ventas()
    p = importar_productos()
    return {
        "ventas": v,
        "productos": p,
        "total_insertados": v["inserted"] + p["inserted"],
    }


# ─── Info ─────────────────────────────────────────────────────────────────────

def get_info() -> dict:
    """Resumen de los datos importados."""
    if not DB_PATH.exists():
        return {"ventas": None, "productos": None}

    conn = sqlite3.connect(str(DB_PATH))
    try:
        def _q(sql):
            row = conn.execute(sql).fetchone()
            return row if row else (0, None, None, 0)

        v = _q("""
            SELECT COUNT(*), MIN(fecha), MAX(fecha), SUM(ingreso)
            FROM sheets_ventas
        """)
        p = _q("""
            SELECT COUNT(*), MIN(fecha), MAX(fecha), SUM(cantidad)
            FROM sheets_productos
        """)
        return {
            "ventas": {
                "total": v[0], "desde": v[1], "hasta": v[2],
                "ingreso_total": round(v[3] or 0, 2),
            },
            "productos": {
                "total": p[0], "desde": p[1], "hasta": p[2],
                "cantidad_total": int(p[3] or 0),
            },
        }
    finally:
        conn.close()
