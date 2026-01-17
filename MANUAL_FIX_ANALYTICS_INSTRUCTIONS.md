# 🔧 Manual Fix: Analytics Dashboard

## Problema Detectado

La página de analytics (`/analytics`) está fallando porque faltan las columnas de profit tracking en las tablas `sales` y `sale_items`.

## Solución Rápida (5 minutos)

### Paso 1: Acceder al SQL Editor de Supabase ⏱️ 30 segundos

1. Ve a: https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm
2. En el menú lateral izquierdo, haz clic en **"SQL Editor"**
3. Haz clic en **"New Query"**

### Paso 2: Ejecutar el Script de Reparación ⏱️ 2 minutos

1. Abre el archivo: `supabase/migrations/FIX_ANALYTICS_TABLES.sql`
2. **Copia TODO el contenido** (Ctrl+A, Ctrl+C)
3. **Pega** en el SQL Editor de Supabase
4. Haz clic en **"Run"** (o presiona Ctrl+Enter)
5. Espera a que termine (verás "Success" en verde)

### Paso 3: Verificar que Funcionó ⏱️ 1 minuto

Al final del script, deberías ver resultados como:

```
✅ sale_items columns
   has_profit: 1
   has_cost: 1

✅ sales columns
   has_total_profit: 1
   has_total_cost: 1

✅ RPC functions
   has_advanced_metrics: 1
   has_time_series: 1
   has_product_perf: 1
```

Si ves todos estos con valor `1`, ¡perfecto!

### Paso 4: Probar Analytics ⏱️ 30 segundos

1. Ve a: https://cafe-pi-steel.vercel.app/analytics
2. Refresca la página (Ctrl+R o F5)
3. La página debería cargar correctamente mostrando:
   - ✅ KPI cards (Revenue, Profit, Avg Ticket, Inventory Value)
   - ✅ Gráfico de revenue/profit
   - ✅ Gráfico de payment breakdown
   - ✅ Gráfico de product performance

## ¿Qué Hace el Script?

El script realiza 10 operaciones automáticamente:

1. ✅ Agrega columnas `profit` y `cost_per_unit` a `sale_items`
2. ✅ Agrega columnas `total_cost`, `total_profit`, `profit_margin` a `sales`
3. ✅ Crea índices para mejorar rendimiento
4. ✅ Crea función automática de cálculo de profit
5. ✅ Crea trigger para ejecutar el cálculo en cada venta
6. ✅ **Backfill**: Calcula profit para la venta del 15 de enero que ingresaste
7. ✅ Actualiza tabla `sales` con datos agregados
8. ✅ Recrea función `get_advanced_metrics`
9. ✅ Recrea función `get_sales_time_series`
10. ✅ Recrea función `get_product_performance`

## Solución de Problemas

### Si ves error: "column already exists"

**Solución**: Ignora, significa que esa columna ya estaba creada. Continúa con el resto del script.

### Si ves error: "function does not exist"

**Solución**: El script creará las funciones. Continúa ejecutando.

### Si analytics sigue fallando después del fix

1. Abre la consola del navegador (F12)
2. Ve a la pestaña "Network"
3. Refresca la página
4. Busca errores en rojo
5. Compárteme el error y lo arreglaré

## Tiempo Total Estimado

⏱️ **~5 minutos** de principio a fin

## ¿Necesitas Ayuda?

Si encuentras algún problema durante la ejecución:

1. Toma un screenshot del error
2. Compártelo conmigo
3. Te ayudaré a resolverlo inmediatamente

---

**Creado**: 2026-01-17
**Script**: `supabase/migrations/FIX_ANALYTICS_TABLES.sql`
