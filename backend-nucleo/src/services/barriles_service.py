"""
Servicio para gestión de barriles de cerveza.
Lee y escribe en Google Sheets (hoja BARRILES del sheet de cervezas).

IMPORTANTE: El reordenamiento MUEVE FILAS FÍSICAMENTE usando la API de Google Sheets v4.
Esto preserva: desplegables, fórmulas, formatos, validaciones de datos.

Estructura del sheet:
  Fila 1: Título "BARRILES RECOLETA"
  Fila 2: Headers
  Fila 3: Subtítulo "EN CAMARA"
  Filas 4+: Datos (Pinchadas primero, luego En Camara, luego slots vacíos)
  Fila con A="VACIOS": separador
  Filas siguientes: Para Retirar
  Fila con A="RETIRADAS": separador
  Filas siguientes: Retiradas

Columnas (1-indexed para gspread):
  RECOLETA:
    1  Ingreso (A)
    2  Proveedor (B) - AUTO
    3  Estilo (C) - DROPDOWN
    4  Código (D)
    5  BARRIL N. (E) - CHECKBOX (TRUE=50L, FALSE=30L)
    6  Fecha de Pinchado (F)
    7  Nombre pinchó (G) - DROPDOWN
    8  Turno pinchado (H) - FORMULA
    9  Fecha de Despinchado (I)
    10 Nombre despinchó (J) - DROPDOWN
    11 Turno despinchado (K) - FORMULA
    12 Fecha de Retirado (L)
    13 Días Pinchado (M) - FORMULA
    14 Estado (N) - FORMULA
    15 Días de retirado (O) - FORMULA
    16 Canilla (P)
    17 T.P. (Q) - FORMULA

  PALERMO:
    1  Ingreso (A)
    2  Proveedor (B) - AUTO
    3  Estilo (C) - DROPDOWN
    4  Código (D)
    5  BARRIL N. (E) - CHECKBOX (TRUE=50L, FALSE=30L)
    6  Fecha de Pinchado (F)
    7  Nombre pinchó (G) - DROPDOWN
    8  Fecha de Despinchado (H)
    9  Fecha de Retirado (J)
    10 Nombre despinchó (J) - DROPDOWN
    11 Días Pinchado (K) - FORMULA
    12 Estado (L) - FORMULA
    13 Días de retirado (M) - FORMULA
    14 Canilla (N)
    15 T.P. (O) - FORMULA
"""
from typing import Optional, List, Dict, Any

import gspread
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

from ..config import settings
from ..utils.logger import logger
from .rate_limiter import rate_limited

# Configuración de sucursales
SUCURSALES_CONFIG = {
    "1": {
        "nombre": "Recoleta",
        "sheet_id": "1Sw-TqlevrqHUt4krNOjzqY0qRQfW3Odm7ZJrp2ZhEsI",
        "sheet_name": "BARRILES",
        "info_sheet_name": "INFO",
        "gid": 1085849685,  # GID real de la pestaña BARRILES (1084027951 era INFO)
        # Índices 0-based para las columnas
        "col_estado": 13,      # Columna N
        "col_dias_retirado": 14,  # Columna O
        "col_canilla": 15,     # Columna P
        "col_tp": 16,          # Columna Q
    },
}

# Valores por defecto (Recoleta)
SHEET_ID = SUCURSALES_CONFIG["1"]["sheet_id"]
SHEET_NAME = SUCURSALES_CONFIG["1"]["sheet_name"]
INFO_SHEET_NAME = SUCURSALES_CONFIG["1"]["info_sheet_name"]

# Columnas 1-indexed
COL_INGRESO = 1
COL_PROVEEDOR = 2
COL_ESTILO = 3
COL_CODIGO = 4
COL_FECHA_PINCHADO = 6
COL_NOMBRE_PINCHO = 7
COL_TURNO_PINCHADO = 8
COL_FECHA_DESPINCHADO = 9
COL_NOMBRE_DESPINCHO = 10
COL_TURNO_DESPINCHADO = 11
COL_FECHA_RETIRADO = 12
COL_DIAS_PINCHADO = 13
COL_ESTADO = 14
COL_DIAS_RETIRADO = 15
COL_CANILLA = 16
COL_TP = 17

ESTADOS_ACTIVOS = {"Pinchada", "En Camara"}
ESTADOS_HISTORIAL = {"Para Retirar", "Retirada"}

# Marcadores en col A
MARCADOR_VACIOS = "VACIOS"
MARCADOR_RETIRADAS = "RETIRADAS"

# Fila donde empiezan los datos activos (1-indexed)
DATA_START_ROW = 4


SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

_gspread_client = None
_sheets_v4_service = None


def _get_client() -> gspread.Client:
    """Obtiene cliente de gspread para operaciones básicas (singleton)."""
    global _gspread_client
    if _gspread_client is None:
        creds = Credentials.from_service_account_file(
            settings.credentials_json_path,
            scopes=SCOPES,
        )
        _gspread_client = gspread.authorize(creds)
    return _gspread_client


def _get_sheets_v4_service():
    """Obtiene servicio de Google Sheets API v4 para operaciones avanzadas (singleton)."""
    global _sheets_v4_service
    if _sheets_v4_service is None:
        creds = Credentials.from_service_account_file(
            settings.credentials_json_path,
            scopes=SCOPES,
        )
        _sheets_v4_service = build('sheets', 'v4', credentials=creds)
    return _sheets_v4_service


