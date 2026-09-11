# Physical Row Movement Implementation

## Overview

This document describes the implementation of **physical row movement** for the reordering functionality in the Barriles system. This approach preserves all cell properties including dropdowns, formulas, checkboxes, and formatting.

---

## Problem Statement

The previous implementation used **copy/paste** to reorder rows, which had the following issues:
- ❌ Destroyed dropdown menus (columns C, G, J)
- ❌ Overwrote formulas (columns B, H, K, M, N, O, Q in Recoleta; K, L, M, O in Palermo)
- ❌ Lost checkbox validations (column E)
- ❌ Lost cell formatting

---

## Solution: Physical Row Movement

The new implementation uses **Google Sheets API v4** to physically move rows instead of copying data. This preserves:
- ✅ Dropdown menus (data validations)
- ✅ Formulas
- ✅ Checkboxes
- ✅ Cell formatting
- ✅ All other cell properties

---

## Technical Implementation

### 1. Dependencies

Added `google-api-python-client` to `requirements.txt`:

```txt
google-api-python-client==2.108.0
```

### 2. New Functions

#### `_get_sheets_v4_service()`

Creates a Google Sheets API v4 service client:

```python
def _get_sheets_v4_service():
    """Obtiene servicio de Google Sheets API v4 para operaciones avanzadas (mover filas)."""
    creds = Credentials.from_service_account_file(
        settings.credentials_json_path,
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )
    return build('sheets', 'v4', credentials=creds)
```

#### `_move_rows_physically()`

Moves rows physically using the Sheets API v4 `cutPaste` request:

```python
def _move_rows_physically(
    sheet_id: str,
    gid: int,
    source_row_index: int,
    destination_row_index: int,
    num_rows: int = 1
) -> None:
    """
    Mueve filas físicamente usando la API de Google Sheets v4.
    
    Args:
        sheet_id: ID del spreadsheet
        gid: ID del sheet (tab)
        source_row_index: Índice de la fila origen (0-indexed)
        destination_row_index: Índice de destino (0-indexed)
        num_rows: Número de filas a mover
    """
    service = _get_sheets_v4_service()
    
    request = {
        "cutPaste": {
            "source": {
                "sheetId": gid,
                "startRowIndex": source_row_index,
                "endRowIndex": source_row_index + num_rows,
            },
            "destination": {
                "sheetId": gid,
                "rowIndex": destination_row_index,
            },
            "pasteType": "PASTE_NORMAL",
        }
    }
    
    body = {"requests": [request]}
    service.spreadsheets().batchUpdate(
        spreadsheetId=sheet_id,
        body=body
    ).execute()
```

### 3. Updated Configuration

Added `gid` (sheet ID) to `SUCURSALES_CONFIG`:

```python
SUCURSALES_CONFIG = {
    "1": {
        "nombre": "Recoleta",
        "sheet_id": "1Sw-TqlevrqHUt4krNOjzqY0qRQfW3Odm7ZJrp2ZhEsI",
        "sheet_name": "BARRILES",
        "gid": 1085849685,  # Sheet ID para API v4
        # ...
    },
    "2": {
        "nombre": "Palermo",
        "sheet_id": "1QNDaWPj-_tp75moQa-dgwwVwGkFphgMaXQ0p2yHNrYw",
        "sheet_name": "BARRILES",
        "gid": 1891271008,  # Sheet ID para API v4
        # ...
    },
}
```

### 4. Rewritten Reordering Functions

#### `reordenar_sheet()` (Recoleta - with markers)

Strategy:
1. Identify all barriles by estado (Pinchada, En Camara, Para Retirar, Retirada)
2. Sort pinchadas by canilla number
3. Build desired order
4. **Move rows physically from bottom to top** to avoid index conflicts
5. Update row indices after each move

