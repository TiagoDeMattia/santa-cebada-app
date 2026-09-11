"""
Funciones helper para normalización de datos
"""
import re
from typing import Optional, Union


def normalizar_precio(valor: Union[str, float, int]) -> float:
    """
    Normaliza un precio a float, manejando formatos argentinos
    Ej: 5.000, 5000,00, $5000, 5000
    """
    texto = str(valor).strip()
    texto = texto.replace("$", "").replace(" ", "")
    texto = re.sub(r"[^\d,.-]", "", texto)

    if not texto:
        raise ValueError("Precio vacío")

    if "," in texto and "." in texto:
        if texto.rfind(",") > texto.rfind("."):
            texto = texto.replace(".", "").replace(",", ".")
        else:
            texto = texto.replace(",", "")
    elif "," in texto:
        partes = texto.split(",")
        if len(partes) == 2 and len(partes[1]) in (1, 2):
            texto = texto.replace(".", "").replace(",", ".")
        else:
            texto = texto.replace(",", "")
    elif "." in texto:
        partes = texto.split(".")
        if not (len(partes) == 2 and len(partes[1]) in (1, 2)):
            texto = texto.replace(".", "")

    return float(texto)


def normalizar_codigo(valor: Union[str, int]) -> str:
    """Normaliza un código a string"""
    codigo = str(valor).strip()
    if not codigo:
        raise ValueError("Código vacío")
    return codigo


def obtener_tasa_iva(alicuota_id: Optional[int] = None, alicuota_percentage: Optional[float] = None) -> float:
    """
    Obtiene la tasa de IVA según la alícuota
    1 = 21%, 2 = 10.5%, 3 = 0%
    """
    if alicuota_percentage is not None:
        try:
            porcentaje = float(alicuota_percentage)
            if porcentaje > 0:
                return 1 + (porcentaje / 100)
        except (TypeError, ValueError):
            pass

    tasas = {1: 1.21, 2: 1.105, 3: 1.0}
    return tasas.get(alicuota_id, 1.21)


def calcular_precio_sin_iva(
    precio: float,
    alicuota_id: Optional[int] = None,
    alicuota_percentage: Optional[float] = None
) -> float:
    """Calcula el precio sin IVA dado un precio final y alícuota"""
    tasa = obtener_tasa_iva(alicuota_id=alicuota_id, alicuota_percentage=alicuota_percentage)
    return round(float(precio) / tasa, 5)


def texto_visible(valor: Optional[str]) -> str:
    """Limpia y normaliza texto para visualización"""
    return re.sub(r"\s+", " ", str(valor or "").strip())


def normalizar_texto_comparacion(valor: Optional[str]) -> str:
    """Normaliza texto para comparación (casefold)"""
    texto = str(valor or "").strip()
    texto = re.sub(r"\s+", " ", texto)
    return texto.casefold()


def clave_codigo(valor: Union[str, int]) -> str:
    """Obtiene clave normalizada para código"""
    return normalizar_codigo(valor).upper()


def ordenar_codigo(valor: Union[str, int]) -> tuple:
    """
    Genera clave para ordenar códigos
    Los numéricos primero, luego alfanuméricos
    """
    codigo = str(valor).strip()
    if codigo.isdigit():
        return (0, int(codigo), "")
    return (1, codigo.casefold(), codigo)