def _get_worksheet(sucursal_id: str = "1") -> gspread.Worksheet:
    """Obtiene worksheet de gspread."""
    config = SUCURSALES_CONFIG.get(sucursal_id, SUCURSALES_CONFIG["1"])
    gc = _get_client()
    sh = gc.open_by_key(config["sheet_id"])
    return sh.worksheet(config["sheet_name"])


def _row_to_barril(row: List[str], row_index: int, sucursal_id: str = "1") -> Optional[Dict[str, Any]]:
    """Convierte una fila a dict. Retorna None si está vacía o es marcador."""
    config = SUCURSALES_CONFIG.get(sucursal_id, SUCURSALES_CONFIG["1"])
    
    # Asegurar que la fila tiene suficientes columnas
    max_col = max(config["col_estado"], config["col_dias_retirado"], config["col_canilla"], config["col_tp"]) + 1
    while len(row) < max_col:
        row.append("")

    col_a = row[0].strip()
    estilo = row[2].strip()
    proveedor = row[1].strip()
    estado = row[config["col_estado"]].strip()

    # Ignorar marcadores y filas sin datos
    if col_a in (MARCADOR_VACIOS, MARCADOR_RETIRADAS, "BARRILES RECOLETA", "BARRILES PALERMO", "Ingreso", "EN CAMARA"):
        return None
    if not estilo and not proveedor:
        return None

    # gspread puede devolver bool Python o string según el formato de celda
    _barril_cell = row[4] if len(row) > 4 else ""
    if isinstance(_barril_cell, bool):
        barril_n_raw = "TRUE" if _barril_cell else "FALSE"
    else:
        barril_n_raw = str(_barril_cell).strip().upper()
    litros_barril = 30.0 if barril_n_raw == "FALSE" else 50.0

    return {
        "row": row_index,
        "ingreso": col_a,
        "proveedor": proveedor,
        "estilo": estilo,
        "codigo": row[3].strip(),
        "barril_n": barril_n_raw,
        "litros_barril": litros_barril,
        "fecha_pinchado": row[5].strip(),
        "nombre_pincho": row[6].strip(),
        "turno_pinchado": row[7].strip(),
        "fecha_despinchado": row[8].strip(),
        "nombre_despincho": row[9].strip(),
        "turno_despinchado": row[10].strip(),
        "fecha_retirado": row[11].strip(),
        "dias_pinchado": row[12].strip(),
        "estado": estado if estado else "En Camara",
        "dias_retirado": row[config["col_dias_retirado"]].strip(),
        "canilla": row[config["col_canilla"]].strip(),
        "tp": row[config["col_tp"]].strip(),
        # Campos que serán enriquecidos desde el sheet INFO en get_visor_data()
        # NO tomar precio/amargor/abv de las columnas D/E/F del BARRILES sheet
        # porque son interpretadas como fechas
        "amargor": "",
        "abv": "",
        "precio": "",
    }


@rate_limited
def get_barriles(filtro: Optional[str] = None, sucursal_id: str = "1") -> List[Dict[str, Any]]:
    """
    Devuelve barriles del sheet.
    filtro: "activos" | "historial" | None (todos)
    sucursal_id: "1" (Recoleta) | "2" (Palermo)
    """
    ws = _get_worksheet(sucursal_id)
    all_rows = ws.get_all_values()

    barriles = []
    for i, row in enumerate(all_rows):
        if i < DATA_START_ROW - 1:
            continue

        barril = _row_to_barril(row, i + 1, sucursal_id)
        if barril is None:
            continue

        estado = barril["estado"]
        if filtro == "activos" and estado not in ESTADOS_ACTIVOS:
            continue
        if filtro == "historial" and estado not in ESTADOS_HISTORIAL:
            continue

        barriles.append(barril)

    return barriles


@rate_limited
def get_personal(sucursal_id: str = "1") -> List[str]:
    """Devuelve la lista de personal desde INFO B3:B12."""
    config = SUCURSALES_CONFIG.get(sucursal_id, SUCURSALES_CONFIG["1"])
    gc = _get_client()
    sh = gc.open_by_key(config["sheet_id"])
    ws = sh.worksheet(config["info_sheet_name"])
    rows = ws.get_all_values()
    personal = []
    for i in range(2, 12):  # filas 3-12 (0-indexed: 2-11)
        if i < len(rows):
            nombre = rows[i][1].strip() if len(rows[i]) > 1 else ""
            if nombre and nombre != "-":
                personal.append(nombre)
    return personal


