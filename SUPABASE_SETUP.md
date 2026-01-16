# Guía de Configuración Supabase

Sigue estos pasos para desplegar la base de datos y conectar tu aplicación.

## 1. Crear Proyecto
1. Ve a [supabase.com/dashboard](https://supabase.com/dashboard) e inicia sesión.
2. Haz clic en **"New Project"**.
3. Selecciona tu organización, ponle nombre (ej: `Cafe-Mirador`) y establece una contraseña segura para la base de datos.
4. Espera unos minutos a que el proyecto se aprovisione.

## 2. Aplicar Migraciones (SQL)
Vamos a crear las tablas y la función de ventas.

1. En el menú lateral izquierdo, ve a **SQL Editor**.
2. Haz clic en **"New Query"**.
3. Copia y pega el contenido de los siguientes archivos (en orden):

### Paso A: Crear Tablas
Copia el contenido de: 

`supabase/migrations/000_inventory_table.sql` y `supabase/migrations/002_sales_tables.sql`
*(Puedes pegarlos uno tras otro o ejecutarlos por separado)*.
> **Ejecuta** el script (botón "Run").

### Paso B: Función RPC
Copia el contenido de: 

`supabase/migrations/001_process_coffee_sale.sql`
> **Ejecuta** el script.

### Paso C: Datos de Prueba (Semilla)
Copia el contenido de: 

`supabase/migrations/003_seed_data.sql`
> **Ejecuta** el script para tener café en el inventario inicial.

### Paso D: Dashboard Stats
Copia el contenido de:

`supabase/migrations/004_dashboard_stats.sql`
> **Ejecuta** el script para habilitar las métricas del panel.

### Paso E: Clientes
Copia el contenido de:

`supabase/migrations/005_customers.sql`
> **Ejecuta** el script para habilitar la gestión de clientes.

### Paso F: Fechas Personalizadas
Copia el contenido de:

`supabase/migrations/006_update_rpc_date.sql`
> **Ejecuta** el script para permitir registrar ventas con fecha pasada.

### Paso G: Productos y Pagos (Update)
Copia el contenido de:

`supabase/migrations/007_payment_and_products.sql`
> **Ejecuta** el script para añadir la columna de pagos y los nuevos productos.

### Paso H: RPC con Pagos
Copia el contenido de:

`supabase/migrations/008_update_rpc_payment.sql`
> **Ejecuta** el script para actualizar la función de venta.

### Paso I: Dirección de Clientes
Copia el contenido de:

`supabase/migrations/009_customer_address.sql`
> **Ejecuta** el script para añadir el campo de dirección.

### Paso J: Seguridad DART (IMPORTANTE)
Copia el contenido de:

`supabase/migrations/010_security_rls.sql`
> **Ejecuta** el script para habilitar la seguridad a nivel de fila (RLS) en todas las tablas. Esto es crucial para proteger los datos.

### Paso K: Roles y Permisos (Admin/Vendedor)
Copia el contenido de:

`supabase/migrations/011_roles_and_permissions.sql`
> **Ejecuta** el script. Esto creará la tabla de perfiles y restringirá que **SOLO LOS ADMINS** puedan editar inventario.
>
> **IMPORTANTE**: Por defecto, nuevos usuarios son 'seller'. Para hacerte Admin, ve a la tabla `public.profiles` en Supabase y cambia tu `role` a 'admin' manualmente después de registrarte.

### Paso L: Fix Rápido (Opcional)
Si te registraste como `vendedor-test@cafe.com` y no quieres configurar el email:
Copia y ejecuta: `supabase/migrations/012_auto_fix_user.sql`
> Esto confirma el email y te hace Admin automáticamente.

### Paso M: Fix Auth Error
Copia el contenido de:

`supabase/migrations/013_fix_auth_error.sql`
> **Ejecuta** el script para corregir posibles errores de autenticación en la creación de usuarios.

## 3. Obtener Credenciales
Para conectar el Frontend (`Next.js`):

1. Ve a **Project Settings** (icono de engranaje abajo a la izquierda).
2. Selecciona **API**.
3. En la sección **Project URL**, copia la URL.
4. En la sección **Project API keys**, busca la clave `anon` `public` y cópiala.

## 4. Configurar Frontend

1. En tu proyecto local, renombra el archivo:
   `frontend/.env.local.example` -> `frontend/.env.local`
2. Pega tus credenciales:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anon-publica-larga
   ```

## 5. Verificar IDs de Productos
Para que el modal de ventas funcione, necesita los IDs reales de tus productos.

1. Ve al **Table Editor** en Supabase.
2. Abre la tabla `inventory`.
3. Copia el `product_id` (UUID) del "Café Tostado" y "Café Molido".
4. (Opcional) Actualiza el archivo `frontend/components/new-sale-modal.tsx` con estos IDs o implementa un `SELECT` dinámico en el futuro.
