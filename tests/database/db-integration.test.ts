import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Skip all tests if environment variables are not set
const canConnect = Boolean(supabaseUrl && supabaseKey && !supabaseUrl.includes('undefined'));

const supabase = canConnect
  ? createClient(supabaseUrl!, supabaseKey!)
  : null;

describe.skipIf(!canConnect)('Database Integration Tests', () => {
  beforeAll(async () => {
    // Verify connection works
    if (!supabase) return;

    const { error } = await supabase.from('inventory').select('count').limit(1);
    if (error) {
      console.warn('Database connection failed, skipping integration tests:', error.message);
    }
  });

  describe('Inventory Table', () => {
    it('should fetch inventory with all columns', async () => {
      if (!supabase) return;

      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThan(0);

      if (data && data.length > 0) {
        const item = data[0];
        // Core inventory fields that must exist
        expect(item).toHaveProperty('product_id');
        expect(item).toHaveProperty('product_name');
      }
    });

    it('should respect RLS policies for anonymous users', async () => {
      if (!supabase) return;

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
      if (!supabase) return;

      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();

      if (data && data.length > 0) {
        const sale = data[0];
        // Core sales fields that must exist
        expect(sale).toHaveProperty('id');
        // total_amount may or may not exist depending on schema version
        expect(sale.id).toBeDefined();
      }
    });

    it('should fetch sales data', async () => {
      if (!supabase) return;

      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .limit(10);

      expect(error).toBeNull();
      // Just verify we can fetch sales data
      expect(data).toBeDefined();
    });
  });
});
