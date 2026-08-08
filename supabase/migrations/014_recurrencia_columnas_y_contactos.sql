-- 014_recurrencia_columnas_y_contactos.sql
--
-- EL ESLABON QUE FALTABA PARA PODER RECONSTRUIR LA BASE.
--
-- ===========================================================================
-- Que problema resuelve
-- ===========================================================================
--
-- El 2026-08-07, el primer ensayo de restauracion real
-- (`scripts/restore-drill.sh`) demostro que **la base no era reconstruible
-- desde `supabase/migrations/`**: `021_fase1_recurrencia.sql` falla en la
-- linea 264 con
--
--     ERROR: column c.typical_recurrence_days does not exist
--
-- porque esa columna —y la tabla `customer_contacts` entera— se crean en
-- `migrations/phase1_migration_clean.sql`, un archivo de **otro directorio**
-- (`migrations/`, en la raiz) que no lleva numero y por tanto no forma parte
-- de ninguna secuencia. En produccion existe porque alguien lo ejecuto a mano
-- en su momento; en una base nueva, no.
--
-- El efecto medido: al reconstruir, 2 de 33 migraciones fallaban y el backup
-- traia datos de `customer_contacts` que no tenian donde ir.
--
-- Esta migracion trae ese eslabon al orden canonico, con el numero 014 —libre
-- entre `013` y `015`— para que quede ANTES de la 021 que lo necesita.
--
-- ===========================================================================
-- Por que es seguro aplicarla en produccion
-- ===========================================================================
--
-- Todo es `IF NOT EXISTS` / `DROP POLICY IF EXISTS` antes de crear: en la base
-- real, donde estos objetos ya existen desde enero, **no cambia nada**. Su
-- valor esta en la base que todavia no existe: la del dia que haya que
-- restaurar.
--
-- Fuente literal: `migrations/phase1_migration_clean.sql`. Ese archivo se
-- conserva como registro historico; el orden canonico es este.

-- `uuid_generate_v4()` viene de uuid-ossp, que el original daba por instalada.
-- `gen_random_uuid()` es equivalente y va en el core desde PG13, pero se
-- respeta la firma original creando la extension si falta.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --- Historial de contactos con clientes -----------------------------------
CREATE TABLE IF NOT EXISTS customer_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    contact_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contact_type TEXT NOT NULL CHECK (contact_type IN ('call', 'visit', 'message', 'other')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id  ON customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_contact_date ON customer_contacts(contact_date);

ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

-- Las politicas abiertas del original se reproducen tal cual para no cambiar
-- el comportamiento al reconstruir. ⚠️ `027_cerrar_rls_publico.sql` las cierra
-- mas adelante en la secuencia: el orden importa y esta migracion va antes.
DROP POLICY IF EXISTS "Enable read access for all users"   ON customer_contacts;
DROP POLICY IF EXISTS "Enable insert access for all users" ON customer_contacts;
DROP POLICY IF EXISTS "Enable update access for all users" ON customer_contacts;
DROP POLICY IF EXISTS "Enable delete access for all users" ON customer_contacts;
CREATE POLICY "Enable read access for all users"   ON customer_contacts FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON customer_contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON customer_contacts FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON customer_contacts FOR DELETE USING (true);

-- --- Columnas de recurrencia que 021 da por hechas --------------------------
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS typical_recurrence_days INTEGER   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_purchase_date      TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_last_purchase_date ON customers(last_purchase_date);

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS customer_recurrence_days INTEGER DEFAULT NULL;

-- --- Comprobacion ----------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.customer_contacts') IS NULL THEN
    RAISE EXCEPTION '014: customer_contacts no quedo creada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='customers'
                   AND column_name='typical_recurrence_days') THEN
    RAISE EXCEPTION '014: customers.typical_recurrence_days no quedo creada';
  END IF;
  RAISE NOTICE '014 OK: customer_contacts y columnas de recurrencia disponibles para 021';
END $$;
