-- CRITICAL FIX: Resolve "Scan error ... converting NULL to string"
-- Run this IMMEDIATELY in the Supabase SQL Editor if you see the "Scan error" in your console.

-- Fix confirmation_token
UPDATE auth.users
SET confirmation_token = ''
WHERE confirmation_token IS NULL;

-- Fix other potential token fields causing similar issues
UPDATE auth.users
SET recovery_token = ''
WHERE recovery_token IS NULL;

UPDATE auth.users
SET email_change_token_new = ''
WHERE email_change_token_new IS NULL;

UPDATE auth.users
SET email_change = ''
WHERE email_change IS NULL;

-- Output result to verify
SELECT email, confirmation_token FROM auth.users;
