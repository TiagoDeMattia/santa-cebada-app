# 📋 ANÁLISIS: DESPLIEGUE INDEPENDIENTE EN VPS

## 🎯 Objetivo
Desplegar la nueva aplicación **Recetario** (Backend Nucleo + Frontend) de forma **independiente y segura** sin afectar la aplicación existente en producción.

---

## 🏗️ ESTRUCTURA ACTUAL EN VPS

### Aplicación Existente (Santa Cebada Fichaje)
```
/home/usuario/
├── santa-cebada/                    # Aplicación en producción
│   ├── server.js                    # Backend Express
│   ├── package.json
│   ├── public/
│   │   ├── app.js
│   │   └── index.html
│   ├── fichaje.db
│   └── logs/
│       └── app.log
│
└── (otros proyectos...)
```

### Configuración Nginx Actual
```
/etc/nginx/sites-enabled/
├── default                          # Archivo de configuración principal
└── (otros sites si existen)
```

### Procesos en Ejecución
```
systemd services:
└── node (o supervisord) para santa-cebada
```

---

## ✨ NUEVA ESTRUCTURA PROPUESTA

### Directorio Independiente
```
/home/usuario/
├── santa-cebada/                    # ✅ INTACTO - No modificar
│   └── (sin cambios)
│
└── recetario-nucleo/                # 🆕 NUEVO PROYECTO
    ├── backend/
    │   ├── main.py
    │   ├── requirements.txt
    │   ├── src/
    │   │   ├── routes/
    │   │   ├── services/
    │   │   ├── controllers/
    │   │   └── ...
    │   └── logs/
    │       └── backend.log
    │
    └── frontend/
        ├── index.html
        ├── dist/                    # Build de Vite
        ├── package.json
        ├── src/
        └── logs/
            └── frontend.log
```

---

## 🔄 ARCHIVOS/SERVICIOS A CREAR (SIN MODIFICAR EXISTENTES)

### 1️⃣ NUEVOS ARCHIVOS EN VPS

#### A. Backend Python
```
📁 /home/usuario/recetario-nucleo/backend/
├── main.py                          # 🆕 Punto de entrada FastAPI
├── requirements.txt                 # 🆕 Dependencias Python
├── src/                             # 🆕 Código fuente (copiar del local)
├── recetario.db                     # 🆕 BD del recetario
└── logs/
    └── backend.log                  # 🆕 Logs específicos
```

**Acceso**: `http://tu-vps:8001` (puerto diferente de santa-cebada)

#### B. Frontend Build (Vite)
```
📁 /home/usuario/recetario-nucleo/frontend/
├── dist/                            # 🆕 Build estático de Vite
│   ├── index.html
│   ├── assets/
│   └── ...
└── logs/
    └── frontend.log                 # 🆕 Logs de acceso
```

**Acceso**: `http://tu-vps/recetario` (servido por Nginx)

---

### 2️⃣ NUEVA CONFIGURACIÓN NGINX

#### Archivo: `/etc/nginx/sites-available/recetario-nucleo` (🆕 NUEVO)

```nginx
# ⚠️ NUEVOS BLOQUES - NO MODIFICAR EXISTENTES

# 1. Proxy para Backend FastAPI (Puerto 8001)
upstream recetario_backend {
    server localhost:8001;
}

# 2. Servidor para Frontend + API
server {
    listen 80;
    server_name recetario.tu-dominio.com.ar;  # O subdominio

    # SSL (nuevo certificado)
    ssl_certificate /etc/letsencrypt/live/recetario.tu-dominio.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/recetario.tu-dominio.com.ar/privkey.pem;

    # Frontend estático
    location / {
        root /home/usuario/recetario-nucleo/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
    }

    # API Backend
    location /api/ {
        proxy_pass http://recetario_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Documentación Swagger
    location /docs {
        proxy_pass http://recetario_backend/docs;
    }

    # Logs específicos
    access_log /var/log/nginx/recetario_access.log;
    error_log /var/log/nginx/recetario_error.log;
}
```

**⚠️ ARCHIVOS NO MODIFICADOS**:
- `/etc/nginx/sites-enabled/default` (santa-cebada intacto)
- Otras configuraciones existentes

---

### 3️⃣ NUEVO SERVICIO SYSTEMD

#### Archivo: `/etc/systemd/system/recetario-backend.service` (🆕 NUEVO)

```ini
[Unit]
Description=Recetario Backend - FastAPI
After=network.target
StartLimitIntervalSec=60
StartLimitBurst=3

[Service]
Type=simple
User=usuario
WorkingDirectory=/home/usuario/recetario-nucleo/backend
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8001
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

# Logs específicos
Environment="PYTHONUNBUFFERED=1"

[Install]
WantedBy=multi-user.target
```

**Comandos**:
```bash
sudo systemctl enable recetario-backend
sudo systemctl start recetario-backend
sudo systemctl status recetario-backend
```

**⚠️ NO MODIFICADO**: Servicio de santa-cebada (`node.service` o similar)

---

### 4️⃣ BASE DE DATOS INDEPENDIENTE

#### Archivo: `/home/usuario/recetario-nucleo/backend/recetario.db` (🆕 NUEVO)

- Directorio completamente independiente
- No interfiere con `fichaje.db` de santa-cebada
- Backups separados

---

## ❌ ARCHIVOS/SERVICIOS QUE NO SE MODIFICARÁN

### Aplicación Santa Cebada (INTACTA)
```
✅ /home/usuario/santa-cebada/         (SIN CAMBIOS)
✅ /etc/nginx/sites-enabled/default    (SIN CAMBIOS)
✅ /etc/systemd/system/node.service    (SIN CAMBIOS)
✅ /var/log/nginx/access.log           (SOLO se agregan logs de recetario)
✅ Puerto 3000 de Node.js              (SIN CAMBIOS)
```

