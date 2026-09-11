# Solución: Error 500 al Cargar Barriles

## 🔴 PROBLEMA

**Error:** `Request failed with status code 500`  
**Causa:** Cuota de Google Sheets API excedida (429 - Rate Limit Exceeded)

### ¿Por qué pasó?

Google Sheets API tiene un límite de **60 lecturas por minuto por usuario**. Durante las pruebas de reordenamiento, se hicieron muchas lecturas consecutivas y se excedió este límite.

Ahora **TODAS** las operaciones están bloqueadas, incluyendo:
- Cargar la lista de barriles
- Obtener el personal
- Cualquier lectura del sheet

---

## ✅ SOLUCIÓN INMEDIATA

### Opción 1: Esperar (Más Simple)

**Espera 2-3 minutos** sin hacer ninguna operación. Google resetea la cuota cada minuto, pero puede tardar un poco más en propagarse.

Después de esperar:
1. Refresca la página de Barriles
2. Debería cargar normalmente

### Opción 2: Cambiar de Usuario de Google (Temporal)

Si necesitás acceso inmediato, podés:
1. Usar otra cuenta de Google en `credentials.json`
2. El límite es **por usuario**, no por proyecto

---

## 🔧 SOLUCIÓN PERMANENTE IMPLEMENTADA

He agregado un **Rate Limiter** que:

### 1. **Controla el número de requests**
- Cuenta cuántas lecturas se hacen por minuto
- Límite seguro: 55 requests/minuto (dejando margen)
- Se resetea automáticamente cada 60 segundos

### 2. **Espera automática**
- Si estás cerca del límite, espera automáticamente
- No hace requests si ya se excedió el límite

### 3. **Retry con Backoff Exponencial**
- Si recibe error 429, reintenta automáticamente
- Espera: 2s, 4s, 8s (backoff exponencial)
- Máximo 3 intentos

### 4. **Logging detallado**
```
Rate limiter: Esperando 15.3s para evitar exceder cuota
Rate limit excedido. Reintentando en 2s (intento 1/3)
Rate limiter: Contador reseteado
```

---

## 📊 CÓMO FUNCIONA

### Antes (Sin Rate Limiter):
```
Request 1 → OK
Request 2 → OK
...
Request 60 → OK
Request 61 → ERROR 429 ❌
Request 62 → ERROR 429 ❌
... (bloqueado por 1 minuto)
```

### Ahora (Con Rate Limiter):
```
Request 1 → OK
Request 2 → OK
...
Request 55 → OK
Request 56 → ESPERA 5s automáticamente ⏳
Request 57 → OK (después de esperar)
```

---

## 🎯 FUNCIONES PROTEGIDAS

El rate limiter se aplica a:
- ✅ `get_barriles()` - Listar barriles
- ✅ `get_personal()` - Obtener personal
- ✅ `get_catalogo_birras()` - Obtener catálogo
- ✅ `reordenar_sheet()` - Reordenar (implícito, usa get_all_values)

---

## 🧪 TESTING

### Para verificar que funciona:

1. **Espera 2-3 minutos** (para que se resetee la cuota actual)

2. **Refresca la página de Barriles**
   - Debería cargar normalmente
   - Si ves en los logs: "Rate limiter: Esperando Xs" → Está funcionando

3. **Prueba el reordenamiento**
   - Modifica un barril
   - El sistema esperará automáticamente si es necesario
   - No deberías ver más errores 429

---

## 📝 LOGS A OBSERVAR

### Logs Normales (Todo OK):
```
INFO | Obteniendo barriles...
INFO | Barriles obtenidos: 25
```

### Logs con Rate Limiter Activo:
```
WARNING | Rate limiter: Esperando 12.5s para evitar exceder cuota
INFO | Rate limiter: Contador reseteado
INFO | Obteniendo barriles...
```

### Logs de Error (Si aún hay problemas):
```
WARNING | Rate limit excedido. Reintentando en 2s (intento 1/3)
WARNING | Rate limit excedido. Reintentando en 4s (intento 2/3)
ERROR | Rate limit excedido después de 3 intentos
```

---

## ⚠️ IMPORTANTE

### Durante los próximos 2-3 minutos:
- ❌ NO intentes cargar la página de Barriles
- ❌ NO hagas operaciones de reordenamiento
- ❌ NO hagas requests a la API

### Después de 2-3 minutos:
- ✅ Refresca la página
- ✅ Debería funcionar normalmente
- ✅ El rate limiter evitará futuros problemas

---

## 🔄 PRÓXIMOS PASOS

1. **Ahora:** Espera 2-3 minutos
2. **Luego:** Refresca la página de Barriles
3. **Verifica:** Que cargue correctamente
4. **Prueba:** El reordenamiento debería funcionar sin errores

---

## 📁 ARCHIVOS CREADOS/MODIFICADOS

- ✅ `backend-nucleo/src/services/rate_limiter.py` - NUEVO
- ✅ `backend-nucleo/src/services/barriles_service.py` - Actualizado con decorators

---

## 💡 BENEFICIOS

1. ✅ **No más errores 429** - El sistema espera automáticamente
2. ✅ **Retry automático** - Si falla, reintenta con backoff
3. ✅ **Transparente** - No necesitás hacer nada especial
4. ✅ **Logging claro** - Sabés cuándo está esperando y por qué

El sistema ahora es mucho más robusto y puede manejar operaciones intensivas sin exceder la cuota de Google. 🚀
