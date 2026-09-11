# Santa Cebada - Estadistica Backend

Modulo Python para obtener, persistir y devolver la estadistica completa de Santa Cebada sin depender de Streamlit.

## Archivos principales

- `scraper.py`: trae pedidos, pagos, productos y gastos desde NucleoCheck
- `database.py`: persistencia en SQLite o Postgres
- `data_processing.py`: limpieza y metricas
- `statistics_service.py`: entrypoint pensado para integrar en otra webapp

## Variables de entorno

- `DATABASE_URL`
- `NUCLEO_EMAIL_PALERMO`
- `NUCLEO_PASSWORD_PALERMO`
- `NUCLEO_EMAIL_RECOLETA`
- `NUCLEO_PASSWORD_RECOLETA`
- `HISTORY_START_DATE`

## Uso basico

```powershell
python -m pip install -r requirements.txt
python statistics_service.py
```

## Integracion en tu webapp

```python
from statistics_service import scrape_complete_statistics_for_period

payload = scrape_complete_statistics_for_period(
    location_key="palermo",
    period="today",
)
```

`payload` devuelve un diccionario listo para serializar a JSON con:

- resumen general
- series de ventas y finanzas
- medios de pago
- productos y rubros
- gastos
- clientes
- ventas por hora
- heatmap semanal
- controles de calidad
