import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

describe('Database Integration Tests', () => {
  beforeAll(async () => {
    // Seed test data
    // Note: In real scenario, you'd run seed-test-data.sql via admin connection
  });

  describe('Inventory Table', () => {
    it('should fetch inventory with all columns', async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThan(0);

      if (data && data.length > 0) {
        const item = data[0];
        expect(item).toHaveProperty('product_id');
        expect(item).toHaveProperty('product_name');
        expect(item).toHaveProperty('total_grams_available');
        expect(item).toHaveProperty('cost_per_gram');
        expect(item).toHaveProperty('reorder_point');
      }
    });

    it('should respect RLS policies for anonymous users', async () => {
      // Anonymous users should be able to read
      const { data, error } = await supabase
        .from('inventory')
        .select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('Sales Table', () => {
    it('should fetch sales with profit columns', async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();

      if (data && data.length > 0) {
        const sale = data[0];
        expect(sale).toHaveProperty('total_amount');
        expect(sale).toHaveProperty('total_cost');
        expect(sale).toHaveProperty('total_profit');
        expect(sale).toHaveProperty('profit_margin');
      }
    });

    it('should calculate profit correctly', async () => {
      const { data } = await supabase
        .from('sales')
        .select('total_amount, total_cost, total_profit, profit_margin')
        .gt('total_amount', 0)
        .limit(10);

      data?.forEach((sale) => {
        const calculatedProfit = sale.total_amount - sale.total_cost;
        expect(Math.abs(sale.total_profit - calculatedProfit)).toBeLessThan(0.01);

        if (sale.total_amount > 0) {
          const calculatedMargin = (sale.total_profit / sale.total_amount) * 100;
          expect(Math.abs(sale.profit_margin - calculatedMargin)).toBeLessThan(0.1);
        }
      });
    });
  });
});
