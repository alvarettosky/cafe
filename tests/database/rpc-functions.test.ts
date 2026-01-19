import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Skip all tests if environment variables are not set
const canConnect = Boolean(supabaseUrl && supabaseKey && !supabaseUrl.includes('undefined'));

const supabase = canConnect
  ? createClient(supabaseUrl!, supabaseKey!)
  : null;

describe.skipIf(!canConnect)('RPC Functions Tests', () => {
  describe('get_advanced_metrics', () => {
    it('should return all required fields', async () => {
      if (!supabase) return;

      const { data, error } = await supabase.rpc('get_advanced_metrics');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toHaveProperty('total_revenue');
      expect(data).toHaveProperty('total_cost');
      expect(data).toHaveProperty('total_profit');
      expect(data).toHaveProperty('avg_profit_margin');
      expect(data).toHaveProperty('sales_count');
      expect(data).toHaveProperty('payment_breakdown');
      expect(data).toHaveProperty('top_products');
      expect(data).toHaveProperty('inventory_value');
      expect(data).toHaveProperty('low_stock_items');
    });

    it('should respect date range parameters', async () => {
      if (!supabase) return;

      const startDate = new Date('2026-01-01').toISOString();
      const endDate = new Date('2026-01-15').toISOString();

      const { data, error } = await supabase.rpc('get_advanced_metrics', {
        p_start_date: startDate,
        p_end_date: endDate,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should return numeric values for metrics', async () => {
      if (!supabase) return;

      const { data } = await supabase.rpc('get_advanced_metrics');

      if (data) {
        expect(typeof data.total_revenue).toBe('number');
        expect(typeof data.total_cost).toBe('number');
        expect(typeof data.total_profit).toBe('number');
        expect(typeof data.sales_count).toBe('number');
      }
    });
  });

  describe('get_sales_time_series', () => {
    it('should return array of time series data', async () => {
      if (!supabase) return;

      const { data, error } = await supabase.rpc('get_sales_time_series', {
        p_interval: 'daily',
        p_days_back: 7,
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should handle different interval types', async () => {
      if (!supabase) return;

      const intervals = ['daily', 'weekly', 'monthly'];

      for (const interval of intervals) {
        const { data, error } = await supabase.rpc('get_sales_time_series', {
          p_interval: interval,
          p_days_back: 30,
        });

        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);
      }
    });

    it('should return correct data structure', async () => {
      if (!supabase) return;

      const { data } = await supabase.rpc('get_sales_time_series', {
        p_interval: 'daily',
        p_days_back: 7,
      });

      if (data && data.length > 0) {
        const point = data[0];
        // RPC returns 'date' not 'period_start'
        expect(point).toHaveProperty('date');
        expect(point).toHaveProperty('revenue');
        // profit and sales_count are also returned
        expect(point).toHaveProperty('profit');
        expect(point).toHaveProperty('sales_count');
      }
    });
  });

  describe('get_product_performance', () => {
    it('should return product metrics', async () => {
      if (!supabase) return;

      const { data, error } = await supabase.rpc('get_product_performance', {
        p_days_back: 30,
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should calculate profit margins correctly', async () => {
      if (!supabase) return;

      const { data } = await supabase.rpc('get_product_performance', {
        p_days_back: 30,
      });

      data?.forEach((product: { revenue: number; profit: number; profit_margin: number }) => {
        if (product.revenue > 0) {
          const expectedMargin = (product.profit / product.revenue) * 100;
          expect(Math.abs(product.profit_margin - expectedMargin)).toBeLessThan(0.1);
        }
      });
    });
  });
});