def update_barril_completo(
    row: int,
    fecha_pinchado: Optional[str] = None,
    nombre_pincho: Optional[str] = None,
    fecha_despinchado: Optional[str] = None,
    nombre_despincho: Optional[str] = None,
    fecha_retirado: Optional[str] = None,
    canilla: Optional[str] = None,
    sucursal_id: str = "1",
) -> Dict[str, Any]:
    """
    Actualiza múltiples campos de un barril en batch.
    Solo actualiza los campos que se pasan (no None).
    
    IMPORTANTE:
    - Los campos de nombre (desplegables) vacíos NO se actualizan para preservar el desplegable
    - Las fechas se convierten a formato serial de Google Sheets para evitar el apóstrofe
    - El estado NO se actualiza porque es una fórmula automática en el sheet
    """
    config = SUCURSALES_CONFIG.get(sucursal_id, SUCURSALES_CONFIG["1"])
    ws = _get_worksheet(sucursal_id)
    service = _get_sheets_v4_service()
    
    col_map = {
        "fecha_pinchado": COL_FECHA_PINCHADO,
        "nombre_pincho": COL_NOMBRE_PINCHO,
        "fecha_despinchado": COL_FECHA_DESPINCHADO,
        "nombre_despincho": COL_NOMBRE_DESPINCHO,
        "fecha_retirado": COL_FECHA_RETIRADO,
        "canilla": COL_CANILLA,
    }

    valores = {
        "fecha_pinchado": fecha_pinchado,
        "nombre_pincho": nombre_pincho,
        "fecha_despinchado": fecha_despinchado,
        "nombre_despincho": nombre_despincho,
        "fecha_retirado": fecha_retirado,
        "canilla": canilla,
    }

    # Preparar actualizaciones para la API v4
    requests = []
    
    for campo, valor in valores.items():
        if valor is not None:
            col = col_map[campo]
            
            # Preparar el valor según el tipo
            cell_value = {}
            
            # Si es un campo de nombre (desplegable) y está vacío, limpiamos el contenido
            # pero preservamos la validación de datos (desplegable)
            if campo in ("nombre_pincho", "nombre_despincho"):
                if valor == "":
                    # Limpiar contenido pero mantener validación
                    requests.append({
                        "updateCells": {
                            "range": {
                                "sheetId": config["gid"],
                                "startRowIndex": row - 1,
                                "endRowIndex": row,
                                "startColumnIndex": col - 1,
                                "endColumnIndex": col,
                            },
                            "rows": [{
                                "values": [{
                                    "userEnteredValue": {}  # Vacío pero mantiene validación
                                }]
                            }],
                            "fields": "userEnteredValue"
                        }
                    })
                    logger.info(f"Limpiando {campo} pero preservando desplegable")
                    continue
                else:
                    # Valor no vacío, escribir normalmente
                    cell_value = {"stringValue": str(valor)}
            # Si es una fecha, convertirla a formato serial de Google Sheets
            elif campo in ("fecha_pinchado", "fecha_despinchado", "fecha_retirado") and valor:
                try:
                    parts = valor.split("/")
                    if len(parts) == 3:
                        day, month, year = parts
                        from datetime import datetime
                        fecha_obj = datetime(int(year), int(month), int(day))
                        # Convertir a número serial de Google Sheets (días desde 30/12/1899)
                        base_date = datetime(1899, 12, 30)
                        delta = fecha_obj - base_date
                        cell_value = {"numberValue": delta.days}
                        logger.info(f"Fecha {valor} convertida a serial: {delta.days}")
                        
                        # Crear request especial para fechas con formato
                        requests.append({
                            "updateCells": {
                                "range": {
                                    "sheetId": config["gid"],
                                    "startRowIndex": row - 1,
                                    "endRowIndex": row,
                                    "startColumnIndex": col - 1,
                                    "endColumnIndex": col,
                                },
                                "rows": [{
                                    "values": [{
                                        "userEnteredValue": cell_value,
                                        "userEnteredFormat": {
                                            "numberFormat": {
                                                "type": "DATE",
                                                "pattern": "dd/mm/yyyy"
                                            }
                                        }
                                    }]
                                }],
                                "fields": "userEnteredValue,userEnteredFormat.numberFormat"
                            }
                        })
                        continue  # Ya agregamos el request, saltar el append al final
                except Exception as e:
                    logger.warning(f"Error convirtiendo fecha {valor}: {e}, usando como string")
                    cell_value = {"stringValue": valor}
            # Si es canilla, convertir a número o limpiar la celda si viene vacío
            elif campo == "canilla":
                if not valor:
                    # Limpiar la celda: no escribir 0, dejar vacío
                    requests.append({
                        "updateCells": {
                            "range": {
                                "sheetId": config["gid"],
                                "startRowIndex": row - 1,
                                "endRowIndex": row,
                                "startColumnIndex": col - 1,
                                "endColumnIndex": col,
                            },
                            "rows": [{"values": [{"userEnteredValue": {}}]}],
                            "fields": "userEnteredValue"
                        }
                    })
                    logger.info(f"Canilla fila {row}: celda vaciada")
                    continue
                try:
                    cell_value = {"numberValue": int(valor)}
                    logger.info(f"Canilla {valor} convertida a número")
                except:
                    cell_value = {"stringValue": str(valor)}
            else:
                # Para otros campos, usar string
                cell_value = {"stringValue": str(valor)}
            
            # Crear request de actualización usando API v4
            requests.append({
                "updateCells": {
                    "range": {
                        "sheetId": config["gid"],
                        "startRowIndex": row - 1,  # 0-indexed
                        "endRowIndex": row,
                        "startColumnIndex": col - 1,  # 0-indexed
                        "endColumnIndex": col,
                    },
                    "rows": [{
                        "values": [{
                            "userEnteredValue": cell_value
                        }]
                    }],
                    "fields": "userEnteredValue"
                }
            })
    
    if requests:
        # Ejecutar todas las actualizaciones en batch
        body = {"requests": requests}
        service.spreadsheets().batchUpdate(
            spreadsheetId=config["sheet_id"],
            body=body
        ).execute()
        logger.info(f"Barril fila {row}: actualizados {len(requests)} campos usando API v4")

    return {"success": True, "row": row, "updated_fields": len(requests)}


