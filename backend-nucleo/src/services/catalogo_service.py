"""
Servicio de catálogo de productos con caché en SQLite.

Estrategia de velocidad:
- JWT: caché en memoria con TTL de 50 min → elimina el login con Playwright en requests repetidos
- Catálogo: guardado en SQLite con timestamp → búsquedas y comparaciones en <1s
- Comparación: usa el catálogo cacheado de ambas sucursales, sin doble login
"""
import json
import os
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any

import sqlite3 as _sqlite3

import requests

from ..config import settings
from ..utils.logger import logger
from ..utils.helpers import normalizar_texto_comparacion

# ─── DB DE CATÁLOGO (sqlite3 puro, sin SQLAlchemy) ───────────────────────────
# Usa ~/.pm2/ para sortear ProtectHome=read-only del systemd pm2-tiago.service
_PM2_HOME = Path(os.environ.get("PM2_HOME", Path.home() / ".pm2"))
_DB_PATH = _PM2_HOME / "catalogo_cache.db"

_CACHE_TTL_MINUTES = 30


def _connect() -> _sqlite3.Connection:
    # isolation_level=None → autocommit mode; explicit BEGIN/COMMIT in write paths
    conn = _sqlite3.connect(str(_DB_PATH), timeout=30, check_same_thread=False, isolation_level=None)
    conn.row_factory = _sqlite3.Row
    return conn


