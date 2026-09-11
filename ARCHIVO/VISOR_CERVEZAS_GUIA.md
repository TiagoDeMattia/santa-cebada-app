# Sistema de Visor de Cervezas 🍺📺

**Fecha**: 10 de Junio de 2026
**Status**: ✅ IMPLEMENTADO

---

## 📋 Características Principales

✅ Nuevo rol de usuario **"VISOR"**
✅ Dos diseños de visor completamente diferentes
✅ Pantalla completa (fullscreen) para TV
✅ Actualización automática cada 30 segundos
✅ Datos en tiempo real desde Google Sheets (A3:F20 de hoja barriles)
✅ Máximo 18 canillas (cervezas pinchadas)
✅ Indicadores de amargor (1-5 lúpulos)
✅ Sin barras de navegación ni distracciones

---

## 🔐 Rol "VISOR" - Configuración

### Características del Rol

- **Acceso**: Solo puede ver los visores de TV
- **Login**: Acceso igual que otros usuarios
- **Redirección**: Al loguearse, va directamente a `/visor/1`
- **Páginas permitidas**: `/visor/1` y `/visor/2` únicamente
- **Interfaz**: Sin navbar, sin dashboard, solo pantalla completa

### En Backend (para crear usuario VISOR)

Necesitas agregar en tu base de datos un usuario con:
```
username: visor
password: [la que definas]
role: VISOR  (o como lo llames en tu BD)
nombre: Pantalla de Cervezas
```

---

## 🎨 Los Dos Visores

### Visor 1: "El Templo Sagrado de la Birra"

**Estética**: Exactamente como la captura que enviaste
- Fondo negro profundo
- Texto vertical a la izquierda: "EL TEMPLO SAGRADO DE LA BIRRA"
- Header: "Cervezas" en gris elegante
- Layout: 3 columnas de información
- Formato por cerveza:
  - **Nombre del estilo** (grande, bold, blanco)
  - **ABV** (en naranja) + **Lúpulos** (1-5 ícono)
  - **Proveedor** (pequeño, gris) + **Precio** (grande, blanco)
- Separadores sutiles entre items

**Acceso**: http://localhost:5173/visor/1

### Visor 2: "Carta Moderna de Cervezas"

**Estética**: Diseño moderno y colorido
- Fondo degradado oscuro (slate)
- Header naranja/ámbar con título grande
- Grid de tarjetas (3-4 columnas, seleccionable)
- Cada tarjeta:
  - Número de canilla (grande, en badge ámbar)
  - Nombre de la cerveza (2xl, bold)
  - Proveedor (pequeño, ámbar claro)
  - ABV + Amargor (con indicadores visuales)
  - Precio (grande, fondo ámbar)
- Interactivo: puedes cambiar entre 3 o 4 columnas

**Acceso**: http://localhost:5173/visor/2

---

## 📺 Uso para TV

### Paso 1: Acceder como "VISOR"

```
URL: http://tu-ip:5173/login
Username: visor (o el que hayas creado)
Password: [tu contraseña]
```

### Paso 2: Elegir visor

Automáticamente irás a `/visor/1` o puedes cambiar a `/visor/2`

### Paso 3: Pantalla Completa

**Botón**: Click en icono "Maximize" (arriba a la derecha)
**Atajo**: F11 o ESC para salir

### Paso 4: En la TV

- Usa un navegador Chrome/Firefox
- Abre DevTools y ve a modo kiosk (fullscreen)
- La página actualizará automáticamente cada 30s
- Puedes pausar/reanudar actualizaciones con botón

---

## 📊 Datos Utilizados

### Fuente de Datos

**Hojas de Google**:
- Hoja: `BARRILES` (Recoleta)
- Rango: A3:F20
- Datos: Estado de canillas activas (Pinchada)

### Mapeo de Columnas

| Columna | Campo | Uso |
|---------|-------|-----|
| A | Canilla | Número de canilla (1-18) |
| B | Estilo | Nombre de la cerveza |
| C | Proveedor | Cervecería/Distribuidor |
| D | Amargor | 1-5 (para lúpulos) |
| E | ABV | Grados de alcohol |
| F | Precio | Precio de la cerveza |

### Datos en Tiempo Real

- Actualización automática cada 30 segundos
- Solo muestra cervezas con estado "Pinchada" (activas)
- Máximo 18 canillas
- Slots vacíos se muestran como espacios

---

## 🎮 Controles del Visor

### Botones Disponibles

| Botón | Acción | Ambos Visores |
|-------|--------|---------------|
| 🔄 Refresh | Actualiza datos ahora | ✅ |
| 🖥️ Maximize | Pantalla completa | ✅ |
| ⏸️ Pausar | Detiene actualización | ✅ |
| 📊 Columnas | Cambia layout (Visor 2) | ❌ |

### Atajos de Teclado

- **F11**: Pantalla completa del navegador
- **ESC**: Salir de pantalla completa
- **F5**: Recargar página
- **Ctrl+Shift+I**: DevTools (solo si está habilitado)

---

## 🔧 Configuración Técnica

### Rutas Protegidas

```typescript
// Ambas rutas solo permitidas para rol "visor"
GET  /visor/1  → CervezasVisor1
GET  /visor/2  → CervezasVisor2
```

### Sin Layout

- No incluyen Navbar
- No incluyen barras laterales
- Fullscreen desde el inicio
- Solo contenido de visor

### Auto-Refresh

- Intervalo: 30 segundos
- Se puede pausar/reanudar
- Usa timestampa para evitar caché

---

## 🐛 Troubleshooting

### El visor no actualiza

**Solución**: 
- Click en botón "Actualizar"
- Verifica que el toggle "Actualización automática" esté en ✓
- Recarga la página (F5)

### No veo datos de cervezas

**Verificar**:
- ¿Hay cervezas pinchadas en el sheet?
- ¿El estado es "Pinchada" (no "En Camara")?
- ¿Estás en Recoleta (sucursal 1)?

### Pantalla completa no funciona

**Solución**:
- Intenta F11 primero
- Si no va, prueba con F11 luego click en botón
- En Firefox, ve a Preferences → Sitios → Permitir fullscreen

### Los precios/datos no aparecen

**Causa**: Los datos se extraen de columnas D, E, F del Sheet
- Verifica que el formato sea correcto
- El script debe poder leer esos datos sin errores

---

## 📱 Múltiples Pantallas

Puedes tener ambos visores en diferentes TVs:

**TV 1**: http://[IP]:5173/visor/1 (Elegante, simple)
**TV 2**: http://[IP]:5173/visor/2 (Moderno, colorido)

Solo necesitas un usuario "VISOR" (mismo login en ambas)

---

## 🚀 Próximas Mejoras (Opcional)

- [ ] Agregar timer de "actualización en X segundos"
- [ ] Sonido de actualización (bell)
- [ ] Rotación automática entre Visor 1 y 2
- [ ] Selector de sucursal en el visor
- [ ] Dark/Light mode
- [ ] Integración de imágenes de cervezas
- [ ] Indicador de "última actualización"
- [ ] QR code para menu digital

---

## 📞 Soporte

Si algo no funciona:

1. Verifica que seas usuario con rol "VISOR"
2. Comprueba datos en Google Sheet
3. Abre DevTools (F12) y mira la consola
4. Recarga la página completamente (Ctrl+F5)

---

**¡Tu sistema de visor de cervezas está listo! 🍺📺**

Úsalo para mostrar la carta de cervezas en tiempo real en una TV de la barra.
