-- Add address column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
