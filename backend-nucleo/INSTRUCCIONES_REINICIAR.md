# 🔄 Instrucciones para Reiniciar el Backend

**Fecha:** 2026-05-05 23:30  
**Motivo:** Aplicar correcciones a los PASOS 3 y 4 del reordenamiento

---

## ✅ Correcciones Aplicadas

Se corrigieron los PASOS 3 y 4 de la función `reordenar_sheet` para que:
- ✅ Busquen filas "Para Retirar" y "Retirada" en **TODO el sheet**
- ✅ Muevan filas que están fuera de su zona correcta
- ✅ Recalculen marcadores en cada iteración

---

## 🚀 Cómo Reiniciar el Backend

### Opción 1: Desde la Terminal Actual

Si el backend está corriendo en una terminal:

1. **Detener el backend:**
   - Presiona `Ctrl + C` en la terminal donde corre el backend

2. **Reiniciar el backend:**
   ```bash
   cd backend-nucleo
   python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Opción 2: Desde PowerShell

Si no sabes dónde está corriendo:

1. **Buscar el proceso:**
   ```powershell
   Get-Process python | Where-Object {$_.Path -like "*uvicorn*"}
   ```

2. **Matar el proceso:**
   ```powershell
   Stop-Process -Name python -Force
   ```

3. **Reiniciar:**
   ```bash
   cd backend-nucleo
   python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### Opción 3: Modo --reload (Automático)

Si el backend está corriendo con `--reload`, debería reiniciarse automáticamente al detectar cambios en los archivos. Pero a veces no funciona correctamente, así que es mejor reiniciar manualmente.

---

## 🧪 Cómo Verificar que Funciona

### 1. Verificar Estado Actual

Antes de reordenar, ejecuta:
```bash
cd backend-nucleo
python debug_estados_completo.py
```

Debería mostrar:
```
❌ 1 filas 'Retirada' en zona EN CAMARA (deberían estar en RETIRADAS)
```

### 2. Ejecutar Reordenamiento

Desde el frontend:
1. Ir a la página de Barriles
2. Clic en el botón "Reordenar"
3. Esperar a que termine

### 3. Verificar Resultado

Ejecuta de nuevo:
```bash
python debug_estados_completo.py
```

Debería mostrar:
```
✅ No se detectaron problemas. Todos los estados están en su zona correcta.
```

---

## 📊 Qué Debería Pasar

### Antes del Reordenamiento

```
Fila 38: German Pils - Estado: Retirada ← ❌ En zona EN CAMARA
Fila 42: "Inframundo" Stout - Estado: Para Retirar ← ✅ Ya en zona VACIOS
```

### Después del Reordenamiento

```
Fila 38: (otra cerveza) - Estado: En Camara ← ✅ Correcto
Fila 42: "Inframundo" Stout - Estado: Para Retirar ← ✅ Sigue en zona VACIOS
...
Fila 59: German Pils - Estado: Retirada ← ✅ Movida a zona RETIRADAS
```

---

## 🐛 Si Sigue Sin Funcionar

### Verificar que el Código Está Correcto

```bash
cd backend-nucleo
Select-String -Path "src/services/barriles_service.py" -Pattern "CORRECCIÓN: Buscar \"Retirada\"" -Context 0,5
```

Debería mostrar:
```
# ✅ CORRECCIÓN: Buscar "Retirada" en CUALQUIER lugar que NO sea su zona correcta
# Zona correcta: después de RETIRADAS
# Si está en su zona correcta Y antes de target_row, saltarla
if row_num > row_retiradas_actual and row_num < target_row:
    continue
```

### Verificar Logs del Backend

Cuando ejecutes el reordenamiento, deberías ver en los logs:
```
=== PASO 4: Moviendo Retiradas ===
Moviendo Retirada fila 38 (German Pils) a posición 59
No hay más Retiradas para mover (iteraciones: 2)
```

Si no ves estos logs, el backend no se reinició correctamente.

---

## ✅ Checklist

- [ ] Backend detenido (Ctrl+C)
- [ ] Backend reiniciado
- [ ] Verificar que el backend está corriendo (http://localhost:8000/docs)
- [ ] Ejecutar `debug_estados_completo.py` (antes)
- [ ] Ejecutar reordenamiento desde el frontend
- [ ] Ejecutar `debug_estados_completo.py` (después)
- [ ] Verificar que no hay problemas

---

**¡Importante!** Si el backend está corriendo con `--reload`, los cambios deberían aplicarse automáticamente. Pero si no funciona, reinicia manualmente.

---

*Documento creado: 2026-05-05 23:30*
