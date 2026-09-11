# 🚀 PLAN DE DEPLOY - RECETARIO NUCLEO EN VPS

## 📋 RESUMEN EJECUTIVO

**Objetivo**: Desplegar Recetario Nucleo en el VPS sin afectar Santa Cebada

**Estado Actual**:
- ✅ VPS: `89.167.100.235`
- ✅ Santa Cebada en funcionamiento (Puerto 3000)
- ✅ Usuario: `tiago`
- ✅ Espacio disponible: 6.4GB
- ✅ Acceso SSH confirmado

---

## 🎯 PLAN DE DESPLIEGUE

### Fase 1: Crear Estructura Independiente

```
ANTES (Solo Santa Cebada):
/home/tiago/
└── santa-cebada/

DESPUÉS (Santa Cebada + Recetario):
/home/tiago/
├── santa-cebada/          ← INTACTO ✅
└── recetario-nucleo/      ← NUEVO
    ├── backend/           (FastAPI - Puerto 8001)
    ├── frontend/          (Build estático de Vite)
    └── logs/
```

### Fase 2: Backend (Python/FastAPI)

```
Ubicación:     /home/tiago/recetario-nucleo/backend/
Technología:   FastAPI + Uvicorn
Puerto:        8001
BD:            SQLite (recetario.db)
Servicio:      systemd → recetario-backend.service
Logs:          journalctl -u recetario-backend
```

### Fase 3: Frontend (React/Vite)

```
Ubicación:     /home/tiago/recetario-nucleo/frontend/dist/
Construcción:  npm run build (Build estático)
Acceso:        ⏳ Será configurado en Nginx/Caddy
URL:           ⏳ Por definir después
```

---

## 🔧 DETALLES TÉCNICOS

### Puertos en Uso

```
Puerto 3000    ✅ Santa Cebada (INTACTO)
Puerto 8001    🆕 Recetario Backend (NUEVO)
Puerto 80/443  ✅ Nginx/Caddy (distribuidor)
```

### Archivo de Configuración

**Ubicación**: `/etc/systemd/system/recetario-backend.service`

```ini
[Unit]
Description=Recetario Backend - FastAPI
After=network.target

[Service]
Type=simple
User=tiago
WorkingDirectory=/home/tiago/recetario-nucleo/backend
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8001
Restart=on-failure
RestartSec=5
Environment="PYTHONUNBUFFERED=1"

[Install]
WantedBy=multi-user.target
```

### Dependencias a Instalar

```bash
pip install fastapi uvicorn sqlite3 # (ya incluidas en requirements.txt)
```

---

## 📋 ARCHIVOS A COPIAR

### Backend (Python)

```
LOCAL                          →  VPS
─────────────────────────────────────────────────
main.py                    →  backend/main.py
requirements.txt           →  backend/requirements.txt
src/                       →  backend/src/
.env                       →  backend/.env
```

### Frontend (Build estático)

```
LOCAL                          →  VPS
─────────────────────────────────────────────────
frontend/dist/             →  frontend/dist/
(todo el contenido generado por: npm run build)
```

**❌ NO se copia**:
- `node_modules/` (instalaremos en VPS)
- `*.db` en frontend/backend (crearemos nuevas)
- `.env` (usaremos el del local o crearemos uno)

---

## ⏱️ TIEMPO ESTIMADO

| Tarea | Tiempo |
|-------|--------|
| Conexión SSH | 10s |
| Crear directorios | 5s |
| Copiar backend | 30s |
| Instalar dependencias Python | 20s |
| Build frontend (local) | 30s |
| Copiar frontend | 10s |
| Crear servicio systemd | 5s |
| Iniciar servicio | 5s |
| Verificación | 10s |
| **TOTAL** | **2-3 min** |

---

## 🛡️ SEGURIDAD Y REVERSIBILIDAD

### Si algo falla:

```bash
# 1. Detener servicio
sudo systemctl stop recetario-backend

# 2. Eliminar directorio
rm -rf /home/tiago/recetario-nucleo/

# 3. Eliminar servicio
rm /etc/systemd/system/recetario-backend.service
sudo systemctl daemon-reload

# → Santa Cebada sigue funcionando ✅
```

---

## 📊 VERIFICACIÓN POST-DEPLOY

### Backend

```bash
# Verificar que el servicio está activo
sudo systemctl status recetario-backend

# Ver logs
sudo journalctl -u recetario-backend -n 50 -f

# Probar endpoint
curl http://localhost:8001/health
```

