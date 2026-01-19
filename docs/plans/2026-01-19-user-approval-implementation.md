# Sistema de Aprobación de Usuarios - Plan de Implementación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementar flujo donde nuevos usuarios quedan pendientes hasta que el admin los apruebe, bloqueando acceso a extraños.

**Architecture:** Agregar columna `approved` a `profiles`, modificar auth-provider para exponer este estado, crear página de espera para no aprobados, y modal de gestión para admin en dashboard.

**Tech Stack:** Next.js 16, Supabase (PostgreSQL + RLS + RPCs), React Context, TailwindCSS

---

## Task 1: Migración SQL

**Files:**

- Create: `supabase/migrations/020_user_approval.sql`

**Step 1: Crear archivo de migración**

```sql
-- ============================================
-- MIGRATION: User Approval System
-- ============================================

-- 1. Agregar columna approved a profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false;

-- 2. Aprobar usuarios existentes (IMPORTANTE: ejecutar ANTES de cambiar RLS)
UPDATE profiles SET approved = true WHERE approved = false;

-- 3. Modificar trigger para nuevos usuarios (quedan pendientes)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, approved)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'seller',
    false  -- Nuevos usuarios quedan pendientes
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: Obtener usuarios pendientes (solo admin)
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
  SELECT u.id, u.email::TEXT, p.created_at
  FROM auth.users u
  JOIN profiles p ON u.id = p.id
  WHERE p.approved = false
  ORDER BY p.created_at DESC;
END;
$$;

-- 5. RPC: Aprobar usuario (solo admin)
CREATE OR REPLACE FUNCTION approve_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Verificar que el usuario es admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE profiles SET approved = true WHERE id = p_user_id;
END;
$$;

-- 6. RPC: Rechazar usuario (solo admin)
CREATE OR REPLACE FUNCTION reject_user(p_user_id UUID)
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
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- 7. Actualizar RLS para requerir aprobación en tablas sensibles

-- Sales
DROP POLICY IF EXISTS "Employees can CRUD sales" ON sales;
CREATE POLICY "Approved employees can CRUD sales" ON sales
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND approved = true
    )
  );

-- Sale Items
DROP POLICY IF EXISTS "Employees can CRUD sale items" ON sale_items;
CREATE POLICY "Approved employees can CRUD sale items" ON sale_items
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND approved = true
    )
  );

-- Customers
DROP POLICY IF EXISTS "Employees can manage customers" ON customers;
CREATE POLICY "Approved employees can manage customers" ON customers
  FOR ALL USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND approved = true
    )
  );

-- Inventory (lectura para aprobados, escritura solo admin)
DROP POLICY IF EXISTS "Enable read access for all users" ON inventory;
CREATE POLICY "Approved users can read inventory" ON inventory
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND approved = true
    )
  );
```

**Step 2: Ejecutar migración en Supabase**

El usuario debe ejecutar este SQL manualmente en:

- Supabase Dashboard → SQL Editor → Pegar y ejecutar

**Step 3: Verificar migración**

```sql
-- Verificar columna existe
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'approved';

-- Verificar usuarios existentes están aprobados
SELECT id, role, approved FROM profiles;

-- Verificar RPCs existen
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_pending_users', 'approve_user', 'reject_user');
```

---

## Task 2: Modificar Auth Provider

**Files:**

- Modify: `components/auth-provider.tsx`

**Step 1: Agregar estado `approved` al contexto**

Modificar `auth-provider.tsx`:

```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';

type UserRole = 'admin' | 'seller' | null;

interface AuthContextType {
    user: User | null;
    session: Session | null;
    role: UserRole;
    approved: boolean;
    isLoading: boolean;
    isAdmin: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [role, setRole] = useState<UserRole>(null);
    const [approved, setApproved] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // 1. Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchUserProfile(session.user.id);
            } else {
                setIsLoading(false);
            }
        });

        // 2. Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                fetchUserProfile(session.user.id);
            } else {
                setRole(null);
                setApproved(false);
                setIsLoading(false);
                // Redirect to login if signed out (only on client)
                if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                    router.push('/login');
                }
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Redirigir usuarios no aprobados
    useEffect(() => {
        if (isLoading) return;

        const publicPaths = ['/login', '/pendiente'];
        const isPublicPath = publicPaths.includes(pathname);

        if (user && !approved && !isPublicPath) {
            router.push('/pendiente');
        }
    }, [user, approved, isLoading, pathname, router]);

    async function fetchUserProfile(userId: string) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('role, approved')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error fetching profile:', error);
                setRole(null);
                setApproved(false);
            } else {
                setRole(data?.role as UserRole);
                setApproved(data?.approved ?? false);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }

    const signInWithGoogle = async () => {
        // Not implemented yet, password based for now
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const value = {
        user,
        session,
        role,
        approved,
        isLoading,
        isAdmin: role === 'admin',
        signInWithGoogle,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
```

