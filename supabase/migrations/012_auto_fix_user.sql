-- Utility Script: Auto-confirm test user and make Admin
-- Run this in Supabase SQL Editor to skip manual configuration steps.

-- 1. Confirm Email
-- FIXED: Set confirmation_token to empty string '' instead of NULL to avoid scan errors
UPDATE auth.users
SET email_confirmed_at = NOW(),
    confirmation_token = ''
WHERE email = 'vendedor-test@cafe.com';

-- 2. Make Admin
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'vendedor-test@cafe.com'
);

-- 3. (Optional) Create profile if trigger failed for some reason
INSERT INTO public.profiles (id, full_name, role)
SELECT id, 'Vendedor Test', 'admin'
FROM auth.users
WHERE email = 'vendedor-test@cafe.com'
AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.users.id);
