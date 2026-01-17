-- tests/database/seed-test-data.sql
-- Seed test data for database integration tests

-- Clean test data
DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE customer_id = '00000000-0000-0000-0000-000000000099');
DELETE FROM sales WHERE customer_id = '00000000-0000-0000-0000-000000000099';
DELETE FROM customers WHERE id = '00000000-0000-0000-0000-000000000099';

-- Insert test customer
INSERT INTO customers (id, full_name, phone)
VALUES ('00000000-0000-0000-0000-000000000099', 'Test Customer', '1234567890')
ON CONFLICT (id) DO NOTHING;

-- Insert test sale
INSERT INTO sales (
  id,
  customer_id,
  total_amount,
  total_cost,
  total_profit,
  profit_margin,
  payment_method,
  created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000999',
  '00000000-0000-0000-0000-000000000099',
  1000.00,
  300.00,
  700.00,
  70.00,
  'Efectivo',
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET total_amount = EXCLUDED.total_amount;

SELECT 'Test data seeded successfully' as status;