### Santa Cebada

```bash
# Verificar que sigue ejecutándose
ps aux | grep "santa-cebada/server.js" | grep -v grep

# Debería devolver: ✅ proceso activo
```

---

## 🚀 CÓMO EJECUTAR EL DEPLOY

### Opción 1: Script Python Automatizado (RECOMENDADO)

```bash
python deploy_recetario_vps.py
```

**El script hace automáticamente**:
1. ✅ Conecta al VPS
2. ✅ Crea directorios
3. ✅ Copia archivos
4. ✅ Instala dependencias
5. ✅ Compila frontend
6. ✅ Crea servicio
7. ✅ Inicia aplicación
8. ✅ Verifica todo

**Requisitos**:
- Python 3.6+
- `pip install paramiko`
- Acceso SSH al VPS
- Node.js instalado localmente (para build frontend)

### Opción 2: Manual Step-by-Step

(Si prefieres mayor control)

```bash
# 1. SSH al VPS
ssh -i "Credenciales VPS/tiago_vps_1_ed25519" -p 2222 tiago@89.167.100.235

# 2. Crear directorios
mkdir -p /home/tiago/recetario-nucleo/{backend,frontend/dist,logs}

# 3. Copiar archivos (desde otra terminal con SFTP)
# ... usar script SFTP ...

# 4. Instalar dependencias
cd /home/tiago/recetario-nucleo/backend
pip install -r requirements.txt

# 5. Crear servicio (ver archivo recetario-backend.service)
sudo tee /etc/systemd/system/recetario-backend.service < recetario-backend.service
sudo systemctl daemon-reload
sudo systemctl enable recetario-backend
sudo systemctl start recetario-backend

# 6. Verificar
sudo systemctl status recetario-backend
```

---

## 📞 TROUBLESHOOTING

### Problema: "Port 8001 already in use"

```bash
# Encontrar qué está usando el puerto
sudo lsof -i :8001

# Matar proceso (si es seguro)
sudo kill -9 <PID>
```

### Problema: "Permission denied" al escribir archivos

```bash
# Asegurar permisos correctos
sudo chown -R tiago:tiago /home/tiago/recetario-nucleo
chmod -R 755 /home/tiago/recetario-nucleo
```

### Problema: Backend no inicia

```bash
# Ver logs detallados
sudo journalctl -u recetario-backend -n 50 -f

# Probar manualmente
cd /home/tiago/recetario-nucleo/backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8001
```

### Problema: Santa Cebada dejó de funcionar

```bash
# Verificar estado
ps aux | grep "santa-cebada/server.js"

# Reiniciar si es necesario
cd /home/tiago/santa-cebada
npm restart
```

---

## 📝 CHECKLIST PRE-DEPLOY

- [ ] Archivo `deploy_recetario_vps.py` preparado
- [ ] Ruta de clave SSH correcta
- [ ] `paramiko` instalado (`pip install paramiko`)
- [ ] `npm install` completado en frontend/
- [ ] Requirements.txt actualizado en backend/
- [ ] .env preparado (si es necesario)
- [ ] Backup de configuración actual tomado
- [ ] Verificado acceso SSH manual

---

## 📝 CHECKLIST POST-DEPLOY

- [ ] Backend iniciado en puerto 8001
- [ ] Santa Cebada sigue funcionando
- [ ] Logs sin errores críticos
- [ ] Frontend copiado correctamente
- [ ] BD de recetario creada
- [ ] Servicio se reinicia automáticamente

---

## 🎯 PRÓXIMOS PASOS (DESPUÉS DEL DEPLOY)

1. **Configurar dominio**
   - Decidir URL: `recetario.santacebada.com.ar` o similar
   - Crear registro DNS

2. **Configurar Nginx/Caddy**
   - Agregar bloque para nuevo dominio
   - Proxy a puerto 8001
   - SSL automático

3. **Actualizar frontend**
   - Cambiar `API_BASE` en componentes
   - Build y redeploy si es necesario

4. **Testing completo**
   - Verificar que funciona en producción
   - Probar todas las características
   - Monitorear logs

---

## 📚 REFERENCIAS

- FastAPI: https://fastapi.tiangolo.com/
- Uvicorn: https://www.uvicorn.org/
- Systemd: https://systemd.io/
- Nginx: https://nginx.org/

---

*Documento preparado para deploy seguro e independiente*
*Riesgo de afectar Santa Cebada: NULO ✅*
*Tiempo estimado: 2-3 minutos*