def mover_barril_post_despinchado(row: int, sucursal_id: str = "1") -> None:
    """
    Después de despinchar un barril, lo mueve a la primera posición
    debajo del marcador VACIOS. Operación rápida: una lectura + una moveDimension.
    Si no se encuentra el marcador VACIOS (p.ej. Palermo), no hace nada.
    """
    config = SUCURSALES_CONFIG.get(sucursal_id, SUCURSALES_CONFIG["1"])
    ws = _get_worksheet(sucursal_id)
    all_rows = ws.get_all_values()

    row_vacios = None
    for i, r in enumerate(all_rows):
        if r and r[0].strip() == MARCADOR_VACIOS:
            row_vacios = i + 1  # 1-indexed
            break

    if row_vacios is None:
        logger.warning(f"No se encontró marcador VACIOS en sucursal {sucursal_id}, no se moverá el barril")
        return

    # Mover la fila al primer slot después de VACIOS
    # Sigue el mismo patrón que reordenar_sheet (target_row - 1 como destination_row_index)
    target_row = row_vacios + 1  # 1-indexed, primera fila después de VACIOS
    if row == target_row:
        logger.info(f"Barril fila {row} ya está en posición correcta (justo después de VACIOS)")
        return

    logger.info(f"Moviendo barril fila {row} a posición {target_row} (después de VACIOS en fila {row_vacios})")
    _move_rows_physically(config["sheet_id"], config["gid"], row - 1, target_row - 1, 1)


def _move_rows_physically(
    sheet_id: str,
    gid: int,
    source_row_index: int,
    destination_row_index: int,
    num_rows: int = 1
) -> None:
    """
    Mueve filas físicamente usando moveDimension de la API de Google Sheets v4.
    Esto mueve la fila COMPLETA como lo haría una persona, sin modificar datos.
    
    IMPORTANTE: moveDimension mueve la fila entera, preservando:
    - Fórmulas con referencias relativas (se ajustan automáticamente)
    - Desplegables y validaciones de datos
    - Formatos de celda
    - Todos los datos sin modificación
    
    Args:
        sheet_id: ID del spreadsheet
        gid: ID del sheet (tab)
        source_row_index: Índice de la fila origen (0-indexed)
        destination_row_index: Índice de destino (0-indexed)
        num_rows: Número de filas a mover (siempre 1 en nuestro caso)
    """
    service = _get_sheets_v4_service()
    
    request = {
        "moveDimension": {
            "source": {
                "sheetId": gid,
                "dimension": "ROWS",
                "startIndex": source_row_index,
                "endIndex": source_row_index + num_rows,
            },
            "destinationIndex": destination_row_index
        }
    }
    
    body = {"requests": [request]}
    service.spreadsheets().batchUpdate(
        spreadsheetId=sheet_id,
        body=body
    ).execute()


def _adjust_row_after_move(row: int, source: int, destination: int) -> int:
    """
    Ajusta el número de fila (1-indexed) de un item después de un moveDimension.
    source y destination son 1-indexed.
    Según la API de Google Sheets (destination es en coordenadas ANTES de remover source):
    - Si source < destination (mover hacia abajo): filas en rango (source, destination) suben 1, source queda en destination-1
    - Si source > destination (mover hacia arriba): filas en rango [destination, source) bajan 1, source queda en destination
    """
    if source == destination:
        return row
    if source < destination:
        # Mover hacia abajo
        if source < row <= destination - 1:
            return row - 1
    else:
        # Mover hacia arriba
        if destination <= row < source:
            return row + 1
    return row