**Step 2: Verificar compilación**

Run: `npm run build`
Expected: Sin errores de TypeScript

**Step 3: Commit**

```bash
git add components/auth-provider.tsx
git commit -m "feat: add approved state to auth context"
```

---

## Task 3: Crear Página de Espera

**Files:**

- Create: `app/pendiente/page.tsx`

**Step 1: Crear página de espera para usuarios no aprobados**

```typescript
'use client';

import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Clock, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PendingApprovalPage() {
    const { user, approved, isLoading, signOut } = useAuth();
    const router = useRouter();

    // Si ya está aprobado, redirigir al dashboard
    useEffect(() => {
        if (!isLoading && approved) {
            router.push('/');
        }
    }, [approved, isLoading, router]);

    // Si no hay usuario, redirigir a login
    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950">
                <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
            <div className="w-full max-w-md space-y-8 rounded-2xl bg-zinc-900 p-8 shadow-xl border border-zinc-800 text-center">
                <div className="flex flex-col items-center">
                    <div className="rounded-full bg-amber-500/10 p-4 mb-4">
                        <Clock className="h-12 w-12 text-amber-500" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Mirador Montañero
                        <span className="block text-xl text-emerald-400 font-normal mt-1">Café Selecto</span>
                    </h1>
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">
                        Tu cuenta está pendiente de aprobación
                    </h2>
                    <p className="text-zinc-400">
                        El administrador revisará tu solicitud pronto.
                        Recibirás acceso una vez que tu cuenta sea aprobada.
                    </p>
                    <p className="text-sm text-zinc-500">
                        Registrado como: <span className="text-zinc-300">{user?.email}</span>
                    </p>
                </div>

                <Button
                    variant="outline"
                    onClick={signOut}
                    className="w-full mt-6"
                >
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar sesión
                </Button>
            </div>
        </div>
    );
}
```

**Step 2: Verificar compilación**

Run: `npm run build`
Expected: Sin errores

**Step 3: Commit**

```bash
git add app/pendiente/page.tsx
git commit -m "feat: add pending approval page for unapproved users"
```

---

## Task 4: Crear Modal de Usuarios Pendientes

**Files:**

- Create: `components/pending-users-modal.tsx`

**Step 1: Crear componente modal**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { X, Check, Trash2, Loader2, Users } from 'lucide-react';

interface PendingUser {
    id: string;
    email: string;
    created_at: string;
}

interface PendingUsersModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

