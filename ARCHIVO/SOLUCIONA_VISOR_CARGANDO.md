# 🔧 SOLUCIONAR: Visor Se Queda Cargando Infinitamente

## 🔴 PROBLEMA
El visor muestra un Spinner infinito y nunca carga.

## ✅ CAUSA IDENTIFICADA
El **backend NO está respondiendo** al endpoint `/api/barriles/visor`.

---

## 📋 SOLUCIÓN PASO A PASO

### Paso 0: Mata los procesos existentes
Primero, cierra todos los procesos Python y Node que estén corriendo:

**En PowerShell:**
```powershell
# Mata todos los Python
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force

# Mata todos los Node
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

---

### Paso 1: Inicia el Backend (PRIMERO)

**Opción A: Usando script (recomendado)**
1. **Abre Explorador de archivos**
2. Navega a: `c:\Users\Tiago\OneDrive\Escritorio\PROYECTO PAGINA FINAL\`
3. **Doble-click en: `INICIA_BACKEND.bat`**
4. Se abrirá una ventana PowerShell

**Esperado:**
```
================================================================================
INICIANDO BACKEND NUCLEO
================================================================================

Activando environment virtual (si existe)...
Usando Python global

Iniciando servidor...

🚀 Iniciando Backend Nucleo...
✓ Base de datos inicializada
✓ Tablas de historial inicializadas
INFO:     Started server process [1234]
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**IMPORTANTE:** 
- ✅ No cierres esta ventana
- ✅ Déjala corriendo en background
- ✅ Verifica que veas "Started server process"

---

### Paso 2: Verifica que el Backend Responde

**En otra terminal PowerShell:**
```powershell
# Test simple
Invoke-WebRequest -Uri "http://localhost:8000/api/health" -TimeoutSec 3
```

**Debería mostrar:**
```
StatusCode        : 200
StatusDescription : OK
```

Si ves error de timeout → El backend no está corriendo. Revisa los logs del backend.

---

### Paso 3: Inicia el Frontend (SEGUNDO)

**Opción A: Usando script**
1. **Abre Explorador de archivos**
2. Navega a: `c:\Users\Tiago\OneDrive\Escritorio\PROYECTO PAGINA FINAL\`
3. **Doble-click en: `INICIA_FRONTEND.bat`**
4. Se abrirá otra ventana PowerShell

**Esperado:**
```
================================================================================
INICIANDO FRONTEND
================================================================================

> frontend@0.0.0 dev
> vite

  VITE v8.0.10  ready in 123 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

**IMPORTANTE:**
- ✅ No cierres esta ventana tampoco
- ✅ Verifica que veas el puerto 5173

---

### Paso 4: Accede al Visor

1. **Abre tu navegador**
2. Navega a: `http://localhost:5173/login`
3. **Inicia sesión** con usuario que tenga rol **VISOR**
   - Si no tienes usuario VISOR, pídele al admin que lo cree
   - Comando SQL: `UPDATE users SET role = 'visor' WHERE username = 'tunombre'`

4. **Deberías ser redirigido a:** `http://localhost:5173/visor/1`

5. **ABRE DEVELOPER TOOLS** (F12) y mira la consola:
   - ✅ Si no hay errores rojos → El visor debería cargar en segundos
   - ❌ Si hay errores → Cópialosy pégalo abajo para diagnosticar

---

## 🐛 TROUBLESHOOTING

### Problema: "Error: La operación sobrepasó el tiempo de espera"
**Causa:** Backend no está respondiendo  
**Solución:**
1. Mata todos los procesos: `Get-Process python | Stop-Process -Force`
2. Inicia backend de nuevo: Doble-click en `INICIA_BACKEND.bat`
3. Espera 10 segundos
4. Prueba conectarse nuevamente

---

### Problema: "ERR_CONNECTION_REFUSED"
**Causa:** Frontend o Backend no están en los puertos correctos  
**Solución:**
1. Backend debe estar en: `http://localhost:8000`
2. Frontend debe estar en: `http://localhost:5173`
3. Si ves otro puerto, ese es el problema
4. Mata todos y reinicia

---

### Problema: "401 Unauthorized"
**Causa:** Token JWT inválido o expirado  
**Solución:**
1. Cierra sesión (botón en navbar)
2. Vuelve a iniciar sesión
3. Si persiste, limpia cookies: F12 → Application → Cookies → Delete all

---

### Problema: "Spinner infinito" (sigue cargando)
**Causa:** Backend devuelve error o los datos son muy lentos  
**Solución:**
1. Abre DevTools (F12)
2. Ve a **Network**
3. Recarga la página
4. Busca la request a `barriles/visor`
5. Haz click y ve la **Response** (qué devuelve el backend)
6. Si ves error rojo, cópialo y pégalo en Slack

---

### Problema: "GET http://localhost:8000/api/barriles/visor 500"
**Causa:** Error en el backend  
**Solución:**
1. Mira la ventana del backend (logs)
2. Debería mostrar un traceback Python
3. Copia el error completo
4. Si dice "attempted relative import" → Reinicia backend
5. Si dice otro error → Necesitamos ver los logs

---

## 📊 VERIFICACIÓN RÁPIDA

**Puedes verificar que todo está corriendo con este comando PowerShell:**
```powershell
Write-Host "Backend:" 
(Invoke-WebRequest -Uri "http://localhost:8000/docs" -TimeoutSec 2 -ErrorAction SilentlyContinue).StatusCode

Write-Host "`nFrontend:"
(Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -ErrorAction SilentlyContinue).StatusCode
```

Debería mostrar ambos `200`.

---

## 📋 CHECKLIST

- [ ] Maté todos los procesos Python y Node
- [ ] El backend está corriendo (ventana abierta con logs)
- [ ] El frontend está corriendo (ventana abierta con logs)
- [ ] Abrí navegador en http://localhost:5173/login
- [ ] Inicié sesión con usuario VISOR
- [ ] Fui redirigido a http://localhost:5173/visor/1
- [ ] Abrí DevTools (F12) para verificar errores
- [ ] El visor debería mostrar:
  - ✓ Fondo gris oscuro
  - ✓ Título "Cervezas" grande
  - ✓ Dos columnas de cervezas
  - ✓ Precios como "$6.600" (no fechas)

---

## 🎯 SI AÚN NO FUNCIONA

**Envía screenshot de:**
1. La ventana del backend (muestra todos los logs)
2. DevTools (Console + Network tabs)
3. El error exacto que ves

---

**¡Eso debería funcionar! 🚀**

Si hay algún error, es porque el backend no puede conectarse a Google Sheets o hay un error en el código. Pero con este diagnóstico podemos identificar exactamente qué es.