def reordenar_sheet(sucursal_id: str = "1") -> Dict[str, Any]:
    """
    Reordena el sheet MOVIENDO FILAS FÍSICAMENTE (no copiando datos).
    Esto preserva desplegables, fórmulas y formatos.
    
    IMPORTANTE: Lee el estado desde la columna de fórmula (N en Recoleta, L en Palermo)
    y mueve las filas según:
    - Debajo de "EN CAMARA": Pinchadas (por canilla), En Camara (por tipo A-E, luego especiales), N/A
    - Debajo de "VACIOS": Para Retirar
    - Debajo de "RETIRADAS": Retirada
    
    CORRECCIONES:
    - target_row empieza DESPUÉS del marcador "EN CAMARA" (no en DATA_START_ROW)
    - "En Cámara" se ordena por tipo: A, B, C, D, E, luego GIN, T, etc.
    - Manejo de errores mejorado para evitar error 500
    """
    config = SUCURSALES_CONFIG.get(sucursal_id, SUCURSALES_CONFIG["1"])
    ws = _get_worksheet(sucursal_id)
    
    try:
        # Leer todo el sheet UNA VEZ
        all_rows = ws.get_all_values()
        
        # Encontrar posiciones de marcadores leyendo toda la columna A
        row_vacios = None
        row_retiradas = None
        row_en_camara = None
        has_markers = False
        
        for i, row in enumerate(all_rows):
            col_a = row[0].strip() if row else ""
            if col_a == "EN CAMARA":
                row_en_camara = i + 1  # 1-indexed
            elif col_a == MARCADOR_VACIOS:
                row_vacios = i + 1
                has_markers = True
            elif col_a == MARCADOR_RETIRADAS:
                row_retiradas = i + 1
                has_markers = True

        # Si no hay marcadores, no se puede reordenar
        if not has_markers:
            logger.warning(f"No se encontraron marcadores VACIOS/RETIRADAS en sucursal {sucursal_id}, omitiendo reordenamiento")
            return {"success": True, "warning": "No se encontraron marcadores en el sheet"}
        
        if not row_vacios or not row_retiradas:
            raise ValueError("No se encontraron los marcadores VACIOS o RETIRADAS en el sheet")
        
        # ✅ CORRECCIÓN: Validar que encontramos EN CAMARA
        if not row_en_camara:
            logger.warning("No se encontró el marcador EN CAMARA, usando DATA_START_ROW")
            row_en_camara = DATA_START_ROW - 1

        logger.info(f"Marcadores encontrados - EN CAMARA: {row_en_camara}, VACIOS: {row_vacios}, RETIRADAS: {row_retiradas}")

        sheet_id = config["sheet_id"]
        gid = config["gid"]
        col_estado_idx = config["col_estado"]  # 0-indexed
        col_canilla_idx = config["col_canilla"]  # 0-indexed
        col_tp_idx = config["col_tp"]  # 0-indexed (columna T.P.)
        
        # ✅ CORRECCIÓN: target_row empieza DESPUÉS del marcador "EN CAMARA"
        target_row = row_en_camara + 1
        max_iterations = 100  # Seguridad contra bucles infinitos
        
        # PASO 1: Ordenar Pinchadas por canilla
        logger.info("=== PASO 1: Ordenando Pinchadas ===")
        all_rows = ws.get_all_values()
        row_vacios_actual = next((i + 1 for i, r in enumerate(all_rows) if r and r[0].strip() == MARCADOR_VACIOS), row_vacios)

        pinchadas = []
        for i, row in enumerate(all_rows):
            row_num = i + 1
            if row_num <= row_en_camara or row_num >= row_vacios_actual:
                continue
            if len(row) <= col_estado_idx:
                continue
            if row[col_estado_idx].strip() != "Pinchada":
                continue
            canilla_str = row[col_canilla_idx].strip() if len(row) > col_canilla_idx else ""
            try:
                canilla_num = int(canilla_str) if canilla_str else 999999
            except:
                canilla_num = 999999
            pinchadas.append({"row": row_num, "canilla": canilla_num, "estilo": row[2].strip() if len(row) > 2 else ""})

        pinchadas.sort(key=lambda x: x["canilla"])

        for p in pinchadas:
            current_row = p["row"]
            if current_row != target_row:
                logger.info(f"Moviendo Pinchada fila {current_row} (canilla {p['canilla']}, {p['estilo']}) a posición {target_row}")
                _move_rows_physically(sheet_id, gid, current_row - 1, target_row - 1, 1)
                for other in pinchadas:
                    if other["row"] != current_row:
                        other["row"] = _adjust_row_after_move(other["row"], current_row, target_row)
                p["row"] = target_row - 1 if current_row < target_row else target_row
            target_row += 1
        
        # PASO 2: Ordenar En Camara por tipo
        logger.info("=== PASO 2: Moviendo En Camara (ordenadas por tipo) ===")
        all_rows = ws.get_all_values()
        row_vacios_actual = next((i + 1 for i, r in enumerate(all_rows) if r and r[0].strip() == MARCADOR_VACIOS), row_vacios)

        en_camara = []
        for i, row in enumerate(all_rows):
            row_num = i + 1
            if row_num <= row_en_camara or row_num >= row_vacios_actual:
                continue
            if len(row) <= col_estado_idx:
                continue
            if row[col_estado_idx].strip() != "En Camara":
                continue
            tp = row[col_tp_idx].strip() if len(row) > col_tp_idx else ""
            en_camara.append({"row": row_num, "tp": tp, "estilo": row[2].strip() if len(row) > 2 else ""})

        tipos_orden = ["A", "B", "C", "D", "E"]
        def tp_sort_key(item):
            tp = item["tp"]
            if tp in tipos_orden:
                return (0, tipos_orden.index(tp))
            return (1, tp)

        en_camara.sort(key=tp_sort_key)

        for ec in en_camara:
            current_row = ec["row"]
            if current_row != target_row:
                logger.info(f"Moviendo En Camara fila {current_row} (tipo {ec['tp']}, {ec['estilo']}) a posición {target_row}")
                _move_rows_physically(sheet_id, gid, current_row - 1, target_row - 1, 1)
                for other in en_camara:
                    if other["row"] != current_row:
                        other["row"] = _adjust_row_after_move(other["row"], current_row, target_row)
                ec["row"] = target_row - 1 if current_row < target_row else target_row
            target_row += 1
        
        # PASO 2.5: Mover N/A
        logger.info("=== PASO 2.5: Moviendo N/A ===")
        all_rows = ws.get_all_values()
        row_vacios_actual = next((i + 1 for i, r in enumerate(all_rows) if r and r[0].strip() == MARCADOR_VACIOS), row_vacios)

        na_items = []
        for i, row in enumerate(all_rows):
            row_num = i + 1
            if row_num <= row_en_camara or row_num >= row_vacios_actual:
                continue
            if len(row) <= col_estado_idx:
                continue
            if row[col_estado_idx].strip() == "N/A":
                na_items.append({"row": row_num, "estilo": row[2].strip() if len(row) > 2 else ""})

        for na in na_items:
            current_row = na["row"]
            if current_row != target_row:
                logger.info(f"Moviendo N/A fila {current_row} ({na['estilo']}) a posición {target_row}")
                _move_rows_physically(sheet_id, gid, current_row - 1, target_row - 1, 1)
                for other in na_items:
                    if other["row"] != current_row:
                        other["row"] = _adjust_row_after_move(other["row"], current_row, target_row)
                na["row"] = target_row - 1 if current_row < target_row else target_row
            target_row += 1
        
        # PASO 3: Mover todas las "Para Retirar" debajo de VACIOS
        logger.info("=== PASO 3: Moviendo Para Retirar ===")
        all_rows = ws.get_all_values()
        
        # Recalcular marcadores
        row_vacios_actual = next((i + 1 for i, row in enumerate(all_rows) if row and row[0].strip() == MARCADOR_VACIOS), row_vacios)
        row_retiradas_actual = next((i + 1 for i, row in enumerate(all_rows) if row and row[0].strip() == MARCADOR_RETIRADAS), row_retiradas)
        
        target_row = row_vacios_actual + 1
        iteration_count = 0
        
        while iteration_count < max_iterations:
            iteration_count += 1
            
            encontrada = None
            for i, row in enumerate(all_rows):
                row_num = i + 1
                
                # Saltar filas que ya están en su zona correcta (entre VACIOS y RETIRADAS)
                if row_vacios_actual < row_num < row_retiradas_actual:
                    continue
                
                if len(row) <= col_estado_idx:
                    continue
                
                estado = row[col_estado_idx].strip()
                if estado == "Para Retirar":
                    # Solo mover si está FUERA de su zona correcta
                    encontrada = {"row_num": row_num, "estilo": row[2].strip() if len(row) > 2 else ""}
                    break
            
            if encontrada is None:
                logger.info(f"No hay más Para Retirar para mover (iteraciones: {iteration_count})")
                break
            
            logger.info(f"Moviendo Para Retirar fila {encontrada['row_num']} ({encontrada['estilo']}) a posición {target_row}")
            _move_rows_physically(sheet_id, gid, encontrada["row_num"] - 1, target_row - 1, 1)
            # Actualizar el array en memoria para reflejar el movimiento
            moved_row = all_rows.pop(encontrada["row_num"] - 1)
            all_rows.insert(target_row - 1, moved_row)
            # Ajustar los marcadores si la fila movida estaba antes de ellos
            if encontrada["row_num"] < row_vacios_actual:
                row_vacios_actual -= 1
            if encontrada["row_num"] < row_retiradas_actual:
                row_retiradas_actual -= 1
            
            target_row += 1
        
        # PASO 4: Mover todas las "Retirada" debajo de RETIRADAS
        logger.info("=== PASO 4: Moviendo Retiradas ===")
        all_rows = ws.get_all_values()
        
        # Recalcular marcador
        row_retiradas_actual = next((i + 1 for i, row in enumerate(all_rows) if row and row[0].strip() == MARCADOR_RETIRADAS), row_retiradas)

        target_row = row_retiradas_actual + 1
        max_iterations = 100
        iteration_count = 0
        
        while iteration_count < max_iterations:
            iteration_count += 1
            
            encontrada = None
            for i, row in enumerate(all_rows):
                row_num = i + 1
                
                # Saltar filas que ya están en su zona correcta (después de RETIRADAS)
                if row_num > row_retiradas_actual:
                    continue
                
                if len(row) <= col_estado_idx:
                    continue
                
                estado = row[col_estado_idx].strip()
                if estado == "Retirada":
                    # Solo mover si está ANTES del marcador RETIRADAS (fuera de su zona correcta)
                    encontrada = {"row_num": row_num, "estilo": row[2].strip() if len(row) > 2 else ""}
                    break
            
            if encontrada is None:
                logger.info(f"No hay más Retiradas para mover (iteraciones: {iteration_count})")
                break
            
            logger.info(f"Moviendo Retirada fila {encontrada['row_num']} ({encontrada['estilo']}) a posición {target_row}")
            _move_rows_physically(sheet_id, gid, encontrada["row_num"] - 1, target_row - 1, 1)
            # Actualizar el array en memoria para reflejar el movimiento
            moved_row = all_rows.pop(encontrada["row_num"] - 1)
            all_rows.insert(target_row - 1, moved_row)
            # Ajustar el marcador si la fila movida estaba antes del marcador
            if encontrada["row_num"] < row_retiradas_actual:
                row_retiradas_actual -= 1
            
            target_row += 1
        
        # Contar resultados finales
        all_rows = ws.get_all_values()
        pinchadas = en_camara = na = para_retirar = retiradas = 0
        
        for i, row in enumerate(all_rows):
            if i < row_en_camara:  # Contar desde después de EN CAMARA
                continue
            if len(row) <= col_estado_idx:
                continue
            estado = row[col_estado_idx].strip()
            if estado == "Pinchada":
                pinchadas += 1
            elif estado == "En Camara":
                en_camara += 1
            elif estado == "N/A":
                na += 1
            elif estado == "Para Retirar":
                para_retirar += 1
            elif estado == "Retirada":
                retiradas += 1
        
        logger.info(f"Reordenamiento completo - Pinchadas: {pinchadas}, En Cámara: {en_camara}, N/A: {na}, Para Retirar: {para_retirar}, Retiradas: {retiradas}")

        return {
            "success": True,
            "pinchadas": pinchadas,
            "en_camara": en_camara,
            "na": na,
            "para_retirar": para_retirar,
            "retiradas": retiradas,
        }
    
    except Exception as e:
        logger.error(f"Error en reordenar_sheet: {str(e)}", exc_info=True)
        raise


