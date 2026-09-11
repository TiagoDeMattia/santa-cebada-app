# 🚀 Guía Rápida - Nueva Página de Barriles

## 📍 Acceso Rápido

### URLs:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000
- **Página Barriles**: http://localhost:5173/barriles

---

## 🎯 Cómo Usar la Nueva Interfaz

### 1. **Navegación Principal**

#### Tabs de Filtrado:
- **Activos**: Muestra Pinchadas + En Cámara
- **Historial**: Muestra Para Retirar + Retiradas
- **Todos**: Muestra todos los barriles

#### Búsqueda:
- Escribe en el campo de búsqueda
- Busca por: Estilo, Proveedor, Código, Canilla
- Filtrado en tiempo real

#### Selector de Sucursal:
- **Recoleta**: Hoja "PRUEBA WEB APP"
- **Palermo**: Hoja "BARRILES"

---

### 2. **Entender las Tarjetas**

#### 🟢 Tarjeta PINCHADA:
```
┌─────────────────────────────┐
│ 🔵  5  ← Canilla grande     │
│                             │
│ [A] Cervecería XYZ          │
│ IPA Artesanal               │
│ ABC123                      │
│                             │
│ 🟢 ● Pinchada  ⏱️ 20d       │
│                             │
│ 📅 Pinchado: 15/04 (Juan)   │
│ 🚚 Despinchado: —           │
│ 📦 Retirado: —              │
│                             │
│              [Editar] ←     │
└─────────────────────────────┘
```

**Características:**
- Borde izquierdo **verde** grueso
- Punto verde **animado** (pulsante)
- Muestra días pinchado con código de colores
- Canilla siempre visible

#### 🔵 Tarjeta EN CÁMARA:
```
┌─────────────────────────────┐
│ 🔵  —  ← Sin canilla        │
│                             │
│ [C] Cervecería ABC          │
│ Lager Premium               │
│ XYZ789                      │
│                             │
│ 🔵 ● En Camara              │
│                             │
│ 📅 Pinchado: —              │
│ 🚚 Despinchado: —           │
│ 📦 Retirado: —              │
│                             │
│              [Editar] ←     │
└─────────────────────────────┘
```

**Características:**
- Borde izquierdo **azul** grueso
- Punto azul **estático**
- Sin días pinchado (no aplica)
- Sin canilla asignada

---

### 3. **Código de Colores**

#### Días Pinchado:
- 🟢 **Verde**: ≤31 días (Óptimo)
- 🟡 **Amarillo**: 32-60 días (Atención)
- 🔴 **Rojo**: +61 días (Urgente)

#### Tipos de Barril:
- 🟡 **A**: Amarillo
- 🟠 **B**: Naranja
- 🟢 **C**: Verde
- 🔵 **D**: Azul
- 🟣 **E**: Púrpura
- 🩷 **GIN**: Rosa
- 🔴 **T**: Rojo

#### Estados:
- 🟢 **Pinchada**: Verde con punto animado
- 🔵 **En Cámara**: Azul con punto estático
- 🟡 **Para Retirar**: Amarillo
- ⚫ **Retirada**: Gris

---

### 4. **Editar un Barril**

#### Paso a paso:
1. **Hover sobre la tarjeta** → Aparece botón [Editar]
2. **Click en [Editar]** → Se abre el modal
3. **Modificar campos:**
   - Canilla N°
   - Fecha de Pinchado
   - Quién pinchó (dropdown)
   - Fecha de Despinchado
   - Quién despinchó (dropdown)
   - Fecha de Retirado
4. **Click en [Guardar]** → Actualiza Google Sheets
5. **Confirmación** → Toast verde de éxito

#### Campos automáticos (no editables):
- ❌ **Estado**: Calculado por fórmula
- ❌ **Días Pinchado**: Calculado por fórmula
- ❌ **Turno**: Calculado por fórmula
- ❌ **Tipo (TP)**: Calculado por fórmula

---

### 5. **Acciones Globales**

#### Reordenar Sheet:
- **Botón**: [Reordenar sheet]
- **Función**: Organiza físicamente las filas en Google Sheets
- **Orden**:
  1. Pinchadas (por canilla)
  2. En Cámara
  3. N/A
  4. Para Retirar
  5. Retiradas
- **Tiempo**: ~10-30 segundos
- **Feedback**: Toast de confirmación

#### Actualizar:
- **Botón**: [Actualizar] (icono de refresh)
- **Función**: Recarga datos desde Google Sheets
- **Uso**: Después de cambios externos o para ver actualizaciones

---

