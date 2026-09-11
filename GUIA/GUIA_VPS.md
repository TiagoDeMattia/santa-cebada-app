# 🚀 GUÍA COMPLETA: DESPLEGAR Y ACTUALIZAR PROYECTOS EN VPS

> Basada en la experiencia del proyecto **Santa Cebada Fichaje System**
> 
> Esta guía es reutilizable para otros proyectos Kiro con diferente contexto

---

## 📋 TABLA DE CONTENIDOS

1. [Requisitos Previos](#requisitos-previos)
2. [Estructura del Proyecto](#estructura-del-proyecto)
3. [Primer Despliegue (Deploy Inicial)](#primer-despliegue-deploy-inicial)
4. [Crear Script de Actualización](#crear-script-de-actualización)
5. [Proceso de Actualización Regular](#proceso-de-actualización-regular)
6. [Troubleshooting Común](#troubleshooting-común)
7. [Checklist de Seguridad](#checklist-de-seguridad)

---

## 🔧 REQUISITOS PREVIOS

### Información del VPS
- **IP del VPS**: Obtén de tu proveedor
- **Puerto SSH**: Por defecto 22, algunos VPS usan puertos personalizados (ej: 2222)
- **Usuario**: Usuario SSH configurado en el VPS
- **Llave SSH**: Archivo de llave privada Ed25519 o RSA

### Herramientas Necesarias en Local
- **Python 3.6+** con módulo `paramiko` instalado
  ```bash
  pip install paramiko
  ```
- **Node.js** (si tu proyecto lo requiere)
- **Git** (opcional pero recomendado)

### Confirmación de Conectividad
Antes de comenzar, verifica que puedas conectarte al VPS:
```bash
ssh -i "path/to/key" -p PORT user@VPS_IP
```

---

## 📁 ESTRUCTURA DEL PROYECTO

### Estructura Local Recomendada
```
proyecto-local/
├── server.js              # Backend principal
├── package.json           # Dependencias de Node.js
├── public/
│   ├── app.js            # Frontend JavaScript
│   ├── index.html        # Frontend HTML
│   ├── styles.css        # (si aplica)
│   └── assets/           # Imágenes, fuentes, etc.
├── database.db           # Base de datos SQLite (si aplica)
├── logs/
│   └── app.log           # Logs de la aplicación
├── actualizar_vps.py     # Script de actualización
├── GUIA_VPS.md           # Esta guía
└── .gitignore
```

### Estructura en VPS
```
/home/usuario/nombre-proyecto/
├── server.js
├── package.json
├── public/
│   ├── app.js
│   ├── index.html
│   └── ...
├── database.db
├── logs/
│   └── app.log
└── node_modules/
```

---

## 🌍 PRIMER DESPLIEGUE (DEPLOY INICIAL)

### Paso 1: Preparar el VPS

**1.1. Conectarse al VPS:**
```bash
ssh -i "path/to/key" -p 2222 usuario@VPS_IP
```

**1.2. Crear directorio del proyecto:**
```bash
mkdir -p /home/usuario/nombre-proyecto
cd /home/usuario/nombre-proyecto
```

**1.3. Inicializar directorios necesarios:**
```bash
mkdir -p public logs
touch logs/app.log
```

**1.4. Instalar dependencias de Node.js:**
```bash
npm install
```

### Paso 2: Subir Archivos Iniciales

**Opción A: Usar SFTP (Recomendado)**

Crear script Python `deploy_inicial.py`:

```python
#!/usr/bin/env python3
"""
DEPLOY INICIAL - Subir proyecto completo al VPS
"""
import paramiko
from pathlib import Path
import os

VPS_IP = "89.167.100.235"
VPS_PORT = 2222
VPS_USER = "usuario"
VPS_PATH = "/home/usuario/nombre-proyecto"
LOCAL_KEY = r"c:\ruta\a\llave_ssh"

# Archivos a subir en deploy inicial
FILES_TO_DEPLOY = [
    (r"local\server.js", f"{VPS_PATH}/server.js"),
    (r"local\package.json", f"{VPS_PATH}/package.json"),
    (r"local\public\app.js", f"{VPS_PATH}/public/app.js"),
    (r"local\public\index.html", f"{VPS_PATH}/public/index.html"),
    # Agregar más archivos según sea necesario
]

try:
    print("\n" + "="*70)
    print("DEPLOY INICIAL")
    print("="*70 + "\n")
    
    # Conectar
    print("Conectando al VPS...")
    pkey = paramiko.Ed25519Key.from_private_key_file(LOCAL_KEY)
    transport = paramiko.Transport((VPS_IP, VPS_PORT))
    transport.connect(username=VPS_USER, pkey=pkey)
    sftp = paramiko.SFTPClient.from_transport(transport)
    print("✅ Conectado\n")
    
    # Crear directorios
    print("Creando directorios...")
    try:
        sftp.mkdir(f"{VPS_PATH}/public")
    except:
        pass
    
    # Subir archivos
    print("Subiendo archivos...\n")
    for local_file, remote_file in FILES_TO_DEPLOY:
        if os.path.exists(local_file):
            sftp.put(local_file, remote_file)
            print(f"✅ {os.path.basename(local_file)}")
        else:
            print(f"❌ {os.path.basename(local_file)} NO ENCONTRADO")
    
    sftp.close()
    transport.close()
    
    print("\n" + "="*70)
    print("✅ DEPLOY INICIAL COMPLETADO")
    print("="*70)
    print("\nPróximos pasos:")
    print("1. Conectarse al VPS y ejecutar: npm install")
    print("2. Configurar la base de datos si es necesario")
    print("3. Iniciar la aplicación: nohup node server.js > logs/app.log 2>&1 &")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
```

**Opción B: Usar Git (Si tienes repo)**
```bash
cd /home/usuario/nombre-proyecto
git clone <tu-repo-url> .
git pull origin main
npm install
```

### Paso 3: Iniciar la Aplicación

```bash
# Iniciar en background
nohup node server.js > logs/app.log 2>&1 &

# Verificar que está corriendo
ps aux | grep "node.*server"

# Ver logs
tail -f logs/app.log
```

### Paso 4: Configurar Reverse Proxy (Caddy/Nginx)

Si usas **Caddy**:

```
(tu-dominio.com.ar) {
    reverse_proxy localhost:3000
    
    # HTTPS automático
    encode gzip
}
```

Reiniciar Caddy:
```bash
sudo systemctl restart caddy
```

---

## 🔄 CREAR SCRIPT DE ACTUALIZACIÓN

### Paso 1: Estructura del Script Python

Crear archivo `actualizar_vps.py` en la raíz del proyecto:

```python
#!/usr/bin/env python3
"""
ACTUALIZADOR UNIVERSAL VPS
Adaptable para cualquier proyecto
"""

import paramiko
from io import StringIO
import os
import time
from pathlib import Path

# ==================== CONFIGURACIÓN ====================
# EDITA ESTOS VALORES PARA TU PROYECTO

VPS_IP = "89.167.100.235"
VPS_PORT = 2222
VPS_USER = "usuario"
VPS_PATH = "/home/usuario/nombre-proyecto"
LOCAL_KEY = r"c:\ruta\a\llave_ssh"
PROJECT_NAME = "Nombre del Proyecto"

# Archivos a actualizar (local → remoto)
# Agregar/Quitar según tu proyecto
FILES_TO_UPDATE = [
    (r"local\public\app.js", f"{VPS_PATH}/public/app.js"),
    (r"local\public\index.html", f"{VPS_PATH}/public/index.html"),
    (r"local\server.js", f"{VPS_PATH}/server.js"),
    (r"local\package.json", f"{VPS_PATH}/package.json"),
]

# Comando para reiniciar (adaptable)
RESTART_COMMAND = "pkill -9 -f 'node.*server.js' && sleep 2 && cd /home/usuario/nombre-proyecto && nohup node server.js > logs/app.log 2>&1 &"

# ==================== EJECUCIÓN ====================

try:
    print("\n" + "="*70)
    print(f"ACTUALIZADOR VPS - {PROJECT_NAME}")
    print("="*70 + "\n")
    
    # Paso 1: Conectar
    print("1️⃣  Conectando al VPS...")
    
    with open(LOCAL_KEY, 'r') as f:
        key_content = f.read()
    
    pkey = paramiko.Ed25519Key.from_private_key(StringIO(key_content))
    
    transport = paramiko.Transport((VPS_IP, VPS_PORT))
    transport.connect(username=VPS_USER, pkey=pkey)
    sftp = paramiko.SFTPClient.from_transport(transport)
    
    print("   ✅ Conectado\n")
    
    # Paso 2: Actualizar archivos
    print("2️⃣  Actualizando archivos...")
    
    files_updated = 0
    
    for local_file, remote_file in FILES_TO_UPDATE:
        if os.path.exists(local_file):
            print(f"\n   📁 {os.path.basename(local_file)}")
            
            # Hacer backup
            try:
                sftp.rename(remote_file, remote_file + ".bak")
                print(f"      ✅ Backup creado")
            except Exception as e:
                print(f"      ⚠️  Sin backup previo")
            
            # Subir nuevo archivo
            sftp.put(local_file, remote_file)
            remote_size = sftp.stat(remote_file).st_size
            local_size = os.path.getsize(local_file)
            
            if remote_size == local_size:
                print(f"      ✅ Subido ({remote_size} bytes)")
                files_updated += 1
            else:
                print(f"      ❌ Error: tamaño no coincide")
        else:
            print(f"\n   ❌ {os.path.basename(local_file)} NO ENCONTRADO")
    
    sftp.close()
    transport.close()
    
    print(f"\n   Archivos actualizados: {files_updated}/{len(FILES_TO_UPDATE)}\n")
    
    # Paso 3: Reiniciar Node.js
    print("3️⃣  Reiniciando Node.js...")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(VPS_IP, port=VPS_PORT, username=VPS_USER, pkey=pkey, timeout=10)
    
    print("   Deteniendo...")
    ssh.exec_command("pkill -9 -f 'node.*server.js'")
    time.sleep(2)
    
    print("   Iniciando...")
    ssh.exec_command(RESTART_COMMAND)
    time.sleep(3)
    
    print("   Verificando...")
    stdin, stdout, stderr = ssh.exec_command("ps aux | grep 'node.*server' | grep -v grep")
    
    if stdout.read().decode().strip():
        print("   ✅ Node.js reiniciado\n")
    else:
        print("   ❌ Error reiniciando Node.js\n")
        stdin, stdout, stderr = ssh.exec_command("tail -10 /home/usuario/nombre-proyecto/logs/app.log")
        print("Logs:")
        print(stdout.read().decode())
    
    ssh.close()
    
    # Paso 4: Completado
    print("="*70)
    print("✅ ACTUALIZACIÓN COMPLETADA")
    print("="*70)
    
    print("""
PRÓXIMOS PASOS:

1. Limpiar caché del navegador:
   - Presiona: Ctrl + Shift + Delete
   - Selecciona: "Cached images and files"
   - Click: "Clear data"

2. Recarga la página en el navegador

3. Verifica que los cambios estén presentes

Si aún ves lo viejo:
- Prueba en una ventana de incógnito
- O ejecuta: F12 → Click derecho en Refresh → Empty cache and hard reload
""")
    
except FileNotFoundError as e:
    print(f"\n❌ Error: Archivo no encontrado")
    print(f"   {e}")
    print(f"\n   Verifica que existe: {LOCAL_KEY}")
    
except paramiko.ssh_exception.AuthenticationException as e:
    print(f"\n❌ Error de autenticación SSH")
    print(f"   La llave no está siendo aceptada")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n")
```

### Paso 2: Configurar el Script

**Editar estos valores:**
```python
VPS_IP = "tu-ip-vps"
VPS_PORT = tu-puerto-ssh  # Ej: 2222
VPS_USER = "tu-usuario"
VPS_PATH = "/home/tu-usuario/tu-proyecto"
LOCAL_KEY = r"c:\ruta\a\tu\llave\ssh"
PROJECT_NAME = "Mi Proyecto"
```

---

## 📤 PROCESO DE ACTUALIZACIÓN REGULAR

### Flujo de Trabajo Recomendado

```
LOCAL DEVELOPMENT
      ↓
1. Hacer cambios en el código
2. Probar localmente (npm run dev)
3. Verificar que todo funciona
      ↓
VERIFICACIÓN
      ↓
4. Limpiar archivos temporales
5. Hacer commit en Git (si usas)
      ↓
DEPLOY
      ↓
6. Ejecutar: python actualizar_vps.py
7. Esperar confirmación ✅
8. Limpiar caché en navegador
9. Recargar página
10. Verificar cambios en producción
```

### Comando Rápido para Actualizar

Crear archivo `actualizar.bat` (Windows):

```batch
@echo off
python "%~dp0actualizar_vps.py"
pause
```

Luego simplemente doble-clic en `actualizar.bat`

---

## 🔍 TROUBLESHOOTING COMÚN

### Problema 1: "Permiso denegado" al conectar SSH

**Causa**: Permisos incorrectos en la llave privada

**Solución**:
```bash
# En Windows, usar la llave de una carpeta temporal
copy llave_ssh c:\temp\llave_ssh
# Asegurarse que no está en OneDrive
```

### Problema 2: Node.js no inicia después de actualizar

**Causa**: Error en el código JavaScript

**Solución**:
```bash
# Ver logs
tail -20 /home/usuario/nombre-proyecto/logs/app.log

# Reintentar manualmente
cd /home/usuario/nombre-proyecto
node server.js
```

### Problema 3: Los cambios no se ven en el navegador

**Causa**: Caché del navegador

**Solución**:
1. `Ctrl + Shift + Delete` (abrir limpiar caché)
2. Seleccionar "Archivos almacenados en caché"
3. "Eliminar datos"
4. `F5` o `Ctrl + R` para recargar

**Alternativa**: Usar devtools
1. `F12` para abrir DevTools
2. Click derecho en el botón Refresh
3. "Vaciar caché y hacer recarga forzada"

### Problema 4: La base de datos se reestablece

**Causa**: Estás subiendo la base de datos vieja

**Solución**: NO incluir el archivo `.db` en `FILES_TO_UPDATE` si quieres preservar datos

```python
# ❌ MALO - Sobrescribe la BD
(r"local\fichaje.db", f"{VPS_PATH}/fichaje.db"),

# ✅ BUENO - Solo código, no datos
(r"local\server.js", f"{VPS_PATH}/server.js"),
```

### Problema 5: Error "Conexión rechazada" en el puerto

**Causa**: Aplicación no está escuchando en el puerto correcto

**Verificar**:
```bash
# Ver qué está en el puerto 3000
sudo lsof -i :3000

# O si no funciona, matar cualquier proceso Node
pkill -9 node
```

---

## 🛡️ CHECKLIST DE SEGURIDAD

### Antes de cada Deploy

- [ ] **Código probado localmente**: Verificar que funciona en `localhost:3000`
- [ ] **Sin credenciales en código**: Buscar por contraseñas hardcodeadas
- [ ] **Variables de entorno**: Usar `.env` para secretos, NO en repositorio
- [ ] **Base de datos**: Confirmado si quieres preservar datos o limpiar
- [ ] **Backup creado**: El script crea `.bak` automáticamente
- [ ] **Logs configurados**: Verificar que `logs/app.log` existe
- [ ] **Puertos correctos**: Confirmar puerto local vs puerto del VPS

### Durante el Deploy

- [ ] **Script ejecutado sin errores**: Ver que aparece ✅
- [ ] **Node.js reiniciado**: Verificar con `ps aux | grep node`
- [ ] **Logs sin errores**: `tail -20 logs/app.log` no debe mostrar errores

### Después del Deploy

- [ ] **Aplicación responde**: Visitar dominio/IP:puerto
- [ ] **Caché limpiado**: Ctrl+Shift+Delete en navegador
- [ ] **Cambios visibles**: Verificar que se ven los cambios hechos
- [ ] **Funcionalidades críticas**: Probar login, transacciones, etc.

---

## 📝 NOTAS IMPORTANTES

### Zona Horaria

Si tu aplicación maneja fechas/horas, asegúrate de:

```javascript
// ✅ CORRECTO - Usa Intl.DateTimeFormat
const formatter = new Intl.DateTimeFormat('es-AR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'America/Argentina/Buenos_Aires'  // Adaptable
});

// ❌ INCORRECTO - Problemas con medianoche
const fecha = new Date().toLocaleString(...);
```

### Manejo de Errores

Agregar logging robustos:

```javascript
try {
  // Tu código
} catch (err) {
  console.error('ERROR CRÍTICO:', {
    mensaje: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
  res.status(500).json({ error: err.message });
}
```

### Monitoreo en Producción

Crear script de verificación `verificar_vps.py`:

```python
#!/usr/bin/env python3
import paramiko
import requests

# Verificar que Node.js está corriendo
# Verificar que el puerto está abierto
# Verificar que la aplicación responde

ssh = paramiko.SSHClient()
ssh.connect(...)
stdin, stdout, stderr = ssh.exec_command("ps aux | grep 'node.*server'")
if stdout.read().decode().strip():
    print("✅ Node.js está corriendo")
else:
    print("❌ Node.js NO está corriendo - Alertar!")
```

---

## 🎯 EJEMPLO COMPLETO: Santa Cebada

### Estructura del Proyecto Santa Cebada
```
c:\Kiro Prueba\
├── server.js                    # Backend Express
├── package.json                 # Dependencias
├── public/
│   ├── app.js                   # Frontend (70KB+)
│   └── index.html               # HTML
├── fichaje.db                   # SQLite (NO subir en actualizaciones)
├── actualizar_vps_simple.py     # Script de actualización
├── GUIA_VPS.md                  # Esta guía
└── logs/
    └── app.log                  # Logs del servidor
```

### Command para actualizar Santa Cebada
```bash
python "c:\Kiro Prueba\actualizar_vps_simple.py"
```

### Verificación después de actualizar
```bash
# SSH al VPS
ssh -i "c:\temp\tiago_key_ssh" -p 2222 tiago@89.167.100.235

# Ver estado
ps aux | grep "node.*server"
tail -20 /home/tiago/santa-cebada/logs/app.log

# Visitar sitio
https://fichadas.santacebada.com.ar
```

---

## 📚 RECURSOS ADICIONALES

- **Documentación Node.js**: https://nodejs.org/docs/
- **Documentación Paramiko**: https://www.paramiko.org/
- **Caddy Reverse Proxy**: https://caddyserver.com/docs/
- **SSH Best Practices**: https://www.ssh.com/ssh/config/

---

## ✅ CONCLUSIÓN

Con esta guía puedes:
1. ✅ Hacer deploy inicial de proyectos al VPS
2. ✅ Crear scripts de actualización automática
3. ✅ Troubleshoot problemas comunes
4. ✅ Mantener aplicaciones en producción
5. ✅ Reutilizar en otros proyectos Kiro

**¡Ahora estás listo para desplegar y mantener proyectos en VPS!** 🚀

---

*Última actualización: Junio 2026*
*Experiencia acumulada del proyecto Santa Cebada Fichaje System*
