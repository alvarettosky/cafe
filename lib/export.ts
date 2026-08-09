import ExcelJS from 'exceljs';
import Papa from 'papaparse';

export type ExportFormat = 'csv' | 'xlsx';

export type ExportableTable =
  | 'inventory'
  | 'sales'
  | 'sale_items'
  | 'customers'
  | 'customer_contacts';

export interface ExportOptions {
  tables: ExportableTable[];
  format: ExportFormat;
  dateRange?: {
    start: string;
    end: string;
  };
  includeRelated?: boolean;
}

export interface TableData {
  name: string;
  data: Record<string, unknown>[];
  columns: string[];
}

/**
 * Generate CSV content from data
 */
export function generateCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  return Papa.unparse(data, {
    quotes: true,
    quoteChar: '"',
    escapeChar: '"',
    header: true,
  });
}

/**
 * Generate XLSX workbook from multiple tables
 */
export async function generateXLSX(tables: TableData[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Café Mirador CRM';
  workbook.created = new Date();

  for (const table of tables) {
    const worksheet = workbook.addWorksheet(formatTableName(table.name), {
      headerFooter: {
        firstHeader: `&C${formatTableName(table.name)} - Café Mirador`,
      },
    });

    if (table.data.length === 0) {
      worksheet.addRow(['Sin datos']);
      continue;
    }

    // Add headers with styling
    const headers = table.columns;
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4A5568' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add data rows
    for (const row of table.data) {
      const values = headers.map(h => formatCellValue(row[h]));
      worksheet.addRow(values);
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      let maxLength = 10;
      column.eachCell?.({ includeEmpty: true }, cell => {
        const cellLength = cell.value?.toString().length ?? 0;
        if (cellLength > maxLength) {
          maxLength = Math.min(cellLength, 50);
        }
      });
      column.width = maxLength + 2;
    });

    // Add auto-filter
    if (table.data.length > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: headers.length },
      };
    }

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate single-table XLSX
 */
export async function generateSingleTableXLSX(
  tableName: string,
  data: Record<string, unknown>[]
): Promise<Buffer> {
  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  return generateXLSX([{ name: tableName, data, columns }]);
}

/**
 * Format table name for display
 */
function formatTableName(name: string): string {
  const names: Record<string, string> = {
    inventory: 'Inventario',
    sales: 'Ventas',
    sale_items: 'Items de Venta',
    customers: 'Clientes',
    customer_contacts: 'Contactos',
  };
  return names[name] || name;
}

/**
 * Format cell value for Excel
 */
function formatCellValue(value: unknown): string | number | boolean | Date | null {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  // Check if it's a date string
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date;
  }
  return String(value);
}

/**
 * Get columns for a table with nice ordering
 */
/**
 * ⚠️ Estos nombres deben ser los del esquema REAL, no los que parezcan lógicos.
 *
 * `app/api/export/route.ts` pide `.select('*')` y luego se queda solo con las
 * columnas de esta lista (`if (col in row)`). Una columna mal escrita no da
 * error: **se cae del archivo en silencio**. Hasta el 2026-08-09 esta tabla
 * nombraba `customers.name` (la real es `full_name`), `sales.total`/`profit`
 * (son `total_amount`/`total_profit`), `sale_items.unit_type`/`unit_price`
 * (son `unit`/`price_per_unit`) e `inventory.stock_kg`/`stock_units`/
 * `unit_price`/`min_stock_threshold`, que no existen en ninguna forma.
 *
 * O sea: **la exportación de clientes salía sin el nombre del cliente**, y la
 * de ventas sin los importes. Verificado contra `information_schema.columns`.
 */
export function getTableColumns(tableName: ExportableTable): string[] {
  const columnMap: Record<ExportableTable, string[]> = {
    inventory: [
      'product_id',
      'product_name',
      'total_grams_available',
      'price_per_lb',
      'price_per_half_lb',
      'cost_per_gram',
      'supplier',
      'reorder_point',
      'last_restock_date',
      'notes',
      'last_updated',
    ],
    sales: [
      'id',
      'customer_id',
      'total_amount',
      'total_cost',
      'total_profit',
      'profit_margin',
      'payment_method',
      'customer_recurrence_days',
      'status',
      'notes',
      'created_at',
    ],
    sale_items: [
      'id',
      'sale_id',
      'product_id',
      'unit',
      'quantity',
      'price_per_unit',
      'total_price',
      'cost_per_unit',
      'profit',
    ],
    customers: [
      'id',
      'full_name',
      'phone',
      'email',
      'address',
      'customer_type',
      'typical_recurrence_days',
      'last_purchase_date',
      'delivery_zone_id',
      'delivery_address',
      'delivery_notes',
      'created_at',
      'updated_at',
    ],
    customer_contacts: ['id', 'customer_id', 'contact_date', 'contact_type', 'notes', 'created_at'],
  };
  return columnMap[tableName] || [];
}

/**
 * Tables that support date filtering
 */
export const TABLES_WITH_DATE_FILTER: ExportableTable[] = [
  'sales',
  'sale_items',
  'customer_contacts',
];

/**
 * Get the date column for a table
 */
export function getDateColumn(tableName: ExportableTable): string | null {
  const dateColumns: Partial<Record<ExportableTable, string>> = {
    sales: 'created_at',
    sale_items: 'created_at',
    customer_contacts: 'contact_date',
  };
  return dateColumns[tableName] || null;
}

/**
 * Get the primary key column for a table
 */
export function getPrimaryKeyColumn(tableName: ExportableTable): string {
  const pkColumns: Partial<Record<ExportableTable, string>> = {
    inventory: 'product_id',
  };
  return pkColumns[tableName] || 'id';
}