```python
def reordenar_sheet(sucursal_id: str = "1") -> Dict[str, Any]:
    # ... identify barriles and sort ...
    
    # Move rows physically using API v4
    sheet_id = config["sheet_id"]
    gid = config["gid"]
    
    # 1. Move retiradas
    target_row = row_retiradas + 1
    for item in orden_retiradas:
        current_row = item["row_num"]
        if current_row != target_row:
            _move_rows_physically(sheet_id, gid, current_row - 1, target_row - 1, 1)
            # Update indices of affected rows
            for other in orden_retiradas + orden_historial + orden_activos:
                if other["row_num"] >= target_row and other["row_num"] < current_row:
                    other["row_num"] += 1
            item["row_num"] = target_row
        target_row += 1
    
    # 2. Move para retirar
    # 3. Move activos (pinchadas + en cámara)
    # ...
```

#### `_reordenar_sheet_sin_marcadores_moviendo()` (Palermo - without markers)

Strategy:
1. Identify all barriles by estado
2. Sort pinchadas by canilla number
3. Build complete order: Pinchadas + En Cámara + Para Retirar + Retiradas
4. **Move rows physically** to target positions
5. Update row indices after each move

```python
def _reordenar_sheet_sin_marcadores_moviendo(
    sucursal_id: str,
    ws,
    all_rows: List[List[str]],
    config: Dict
) -> Dict[str, Any]:
    # ... identify barriles and sort ...
    
    # Build complete order
    orden_completo = pinchadas + en_camara + para_retirar + retiradas
    
    # Move rows physically
    sheet_id = config["sheet_id"]
    gid = config["gid"]
    
    target_row = DATA_START_ROW
    for item in orden_completo:
        current_row = item["row_num"]
        if current_row != target_row:
            _move_rows_physically(sheet_id, gid, current_row - 1, target_row - 1, 1)
            # Update indices
            for other in orden_completo:
                if other["row_num"] >= target_row and other["row_num"] < current_row:
                    other["row_num"] += 1
            item["row_num"] = target_row
        target_row += 1
```

---

## Protected Columns

The following columns are **automatically preserved** by physical row movement:

### Both Sucursales:
- **Column B (Proveedor)**: Auto-populated formula
- **Column C (Estilo)**: Dropdown menu
- **Column E (BARRIL N.)**: Checkbox (TRUE=50L, FALSE=30L)
- **Column G (Nombre pinchó)**: Dropdown menu
- **Column J (Nombre despinchó)**: Dropdown menu

### Recoleta Only:
- **Column H (Turno pinchado)**: Formula
- **Column K (Turno despinchado)**: Formula
- **Column M (Días Pinchado)**: Formula
- **Column N (Estado)**: Formula
- **Column O (Días de retirado)**: Formula
- **Column Q (T.P.)**: Formula

### Palermo Only:
- **Column K (Días Pinchado)**: Formula
- **Column L (Estado)**: Formula
- **Column M (Días de retirado)**: Formula
- **Column O (T.P.)**: Formula

---

## Columns That Can Be Modified

The following columns contain data that can be modified directly:

### Recoleta:
- **Column A (Ingreso)**: Date
- **Column D (Código)**: Text
- **Column F (Fecha pinchado)**: Date
- **Column I (Fecha despinchado)**: Date
- **Column L (Fecha retirado)**: Date
- **Column P (Canilla)**: Number

### Palermo:
- **Column A (Ingreso)**: Date
- **Column D (Código)**: Text
- **Column F (Fecha pinchado)**: Date
- **Column H (Fecha despinchado)**: Date
- **Column J (Fecha retirado)**: Date
- **Column N (Canilla)**: Number

---

## How It Works

### Index Management

When moving rows, we need to carefully manage row indices because moving a row affects the indices of other rows:

1. **Moving a row UP** (to a lower row number):
   - All rows between destination and source shift down by 1
   - Example: Moving row 10 to row 5 → rows 5-9 become 6-10

