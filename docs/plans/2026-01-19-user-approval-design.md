# Sistema de Aprobación de Usuarios

## Resumen

Implementar un flujo donde los nuevos usuarios que se registren queden en estado "pendiente" hasta que el administrador los apruebe. Esto evita que extraños accedan al sistema.

## Decisiones de Diseño

- **Notificación al admin:** Panel en la app (sin costos de email)
- **Usuario no aprobado:** Ve pantalla de espera después de login
- **Interfaz de aprobación:** Badge en dashboard + modal
- **Info visible:** Solo email del usuario pendiente

## Cambios en Base de Datos

### 1. Nueva columna en `profiles`

```sql
ALTER TABLE profiles
ADD COLUMN approved BOOLEAN NOT NULL DEFAULT false;
```

### 2. Modificar trigger `handle_new_user()`

Nuevos usuarios se crean con `approved = false`:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, approved)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'seller', false);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. RPCs para gestión de usuarios

```sql
-- Obtener usuarios pendientes (solo admin)
CREATE OR REPLACE FUNCTION get_pending_users()
RETURNS TABLE (id UUID, email TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verificar que el usuario es admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email, p.created_at
  FROM auth.users u
  JOIN profiles p ON u.id = p.id
  WHERE p.approved = false
  ORDER BY p.created_at DESC;
END;
$$;

-- Aprobar usuario (solo admin)
CREATE OR REPLACE FUNCTION approve_user(user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verificar que el usuario es admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE profiles SET approved = true WHERE id = user_id;
END;
$$;

-- Rechazar usuario (solo admin) - elimina el usuario
CREATE OR REPLACE FUNCTION reject_user(user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verificar que el usuario es admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Eliminar de auth.users (cascade elimina profile)
  DELETE FROM auth.users WHERE id = user_id;
END;
$$;
```

### 4. Actualizar RLS (defensa en profundidad)

Agregar condición de `approved = true` a políticas de lectura de datos sensibles:

```sql
-- Ejemplo para sales
DROP POLICY IF EXISTS "Employees can CRUD sales" ON sales;
CREATE POLICY "Approved employees can CRUD sales" ON sales
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND approved = true
    )
  );
```

## Cambios en Frontend

### 1. `components/auth-provider.tsx`

Agregar `approved` al contexto:

```typescript
interface AuthContextType {
  // ... existente
  approved: boolean;
}

// En fetchUserRole, también obtener approved:
const { data } = await supabase.from('profiles').select('role, approved').eq('id', userId).single();

setApproved(data?.approved ?? false);
```

### 2. Nueva página `app/pendiente/page.tsx`

Pantalla de espera para usuarios no aprobados:

- Logo Mirador Montañero
- Mensaje: "Tu cuenta está pendiente de aprobación"
- Subtexto: "El administrador revisará tu solicitud pronto"
- Botón "Cerrar sesión"

### 3. Protección de rutas

En layout o middleware, redirigir usuarios no aprobados:

```typescript
// Si autenticado pero no aprobado y no está en /pendiente o /login
if (user && !approved && pathname !== '/pendiente' && pathname !== '/login') {
  router.push('/pendiente');
}
```

### 4. Badge en Dashboard (`app/page.tsx`)

Solo visible para admin:

```tsx
{
  isAdmin && pendingCount > 0 && (
    <button onClick={() => setShowPendingModal(true)}>
      <span className="badge">{pendingCount} pendientes</span>
    </button>
  );
}
```

### 5. Nuevo componente `components/PendingUsersModal.tsx`

Modal con lista de usuarios pendientes:

- Fetch con `supabase.rpc('get_pending_users')`
- Por cada usuario: email + botones Aprobar/Rechazar
- Aprobar: `supabase.rpc('approve_user', { user_id })`
- Rechazar: `supabase.rpc('reject_user', { user_id })`

## Archivos a Crear

| Archivo                                     | Descripción         |
| ------------------------------------------- | ------------------- |
| `supabase/migrations/013_user_approval.sql` | Migración completa  |
| `app/pendiente/page.tsx`                    | Pantalla de espera  |
| `components/PendingUsersModal.tsx`          | Modal de aprobación |

## Archivos a Modificar

| Archivo                        | Cambio                         |
| ------------------------------ | ------------------------------ |
| `components/auth-provider.tsx` | Agregar `approved` al contexto |
| `app/page.tsx`                 | Badge + modal de pendientes    |
| `app/layout.tsx`               | Protección de rutas            |

## Consideraciones

- **Admin existente:** Asegurarse de que el admin actual tenga `approved = true` antes de aplicar cambios
- **Migración:** Ejecutar `UPDATE profiles SET approved = true WHERE role = 'admin'` para no bloquearse
- **Testing:** Probar flujo completo en desarrollo antes de producción
