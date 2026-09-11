# Actualización de Afiliaciones y Barras de Stock Dinámicas

## Resumen de Cambios

Se han realizado dos actualizaciones importantes en el sistema:

### 1. ✅ Actualización de Afiliaciones (Linkeos)

**Cambios realizados:**
- Eliminadas todas las afiliaciones antiguas
- Insertadas 27 nuevas afiliaciones con 56 linkeos totales

**Nuevas afiliaciones:**
```
S001 - Jameson → Nucleo: 8, 534
S002 - Black Label → Nucleo: 7
S003 - Jack Daniels → Nucleo: 6
S004 - Havana Club → Nucleo: 13, 609
S005 - Absolut → Nucleo: 14, 15
S006 - Smirnoff → Nucleo: 16, 17, 707
S007 - Jagger → Nucleo: 18, 19, 527, 543
S008 - Cinzano → Nucleo: 448, 607
S009 - Bombay → Nucleo: 9
S010 - Aconcagua → Nucleo: 10, 616
S011 - Campari → Nucleo: 11, 604, 615
S012 - Fernet → Nucleo: 12, 602, 614
S013 - Aperol → Nucleo: 426, 603
S014 - Cynar → Nucleo: 425, 605
S015 - La Fuerza → Nucleo: 337
S016 - Champagne Espumante → Nucleo: 426, 603
S017 - Tequila Jose Cuervo Blue Agave → Nucleo: 535, 706
S018 - Gancia → Nucleo: 580
S019 - Barreiro → Nucleo: 525
S021 - Carpano Rosso → Nucleo: 539, 541, 531
S022 - Lemoncello → Nucleo: 533
S023 - Redbull → Nucleo: 17, 28, 15, 19, 534
S025 - Paso a Paso Criolla Blanco → Nucleo: 552, 563, 621
S026 - Nido del Tigre Malbec → Nucleo: 585, 586, 623
S140 - Cafayate Dulce Cosecha Tardia → (Sin códigos Nucleo)
S141 - Chardonnay Turbio → Nucleo: 140, 141
S142 - La Cayetana Pinot Noir → Nucleo: 54, 138
```

**Nota:** S140 (Cafayate Dulce Cosecha Tardia) se insertó sin códigos de Nucleo asociados.

### 2. ✅ Barras de Stock Dinámicas

**Cambios realizados en `frontend/src/pages/EstadisticasStocks.tsx`:**

- Las barras de stock ahora son **100% dinámicas**
- El tamaño de cada barra se calcula basándose en el **máximo valor** de la semana con más cantidad
- Las demás barras se escalan proporcionalmente respecto al máximo
- Se agregó un **gradiente visual** (from-accent to-accent/80) para mejor presentación
- Se muestra el **porcentaje** dentro de la barra cuando hay espacio suficiente (>15%)

**Antes:**
```
Todas las barras tenían el mismo tamaño fijo
```

**Después:**
```
Barra con máximo cantidad: 100% de ancho
Otras barras: Ancho proporcional al máximo
Ejemplo: Si máximo es 100 unidades:
  - 100 unidades → 100% ancho
  - 50 unidades → 50% ancho
  - 25 unidades → 25% ancho
```

## Archivos Modificados

1. **backend-nucleo/insert_afiliaciones.py**
   - Actualizado con las nuevas afiliaciones
   - Script ejecutado exitosamente

2. **frontend/src/pages/EstadisticasStocks.tsx**
   - Función `BarChart` mejorada con cálculo dinámico
   - Mejor visualización con gradientes
   - Muestra porcentaje en las barras

## Verificación

✅ Base de datos actualizada correctamente:
- Total de linkeos: 56
- Total de productos: 27
- Todos los códigos de stock insertados correctamente

## Próximos Pasos (Opcional)

Si deseas hacer más cambios:
1. Agregar más afiliaciones: Editar `insert_afiliaciones.py` y ejecutar
2. Personalizar colores de barras: Modificar clases Tailwind en `BarChart`
3. Cambiar altura de barras: Ajustar `h-8` en el componente

---
**Fecha de actualización:** 14 de Mayo de 2026
**Estado:** ✅ Completado
