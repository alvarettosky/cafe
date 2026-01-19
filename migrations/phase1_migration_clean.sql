-- Phase 1: Customer Recurrence and Sales Editing Migration

-- Create customer_contacts table
CREATE TABLE IF NOT EXISTS customer_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    contact_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contact_type TEXT NOT NULL CHECK (contact_type IN ('call', 'visit', 'message', 'other')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_customer_id ON customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_contacts_contact_date ON customer_contacts(contact_date);

ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON customer_contacts FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON customer_contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON customer_contacts FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON customer_contacts FOR DELETE USING (true);

-- Add columns to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS typical_recurrence_days INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_purchase_date TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_last_purchase_date ON customers(last_purchase_date);

-- Add column to sales table
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS customer_recurrence_days INTEGER DEFAULT NULL;

-- Function: calculate_customer_recurrence
DROP FUNCTION IF EXISTS calculate_customer_recurrence(UUID);

CREATE OR REPLACE FUNCTION calculate_customer_recurrence(p_customer_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_recurrence_days INTEGER;
    v_sale_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_sale_count
    FROM sales
    WHERE customer_id = p_customer_id;

    IF v_sale_count < 2 THEN
        RETURN NULL;
    END IF;

    WITH recent_sales AS (
        SELECT created_at
        FROM sales
        WHERE customer_id = p_customer_id
        ORDER BY created_at DESC
        LIMIT 3
    ),
    date_diffs AS (
        SELECT
            created_at,
            LAG(created_at) OVER (ORDER BY created_at DESC) as prev_date
        FROM recent_sales
    )
    SELECT
        ROUND(AVG(EXTRACT(DAY FROM (prev_date - created_at))))::INTEGER
    INTO v_recurrence_days
    FROM date_diffs
    WHERE prev_date IS NOT NULL;

    RETURN v_recurrence_days;
END;
$$;

-- Function: get_customers_to_contact
DROP FUNCTION IF EXISTS get_customers_to_contact(INTEGER);

CREATE OR REPLACE FUNCTION get_customers_to_contact(p_days_threshold INTEGER DEFAULT 7)
RETURNS TABLE (
    customer_id UUID,
    full_name TEXT,
    phone TEXT,
    email TEXT,
    last_purchase_date TIMESTAMPTZ,
    typical_recurrence_days INTEGER,
    days_since_last_purchase INTEGER,
    days_until_expected INTEGER,
    urgency TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH customer_data AS (
        SELECT
            c.id,
            c.full_name,
            c.phone,
            c.email,
            c.last_purchase_date,
            c.typical_recurrence_days,
            EXTRACT(DAY FROM (CURRENT_TIMESTAMP - c.last_purchase_date))::INTEGER as days_since_last,
            CASE
                WHEN c.typical_recurrence_days IS NOT NULL THEN
                    c.typical_recurrence_days - EXTRACT(DAY FROM (CURRENT_TIMESTAMP - c.last_purchase_date))::INTEGER
                ELSE
                    NULL
            END as days_until_expected
        FROM customers c
        WHERE c.last_purchase_date IS NOT NULL
    )
    SELECT
        cd.id as customer_id,
        cd.full_name,
        cd.phone,
        cd.email,
        cd.last_purchase_date,
        cd.typical_recurrence_days,
        cd.days_since_last as days_since_last_purchase,
        cd.days_until_expected as days_until_expected,
        CASE
            WHEN cd.days_until_expected IS NULL THEN 'unknown'
            WHEN cd.days_until_expected <= -p_days_threshold THEN 'high'
            WHEN cd.days_until_expected <= 0 THEN 'medium'
            ELSE 'low'
        END as urgency
    FROM customer_data cd
    WHERE
        cd.typical_recurrence_days IS NULL
        OR
        cd.days_until_expected <= 0
    ORDER BY
        CASE
            WHEN cd.days_until_expected IS NULL THEN 3
            WHEN cd.days_until_expected <= -p_days_threshold THEN 1
            WHEN cd.days_until_expected <= 0 THEN 2
            ELSE 3
        END,
        cd.days_since_last DESC;
END;
$$;

-- Function: update_customer_recurrence
DROP FUNCTION IF EXISTS update_customer_recurrence(UUID, INTEGER);

CREATE OR REPLACE FUNCTION update_customer_recurrence(
    p_customer_id UUID,
    p_recurrence_days INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE customers
    SET
        typical_recurrence_days = p_recurrence_days,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_customer_id;

    RETURN FOUND;
END;
$$;

-- Function: can_edit_sale
DROP FUNCTION IF EXISTS can_edit_sale(UUID);

CREATE OR REPLACE FUNCTION can_edit_sale(p_sale_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_created_at TIMESTAMPTZ;
    v_hours_elapsed NUMERIC;
BEGIN
    SELECT created_at INTO v_created_at
    FROM sales
    WHERE id = p_sale_id;

    IF v_created_at IS NULL THEN
        RETURN FALSE;
    END IF;

    v_hours_elapsed := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_created_at)) / 3600;

    RETURN v_hours_elapsed < 24;
END;
$$;

-- Function: edit_sale
DROP FUNCTION IF EXISTS edit_sale(UUID, UUID, TEXT, JSONB);

CREATE OR REPLACE FUNCTION edit_sale(
    p_sale_id UUID,
    p_customer_id UUID,
    p_payment_method TEXT,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_can_edit BOOLEAN;
    v_old_items JSONB;
    v_new_total NUMERIC := 0;
    v_new_cost NUMERIC := 0;
    v_new_profit NUMERIC := 0;
    v_item JSONB;
    v_product_id UUID;
    v_old_quantity NUMERIC;
    v_new_quantity NUMERIC;
    v_price NUMERIC;
    v_cost NUMERIC;
    v_unit TEXT;
BEGIN
    v_can_edit := can_edit_sale(p_sale_id);

    IF NOT v_can_edit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Sale cannot be edited after 24 hours'
        );
    END IF;

    SELECT jsonb_agg(
        jsonb_build_object(
            'product_id', product_id,
            'quantity', quantity,
            'unit', unit
        )
    ) INTO v_old_items
    FROM sale_items
    WHERE sale_id = p_sale_id;

    BEGIN
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_old_items)
        LOOP
            v_product_id := (v_item->>'product_id')::UUID;
            v_old_quantity := (v_item->>'quantity')::NUMERIC;
            v_unit := v_item->>'unit';

            IF v_unit = 'kg' THEN
                UPDATE inventory
                SET
                    stock_kg = stock_kg + v_old_quantity,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = v_product_id;
            ELSE
                UPDATE inventory
                SET
                    stock_units = stock_units + v_old_quantity,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = v_product_id;
            END IF;
        END LOOP;

        DELETE FROM sale_items WHERE sale_id = p_sale_id;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
        LOOP
            v_product_id := (v_item->>'product_id')::UUID;
            v_new_quantity := (v_item->>'quantity')::NUMERIC;
            v_price := (v_item->>'unit_price')::NUMERIC;
            v_unit := v_item->>'unit';

            SELECT
                CASE
                    WHEN v_unit = 'kg' THEN cost_per_kg
                    ELSE cost_per_unit
                END INTO v_cost
            FROM inventory
            WHERE product_id = v_product_id;

            INSERT INTO sale_items (
                sale_id,
                product_id,
                quantity,
                unit,
                unit_price,
                total_price,
                cost_per_unit,
                profit
            ) VALUES (
                p_sale_id,
                v_product_id,
                v_new_quantity,
                v_unit,
                v_price,
                v_price * v_new_quantity,
                v_cost,
                (v_price - v_cost) * v_new_quantity
            );

            IF v_unit = 'kg' THEN
                UPDATE inventory
                SET
                    stock_kg = stock_kg - v_new_quantity,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = v_product_id;
            ELSE
                UPDATE inventory
                SET
                    stock_units = stock_units - v_new_quantity,
                    updated_at = CURRENT_TIMESTAMP
                WHERE product_id = v_product_id;
            END IF;

            v_new_total := v_new_total + (v_price * v_new_quantity);
            v_new_cost := v_new_cost + (v_cost * v_new_quantity);
        END LOOP;

        v_new_profit := v_new_total - v_new_cost;

        UPDATE sales
        SET
            customer_id = p_customer_id,
            payment_method = p_payment_method,
            total_amount = v_new_total,
            total_cost = v_new_cost,
            total_profit = v_new_profit,
            profit_margin = CASE
                WHEN v_new_total > 0 THEN (v_new_profit / v_new_total * 100)
                ELSE 0
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = p_sale_id;

        RETURN jsonb_build_object(
            'success', true,
            'sale_id', p_sale_id,
            'total_amount', v_new_total,
            'total_profit', v_new_profit
        );

    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
    END;
END;
$$;

-- Trigger to update customer last_purchase_date
DROP TRIGGER IF EXISTS update_customer_last_purchase ON sales;
DROP FUNCTION IF EXISTS update_customer_last_purchase_trigger();

CREATE OR REPLACE FUNCTION update_customer_last_purchase_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE customers
    SET
        last_purchase_date = NEW.created_at,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.customer_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER update_customer_last_purchase
    AFTER INSERT ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_last_purchase_trigger();

-- Backfill existing data
UPDATE customers c
SET last_purchase_date = (
    SELECT MAX(s.created_at)
    FROM sales s
    WHERE s.customer_id = c.id
)
WHERE EXISTS (
    SELECT 1 FROM sales s WHERE s.customer_id = c.id
);

UPDATE customers c
SET typical_recurrence_days = calculate_customer_recurrence(c.id)
WHERE (
    SELECT COUNT(*) FROM sales WHERE customer_id = c.id
) >= 3;
