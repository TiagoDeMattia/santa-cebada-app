# Instrucciones para Activar Visor en 1920×1080

## 🔴 PROBLEMA IDENTIFICADO
El visor no carga porque el **backend no está corriendo**. Sin el backend, el frontend no puede obtener datos.

## ✅ SOLUCIÓN PASO A PASO

### Paso 1: Verifica que el Backend esté Corriendo

1. **Abre una terminal PowerShell** (o CMD)

2. **Navega al backend:**
   ```powershell
   cd "c:\Users\Tiago\OneDrive\Escritorio\PROYECTO PAGINA FINAL\backend-nucleo"
   ```

3. **Verifica que el backend esté activo:**
   - Si ves un proceso corriendo con `python main.py` → El backend está activo ✓
   - Si no ves nada → Necesitas iniciar el backend

4. **Si necesitas iniciarlo:**
   ```powershell
   python main.py
   ```

   Deberías ver algo como:
   ```
   🚀 Iniciando Backend Nucleo...
   ✓ Base de datos inicializada
   ✓ Tablas de historial inicializadas
   ```

   **IMPORTANTE**: No cierres esta ventana. Déjala corriendo.

---

### Paso 2: Verifica que el Frontend esté Corriendo

1. **En OTRA terminal**, navega al frontend:
   ```powershell
   cd "c:\Users\Tiago\OneDrive\Escritorio\PROYECTO PAGINA FINAL\frontend"
   ```

2. **Inicia el servidor de desarrollo:**
   ```powershell
   npm run dev
   ```

   Deberías ver:
   ```
   VITE v8.0.10 ready in 123 ms
   ➜ Local: http://localhost:5173/
   ```

3. **IMPORTANTE**: No cierres esta ventana tampoco.

---

### Paso 3: Accede al Visor

1. **Abre tu navegador** en:
   ```
   http://localhost:5173/login
   ```

2. **Inicia sesión** con un usuario que tenga rol **VISOR**
   - Usuario: (tu usuario con rol visor)
   - Contraseña: (tu contraseña)

3. **Deberías ser redirigido automáticamente a:**
   ```
   http://localhost:5173/visor/1
   ```

4. **Verifica que veas:**
   - ✓ Fondo gris oscuro
   - ✓ Título "Cervezas" en grande
   - ✓ Texto vertical "EL TEMPLO SAGRADO DE LA BIRRA" a la izquierda
   - ✓ **Dos columnas** de cervezas (9 a la izquierda, 9 a la derecha)
   - ✓ Cada cerveza con: Nombre, ABV, Amargor, Marca, Precio
   - ✓ Precios como **"$6.600"** (NO como fechas)

---

### Paso 4: Pantalla Completa (55-65 pulgadas a 1920×1080)

**Opción A: Fullscreen automático**
- Click en el botón **"⛶"** (Maximize) en la esquina superior derecha
- La pantalla se expandirá a pantalla completa

**Opción B: Pantalla en modo cliente**
1. Presiona **F11** para fullscreen total del navegador
2. O configura tu display a **1920×1080** en Windows

---

## 🔧 TROUBLESHOOTING

### Problema: "El visor no carga / Spinner infinito"
**Causa:** El backend no está corriendo o hay un error en él

**Solución:**
```powershell
# En la terminal del backend, presiona Ctrl+C
# Luego ejecuta:
python main.py
```

Ver los logs para identificar el error.

---

### Problema: "Precios se ven como fechas (04/01/2025)"
**Causa:** El backend está usando datos del sheet BARRILES en lugar del sheet INFO

**Solución:** El código ya está fijo. Solo necesitas:
1. Ctrl+C en el backend
2. `python main.py` para reiniciar
3. Recarga el navegador

---

### Problema: "Las cervezas se solapan / no caben todas"
**Solución:** El layout ya está optimizado para 1920×1080

- Dos columnas automáticas
- Scroll suave en cada columna
- Espaciado calculado para pantalla grande

Si ves scroll y no todo está visible → Reduce zoom del navegador (Ctrl + Menos)

---

### Problema: "No veo el visor en la navbar"
**Causa:** No iniciaste sesión como usuario con rol **VISOR**

**Solución:**
1. Verifica que tu usuario tenga rol 'visor' en la base de datos
2. Si no, pídele al admin que cambie tu rol
3. Cierra sesión y vuelve a iniciar con un usuario VISOR

---

## 📋 CAMBIOS REALIZADOS

### Backend (`barriles_service.py`)
✅ Precio SIEMPRE viene del sheet INFO (nunca como fecha)
✅ Función `_row_to_barril()` retorna campos vacíos para precio/amargor/abv
✅ Función `get_visor_data()` fuerza string en precio: `str(info["precio"]).strip()`

### Frontend (`CervezasVisor1.tsx`)
✅ Diseño optimizado para **1920×1080**
✅ Dos columnas automáticas (9 + 9 cervezas)
✅ Títulos y tamaños aumentados para pantalla grande
✅ Scrollbar suave en cada columna
✅ Componente `CervezaRow` compacto y legible
✅ ABV con colores dinámicos (rojo/ámbar/amarillo/gris)

---

## ⏰ AUTO-REFRESH

El visor se actualiza **cada 30 segundos** automáticamente:
- Los precios, amargor y ABV se recargan desde Google Sheets
- No necesitas actualizar manualmente

Para pausar: Click en "Auto-refresh: OFF" (parte inferior)

---

## 📊 ESPECIFICACIONES FINALES

- **Resolución:** 1920×1080 (horizontal)
- **Pantalla:** 55-65 pulgadas
- **Layout:** 2 columnas (18 cervezas máximo)
- **Datos:** Actualización cada 30 segundos
- **Control:** Refresh y Fullscreen en esquina superior derecha
- **Modo sin controles:** En pantalla completa desaparecen los botones

---

**Status**: ✅ LISTO PARA USAR

Solo necesitas que el backend esté corriendo. ¡El resto está todo listo!