### Sistema VPS Base
```
✅ /etc/nginx/nginx.conf               (SIN CAMBIOS)
✅ /etc/ssl/certs/                     (SIN CAMBIOS - solo agregar cert nuevo)
✅ Firewall / Puertos                  (Solo abrir 8001 si es necesario)
✅ Usuario/permisos base               (SIN CAMBIOS)
```

---

## 🔐 PUERTOS Y CERTIFICADOS

### Puertos Utilizados
```
Puerto 80    → Nginx (distribuidor de tráfico)
Puerto 443   → Nginx HTTPS
Port 3000    → ✅ Santa Cebada Node.js (INTACTO)
Puerto 8000  → ❌ NO USAR (evita conflicto)
Puerto 8001  → 🆕 Recetario Backend FastAPI
Puerto 8002  → (reservado si hay otra app)
```

### Certificados SSL
```
📁 /etc/letsencrypt/live/

Existente (INTACTO):
├── fichadas.santacebada.com.ar/
│   ├── fullchain.pem
│   └── privkey.pem

Nuevo (NUEVO):
└── recetario.tu-dominio.com.ar/
    ├── fullchain.pem
    └── privkey.pem
```

---

## 📝 RESUMEN DE CAMBIOS

| Item | Acción | Tipo | Riesgo |
|------|--------|------|--------|
| `/home/usuario/recetario-nucleo/` | Crear (nuevo directorio) | NUEVA | ✅ Bajo |
| `/etc/nginx/sites-available/recetario-nucleo` | Crear (nueva config) | NUEVA | ✅ Bajo |
| `/etc/nginx/sites-enabled/recetario-nucleo` | Symlink (nuevo) | NUEVA | ✅ Bajo |
| `/etc/systemd/system/recetario-backend.service` | Crear (nuevo servicio) | NUEVA | ✅ Bajo |
| `/etc/letsencrypt/live/recetario.tu-dominio.com.ar/` | Crear (nuevo cert) | NUEVA | ✅ Bajo |
| `/var/log/nginx/recetario_*.log` | Crear (nuevos logs) | NUEVA | ✅ Bajo |
| Aplicación Santa Cebada | ❌ SIN CAMBIOS | PROTEGIDO | ✅ NULO |
| Configuración Nginx base | ❌ SIN CAMBIOS | PROTEGIDO | ✅ NULO |
| Sistema operativo VPS | ❌ SIN CAMBIOS | PROTEGIDO | ✅ NULO |

---

## 🛡️ ESTRATEGIA DE SEGURIDAD

### 1. Aislamiento Total
- ✅ Directorio separado
- ✅ Usuario/permisos idénticos
- ✅ Base de datos independiente
- ✅ Logs separados

### 2. Reversibilidad
Si algo falla, solo necesitas:
```bash
# Eliminar el nuevo proyecto
rm -rf /home/usuario/recetario-nucleo/

# Eliminar config Nginx
rm /etc/nginx/sites-enabled/recetario-nucleo

# Eliminar servicio
systemctl stop recetario-backend
rm /etc/systemd/system/recetario-backend.service

# Recargar Nginx
sudo systemctl reload nginx

# Santa Cebada sigue en funcionamiento ✅
```

### 3. Testing Aislado
Puedes testear antes de activar en Nginx:
```bash
# Backend solo accesible internamente
curl http://localhost:8001/docs

# Frontend solo visible cuando Nginx esté configurado
```

---

## 📋 CHECKLIST PRE-DEPLOY

### Verificaciones Antes de Comenzar
- [ ] Acceso SSH confirmado al VPS
- [ ] Permisos de usuario verificados
- [ ] Puerto 8001 disponible (verificar con `sudo lsof -i :8001`)
- [ ] Espacio en disco suficiente (`df -h`)
- [ ] Backup de config Nginx existente (`sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak`)

### Durante el Deploy
- [ ] Nuevos directorios creados sin errores
- [ ] Archivos copiados correctamente
- [ ] Permisos configurados (`chmod 755` directorios, `644` archivos)
- [ ] Dependencias instaladas (`pip install -r requirements.txt`)
- [ ] Base de datos inicializada

### Después del Deploy
- [ ] Backend accesible: `curl http://localhost:8001/health`
- [ ] Nginx reiniciado: `sudo systemctl reload nginx`
- [ ] Frontend accesible: `curl https://recetario.tu-dominio.com.ar`
- [ ] Santa Cebada aún funciona: `curl https://fichadas.santacebada.com.ar`
- [ ] Logs sin errores: `tail -20 /var/log/nginx/recetario_error.log`

---

## 🚀 PRÓXIMO PASO

Cuando estés listo, voy a crear un **script Python de deploy** que automatiza todo esto:

1. ✅ Crea directorios
2. ✅ Copia archivos vía SFTP
3. ✅ Instala dependencias
4. ✅ Configura Nginx (sin tocar Santa Cebada)
5. ✅ Genera certificado SSL
6. ✅ Inicia servicio
7. ✅ Verifica funcionamiento
8. ✅ Confirma que Santa Cebada sigue funcionando

---

## ❓ PREGUNTAS IMPORTANTES

Antes de continuar, confirma:

1. **¿Tienes un dominio/subdominio para Recetario?**
   - Ej: `recetario.tu-dominio.com.ar` o `app.tu-dominio.com.ar`

2. **¿Cuál es la URL actual de Santa Cebada?**
   - Ej: `fichadas.santacebada.com.ar`

3. **¿Puerto 8001 disponible?** (probablemente sí)

4. **¿Quieres certificado SSL automático?** (recomendado)

---

*Documento preparado para deploy seguro e independiente*
*Riesgo de afectar Santa Cebada: NULO ✅*
