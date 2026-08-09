import { describe, it, expect } from 'vitest';
import {
  generateCSV,
  generateXLSX,
  generateSingleTableXLSX,
  getTableColumns,
  getDateColumn,
  TABLES_WITH_DATE_FILTER,
} from '../export';
import type { ExportableTable, TableData } from '../export';

describe('Export Utilities', () => {
  describe('generateCSV', () => {
    it('should generate empty string for empty data', () => {
      const result = generateCSV([]);
      expect(result).toBe('');
    });

    it('should generate CSV with headers and data', () => {
      const data = [
        { id: '1', name: 'Product A', price: 100 },
        { id: '2', name: 'Product B', price: 200 },
      ];

      const result = generateCSV(data);

      expect(result).toContain('id');
      expect(result).toContain('name');
      expect(result).toContain('price');
      expect(result).toContain('Product A');
      expect(result).toContain('Product B');
      expect(result).toContain('100');
      expect(result).toContain('200');
    });

    it('should handle special characters with quotes', () => {
      const data = [{ name: 'Product "Special"', description: 'Has, comma' }];

      const result = generateCSV(data);

      // Papaparse handles escaping
      expect(result).toContain('"');
    });

    it('should handle null values', () => {
      const data = [{ id: '1', name: null }];

      const result = generateCSV(data);

      expect(result).toBeDefined();
    });
  });

  describe('generateXLSX', () => {
    it('should generate valid XLSX buffer', async () => {
      const tables: TableData[] = [
        {
          name: 'test',
          data: [{ id: '1', name: 'Test' }],
          columns: ['id', 'name'],
        },
      ];

      const buffer = await generateXLSX(tables);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle empty data', async () => {
      const tables: TableData[] = [
        {
          name: 'empty',
          data: [],
          columns: ['id', 'name'],
        },
      ];

      const buffer = await generateXLSX(tables);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle multiple tables', async () => {
      const tables: TableData[] = [
        {
          name: 'table1',
          data: [{ id: '1' }],
          columns: ['id'],
        },
        {
          name: 'table2',
          data: [{ id: '2' }],
          columns: ['id'],
        },
      ];

      const buffer = await generateXLSX(tables);

      expect(buffer).toBeInstanceOf(Buffer);
      // Should be larger than single table
      expect(buffer.length).toBeGreaterThan(100);
    });

    it('should handle various data types', async () => {
      const tables: TableData[] = [
        {
          name: 'types',
          data: [
            {
              string: 'text',
              number: 42,
              float: 3.14,
              boolean: true,
              date: '2026-01-23T10:00:00Z',
              null_val: null,
              object: { nested: 'value' },
            },
          ],
          columns: ['string', 'number', 'float', 'boolean', 'date', 'null_val', 'object'],
        },
      ];

      const buffer = await generateXLSX(tables);

      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('generateSingleTableXLSX', () => {
    it('should generate XLSX for single table', async () => {
      const data = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ];

      const buffer = await generateSingleTableXLSX('items', data);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle empty data array', async () => {
      const buffer = await generateSingleTableXLSX('empty', []);

      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('getTableColumns', () => {
    // Estos tres tests fijaban los nombres EQUIVOCADOS —`unit_price`, `total`,
    // `name`—, o sea codificaban el defecto en vez de protegerse de él: pasaban
    // en verde mientras la exportación de clientes salía sin el nombre del
    // cliente. Los nombres de abajo salen de `information_schema.columns`, y
    // `npm run check:rpc` los contrasta contra la base en cada corrida: un test
    // unitario solo puede comprobar que la lista no cambia sin querer, no que
    // sea la correcta.
    it('should return correct columns for inventory', () => {
      const columns = getTableColumns('inventory');

      expect(columns).toContain('product_id');
      expect(columns).toContain('product_name');
      expect(columns).toContain('total_grams_available');
      expect(columns).toContain('price_per_lb');
      expect(columns).toContain('cost_per_gram');
      expect(columns).not.toContain('unit_price');
    });

    it('should return correct columns for sales', () => {
      const columns = getTableColumns('sales');

      expect(columns).toContain('id');
      expect(columns).toContain('customer_id');
      expect(columns).toContain('total_amount');
      expect(columns).toContain('total_profit');
      expect(columns).toContain('payment_method');
      expect(columns).toContain('created_at');
      expect(columns).not.toContain('total');
    });

    it('should return correct columns for customers', () => {
      const columns = getTableColumns('customers');

      expect(columns).toContain('id');
      // El nombre del cliente. Se llama `full_name`, y por llamarlo `name` aquí
      // el CSV de clientes salió sin él durante meses.
      expect(columns).toContain('full_name');
      expect(columns).toContain('phone');
      expect(columns).toContain('typical_recurrence_days');
      expect(columns).not.toContain('name');
    });

    it('should return correct columns for all exportable tables', () => {
      // `products` y `product_variants` salieron con la migración 036: las
      // tablas ya no existen en la base, así que exportarlas devolvía un error
      // de PostgREST, no un archivo.
      const tables: ExportableTable[] = [
        'inventory',
        'sales',
        'sale_items',
        'customers',
        'customer_contacts',
      ];

      tables.forEach(table => {
        const columns = getTableColumns(table);
        expect(columns).toBeInstanceOf(Array);
        expect(columns.length).toBeGreaterThan(0);
        // Each table should have a primary key column (id or product_id)
        const hasPK = columns.includes('id') || columns.includes('product_id');
        expect(hasPK).toBe(true);
      });
    });
  });

  describe('getDateColumn', () => {
    it('should return created_at for sales', () => {
      expect(getDateColumn('sales')).toBe('created_at');
    });

    it('should return created_at for sale_items', () => {
      expect(getDateColumn('sale_items')).toBe('created_at');
    });

    it('should return contact_date for customer_contacts', () => {
      expect(getDateColumn('customer_contacts')).toBe('contact_date');
    });

    it('should return null for non-date-filterable tables', () => {
      expect(getDateColumn('inventory')).toBeNull();
      expect(getDateColumn('customers')).toBeNull();
    });
  });

  describe('TABLES_WITH_DATE_FILTER', () => {
    it('should include sales, sale_items, and customer_contacts', () => {
      expect(TABLES_WITH_DATE_FILTER).toContain('sales');
      expect(TABLES_WITH_DATE_FILTER).toContain('sale_items');
      expect(TABLES_WITH_DATE_FILTER).toContain('customer_contacts');
    });

    it('should not include inventory or customers', () => {
      expect(TABLES_WITH_DATE_FILTER).not.toContain('inventory');
      expect(TABLES_WITH_DATE_FILTER).not.toContain('customers');
    });
  });
});
