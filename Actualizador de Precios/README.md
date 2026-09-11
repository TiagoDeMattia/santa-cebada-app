# Actualizador de Precios — Santa Cebada

Lee precios desde Google Sheets y los actualiza automáticamente en NucleoCheck.

## Instalación

```bash
pip install playwright gspread google-auth
playwright install chromium
```

## Configuración

1. Colocá el archivo `credentials.json` (service account) en la misma carpeta que el script
2. Abrí `actualizar_precios.py` y editá las primeras líneas:

```python
NUCLEO_EMAIL    = "tu_email@gmail.com"
NUCLEO_PASSWORD = "tu_password"
```

## Uso

```bash
python actualizar_precios.py
```

El script corre con ventana visible (`headless=False`) para que puedas ver lo que hace.
Cuando estés seguro de que funciona bien, podés cambiar a `headless=True`.

## Sheet esperado

| Col E     | Col F   | Col G  | Col H       |
|-----------|---------|--------|-------------|
| Código    | Nombre  | Precio | Observación |
| 2         | Pinta   | 5000   | (ignorado)  |

- Los precios se leen como números (acepta `5000`, `5.000` o `5000,00`)
- Filas con código o precio vacío se saltean automáticamente