@rate_limited
def get_catalogo_birras(sucursal_id: str = "1") -> List[Dict[str, Any]]:
    """Catálogo de birras desde INFO (col B=Estilo, C=Productor, D=Tipo)."""
    config = SUCURSALES_CONFIG.get(sucursal_id, SUCURSALES_CONFIG["1"])
    gc = _get_client()
    sh = gc.open_by_key(config["sheet_id"])
    ws = sh.worksheet(config["info_sheet_name"])
    rows = ws.get_all_values()
    birras = []
    for i, row in enumerate(rows):
        if i < 14:
            continue
        while len(row) < 4:
            row.append("")
        estilo = row[1].strip()
        productor = row[2].strip()
        tipo = row[3].strip()
        if estilo and productor:
            birras.append({"estilo": estilo, "productor": productor, "tipo": tipo})
    return birras


@rate_limited
def get_info_birras_con_precio(sucursal_id: str = "1") -> Dict[str, Any]:
    """
    Birras con precio desde la hoja INFO.
      - B16:B1000  → nombre del estilo (columna B, índice 1)
      - D16:D1000  → letra de categoría (A, B, C...) (columna D, índice 3)
      - I29:J35    → tabla lookup: I=letra, J=precio normal
      - J36        → precio Hora Santa (para cervezas tipo B, 17-20hs BsAs)
    Devuelve { birras: [{estilo, precio, codigo}], hora_santa_precio }.
    """
    config = SUCURSALES_CONFIG.get(sucursal_id, SUCURSALES_CONFIG["1"])
    gc = _get_client()
    sh = gc.open_by_key(config["sheet_id"])
    ws = sh.worksheet(config["info_sheet_name"])
    rows = ws.get_all_values()

    # Tabla de lookup de precios: I29:J35 (0-indexed filas 28-34, cols 8 y 9)
    precio_lookup: Dict[str, str] = {}
    for i in range(28, min(35, len(rows))):
        row = rows[i]
        while len(row) < 10:
            row.append("")
        letra = row[8].strip()   # columna I
        precio = row[9].strip()  # columna J
        if letra and precio:
            precio_lookup[letra.upper()] = precio

    # Precio Hora Santa: J36 (0-indexed fila 35, columna J = índice 9)
    hora_santa_precio = ""
    if 35 < len(rows):
        row36 = rows[35]
        while len(row36) < 10:
            row36.append("")
        hora_santa_precio = row36[9].strip()

    logger.debug(f"Tabla precios INFO: {precio_lookup} | Hora Santa: {hora_santa_precio}")

    # Birras: B16:D1000 (0-indexed fila 15 en adelante)
    seen: set = set()
    birras: List[Dict[str, str]] = []
    for i in range(15, len(rows)):   # fila 16 = índice 15
        row = rows[i]
        while len(row) < 4:
            row.append("")
        estilo = row[1].strip()   # columna B
        codigo = row[3].strip()   # columna D
        proveedor = row[2].strip() if len(row) > 2 else ""
        if not estilo and not proveedor:
            break  # fila completamente vacía, fin del catálogo
        if not estilo or estilo in seen:
            continue
        seen.add(estilo)
        precio = precio_lookup.get(codigo.upper(), "")
        birras.append({"estilo": estilo, "precio": precio, "codigo": codigo})

    birras.sort(key=lambda x: x["estilo"].lower())
    return {"birras": birras, "hora_santa_precio": hora_santa_precio}