def _ensure_schema() -> None:
    conn = _connect()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS catalogo (
                id          INTEGER PRIMARY KEY,
                sucursal_id TEXT NOT NULL,
                product_id  INTEGER,
                codigo      TEXT,
                nombre      TEXT,
                categoria   TEXT,
                subcategoria TEXT,
                activo      INTEGER DEFAULT 1,
                precio      REAL,
                alicuota_id INTEGER,
                company_id  INTEGER,
                raw_json    TEXT,
                cached_at   TEXT
            );
            CREATE TABLE IF NOT EXISTS catalogo_meta (
                id              INTEGER PRIMARY KEY,
                sucursal_id     TEXT NOT NULL UNIQUE,
                cached_at       TEXT,
                total_productos INTEGER
            );
        """)
    finally:
        conn.close()


_ensure_schema()


# ─── CACHÉ DE JWT EN MEMORIA ──────────────────────────────────────────────────

_jwt_cache: Dict[str, Dict] = {}
_JWT_TTL_SECONDS = 15 * 60


def _get_cached_jwt(sucursal_id: str) -> Optional[str]:
    entry = _jwt_cache.get(sucursal_id)
    if not entry:
        return None
    if (datetime.now() - entry["at"]).total_seconds() > _JWT_TTL_SECONDS:
        del _jwt_cache[sucursal_id]
        return None
    return entry["token"]


def _set_cached_jwt(sucursal_id: str, token: str):
    _jwt_cache[sucursal_id] = {"token": token, "at": datetime.now()}


def invalidate_jwt(sucursal_id: str):
    _jwt_cache.pop(sucursal_id, None)


# ─── LOGIN (mismos headers que scraper.py / estadistica_service) ─────────────

_API_BASE   = settings.nucleo_api_base
_ORIGIN_URL = "https://prod.nucleocheck.com"
_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0"

_SUCURSAL_MAP = {
    "1": {"email": settings.sucursal_recoleta_email, "company_id": settings.sucursal_recoleta_company_id, "nombre": "Recoleta"},
}


def _base_headers() -> dict:
    return {
        "User-Agent":   _USER_AGENT,
        "Accept":       "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Origin":       _ORIGIN_URL,
        "Referer":      _ORIGIN_URL,
    }


def _login_directo(sucursal_id: str) -> str:
    """Login a NucleoCheck con los mismos headers que scraper.py."""
    cached = _get_cached_jwt(sucursal_id)
    if cached:
        return cached

    suc = _SUCURSAL_MAP.get(sucursal_id)
    if not suc:
        raise ValueError(f"Sucursal desconocida: {sucursal_id}")

    logger.info(f"Login NucleoCheck para {suc['nombre']}...")
    with requests.Session() as session:
        # Paso 1 — LoginUser
        h1 = _base_headers()
        h1["Authorization"] = "Bearer"
        r1 = session.post(
            f"{_API_BASE}/Account/LoginUser",
            headers=h1,
            json={"CompanyId": suc["company_id"], "EmailUser": suc["email"],
                  "IsUserCheck": True, "Password": settings.nucleo_password},
            timeout=20,
        )
        r1.raise_for_status()
        token1 = r1.json().get("Token")
        if not token1:
            raise RuntimeError(f"LoginUser sin token. Resp: {r1.text[:200]}")

        # Paso 2 — ValidateToken
        h2 = _base_headers()
        h2["Authorization"] = f"Bearer {token1}"
        h2["jwt-Token"]     = token1
        h2.pop("Content-Type", None)
        r2 = session.post(f"{_API_BASE}/Account/ValidateToken", headers=h2, timeout=20)
        r2.raise_for_status()
        token = r2.json().get("NewToken")
        if not token:
            raise RuntimeError(f"ValidateToken sin NewToken. Resp: {r2.text[:200]}")

    _set_cached_jwt(sucursal_id, token)
    logger.info(f"Login OK para {suc['nombre']}")
    return token


def _make_session(sucursal_id: str) -> requests.Session:
    token   = _login_directo(sucursal_id)
    h       = _base_headers()
    h["Authorization"] = f"Bearer {token}"
    h["jwt-Token"]     = token
    session = requests.Session()
    session.headers.update(h)
    return session


# ─── CATÁLOGO CACHEADO ────────────────────────────────────────────────────────

def _get_cache_age(sucursal_id: str) -> Optional[float]:
    """Devuelve la edad del caché en minutos, o None si no existe."""
    try:
        conn = _connect()
        try:
            row = conn.execute(
                "SELECT cached_at FROM catalogo_meta WHERE sucursal_id = ?", (sucursal_id,)
            ).fetchone()
        finally:
            conn.close()
        if not row:
            return None
        cached_at = datetime.fromisoformat(row["cached_at"])
        return (datetime.now() - cached_at).total_seconds() / 60
    except Exception:
        return None


def _load_from_cache(sucursal_id: str) -> List[Dict]:
    try:
        conn = _connect()
        try:
            rows = conn.execute(
                "SELECT * FROM catalogo WHERE sucursal_id = ?", (sucursal_id,)
            ).fetchall()
        finally:
            conn.close()
        return [dict(r) for r in rows]
    except Exception:
        return []


def _save_to_cache(sucursal_id: str, productos: List[Dict]) -> None:
    cached_at = datetime.now().isoformat()
    rows = []
    for p in productos:
        price = None
        price_list = p.get("PriceListProducts") or []
        if price_list:
            price = float(price_list[0].get("Price") or 0) or None
        rows.append((
            sucursal_id,
            p.get("Id"),
            str(p.get("Code") or "").strip(),
            str(p.get("Name") or "").strip(),
            str(p.get("CategoryName") or "").strip(),
            str(p.get("SubCategoryName") or "").strip(),
            1 if p.get("IsActive", True) else 0,
            price,
            p.get("AlicuotaId"),
            p.get("CompanyId"),
            json.dumps(p),
            cached_at,
        ))

    conn = _connect()
    try:
        conn.execute("BEGIN")
        conn.execute("DELETE FROM catalogo WHERE sucursal_id = ?", (sucursal_id,))
        conn.execute("DELETE FROM catalogo_meta WHERE sucursal_id = ?", (sucursal_id,))
        if rows:
            conn.executemany(
                "INSERT INTO catalogo (sucursal_id, product_id, codigo, nombre, categoria, subcategoria, activo, precio, alicuota_id, company_id, raw_json, cached_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                rows
            )
        conn.execute(
            "INSERT INTO catalogo_meta (sucursal_id, cached_at, total_productos) VALUES (?, ?, ?)",
            (sucursal_id, cached_at, len(rows))
        )
        conn.commit()
        logger.info(f"Catalogo guardado: {len(rows)} productos para sucursal {sucursal_id}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _fetch_all_products(sucursal_id: str) -> List[Dict]:
    """Descarga el catálogo completo de NucleoCheck paginado. Retry automático en 401."""
    for attempt in range(2):
        try:
            session = _make_session(sucursal_id)
            productos = []
            page = 1
            total_pages = 1

            while page <= total_pages:
                r = session.get(f"{_API_BASE}/Product/FindPaged/", params={
                    "Code": "", "Name": "", "IsCommensal": "false",
                    "PageNumber": page, "PageSize": 200, "SortOrder": "",
                }, timeout=30)
                r.raise_for_status()
                data = r.json()
                total_pages = data.get("TotalPages", 1)
                productos.extend(data.get("Data", []))
                page += 1

            return productos
        except requests.exceptions.HTTPError as e:
            if getattr(getattr(e, "response", None), "status_code", None) == 401 and attempt == 0:
                logger.warning(f"Token expirado en catálogo (sucursal {sucursal_id}), renovando...")
                invalidate_jwt(sucursal_id)
                continue
            raise
    raise RuntimeError("Token refresh fallido en catálogo")


def get_catalogo(sucursal_id: str, force_refresh: bool = False) -> List[Dict]:
    """
    Devuelve el catálogo de productos. Usa caché si está fresco.
    Si el refresh falla pero hay datos viejos, los devuelve igual (fallback).
    force_refresh=True fuerza descarga desde NucleoCheck.
    """
    age = _get_cache_age(sucursal_id)

    if not force_refresh and age is not None and age < _CACHE_TTL_MINUTES:
        logger.info(f"Catálogo desde caché ({age:.1f} min) para sucursal {sucursal_id}")
        return _load_from_cache(sucursal_id)

    logger.info(f"Descargando catálogo para sucursal {sucursal_id}...")
    try:
        productos = _fetch_all_products(sucursal_id)
        _save_to_cache(sucursal_id, productos)
        return _load_from_cache(sucursal_id)
    except Exception as e:
        logger.warning(f"Refresh falló ({e}), sucursal {sucursal_id}")
        stale = _load_from_cache(sucursal_id)
        if stale:
            logger.warning(f"Usando caché vencido ({age:.1f} min)")
            return stale
        raise


def buscar_en_catalogo(
    sucursal_id: str,
    codigo: Optional[str] = None,
    nombre: Optional[str] = None,
    force_refresh: bool = False,
) -> List[Dict]:
    """Busca en el catálogo cacheado. Mucho más rápido que consultar la API."""
    catalogo = get_catalogo(sucursal_id, force_refresh=force_refresh)

    if not codigo and not nombre:
        return catalogo

    results = []
    codigo_norm = codigo.strip().upper() if codigo else None
    nombre_norm = normalizar_texto_comparacion(nombre) if nombre else None

    for p in catalogo:
        if codigo_norm and codigo_norm not in str(p.get("codigo") or "").upper():
            continue
        if nombre_norm and nombre_norm not in normalizar_texto_comparacion(p.get("nombre") or ""):
            continue
        results.append(p)

    return results


def get_cache_info() -> Dict[str, Any]:
    """Devuelve info del estado del caché para sucursales configuradas."""
    info = {}
    for suc_id, suc_data in _SUCURSAL_MAP.items():
        age = _get_cache_age(suc_id)
        nombre = suc_data["nombre"]
        if age is None:
            info[nombre] = {"cached": False, "age_minutes": None}
        else:
            info[nombre] = {
                "cached": True,
                "age_minutes": round(age, 1),
                "fresh": age < _CACHE_TTL_MINUTES,
                "expires_in_minutes": round(_CACHE_TTL_MINUTES - age, 1),
            }
    return info