2. **Moving a row DOWN** (to a higher row number):
   - All rows between source and destination shift up by 1
   - Example: Moving row 5 to row 10 → rows 6-10 become 5-9

Our implementation updates the `row_num` field in our data structure after each move to keep track of where each row is.

### Movement Order

We move rows in sections:
1. **Retiradas** (bottom section) - moved first
2. **Para Retirar** (middle section) - moved second
3. **Activos** (top section: Pinchadas + En Cámara) - moved last

This order minimizes index conflicts.

---

## API Endpoint

The endpoint remains the same:

```bash
POST /api/barriles/reordenar?sucursal_id=1  # Recoleta
POST /api/barriles/reordenar?sucursal_id=2  # Palermo
```

---

## Testing

### Test Cases

1. ✅ **Recoleta Reordering**
   - Pinchadas ordered by canilla number
   - En Cámara placed after Pinchadas
   - Para Retirar placed after VACIOS marker
   - Retiradas placed after RETIRADAS marker
   - All dropdowns preserved
   - All formulas preserved
   - All checkboxes preserved

2. ✅ **Palermo Reordering**
   - Pinchadas ordered by canilla number
   - All estados in one section: Pinchadas + En Cámara + Para Retirar + Retiradas
   - All dropdowns preserved
   - All formulas preserved
   - All checkboxes preserved

### How to Test

1. Open the Barriles page in the frontend
2. Select a sucursal (Recoleta or Palermo)
3. Click "Reordenar" button
4. Verify:
   - Pinchadas are ordered by canilla number
   - Dropdowns in columns C, G, J still work
   - Formulas in columns B, H, K, M, N, O, Q (Recoleta) or K, L, M, O (Palermo) still calculate
   - Checkboxes in column E still work

---

## Benefits

### Before (Copy/Paste Approach):
- ❌ Lost dropdowns
- ❌ Lost formulas
- ❌ Lost checkboxes
- ❌ Lost formatting
- ❌ Required manual fixing after reordering

### After (Physical Movement Approach):
- ✅ Preserves dropdowns
- ✅ Preserves formulas
- ✅ Preserves checkboxes
- ✅ Preserves formatting
- ✅ No manual fixing needed
- ✅ Exactly like manually dragging rows in Google Sheets

---

## Future Enhancements

### Column E Checkbox Handling

When creating new barriles, the system should:
1. Ask user if the barril is 30L or 50L
2. Set column E checkbox accordingly:
   - TRUE = 50L barril
   - FALSE = 30L barril

This is currently handled by the sheet's default value (TRUE), but should be made explicit in the creation flow.

---

## Files Modified

1. **backend-nucleo/requirements.txt**
   - Added `google-api-python-client==2.108.0`

2. **backend-nucleo/src/services/barriles_service.py**
   - Added `_get_sheets_v4_service()` function
   - Added `_move_rows_physically()` function
   - Rewrote `reordenar_sheet()` to use physical movement
   - Rewrote `_reordenar_sheet_sin_marcadores_moviendo()` to use physical movement
   - Added `gid` to `SUCURSALES_CONFIG`
   - Removed all copy/paste code
   - Added comprehensive documentation

---

## Conclusion

The physical row movement implementation successfully preserves all cell properties during reordering, making the system behave exactly like manually dragging rows in Google Sheets. This eliminates the need for manual fixes after reordering and ensures data integrity.

---

## Links

- **Recoleta Sheet**: https://docs.google.com/spreadsheets/d/1Sw-TqlevrqHUt4krNOjzqY0qRQfW3Odm7ZJrp2ZhEsI/edit?gid=1085849685#gid=1085849685
- **Palermo Sheet**: https://docs.google.com/spreadsheets/d/1QNDaWPj-_tp75moQa-dgwwVwGkFphgMaXQ0p2yHNrYw/edit?gid=1891271008#gid=1891271008
- **Google Sheets API v4 Documentation**: https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#cutpasterequest