@rate_limited
def get_visor_data(sucursal_id: str = "1") -> List[Dict[str, Any]]:
    """
    Obtiene datos para el visor desde la hoja "CARTELERIA ACTUAL DE VISOR", rango A3:F20.
    
    Estructura:
    - Columna A: Canilla (1-18)
    - Columna B: Estilo (nombre cerveza)
    - Columna C: Proveedor
    - Columna D: Amargor (nivel 1-5)
    - Columna E: ABV (alcohol %)
    - Columna F: Precio
    """
    try:
        logger.debug(f"get_visor_data() iniciado para sucursal {sucursal_id}")
        
        # Obtener barriles activos del BARRILES sheet (para canilla y estado)
        try:
            barriles = get_barriles(filtro="activos", sucursal_id=sucursal_id)
            logger.debug(f"Obtenidos {len(barriles)} barriles activos del BARRILES sheet")
        except Exception as e:
            logger.error(f"Error obteniendo barriles: {e}")
            barriles = []
        
        if not barriles:
            logger.warning(f"No hay barriles activos para sucursal {sucursal_id}")
            return []
        
        # Obtener datos del sheet "CARTELERIA ACTUAL DE VISOR", rango A3:F20
        info_data = {}
        try:
            config = SUCURSALES_CONFIG.get(sucursal_id, SUCURSALES_CONFIG["1"])
            gc = _get_client()
            sh = gc.open_by_key(config["sheet_id"])
            
            # Usar el sheet "CARTELERIA ACTUAL DE VISOR"
            ws = sh.worksheet("CARTELERIA ACTUAL DE VISOR")
            
            # Leer el rango A1:F20 (vamos a extraer desde fila 3)
            all_values = ws.get_all_values()
            
            logger.info(f"[VISOR] Total rows in CARTELERIA: {len(all_values)}")
            
            # Procesar filas 3 a 20 (índices 2 a 19 en la lista)
            for row_idx in range(2, min(20, len(all_values))):
                row = all_values[row_idx]
                
                # Asegurar que la fila tiene al menos 6 columnas
                while len(row) < 6:
                    row.append("")
                
                canilla = str(row[0]).strip()  # Columna A
                
                if canilla and canilla.isdigit():  # Solo si tiene número válido
                    info_data[canilla] = {
                        "estilo": str(row[1]).strip(),      # Columna B
                        "proveedor": str(row[2]).strip(),   # Columna C
                        "amargor": str(row[3]).strip(),     # Columna D
                        "abv": str(row[4]).strip(),         # Columna E
                        "precio": str(row[5]).strip(),      # Columna F
                        "palabras_destacar": str(row[7]).strip() if len(row) > 7 else "",  # Columna H
                    }
                    logger.info(f"[VISOR] Canilla {canilla}: amargor='{row[3]}', abv='{row[4]}', precio='{row[5]}', palabras='{row[7] if len(row) > 7 else ''}'")
            
            logger.info(f"[VISOR] Parseadas {len(info_data)} canillas de CARTELERIA ACTUAL DE VISOR")
            
        except Exception as e:
            logger.error(f"Error obteniendo datos de CARTELERIA ACTUAL DE VISOR: {e}", exc_info=True)
            info_data = {}
        
        # Enriquecer barriles con datos del sheet CARTELERIA
        visor_data = []
        for barril in barriles[:18]:
            canilla_str = str(barril.get("canilla", "")).strip()
            
            if canilla_str in info_data:
                # Si encontramos la canilla en CARTELERIA, usar todos esos datos
                info = info_data[canilla_str]
                barril["estilo"] = info["estilo"]
                barril["proveedor"] = info["proveedor"]
                barril["amargor"] = info["amargor"]
                barril["abv"] = info["abv"]
                barril["precio"] = info["precio"]
                barril["palabras_destacar"] = info.get("palabras_destacar", "")  # Agregar palabras a destacar
            else:
                # Si no encuentra, mantener datos del BARRILES sheet
                barril["precio"] = str(barril.get("precio", ""))
                barril["palabras_destacar"] = ""
            
            visor_data.append(barril)
        
        logger.debug(f"Retornando {len(visor_data)} barriles para visor")
        return visor_data
        
    except Exception as e:
        logger.error(f"Error crítico en get_visor_data(): {e}", exc_info=True)
        return []


