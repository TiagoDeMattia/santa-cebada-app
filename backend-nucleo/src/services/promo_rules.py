"""
Reglas de visibilidad de grupos de promos en el visor.

Reglas configuradas:
  HORA SANTA    → todos los días de 17:00 a 20:00
  PROMOS MAÑANA → todos los días de 10:00 a 16:00
  2X1           → sábados y feriados nacionales argentinos de 17:00 a 20:00
  (resto)       → siempre visible

Feriados: actualizar la lista _FERIADOS cada año.
"""
from datetime import date, datetime
from typing import FrozenSet
import pytz

_ARG_TZ = pytz.timezone("America/Argentina/Buenos_Aires")

_FERIADOS: FrozenSet[date] = frozenset({
    # 2025
    date(2025, 1, 1),
    date(2025, 3, 3), date(2025, 3, 4),          # Carnaval
    date(2025, 3, 24),                             # Memoria
    date(2025, 4, 2),                              # Veteranos
    date(2025, 4, 18), date(2025, 4, 19),         # Semana Santa
    date(2025, 5, 1),                              # Trabajo
    date(2025, 5, 25),                             # Revolución
    date(2025, 6, 16),                             # Güemes (trasladado)
    date(2025, 6, 20),                             # Belgrano
    date(2025, 7, 9),                              # Independencia
    date(2025, 8, 18),                             # San Martín (3er lunes ago)
    date(2025, 10, 13),                            # Diversidad Cultural
    date(2025, 11, 20),                            # Soberanía Nacional
    date(2025, 12, 8),                             # Inmaculada
    date(2025, 12, 25),                            # Navidad
    # 2026
    date(2026, 1, 1),
    date(2026, 2, 16), date(2026, 2, 17),         # Carnaval
    date(2026, 3, 24),                             # Memoria
    date(2026, 4, 2),                              # Veteranos
    date(2026, 4, 3), date(2026, 4, 4),           # Semana Santa
    date(2026, 5, 1),                              # Trabajo
    date(2026, 5, 25),                             # Revolución
    date(2026, 6, 15),                             # Güemes
    date(2026, 6, 20),                             # Belgrano
    date(2026, 7, 9),                              # Independencia
    date(2026, 8, 17),                             # San Martín (3er lunes ago)
    date(2026, 10, 12),                            # Diversidad Cultural
    date(2026, 11, 20),                            # Soberanía Nacional
    date(2026, 12, 8),                             # Inmaculada
    date(2026, 12, 25),                            # Navidad
})


def _now_arg() -> datetime:
    return datetime.now(_ARG_TZ)


def is_group_visible(group_nombre: str) -> bool:
    """Devuelve True si el grupo de promos debe mostrarse en este momento."""
    nombre = group_nombre.upper()
    now = _now_arg()
    hora = now.hour + now.minute / 60.0
    today = now.date()
    is_sabado = today.weekday() == 5
    is_feriado = today in _FERIADOS

    if "HORA SANTA" in nombre:
        return 17.0 <= hora < 20.0

    if "2X1" in nombre:
        return (is_sabado or is_feriado) and 17.0 <= hora < 20.0

    if "MAÑANA" in nombre or "MANANA" in nombre:
        return 10.0 <= hora < 16.0

    return True