export function PendingUsersModal({ isOpen, onClose, onUpdate }: PendingUsersModalProps) {
    const [users, setUsers] = useState<PendingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchPendingUsers();
        }
    }, [isOpen]);

    async function fetchPendingUsers() {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_pending_users');
            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error('Error fetching pending users:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleApprove(userId: string) {
        setActionLoading(userId);
        try {
            const { error } = await supabase.rpc('approve_user', { p_user_id: userId });
            if (error) throw error;
            await fetchPendingUsers();
            onUpdate();
        } catch (err) {
            console.error('Error approving user:', err);
            alert('Error al aprobar usuario');
        } finally {
            setActionLoading(null);
        }
    }

    async function handleReject(userId: string) {
        if (!confirm('¿Estás seguro de rechazar este usuario? Se eliminará permanentemente.')) {
            return;
        }

        setActionLoading(userId);
        try {
            const { error } = await supabase.rpc('reject_user', { p_user_id: userId });
            if (error) throw error;
            await fetchPendingUsers();
            onUpdate();
        } catch (err) {
            console.error('Error rejecting user:', err);
            alert('Error al rechazar usuario');
        } finally {
            setActionLoading(null);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-amber-500" />
                        <h2 className="text-lg font-semibold text-white">Usuarios Pendientes</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-zinc-400">No hay usuarios pendientes</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">
                                            {user.email}
                                        </p>
                                        <p className="text-xs text-zinc-500">
                                            {new Date(user.created_at).toLocaleDateString('es-CO', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                    <div className="flex gap-2 ml-3">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 w-8 p-0 border-emerald-600 hover:bg-emerald-600"
                                            onClick={() => handleApprove(user.id)}
                                            disabled={actionLoading === user.id}
                                        >
                                            {actionLoading === user.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Check className="w-4 h-4 text-emerald-500" />
                                            )}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 w-8 p-0 border-red-600 hover:bg-red-600"
                                            onClick={() => handleReject(user.id)}
                                            disabled={actionLoading === user.id}
                                        >
                                            {actionLoading === user.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
```

**Step 2: Verificar compilación**

Run: `npm run build`
Expected: Sin errores

**Step 3: Commit**

```bash
git add components/pending-users-modal.tsx
git commit -m "feat: add pending users modal for admin approval"
```

---

## Task 5: Integrar Badge y Modal en Dashboard

**Files:**

- Modify: `app/page.tsx`

**Step 1: Agregar imports y estado**

Al inicio del archivo, agregar:

```typescript
import { PendingUsersModal } from '@/components/pending-users-modal';
```

Dentro del componente Dashboard, agregar estados:

```typescript
const { user, isLoading, isAdmin } = useAuth();
const [pendingCount, setPendingCount] = useState(0);
const [showPendingModal, setShowPendingModal] = useState(false);
```

**Step 2: Agregar fetch de usuarios pendientes**

Dentro del useEffect que hace fetch de datos, agregar:

```typescript
// Fetch pending users count (solo admin)
if (isAdmin) {
  const { data: pendingData } = await supabase.rpc('get_pending_users');
  if (pendingData) setPendingCount(pendingData.length);
}
```

Y agregar `isAdmin` a las dependencias del useEffect.

**Step 3: Agregar badge en header**

Después del botón de refresh, agregar:

```tsx
{
  isAdmin && pendingCount > 0 && (
    <Button variant="outline" onClick={() => setShowPendingModal(true)} className="relative">
      <Users className="w-4 h-4 mr-2" />
      Pendientes
      <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
        {pendingCount}
      </span>
    </Button>
  );
}
```

**Step 4: Agregar modal al final del componente**

Antes de cerrar el `<main>`:

```tsx
<PendingUsersModal
  isOpen={showPendingModal}
  onClose={() => setShowPendingModal(false)}
  onUpdate={() => {
    handleRefresh();
    supabase.rpc('get_pending_users').then(({ data }) => {
      if (data) setPendingCount(data.length);
    });
  }}
/>
```

**Step 5: Verificar compilación**

Run: `npm run build`
Expected: Sin errores

**Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add pending users badge and modal to dashboard"
```

---

## Task 6: Testing Manual

**Step 1: Probar flujo completo en desarrollo**

1. Ejecutar migración SQL en Supabase
2. `npm run dev`
3. Crear cuenta nueva → debe ir a `/pendiente`
4. Como admin, ver badge en dashboard
5. Aprobar usuario → usuario puede acceder
6. Rechazar usuario → usuario se elimina

**Step 2: Verificar RLS**

Usuario no aprobado no debe poder leer datos aunque intente acceder directamente a la API.

**Step 3: Commit final**

```bash
git add -A
git commit -m "feat: complete user approval system implementation"
```

---

## Resumen de Archivos

| Archivo                                     | Acción    | Descripción                    |
| ------------------------------------------- | --------- | ------------------------------ |
| `supabase/migrations/020_user_approval.sql` | Crear     | Migración completa             |
| `components/auth-provider.tsx`              | Modificar | Agregar `approved` al contexto |
| `app/pendiente/page.tsx`                    | Crear     | Pantalla de espera             |
| `components/pending-users-modal.tsx`        | Crear     | Modal de aprobación            |
| `app/page.tsx`                              | Modificar | Badge + integración modal      |

## Orden de Ejecución

1. **Task 1**: Migración SQL (manual en Supabase)
2. **Task 2**: Auth Provider
3. **Task 3**: Página /pendiente
4. **Task 4**: Modal de pendientes
5. **Task 5**: Integración en Dashboard
6. **Task 6**: Testing manual
