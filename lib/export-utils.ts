import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import JSZip from 'jszip';

export interface ExportOptions {
  tables: string[];
  format: 'csv' | 'xlsx';
  dateRange?: {
    start: string;
    end: string;
  };
}

export async function generateCSV(data: Record<string, unknown>[]): Promise<string> {
  return Papa.unparse(data, {
    header: true,
    skipEmptyLines: true,
  });
}

export async function generateXLSX(
  data: Record<string, unknown>[],
  tableName: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(tableName);

  if (data.length === 0) {
    worksheet.addRow(['Sin datos']);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  // Add headers with styling
  const headers = Object.keys(data[0]);
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };

  // Add data rows
  data.forEach(row => {
    const values = headers.map(h => {
      const value = row[h];
      // Handle objects/arrays
      if (value !== null && typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value;
    });
    worksheet.addRow(values);
  });

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, cell => {
      const length = cell.value ? String(cell.value).length : 10;
      maxLength = Math.max(maxLength, length);
    });
    column.width = Math.min(maxLength + 2, 50);
  });

  // Add filters
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function createZipArchive(
  files: { name: string; content: Buffer | string }[]
): Promise<Buffer> {
  const zip = new JSZip();

  files.forEach(file => {
    zip.file(file.name, file.content);
  });

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