### 6. **Secciones Colapsables**

#### Expandir/Contraer:
- **Click en el header** de cualquier sección
- **Icono**: ▼ (expandido) / ▶ (contraído)
- **Por defecto**:
  - ✅ Pinchadas: Expandido
  - ✅ En Cámara: Expandido
  - ✅ Para Retirar: Expandido (en tab Historial)
  - ❌ Retiradas: Contraído

---

## 📱 Uso en Móvil

### Características:
- ✅ **1 columna**: Tarjetas apiladas verticalmente
- ✅ **Scroll suave**: Sin scroll horizontal
- ✅ **Toda la info visible**: Sin truncamiento
- ✅ **Botones grandes**: Fácil de tocar
- ✅ **Responsive**: Se adapta automáticamente

### Tips:
- Usa el selector de sucursal en la parte superior
- Los tabs son fáciles de tocar
- El botón [Editar] aparece siempre visible en móvil
- Scroll vertical para ver más barriles

---

## 🔧 Solución de Problemas

### Error 500 al cargar:
1. Verificar que el backend esté corriendo
2. Verificar conexión a Google Sheets
3. Revisar rate limiter (máx 55 requests/min)
4. Esperar 1 minuto y reintentar

### Datos no actualizan:
1. Click en [Actualizar]
2. Verificar selector de sucursal correcto
3. Verificar que el tab de filtro sea el correcto

### Modal no abre:
1. Verificar que el barril tenga datos válidos
2. Refrescar la página (F5)
3. Revisar consola del navegador (F12)

### Reordenamiento no funciona:
1. Verificar que haya barriles para reordenar
2. Esperar a que termine (puede tomar 30 seg)
3. Verificar logs del backend
4. Actualizar después de reordenar

---

## 🎨 Personalización (Futuro)

### Posibles mejoras:
- [ ] Ordenamiento personalizado (drag & drop)
- [ ] Filtros adicionales (por tipo, proveedor)
- [ ] Vista de lista compacta (alternativa)
- [ ] Exportar a PDF/Excel
- [ ] Gráficos de estadísticas
- [ ] Notificaciones de barriles viejos
- [ ] Búsqueda avanzada
- [ ] Historial de cambios

---

## 📚 Recursos

### Archivos importantes:
- **Código**: `frontend/src/pages/Barriles.tsx`
- **Backup**: `frontend/src/pages/Barriles.tsx.backup`
- **Backend**: `backend-nucleo/src/services/barriles_service.py`
- **API**: `frontend/src/lib/api.ts`

### Documentación:
- **Rediseño completo**: `REDISENO_BARRILES_COMPLETADO.md`
- **Comparación visual**: `COMPARACION_VISUAL_BARRILES.md`
- **Esta guía**: `GUIA_RAPIDA_BARRILES.md`

---

## 🆘 Ayuda Rápida

### Comandos útiles:

#### Iniciar servidores:
```bash
# Frontend
cd frontend
npm run dev

# Backend
cd backend-nucleo
python main.py
```

#### Rollback a versión anterior:
```bash
cp frontend/src/pages/Barriles.tsx.backup frontend/src/pages/Barriles.tsx
```

#### Ver logs del backend:
```bash
# En la terminal donde corre el backend
# Los logs aparecen automáticamente
```

---

## ✅ Checklist de Verificación

Antes de usar en producción:

- [ ] Probar en Chrome/Edge
- [ ] Probar en Firefox
- [ ] Probar en Safari (si disponible)
- [ ] Probar en móvil (Chrome mobile)
- [ ] Probar edición de barriles
- [ ] Probar reordenamiento
- [ ] Probar filtros y búsqueda
- [ ] Probar cambio de sucursal
- [ ] Verificar que los datos se guardan correctamente
- [ ] Verificar que las fórmulas no se rompen

---

## 🎯 Atajos de Teclado

### Navegación:
- **F5**: Refrescar página
- **Ctrl + F**: Buscar en página
- **F12**: Abrir DevTools (para debugging)
- **Ctrl + Shift + M**: Toggle device toolbar (responsive)

### En el modal de edición:
- **Tab**: Navegar entre campos
- **Enter**: Guardar (cuando está en el botón)
- **Esc**: Cerrar modal

---

## 📞 Contacto

Si encuentras algún problema o tienes sugerencias:
1. Revisar esta guía primero
2. Revisar la documentación completa
3. Revisar logs del backend
4. Contactar al desarrollador

---

*Guía actualizada: 2026-05-05*
*Versión: 1.0*

**¡Disfruta la nueva interfaz de Barriles! 🍺**