def get_carteleria_visor2(sucursal_id: str = "1") -> Dict[str, Any]:
    """
    Lee la hoja CARTELERIA ACTUAL DE VISOR y devuelve los ítems agrupados.

    Columnas (0-indexed):
      J (9)  → grupo (número o letra)
      L (11) → nombre del ítem
      M (12) → precio

    Nombres de grupos en O4:P7 (0-indexed filas 3-6, cols 14-15):
      O (14) → id del grupo
      P (15) → nombre visible
    """
    config = SUCURSALES_CONFIG.get(sucursal_id, SUCURSALES_CONFIG["1"])
    gc = _get_client()
    sh = gc.open_by_key(config["sheet_id"])

    try:
        ws = sh.worksheet("CARTELERIA ACTUAL DE VISOR")
    except Exception as e:
        logger.error(f"Sheet CARTELERIA ACTUAL DE VISOR no encontrado: {e}")
        raise ValueError("Hoja CARTELERIA ACTUAL DE VISOR no encontrada en el spreadsheet")

    all_values = ws.get_all_values()

    # ── Leer grupos desde O4:Q7 (filas índice 3-6, cols O=14, P=15, Q=16) ──────
    group_names: Dict[str, str] = {}
    group_horarios: Dict[str, str] = {}
    group_order: list = []
    for row_idx in range(3, min(7, len(all_values))):
        row = all_values[row_idx]
        while len(row) < 17:
            row.append("")
        gid_val      = str(row[14]).strip()  # columna O — id del grupo
        gname_val    = str(row[15]).strip()  # columna P — nombre visible
        ghorario_val = str(row[16]).strip()  # columna Q — leyenda de horario
        if gid_val:
            group_names[gid_val]    = gname_val or gid_val
            group_horarios[gid_val] = ghorario_val
            group_order.append(gid_val)

    # ── Leer ítems: columnas J (9), L (11), M (12) ────────────────────────────
    items_by_group: Dict[str, list] = {gid: [] for gid in group_order}

    for row_idx in range(1, len(all_values)):  # saltar fila de header (fila 1)
        row = all_values[row_idx]
        while len(row) < 13:
            row.append("")
        grupo  = str(row[9]).strip()   # J
        nombre = str(row[11]).strip()  # L
        precio = str(row[12]).strip()  # M

        if not grupo or not nombre:
            continue
        if grupo not in items_by_group:
            if grupo not in group_names:
                group_names[grupo]    = grupo
                group_horarios[grupo] = ""
                group_order.append(grupo)
            items_by_group[grupo] = []
        items_by_group[grupo].append({"nombre": nombre, "precio": precio})

    # ── Armar respuesta ordenada ───────────────────────────────────────────────
    from .promo_rules import is_group_visible
    groups = [
        {
            "id": gid,
            "nombre": group_names.get(gid, gid),
            "horario": group_horarios.get(gid, ""),
            "items": items_by_group.get(gid, []),
            "visible": is_group_visible(group_names.get(gid, gid)),
        }
        for gid in group_order
    ]

    # ── Leer desglose de Menú Ejecutivo desde O31:P35 (filas índice 30-34) ──────
    menu_ejecutivo = []
    for row_idx in range(30, min(35, len(all_values))):
        row = all_values[row_idx]
        while len(row) < 16:
            row.append("")
        o_val = str(row[14]).strip()  # columna O
        p_val = str(row[15]).strip()  # columna P
        menu_ejecutivo.append({"label": o_val, "value": p_val})

    logger.info(f"[VISOR2] {sum(len(g['items']) for g in groups)} ítems en {len(groups)} grupos")
    return {"groups": groups, "menu_ejecutivo": menu_ejecutivo}
