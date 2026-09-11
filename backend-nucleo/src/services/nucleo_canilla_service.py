"""
Actualización automática del nombre de producto en NucleoCheck
al pinchar un barril en una canilla.

Formato: CANILLA {N} - {estilo}
         CANILLA {N} - {estilo} - HORA SANTA  (para canillas con hora santa)
"""
import sys
import os
import logging
from pathlib import Path
from typing import Optional
import requests as _requests

logger = logging.getLogger(__name__)

# ─── Inyectar credentials del entorno ────────────────────────────────────────

_SERVICES_DIR = Path(__file__).parent
if str(_SERVICES_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVICES_DIR))

_API_BASE = "https://api-prod.nucleocheck.com"
_ORIGIN   = "https://prod.nucleocheck.com"

# ─── Mapeo canilla → código(s) de producto en NucleoCheck ────────────────────
# Cada entrada: canilla_num (str) → lista de (codigo, es_hora_santa)

_CANILLA_CODES: dict[str, list[tuple[str, bool]]] = {
    "1":  [("719", False)],
    "2":  [("720", False)],
    "3":  [("721", False)],
    "4":  [("722", False), ("147", True)],
    "5":  [("723", False), ("148", True)],
    "6":  [("724", False), ("149", True)],
    "7":  [("725", False), ("155", True)],
    "8":  [("726", False)],
    "9":  [("727", False)],
    "10": [("728", False)],
    "11": [("729", False)],
    "12": [("730", False)],
    "13": [("758", False)],
    "14": [("776", False)],
    "15": [("777", False)],
    "16": [("778", False)],
    "17": [("779", False)],
    "18": [("780", False)],
}

# ─── Auth helpers ─────────────────────────────────────────────────────────────

def _base_headers() -> dict:
    return {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Origin": _ORIGIN,
        "Referer": _ORIGIN,
        "User-Agent": "Mozilla/5.0",
    }


def _get_token() -> Optional[str]:
    """Obtiene JWT via REST (login + validate). Usa las credenciales de entorno."""
    email    = os.environ.get("NUCLEO_EMAIL_RECOLETA", "")
    password = os.environ.get("NUCLEO_PASSWORD_RECOLETA", "")
    company_id = 1041  # Santa Cebada

    if not email or not password:
        logger.error("nucleo_canilla_service: credenciales no configuradas")
        return None

    try:
        with _requests.Session() as s:
            h = _base_headers()
            h["Authorization"] = "Bearer"
            r = s.post(f"{_API_BASE}/Account/LoginUser", headers=h, json={
                "CompanyId": company_id,
                "EmailUser": email,
                "IsUserCheck": True,
                "Password": password,
            }, timeout=15)
            r.raise_for_status()
            t1 = r.json().get("Token")

            h2 = _base_headers()
            h2["Authorization"] = f"Bearer {t1}"
            h2["jwt-Token"] = t1
            r2 = s.post(f"{_API_BASE}/Account/ValidateToken", headers=h2, timeout=15)
            r2.raise_for_status()
            return r2.json().get("NewToken")
    except Exception as e:
        logger.error(f"nucleo_canilla_service: error obteniendo token: {e}")
        return None


def _auth_headers(token: str) -> dict:
    h = _base_headers()
    h["Authorization"] = f"Bearer {token}"
    h["jwt-Token"] = token
    h.pop("Content-Type", None)
    return h


# ─── Lógica de actualización ──────────────────────────────────────────────────

def _find_product_id_by_code(session: _requests.Session, auth_h: dict, code: str) -> Optional[int]:
    """Busca el Id interno del producto por su código."""
    try:
        r = session.get(
            f"{_API_BASE}/Product/FindPaged/",
            headers={**auth_h, "Content-Type": "application/json"},
            params={"Code": code, "Name": "", "IsCommensal": "false",
                    "PageNumber": 1, "PageSize": 10, "SortOrder": ""},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        for p in data.get("Data", []):
            if str(p.get("Code", "")).strip() == code:
                return p["Id"]
    except Exception as e:
        logger.error(f"nucleo_canilla_service: error buscando código {code}: {e}")
    return None


def _get_full_product(session: _requests.Session, auth_h: dict, product_id: int) -> Optional[dict]:
    """Obtiene el JSON completo del producto por su Id."""
    try:
        r = session.get(
            f"{_API_BASE}/Product/FindById/{product_id}",
            headers={**auth_h, "Content-Type": "application/json"},
            timeout=15,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.error(f"nucleo_canilla_service: error obteniendo producto {product_id}: {e}")
    return None


def _save_product(session: _requests.Session, token: str, product: dict) -> bool:
    """Guarda el producto con los campos modificados."""
    try:
        h = _base_headers()
        h["Authorization"] = f"Bearer {token}"
        h["jwt-Token"] = token
        r = session.post(f"{_API_BASE}/Product/SaveProduct", headers=h, json=product, timeout=20)
        r.raise_for_status()
        resp = r.json()
        return bool(resp.get("Product"))
    except Exception as e:
        logger.error(f"nucleo_canilla_service: error guardando producto: {e}")
    return False


def actualizar_nombre_canilla(canilla_num: str, estilo: str) -> dict:
    """
    Actualiza los productos de NucleoCheck correspondientes a la canilla dada.
    Formato regular:    CANILLA {N} - {estilo}
    Formato hora santa: CANILLA {N} - {estilo} - HORA SANTA

    Retorna dict con resultados por código.
    """
    canilla_num = str(canilla_num).strip()
    estilo = estilo.strip().upper()

    codes = _CANILLA_CODES.get(canilla_num)
    if not codes:
        logger.warning(f"nucleo_canilla_service: canilla {canilla_num!r} no tiene código mapeado")
        return {"ok": False, "error": f"Canilla {canilla_num} sin mapeo"}

    token = _get_token()
    if not token:
        return {"ok": False, "error": "No se pudo obtener token NucleoCheck"}

    results = []
    auth_h = _auth_headers(token)

    with _requests.Session() as session:
        for code, is_hora_santa in codes:
            nuevo_nombre = (
                f"CANILLA {canilla_num} - {estilo} - HORA SANTA"
                if is_hora_santa
                else f"CANILLA {canilla_num} - {estilo}"
            )

            product_id = _find_product_id_by_code(session, auth_h, code)
            if product_id is None:
                logger.warning(f"nucleo_canilla_service: código {code} no encontrado en NucleoCheck")
                results.append({"code": code, "ok": False, "error": "no encontrado"})
                continue

            product = _get_full_product(session, auth_h, product_id)
            if product is None:
                results.append({"code": code, "ok": False, "error": "no se pudo leer"})
                continue

            nombre_anterior = product.get("Name", "")
            if nombre_anterior.strip().upper() == nuevo_nombre:
                logger.info(f"nucleo_canilla_service: {code} sin cambio (ya es '{nombre_anterior}')")
                results.append({"code": code, "ok": True, "skipped": True, "nombre_anterior": nombre_anterior, "nombre_nuevo": nuevo_nombre})
                continue

            product["Name"] = nuevo_nombre

            ok = _save_product(session, token, product)
            if ok:
                logger.info(f"nucleo_canilla_service: {code} '{nombre_anterior}' → '{nuevo_nombre}'")
            results.append({"code": code, "ok": ok, "nombre_anterior": nombre_anterior, "nombre_nuevo": nuevo_nombre})

    todos_ok = all(r["ok"] for r in results)
    return {"ok": todos_ok, "resultados": results}
