# Backend Nucleo - Santa Cebada

API REST para gestión de precios y productos del sistema NucleoCheck.

## Arquitectura

```
backend-nucleo/
├── src/
│   ├── config/          # Configuración y settings
│   ├── models/          # Modelos Pydantic (schemas)
│   ├── services/        # Lógica de negocio
│   ├── controllers/     # Controladores de API
│   ├── routes/          # Enrutadores
│   ├── middleware/      # Auth, logging, etc.
│   ├── utils/           # Helpers y logger
│   └── main.py          # Punto de entrada
├── credentials.json     # Google Service Account
├── .env                 # Variables de entorno
└── requirements.txt     # Dependencias
```

## Instalación

```bash
# Crear entorno virtual
python -m venv venv
venv\Scripts\activate  # Windows

# Instalar dependencias
pip install -r requirements.txt

# Instalar Playwright browsers
playwright install chromium
```

## Configuración

1. Copiar `.env.example` a `.env`
2. Editar `.env` con tus credenciales
3. Colocar `credentials.json` (Google Service Account) en la carpeta raíz

## Ejecución

```bash
# Development
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Endpoints

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/verify` | Verificar token |

### Productos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/productos` | Listar productos |
| GET | `/api/productos/{id}` | Obtener producto |
| GET | `/api/productos/comparar` | Comparar sucursales |
| POST | `/api/productos/actualizar-precio` | Actualizar precio individual |
| POST | `/api/productos/actualizar-desde-sheet` | Actualización masiva |

### Sucursales
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/sucursales` | Listar sucursales |
| GET | `/api/sucursales/{id}` | Obtener sucursal |

## Documentación Interactiva

Una vez ejecutando, acceder a:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Ejemplo de Uso

### 1. Obtener token
```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "tu_password"}'
```

### 2. Listar productos
```bash
curl "http://localhost:8000/api/productos" \
  -H "Authorization: Bearer TU_TOKEN"
```

### 3. Actualizar precio
```bash
curl -X POST "http://localhost:8000/api/productos/actualizar-precio" \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"codigo": "123", "precio": 5000, "sucursal_id": "1"}'
```

### 4. Actualizar desde Sheet
```bash
curl -X POST "http://localhost:8000/api/productos/actualizar-desde-sheet" \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sucursal_id": "1", "modo_prueba": false}'
```

## Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `NUCLEO_PASSWORD` | Password de NucleoCheck | `13502` |
| `NUCLEO_API_BASE` | URL de API NucleoCheck | `https://api-prod.nucleocheck.com` |
| `SUCURSAL_RECOLETA_EMAIL` | Email sucursal Recoleta | - |
| `SUCURSAL_PALERMO_EMAIL` | Email sucursal Palermo | - |
| `SHEET_ID` | ID de Google Sheet | - |
| `JWT_SECRET` | Secreto para JWT tokens | - |
| `PORT` | Puerto del servidor | `8000` |

## Sucursales Configuradas

| ID | Nombre | Company ID |
|----|--------|------------|
| 1 | Recoleta | 1041 |
| 2 | Palermo | 827 |
