"""
Datos para widgets de iPhone (Scriptable).
Sin JWT — autenticado con widget_api_key en query param.
Toda la data viene de NucleoCheck API en tiempo real.
"""
from datetime import datetime, timedelta, timezone


def get_facturacion_widget(location_key: str = "recoleta") -> dict:
    """
    Facturación total (todas las cajas: Cebados SRL, Vales 1, Vales 2) en tiempo real.
    Llama a InvoiceList/Find con ventanas de tiempo para: hoy, turno mañana,
    noche, semanal, mensual.  Nunca usa la DB local (que es diaria).
    """
    import requests as _req
    from email.utils import format_datetime as _fmt
    from .estadistica_service import _get_live_token, _auth_headers, _API_BASE

    now_utc   = datetime.now(timezone.utc)
    local_now = now_utc - timedelta(hours=3)

    # Día de negocio: arranca a las 8 AM ART (= 11 AM UTC)
    if local_now.hour < 8:
        bday_local = (local_now - timedelta(days=1)).replace(
            hour=8, minute=0, second=0, microsecond=0)
    else:
        bday_local = local_now.replace(hour=8, minute=0, second=0, microsecond=0)

    bday_utc  = bday_local + timedelta(hours=3)
    bday_date = bday_local.date()

    # Turnos en UTC:  turno mañana 11-16 ART = 14-19 UTC
    al_start = datetime(bday_date.year, bday_date.month, bday_date.day, 14, 0, tzinfo=timezone.utc)
    al_end   = datetime(bday_date.year, bday_date.month, bday_date.day, 19, 0, tzinfo=timezone.utc)

    # Semana (desde el lunes) y mes
    week_date  = bday_date - timedelta(days=bday_date.weekday())
    month_date = bday_date.replace(day=1)
    week_utc   = datetime(week_date.year,  week_date.month,  week_date.day,  11, 0, tzinfo=timezone.utc)
    month_utc  = datetime(month_date.year, month_date.month, month_date.day, 11, 0, tzinfo=timezone.utc)

    token   = _get_live_token(location_key)
    headers = _auth_headers(token)

    def _fetch(from_utc: datetime, to_utc: datetime) -> float:
        if to_utc <= from_utc:
            return 0.0
        r = _req.get(
            f"{_API_BASE}/InvoiceList/Find",
            headers=headers,
            params={"DateFrom": _fmt(from_utc, usegmt=True),
                    "DateTo":   _fmt(to_utc,   usegmt=True)},
            timeout=30,
        )
        r.raise_for_status()
        invoices = r.json()  # Todas las cajas (Cebados SRL + Vales 1 + Vales 2)
        return round(sum(float(i.get("Total") or 0) for i in invoices), 2)

    hoy    = _fetch(bday_utc, now_utc)
    manana = _fetch(al_start, min(al_end, now_utc))
    noche  = _fetch(al_end,   now_utc)
    semanal = _fetch(week_utc,  now_utc)
    mensual = _fetch(month_utc, now_utc)

    turno = "manana" if al_start <= now_utc < al_end else "noche"

    return {
        "hoy":      hoy,
        "manana":   manana,
        "noche":    noche,
        "semanal":  semanal,
        "mensual":  mensual,
        "fecha_negocio": str(bday_date),
        "turno_actual":  turno,
    }


def get_alertas_widget() -> dict:
    """Resumen de alertas 85/86 para el widget de iPhone."""
    from .alertas_service import get_alertas

    productos = get_alertas()
    en_86 = [p for p in productos if p.get("tipo") == 86]
    en_85 = [p for p in productos if p.get("tipo") == 85]

    def _names(lst):
        return [p.get("nombre") or p.get("codigo") or "?" for p in lst]

    return {
        "alerta86": {"count": len(en_86), "nombres": _names(en_86)},
        "alerta85": {"count": len(en_85), "nombres": _names(en_85)},
        "todo_ok":  len(en_86) == 0 and len(en_85) == 0,
    }


def get_widgets_data(location_key: str = "recoleta") -> dict:
    """Un solo endpoint que devuelve facturación + vales + alertas."""
    from .estadistica_service import get_vales_counters

    return {
        "facturacion": get_facturacion_widget(location_key),
        "vales":       get_vales_counters(location_key),
        "alertas":     get_alertas_widget(),
        "updated_at":  datetime.now(timezone.utc).isoformat(),
    }
