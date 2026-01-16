# Configuración de Supabase para Café Mirador

Este directorio contiene todas las migraciones SQL necesarias para configurar la base de datos de Supabase.

## Aplicar Migraciones a Supabase

### Paso 0: Diagnóstico (Ejecuta esto primero)

Antes de aplicar migraciones, verifica el estado actual de tu base de datos:

1. Abre tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Ve a **SQL Editor** en el menú lateral
3. Copia el contenido de `migrations/diagnose_database.sql`
4. Pégalo en el SQL Editor y haz clic en **Run**
5. Revisa los resultados para ver qué falta

### Opción 1: Fix rápido para producción (Recomendado si ya tienes algunas tablas)

Si ves el error "policy already exists" o algunas tablas ya existen:

1. Abre el archivo `migrations/fix_production_data.sql`
2. Copia TODO el contenido
3. Pégalo en el SQL Editor de Supabase
4. Haz clic en **Run**
5. Verifica que veas "SUCCESS: Inventory data loaded" en los resultados

Este script es **idempotente** (puedes ejecutarlo múltiples veces sin problemas).

### Opción 2: Base de datos nueva desde cero

Si tu base de datos está completamente vacía:

1. Abre el archivo `migrations/consolidated_migration.sql`
2. Copia TODO el contenido del archivo
3. Pégalo en el SQL Editor de Supabase
4. Haz clic en **Run** (o presiona Ctrl/Cmd + Enter)
5. Espera a que todas las queries se ejecuten (puede tomar 10-20 segundos)
6. Si ves errores de "already exists", ignóralos (significa que ya estaban creados)

### Opción 2: Ejecutar migraciones una por una

Si prefieres tener más control, ejecuta cada archivo en orden numérico:

1. `000_inventory_table.sql` - Crea tabla de inventario
2. `001_process_coffee_sale.sql` - Crea RPC para procesar ventas
3. `002_sales_tables.sql` - Crea tablas de ventas
4. `003_seed_data.sql` - Inserta datos iniciales
5. `004_dashboard_stats.sql` - Crea RPC para estadísticas
6. `005_customers.sql` - Crea tabla de clientes
7. `006_update_rpc_date.sql` - Actualiza RPC con fecha
8. `007_payment_and_products.sql` - Agrega métodos de pago
9. `008_update_rpc_payment.sql` - Actualiza RPC con pago
10. `009_customer_address.sql` - Agrega dirección a clientes
11. `010_security_rls.sql` - Configura Row Level Security
12. `011_roles_and_permissions.sql` - Configura roles y permisos
13. `012_auto_fix_user.sql` - Fix automático de usuarios
14. `013_fix_auth_error.sql` - Fix de tokens NULL en auth

## Verificar que las Migraciones se Aplicaron

Después de ejecutar las migraciones, verifica en el SQL Editor:

```sql
-- Verificar que existen las tablas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Verificar que hay productos en inventory
SELECT * FROM inventory;

-- Deberías ver 2 productos:
-- - Café Tostado (Grano)
-- - Café Molido Medio
```

## Troubleshooting

### Error: "policy already exists"
Si ves este error, significa que ya ejecutaste algunas migraciones. Puedes:
1. Saltarte las que ya están aplicadas
2. O resetear la base de datos desde el Dashboard de Supabase (Settings → Database → Reset Database)

### Error: "permission denied for schema auth"
La migración `013_fix_auth_error.sql` modifica el esquema `auth`. Si no tienes permisos:
1. Ejecuta esta migración desde el dashboard como owner
2. O sáltala si no ves errores de "Scan error" en la consola

### No aparecen productos en el dropdown
Significa que las migraciones no se ejecutaron. Sigue los pasos de "Aplicar Migraciones" arriba.

## Agregar Nuevas Migraciones

Si necesitas modificar el esquema:

1. Crea un nuevo archivo: `015_descripcion.sql` (siguiente número)
2. Escribe tus cambios SQL
3. Ejecútalo en el SQL Editor de Supabase
4. Actualiza `consolidated_migration.sql` si es necesario

## Notas Importantes

- **NO elimines** archivos de migraciones antiguas, son el historial del esquema
- **NO modifiques** migraciones ya aplicadas, crea una nueva migración
- El archivo `consolidated_migration.sql` se regenera concatenando todas las migraciones en orden
- La migración `014_fix_select_permissions.sql` fue eliminada por ser duplicada (ya cubierta en 010)
