# Backup & Export System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement complete automatic backup and manual export system for all database tables.

**Architecture:** GitHub Actions cron → Supabase export → Google Drive storage + Manual export UI with CSV/XLSX formats via Next.js API routes.

**Tech Stack:** GitHub Actions, googleapis, exceljs, papaparse, jszip, Resend, Next.js 14 App Router, TypeScript

---

## Phase 1: Infrastructure & Core Scripts

### Task 1: Install Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Add backup dependencies**

```bash
npm install googleapis@^128.0.0 resend@^3.0.0 exceljs@^4.4.0 papaparse@^5.4.1 jszip@^3.10.1
```

Expected: Dependencies installed successfully

**Step 2: Add type definitions**

```bash
npm install --save-dev @types/papaparse
```

Expected: Type definitions installed

**Step 3: Commit dependency changes**

```bash
git add package.json package-lock.json
git commit -m "deps: add backup system dependencies (googleapis, exceljs, papaparse, jszip, resend)"
```

---

### Task 2: Create Backup Scripts Directory Structure

**Files:**

- Create: `scripts/backup/export-to-json.ts`
- Create: `scripts/backup/export-to-sql.ts`
- Create: `scripts/backup/upload-to-gdrive.ts`
- Create: `scripts/backup/cleanup-old-backups.ts`
- Create: `scripts/backup/send-notification.ts`
- Create: `scripts/backup/types.ts`
- Create: `scripts/backup/index.ts`

**Step 1: Create scripts/backup directory**

```bash
mkdir -p scripts/backup
```

Expected: Directory created

**Step 2: Create types file for shared interfaces**

Create `scripts/backup/types.ts`:

```typescript
export interface BackupMetadata {
  timestamp: string;
  tables: Record<string, { rows: number; size_bytes: number }>;
  duration_seconds: number;
  github_run_id?: string;
  hash_sha256: string;
}

export interface TableExportResult {
  tableName: string;
  rows: number;
  sizeBytes: number;
  success: boolean;
  error?: string;
}

export interface BackupConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  googleDriveFolderId: string;
  notificationEmail: string;
  resendApiKey: string;
}

export const BACKUP_TABLES = [
  'inventory',
  'sales',
  'sale_items',
  'customers',
  'customer_contacts',
  'profiles',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];
```

**Step 3: Commit types**

```bash
git add scripts/backup/types.ts
git commit -m "feat(backup): add TypeScript types for backup system"
```

---

### Task 3: Implement JSON Export Script

**Files:**

- Create: `scripts/backup/export-to-json.ts`

**Step 1: Write export-to-json implementation**

Create `scripts/backup/export-to-json.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { createWriteStream, promises as fs } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import { BACKUP_TABLES, TableExportResult, BackupMetadata } from './types';

export async function exportToJSON(
  supabaseUrl: string,
  serviceKey: string,
  outputDir: string
): Promise<{ results: TableExportResult[]; metadata: BackupMetadata }> {
  const supabase = createClient(supabaseUrl, serviceKey);
  const timestamp = new Date().toISOString();
  const results: TableExportResult[] = [];
  const startTime = Date.now();

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Export each table
  for (const tableName of BACKUP_TABLES) {
    try {
      console.log(`Exporting table: ${tableName}`);

      // Fetch all data with pagination
      let allData: any[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .range(offset, offset + pageSize - 1);

        if (error) throw error;

        allData = allData.concat(data || []);
        hasMore = (data?.length || 0) === pageSize;
        offset += pageSize;
      }

      // Write to compressed JSON file
      const fileName = `${tableName}.json.gz`;
      const filePath = `${outputDir}/${fileName}`;
      const jsonContent = JSON.stringify(allData, null, 2);

      const writeStream = createWriteStream(filePath);
      const gzip = createGzip();

      await pipeline(
        async function* () {
          yield jsonContent;
        },
        gzip,
        writeStream
      );

      const stats = await fs.stat(filePath);

      results.push({
        tableName,
        rows: allData.length,
        sizeBytes: stats.size,
        success: true,
      });

      console.log(`✓ ${tableName}: ${allData.length} rows, ${stats.size} bytes`);
    } catch (error) {
      results.push({
        tableName,
        rows: 0,
        sizeBytes: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`✗ ${tableName}: ${error}`);
    }
  }

  // Calculate hash of all exported files
  const hash = crypto.createHash('sha256');
  for (const result of results) {
    if (result.success) {
      const content = await fs.readFile(`${outputDir}/${result.tableName}.json.gz`);
      hash.update(content);
    }
  }

  const metadata: BackupMetadata = {
    timestamp,
    tables: Object.fromEntries(
      results
        .filter(r => r.success)
        .map(r => [r.tableName, { rows: r.rows, size_bytes: r.sizeBytes }])
    ),
    duration_seconds: Math.floor((Date.now() - startTime) / 1000),
    github_run_id: process.env.GITHUB_RUN_ID,
    hash_sha256: hash.digest('hex'),
  };

  // Write metadata file
  await fs.writeFile(`${outputDir}/metadata.json`, JSON.stringify(metadata, null, 2));

  return { results, metadata };
}

// CLI execution
if (require.main === module) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const output = process.argv[2] || './backups/temp';

  exportToJSON(url, key, output)
    .then(({ results, metadata }) => {
      console.log('\n=== Export Complete ===');
      console.log(`Duration: ${metadata.duration_seconds}s`);
      console.log(`Hash: ${metadata.hash_sha256}`);

      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        console.error(`\n${failed.length} table(s) failed:`);
        failed.forEach(f => console.error(`  - ${f.tableName}: ${f.error}`));
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Export failed:', error);
      process.exit(1);
    });
}
```

**Step 2: Test export script locally**

```bash
# Set env vars
export NEXT_PUBLIC_SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"

# Run export
npx tsx scripts/backup/export-to-json.ts ./backups/test
```

Expected: Creates ./backups/test/ with \*.json.gz files and metadata.json

**Step 3: Verify exported files**

```bash
ls -lh ./backups/test/
zcat ./backups/test/inventory.json.gz | jq '.[0]'
```

Expected: Shows compressed files and can decompress/parse JSON

**Step 4: Clean up test files**

```bash
rm -rf ./backups/test
```

**Step 5: Commit JSON export script**

```bash
git add scripts/backup/export-to-json.ts
git commit -m "feat(backup): implement JSON export with compression and pagination"
```

---

### Task 4: Implement SQL Dump Export

**Files:**

- Create: `scripts/backup/export-to-sql.ts`

**Step 1: Write SQL dump implementation**

Create `scripts/backup/export-to-sql.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { createWriteStream } from 'fs';
import { createGzip } from 'zlib';
import { BACKUP_TABLES } from './types';

export async function exportToSQL(
  supabaseUrl: string,
  serviceKey: string,
  outputPath: string
): Promise<{ sizeBytes: number; rowCount: number }> {
  const supabase = createClient(supabaseUrl, serviceKey);
  const gzip = createGzip();
  const writeStream = createWriteStream(outputPath);

  gzip.pipe(writeStream);

  let totalRows = 0;

  // Write SQL header
  gzip.write('-- Cafe Mirador Backup\n');
  gzip.write(`-- Generated: ${new Date().toISOString()}\n`);
  gzip.write('-- Database: Supabase PostgreSQL\n\n');
  gzip.write('BEGIN;\n\n');

  for (const tableName of BACKUP_TABLES) {
    try {
      console.log(`Exporting table to SQL: ${tableName}`);

      // Fetch all data
      let allData: any[] = [];
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .range(offset, offset + pageSize - 1);

        if (error) throw error;

        allData = allData.concat(data || []);
        hasMore = (data?.length || 0) === pageSize;
        offset += pageSize;
      }

      if (allData.length === 0) {
        gzip.write(`-- Table ${tableName} is empty\n\n`);
        continue;
      }

      // Write DELETE statement
      gzip.write(`-- Table: ${tableName} (${allData.length} rows)\n`);
      gzip.write(`DELETE FROM ${tableName};\n`);

      // Write INSERT statements
      const columns = Object.keys(allData[0]);
      gzip.write(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES\n`);

      allData.forEach((row, index) => {
        const values = columns.map(col => {
          const value = row[col];
          if (value === null) return 'NULL';
          if (typeof value === 'string') {
            return `'${value.replace(/'/g, "''")}'`;
          }
          if (value instanceof Date) {
            return `'${value.toISOString()}'`;
          }
          if (typeof value === 'object') {
            return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
          }
          return String(value);
        });

        const isLast = index === allData.length - 1;
        gzip.write(`  (${values.join(', ')})${isLast ? ';\n\n' : ',\n'}`);
      });

      totalRows += allData.length;
      console.log(`✓ ${tableName}: ${allData.length} rows`);
    } catch (error) {
      console.error(`✗ Error exporting ${tableName}:`, error);
      gzip.write(`-- ERROR: Failed to export ${tableName}\n\n`);
    }
  }

  gzip.write('COMMIT;\n');
  gzip.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      const stats = require('fs').statSync(outputPath);
      resolve({ sizeBytes: stats.size, rowCount: totalRows });
    });
    writeStream.on('error', reject);
  });
}

// CLI execution
if (require.main === module) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const output = process.argv[2] || './backups/backup.sql.gz';

  exportToSQL(url, key, output)
    .then(({ sizeBytes, rowCount }) => {
      console.log(`\n✓ SQL dump complete: ${rowCount} rows, ${sizeBytes} bytes`);
    })
    .catch(error => {
      console.error('SQL export failed:', error);
      process.exit(1);
    });
}
```

**Step 2: Commit SQL export**

```bash
git add scripts/backup/export-to-sql.ts
git commit -m "feat(backup): implement SQL dump export with compression"
```

---

### Task 5: Implement Google Drive Upload

**Files:**

- Create: `scripts/backup/upload-to-gdrive.ts`

**Step 1: Write Google Drive upload implementation**

Create `scripts/backup/upload-to-gdrive.ts`:

```typescript
import { google } from 'googleapis';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';

interface UploadResult {
  fileId: string;
  fileName: string;
  size: number;
  webViewLink: string;
}

export async function uploadToGoogleDrive(
  credentialsJson: string,
  folderId: string,
  localPath: string,
  remoteName?: string
): Promise<UploadResult> {
  // Parse credentials
  const credentials = JSON.parse(credentialsJson);

  // Authenticate with service account
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  const drive = google.drive({ version: 'v3', auth });

  // Get file stats
  const stats = await fs.stat(localPath);
  const fileName = remoteName || path.basename(localPath);

  console.log(`Uploading ${fileName} (${stats.size} bytes) to Google Drive...`);

  // Upload file
  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      body: createReadStream(localPath),
    },
    fields: 'id,name,size,webViewLink',
  });

  console.log(`✓ Uploaded: ${response.data.name} (ID: ${response.data.id})`);

  return {
    fileId: response.data.id!,
    fileName: response.data.name!,
    size: parseInt(response.data.size || '0'),
    webViewLink: response.data.webViewLink!,
  };
}

export async function uploadDirectory(
  credentialsJson: string,
  folderId: string,
  localDir: string
): Promise<UploadResult[]> {
  const files = await fs.readdir(localDir);
  const results: UploadResult[] = [];

  for (const file of files) {
    const localPath = path.join(localDir, file);
    const stat = await fs.stat(localPath);

    if (stat.isFile()) {
      const result = await uploadToGoogleDrive(credentialsJson, folderId, localPath);
      results.push(result);
    }
  }

  return results;
}

// CLI execution
if (require.main === module) {
  const credentials = process.env.GOOGLE_DRIVE_CREDENTIALS!;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;
  const localPath = process.argv[2];

  if (!localPath) {
    console.error('Usage: npx tsx upload-to-gdrive.ts <file-or-directory>');
    process.exit(1);
  }

  fs.stat(localPath)
    .then(async stats => {
      if (stats.isDirectory()) {
        const results = await uploadDirectory(credentials, folderId, localPath);
        console.log(`\n✓ Uploaded ${results.length} file(s)`);
        results.forEach(r => console.log(`  - ${r.fileName}: ${r.size} bytes`));
      } else {
        await uploadToGoogleDrive(credentials, folderId, localPath);
      }
    })
    .catch(error => {
      console.error('Upload failed:', error);
      process.exit(1);
    });
}
```

**Step 2: Commit Google Drive upload**

```bash
git add scripts/backup/upload-to-gdrive.ts
git commit -m "feat(backup): implement Google Drive upload with service account auth"
```

---

### Task 6: Implement Cleanup & Retention Policy

**Files:**

- Create: `scripts/backup/cleanup-old-backups.ts`

**Step 1: Write cleanup implementation**

Create `scripts/backup/cleanup-old-backups.ts`:

```typescript
import { google } from 'googleapis';

interface CleanupStats {
  dailyDeleted: number;
  weeklyDeleted: number;
  monthlyDeleted: number;
}

export async function cleanupOldBackups(
  credentialsJson: string,
  dailyFolderId: string,
  weeklyFolderId: string,
  monthlyFolderId: string
): Promise<CleanupStats> {
  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  const now = new Date();
  const stats: CleanupStats = {
    dailyDeleted: 0,
    weeklyDeleted: 0,
    monthlyDeleted: 0,
  };

  // Cleanup daily backups (keep last 7 days)
  console.log('Cleaning daily backups...');
  const dailyFiles = await drive.files.list({
    q: `'${dailyFolderId}' in parents and trashed=false`,
    fields: 'files(id,name,createdTime)',
  });

  for (const file of dailyFiles.data.files || []) {
    const createdDate = new Date(file.createdTime!);
    const ageInDays = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays > 7) {
      // Move Sunday backups to weekly folder
      if (createdDate.getDay() === 0 && ageInDays <= 30) {
        console.log(`Moving ${file.name} to weekly folder`);
        await drive.files.update({
          fileId: file.id!,
          addParents: weeklyFolderId,
          removeParents: dailyFolderId,
          fields: 'id',
        });
      } else {
        console.log(`Deleting old daily backup: ${file.name} (${ageInDays.toFixed(0)} days old)`);
        await drive.files.delete({ fileId: file.id! });
        stats.dailyDeleted++;
      }
    }
  }

  // Cleanup weekly backups (keep last 4 weeks)
  console.log('Cleaning weekly backups...');
  const weeklyFiles = await drive.files.list({
    q: `'${weeklyFolderId}' in parents and trashed=false`,
    fields: 'files(id,name,createdTime)',
  });

  for (const file of weeklyFiles.data.files || []) {
    const createdDate = new Date(file.createdTime!);
    const ageInDays = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays > 30) {
      // Move last Sunday of month to monthly folder
      const isLastSundayOfMonth =
        createdDate.getDay() === 0 &&
        new Date(createdDate.getFullYear(), createdDate.getMonth() + 1, 0).getDate() -
          createdDate.getDate() <
          7;

      if (isLastSundayOfMonth && ageInDays <= 365) {
        console.log(`Moving ${file.name} to monthly folder`);
        await drive.files.update({
          fileId: file.id!,
          addParents: monthlyFolderId,
          removeParents: weeklyFolderId,
          fields: 'id',
        });
      } else {
        console.log(`Deleting old weekly backup: ${file.name}`);
        await drive.files.delete({ fileId: file.id! });
        stats.weeklyDeleted++;
      }
    }
  }

  // Cleanup monthly backups (keep last 12 months)
  console.log('Cleaning monthly backups...');
  const monthlyFiles = await drive.files.list({
    q: `'${monthlyFolderId}' in parents and trashed=false`,
    fields: 'files(id,name,createdTime)',
  });

  for (const file of monthlyFiles.data.files || []) {
    const createdDate = new Date(file.createdTime!);
    const ageInDays = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

    if (ageInDays > 365) {
      console.log(`Deleting old monthly backup: ${file.name}`);
      await drive.files.delete({ fileId: file.id! });
      stats.monthlyDeleted++;
    }
  }

  return stats;
}

// CLI execution
if (require.main === module) {
  const credentials = process.env.GOOGLE_DRIVE_CREDENTIALS!;
  const dailyId = process.env.GOOGLE_DRIVE_DAILY_FOLDER_ID!;
  const weeklyId = process.env.GOOGLE_DRIVE_WEEKLY_FOLDER_ID!;
  const monthlyId = process.env.GOOGLE_DRIVE_MONTHLY_FOLDER_ID!;

  cleanupOldBackups(credentials, dailyId, weeklyId, monthlyId)
    .then(stats => {
      console.log('\n=== Cleanup Complete ===');
      console.log(`Daily deleted: ${stats.dailyDeleted}`);
      console.log(`Weekly deleted: ${stats.weeklyDeleted}`);
      console.log(`Monthly deleted: ${stats.monthlyDeleted}`);
    })
    .catch(error => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}
```

**Step 2: Commit cleanup script**

```bash
git add scripts/backup/cleanup-old-backups.ts
git commit -m "feat(backup): implement retention policy with 7/30/365 day rotation"
```

---

### Task 7: Implement Email Notifications

**Files:**

- Create: `scripts/backup/send-notification.ts`

**Step 1: Write email notification implementation**

Create `scripts/backup/send-notification.ts`:

```typescript
import { Resend } from 'resend';
import { BackupMetadata, TableExportResult } from './types';

interface NotificationData {
  success: boolean;
  metadata?: BackupMetadata;
  results?: TableExportResult[];
  error?: string;
  driveLink?: string;
}

export async function sendBackupNotification(
  resendApiKey: string,
  recipientEmail: string,
  data: NotificationData
): Promise<void> {
  const resend = new Resend(resendApiKey);

  if (data.success && data.metadata && data.results) {
    // Success email
    const totalRows = Object.values(data.metadata.tables).reduce((sum, t) => sum + t.rows, 0);
    const totalSize = Object.values(data.metadata.tables).reduce((sum, t) => sum + t.size_bytes, 0);

    const tablesList = Object.entries(data.metadata.tables)
      .map(
        ([name, info]) =>
          `  • ${name}: ${info.rows} registros (${(info.size_bytes / 1024).toFixed(1)} KB)`
      )
      .join('\n');

    const html = `
      <h2>✅ Backup Diario Exitoso - Café Mirador</h2>
      <p><strong>Fecha/Hora:</strong> ${new Date(data.metadata.timestamp).toLocaleString('es-CO')}</p>
      <p><strong>Duración:</strong> ${data.metadata.duration_seconds} segundos</p>
      <p><strong>Total de registros:</strong> ${totalRows}</p>
      <p><strong>Tamaño total:</strong> ${(totalSize / 1024 / 1024).toFixed(2)} MB</p>

      <h3>Tablas incluidas:</h3>
      <pre>${tablesList}</pre>

      <p><strong>Hash SHA-256:</strong> <code>${data.metadata.hash_sha256}</code></p>

      ${data.driveLink ? `<p><a href="${data.driveLink}">Ver en Google Drive</a></p>` : ''}

      <hr>
      <p><small>GitHub Run ID: ${data.metadata.github_run_id || 'N/A'}</small></p>
    `;

    await resend.emails.send({
      from: 'Backup System <noreply@cafemirador.app>',
      to: recipientEmail,
      subject: '✅ Backup Diario Exitoso - Café Mirador',
      html,
    });

    console.log('✓ Success notification sent');
  } else {
    // Error email
    const failedTables =
      data.results
        ?.filter(r => !r.success)
        .map(r => `  • ${r.tableName}: ${r.error}`)
        .join('\n') || 'Unknown error';

    const html = `
      <h2>⚠️ Error en Backup Automático - Café Mirador</h2>
      <p><strong>Fecha/Hora:</strong> ${new Date().toLocaleString('es-CO')}</p>

      <h3>Tablas que fallaron:</h3>
      <pre>${failedTables}</pre>

      ${data.error ? `<p><strong>Error general:</strong></p><pre>${data.error}</pre>` : ''}

      <h3>Acción recomendada:</h3>
      <p>Revisar los logs de GitHub Actions y verificar:</p>
      <ul>
        <li>Conexión a Supabase</li>
        <li>Credenciales de Google Drive</li>
        <li>Permisos de la service account</li>
      </ul>
    `;

    await resend.emails.send({
      from: 'Backup System <noreply@cafemirador.app>',
      to: recipientEmail,
      subject: '⚠️ Error en Backup Automático - Café Mirador',
      html,
    });

    console.log('✓ Error notification sent');
  }
}

// CLI execution
if (require.main === module) {
  const apiKey = process.env.RESEND_API_KEY!;
  const email = process.env.NOTIFICATION_EMAIL!;
  const success = process.argv[2] === 'success';

  const mockData: NotificationData = success
    ? {
        success: true,
        metadata: {
          timestamp: new Date().toISOString(),
          tables: {
            inventory: { rows: 15, size_bytes: 2048 },
            sales: { rows: 1234, size_bytes: 45000 },
          },
          duration_seconds: 8,
          hash_sha256: 'abc123...',
        },
        results: [],
        driveLink: 'https://drive.google.com/...',
      }
    : {
        success: false,
        error: 'Connection timeout',
        results: [{ tableName: 'sales', rows: 0, sizeBytes: 0, success: false, error: 'Timeout' }],
      };

  sendBackupNotification(apiKey, email, mockData)
    .then(() => console.log('Notification sent'))
    .catch(error => {
      console.error('Failed to send notification:', error);
      process.exit(1);
    });
}
```

**Step 2: Commit notification script**

```bash
git add scripts/backup/send-notification.ts
git commit -m "feat(backup): implement email notifications with Resend"
```

---

### Task 8: Create Main Backup Orchestrator

**Files:**

- Create: `scripts/backup/index.ts`

**Step 1: Write main orchestrator**

Create `scripts/backup/index.ts`:

```typescript
#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { exportToJSON } from './export-to-json';
import { exportToSQL } from './export-to-sql';
import { uploadDirectory, uploadToGoogleDrive } from './upload-to-gdrive';
import { cleanupOldBackups } from './cleanup-old-backups';
import { sendBackupNotification } from './send-notification';

async function main() {
  const timestamp = new Date().toISOString().split('T')[0];
  const isFirstDayOfMonth = new Date().getDate() === 1;
  const tempDir = `./backups/temp-${Date.now()}`;

  try {
    console.log('=== Starting Backup Process ===');
    console.log(`Date: ${timestamp}`);
    console.log(`First day of month: ${isFirstDayOfMonth}\n`);

    // 1. Export to JSON
    console.log('Step 1: Exporting to JSON...');
    const { results, metadata } = await exportToJSON(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      tempDir
    );

    // 2. Export to SQL (monthly only)
    let sqlPath: string | undefined;
    if (isFirstDayOfMonth) {
      console.log('\nStep 2: Generating SQL dump (monthly)...');
      sqlPath = `${tempDir}/monthly-${timestamp}.sql.gz`;
      await exportToSQL(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        sqlPath
      );
    }

    // 3. Upload to Google Drive
    console.log('\nStep 3: Uploading to Google Drive...');
    const folderId = isFirstDayOfMonth
      ? process.env.GOOGLE_DRIVE_MONTHLY_FOLDER_ID!
      : process.env.GOOGLE_DRIVE_DAILY_FOLDER_ID!;

    const uploadResults = await uploadDirectory(
      process.env.GOOGLE_DRIVE_CREDENTIALS!,
      folderId,
      tempDir
    );

    const driveLink = uploadResults[0]?.webViewLink;

    // 4. Cleanup old backups
    console.log('\nStep 4: Cleaning up old backups...');
    const cleanupStats = await cleanupOldBackups(
      process.env.GOOGLE_DRIVE_CREDENTIALS!,
      process.env.GOOGLE_DRIVE_DAILY_FOLDER_ID!,
      process.env.GOOGLE_DRIVE_WEEKLY_FOLDER_ID!,
      process.env.GOOGLE_DRIVE_MONTHLY_FOLDER_ID!
    );

    console.log(
      `Deleted: ${cleanupStats.dailyDeleted} daily, ${cleanupStats.weeklyDeleted} weekly, ${cleanupStats.monthlyDeleted} monthly`
    );

    // 5. Send success notification
    console.log('\nStep 5: Sending notification...');
    await sendBackupNotification(process.env.RESEND_API_KEY!, process.env.NOTIFICATION_EMAIL!, {
      success: true,
      metadata,
      results,
      driveLink,
    });

    // 6. Cleanup temp directory
    await fs.rm(tempDir, { recursive: true });

    console.log('\n=== Backup Complete ===');
    process.exit(0);
  } catch (error) {
    console.error('\n=== Backup Failed ===');
    console.error(error);

    // Send error notification
    try {
      await sendBackupNotification(process.env.RESEND_API_KEY!, process.env.NOTIFICATION_EMAIL!, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } catch (notifError) {
      console.error('Failed to send error notification:', notifError);
    }

    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {}

    process.exit(1);
  }
}

main();
```

**Step 2: Add npm script**

Add to `package.json`:

```json
{
  "scripts": {
    "backup:execute": "tsx scripts/backup/index.ts"
  }
}
```

**Step 3: Commit orchestrator**

```bash
git add scripts/backup/index.ts package.json
git commit -m "feat(backup): add main orchestrator script"
```

---

## Phase 2: GitHub Actions Automation

### Task 9: Create GitHub Actions Workflow

**Files:**

- Create: `.github/workflows/daily-backup.yml`

**Step 1: Write workflow file**

Create `.github/workflows/daily-backup.yml`:

```yaml
name: Daily Database Backup

on:
  schedule:
    # Run at 2:00 AM UTC every day
    - cron: '0 2 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run backup with retries
        uses: nick-invision/retry@v2
        with:
          timeout_minutes: 10
          max_attempts: 3
          retry_wait_seconds: 30
          command: npm run backup:execute
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          GOOGLE_DRIVE_CREDENTIALS: ${{ secrets.GOOGLE_DRIVE_CREDENTIALS }}
          GOOGLE_DRIVE_DAILY_FOLDER_ID: ${{ secrets.GOOGLE_DRIVE_DAILY_FOLDER_ID }}
          GOOGLE_DRIVE_WEEKLY_FOLDER_ID: ${{ secrets.GOOGLE_DRIVE_WEEKLY_FOLDER_ID }}
          GOOGLE_DRIVE_MONTHLY_FOLDER_ID: ${{ secrets.GOOGLE_DRIVE_MONTHLY_FOLDER_ID }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          NOTIFICATION_EMAIL: ${{ secrets.NOTIFICATION_EMAIL }}
          GITHUB_RUN_ID: ${{ github.run_id }}

      - name: Upload logs on failure
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: backup-logs
          path: |
            backups/
            *.log
          retention-days: 30
```

**Step 2: Commit workflow**

```bash
git add .github/workflows/daily-backup.yml
git commit -m "ci: add daily backup GitHub Actions workflow with retry logic"
```

---

### Task 10: Create Setup Documentation

**Files:**

- Create: `docs/BACKUP_SETUP_GUIDE.md`

**Step 1: Write setup guide**

Create `docs/BACKUP_SETUP_GUIDE.md`:

```markdown
# Backup System Setup Guide

## Prerequisites

1. Supabase project with service role key
2. Google Cloud Platform account
3. Resend account (free tier)
4. GitHub repository

## Step 1: Google Cloud Setup

### Create Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click "Create Project"
3. Name: "Cafe-Mirador-Backups"
4. Click "Create"

### Enable Google Drive API

1. In the project, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click "Enable"

### Create Service Account

1. Go to "IAM & Admin" → "Service Accounts"
2. Click "Create Service Account"
3. Name: "backup-automation"
4. Click "Create and Continue"
5. Skip role assignment (click "Continue")
6. Click "Done"
7. Click on the service account email
8. Go to "Keys" tab
9. Click "Add Key" → "Create new key"
10. Choose JSON format
11. Save the file securely (you'll need it for GitHub Secrets)

## Step 2: Google Drive Setup

### Create Backup Folder Structure

1. Open [Google Drive](https://drive.google.com)
2. Create folder: "Cafe-Mirador-Backups"
3. Inside it, create 3 subfolders:
   - `daily`
   - `weekly`
   - `monthly`

### Share with Service Account

1. Right-click "Cafe-Mirador-Backups" folder
2. Click "Share"
3. Paste the service account email (from Step 1.7)
4. Set permission: "Editor"
5. Uncheck "Notify people"
6. Click "Share"

### Get Folder IDs

For each folder (Cafe-Mirador-Backups/daily, weekly, monthly):

1. Open the folder
2. Copy the ID from the URL:
```

https://drive.google.com/drive/folders/FOLDER_ID_HERE
^^^^^^^^^^^^^^^^

```
3. Save each ID:
- Daily folder ID
- Weekly folder ID
- Monthly folder ID

## Step 3: Resend Setup

1. Go to [resend.com](https://resend.com)
2. Sign up (free tier: 100 emails/day)
3. Create API key
4. Save the key securely

## Step 4: GitHub Secrets

Add these secrets to your GitHub repository:

Settings → Secrets and variables → Actions → New repository secret

1. **NEXT_PUBLIC_SUPABASE_URL**
- Value: Your Supabase project URL
- Example: `https://abcdefgh.supabase.co`

2. **SUPABASE_SERVICE_ROLE_KEY**
- Value: Service role key from Supabase Dashboard → Settings → API
- ⚠️ Keep this secret! It bypasses Row Level Security

3. **GOOGLE_DRIVE_CREDENTIALS**
- Value: Entire contents of the JSON file from Step 1.9
- Copy-paste the whole JSON object

4. **GOOGLE_DRIVE_DAILY_FOLDER_ID**
- Value: Folder ID for `daily` folder

5. **GOOGLE_DRIVE_WEEKLY_FOLDER_ID**
- Value: Folder ID for `weekly` folder

6. **GOOGLE_DRIVE_MONTHLY_FOLDER_ID**
- Value: Folder ID for `monthly` folder

7. **RESEND_API_KEY**
- Value: API key from Resend

8. **NOTIFICATION_EMAIL**
- Value: Your email address to receive notifications
- Example: `admin@cafemirador.com`

## Step 5: Test Backup Manually

1. Go to GitHub repository
2. Actions tab
3. Click "Daily Database Backup"
4. Click "Run workflow"
5. Wait for completion (should take 1-2 minutes)
6. Check:
- ✅ Workflow succeeded
- ✅ Files appear in Google Drive daily folder
- ✅ Email notification received

## Troubleshooting

### "Permission denied" error

- Verify service account has Editor access to all folders
- Re-share folders with service account email

### "Invalid credentials" error

- Check `GOOGLE_DRIVE_CREDENTIALS` secret is valid JSON
- Ensure no extra spaces or line breaks

### No email received

- Check spam folder
- Verify `NOTIFICATION_EMAIL` is correct
- Check Resend dashboard for delivery logs

### Workflow timeout

- Increase timeout in workflow file
- Check Supabase connection speed
- Verify database size isn't too large

## Maintenance

### Monitoring

- Check email notifications daily
- Review GitHub Actions logs weekly
- Monitor Google Drive storage usage monthly

### Rotating Credentials

Every 90 days:

1. Generate new Supabase service role key
2. Update `SUPABASE_SERVICE_ROLE_KEY` secret
3. Revoke old key in Supabase dashboard

### Backup Retention

Current policy:
- Daily: Keep 7 days
- Weekly: Keep 4 weeks
- Monthly: Keep 12 months

Adjust in `scripts/backup/cleanup-old-backups.ts` if needed.
```

**Step 2: Commit setup guide**

```bash
git add docs/BACKUP_SETUP_GUIDE.md
git commit -m "docs: add comprehensive backup system setup guide"
```

---

## Phase 3: Manual Export UI

### Task 11: Create Backup Audit Log Table

**Files:**

- Create: `supabase/migrations/020_backup_audit_log.sql`

**Step 1: Write migration**

Create `supabase/migrations/020_backup_audit_log.sql`:

```sql
-- Create backup audit log table
CREATE TABLE IF NOT EXISTS backup_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('manual_export', 'auto_backup', 'restore', 'download')),
  tables TEXT[],
  format TEXT CHECK (format IN ('csv', 'xlsx', 'json', 'sql')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  file_size_bytes INTEGER,
  row_count INTEGER
);

-- Add index for querying by user and timestamp
CREATE INDEX idx_backup_audit_user_timestamp ON backup_audit_log(user_id, timestamp DESC);

-- RLS policies
ALTER TABLE backup_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can see all logs
CREATE POLICY "Admins can view all backup logs"
  ON backup_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Anyone can insert (system logs)
CREATE POLICY "Allow inserting backup logs"
  ON backup_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Comment
COMMENT ON TABLE backup_audit_log IS 'Audit trail for all backup and export operations';
```

**Step 2: Apply migration locally (test)**

```bash
# This would be applied in Supabase dashboard in production
# For now, just verify SQL syntax
cat supabase/migrations/020_backup_audit_log.sql | grep -i "CREATE TABLE"
```

Expected: Shows CREATE TABLE statement

**Step 3: Commit migration**

```bash
git add supabase/migrations/020_backup_audit_log.sql
git commit -m "feat(db): add backup_audit_log table for auditing"
```

---

### Task 12: Create Export API Route

**Files:**

- Create: `app/api/export/route.ts`
- Create: `lib/export-utils.ts`

**Step 1: Write export utilities**

Create `lib/export-utils.ts`:

```typescript
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

export async function generateCSV(data: any[], tableName: string): Promise<string> {
  return Papa.unparse(data, {
    header: true,
    skipEmptyLines: true,
  });
}

export async function generateXLSX(data: any[], tableName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(tableName);

  if (data.length === 0) {
    worksheet.addRow(['No data']);
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
    worksheet.addRow(Object.values(row));
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
```

**Step 2: Write API route**

Create `app/api/export/route.ts`:

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { generateCSV, generateXLSX, createZipArchive } from '@/lib/export-utils';

const ALLOWED_TABLES = [
  'inventory',
  'sales',
  'sale_items',
  'customers',
  'customer_contacts',
  'profiles',
] as const;

const MAX_ROWS = 10000;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { tables, format, dateRange } = body;

    // Validate tables
    if (!Array.isArray(tables) || tables.length === 0) {
      return NextResponse.json({ error: 'Invalid tables parameter' }, { status: 400 });
    }

    for (const table of tables) {
      if (!ALLOWED_TABLES.includes(table as any)) {
        return NextResponse.json({ error: `Invalid table: ${table}` }, { status: 400 });
      }
    }

    // Validate format
    if (format !== 'csv' && format !== 'xlsx') {
      return NextResponse.json({ error: 'Invalid format. Use "csv" or "xlsx"' }, { status: 400 });
    }

    // Export each table
    const files: { name: string; content: Buffer | string }[] = [];
    let totalRows = 0;
    let totalSize = 0;

    for (const tableName of tables) {
      let query = supabase.from(tableName).select('*');

      // Apply date range filter if provided
      if (dateRange?.start && dateRange?.end) {
        // Determine date column based on table
        const dateColumn =
          tableName === 'sales'
            ? 'created_at'
            : tableName === 'customers'
              ? 'last_purchase_date'
              : 'created_at';

        query = query.gte(dateColumn, dateRange.start).lte(dateColumn, dateRange.end);
      }

      // Limit rows
      query = query.limit(MAX_ROWS);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch ${tableName}: ${error.message}`);
      }

      if (!data || data.length === 0) {
        continue; // Skip empty tables
      }

      totalRows += data.length;

      // Generate file
      let content: Buffer | string;
      let fileName: string;

      if (format === 'csv') {
        content = await generateCSV(data, tableName);
        fileName = `${tableName}.csv`;
        totalSize += Buffer.byteLength(content);
      } else {
        content = await generateXLSX(data, tableName);
        fileName = `${tableName}.xlsx`;
        totalSize += content.length;
      }

      files.push({ name: fileName, content });
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No data to export' }, { status: 404 });
    }

    // Log to audit table
    await supabase.from('backup_audit_log').insert({
      user_id: user.id,
      action: 'manual_export',
      tables,
      format,
      success: true,
      file_size_bytes: totalSize,
      row_count: totalRows,
    });

    // Return single file or zip
    if (files.length === 1) {
      const file = files[0];
      const headers = new Headers();
      headers.set(
        'Content-Type',
        format === 'csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      headers.set('Content-Disposition', `attachment; filename="${file.name}"`);

      return new NextResponse(file.content, { headers });
    } else {
      // Multiple tables - create zip
      const zipBuffer = await createZipArchive(files);
      const timestamp = new Date().toISOString().split('T')[0];
      const zipName = `cafe-mirador-export-${timestamp}.zip`;

      const headers = new Headers();
      headers.set('Content-Type', 'application/zip');
      headers.set('Content-Disposition', `attachment; filename="${zipName}"`);

      return new NextResponse(zipBuffer, { headers });
    }
  } catch (error) {
    console.error('Export error:', error);

    // Log failure to audit table (best effort)
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.from('backup_audit_log').insert({
          user_id: user.id,
          action: 'manual_export',
          success: false,
          error_message: error instanceof Error ? error.message : String(error),
        });
      }
    } catch {}

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}
```

**Step 3: Commit export functionality**

```bash
git add lib/export-utils.ts app/api/export/route.ts
git commit -m "feat(api): implement /api/export route with CSV/XLSX support"
```

---

### Task 13: Create Reusable Download Button Component

**Files:**

- Create: `components/backups/DownloadButton.tsx`
- Create: `components/backups/index.ts`

**Step 1: Write DownloadButton component**

Create `components/backups/DownloadButton.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

interface DownloadButtonProps {
  tableName: string | string[];
  dateRange?: {
    start: string;
    end: string;
  };
  format?: 'csv' | 'xlsx';
  label?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export function DownloadButton({
  tableName,
  dateRange,
  format = 'xlsx',
  label,
  variant = 'outline',
  size = 'md',
}: DownloadButtonProps) {
  const { role } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Only show to admins
  if (role !== 'admin') {
    return null;
  }

  const handleDownload = async () => {
    setIsLoading(true);

    try {
      const tables = Array.isArray(tableName) ? tableName : [tableName];

      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tables,
          format,
          dateRange,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Export failed');
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `export-${Date.now()}.${format}`;

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert(error instanceof Error ? error.message : 'Failed to download export');
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  const variantClasses = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50',
    ghost: 'text-gray-700 hover:bg-gray-100',
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isLoading}
      className={`
        inline-flex items-center gap-2 rounded-md font-medium
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
      `}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      <span>{isLoading ? 'Exportando...' : label || 'Exportar'}</span>
    </button>
  );
}
```

**Step 2: Create index file**

Create `components/backups/index.ts`:

```typescript
export { DownloadButton } from './DownloadButton';
```

**Step 3: Write test for DownloadButton**

Create `components/backups/__tests__/DownloadButton.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DownloadButton } from '../DownloadButton';

// Mock auth provider
vi.mock('@/components/auth-provider', () => ({
  useAuth: () => ({ role: 'admin', user: { id: '1' } }),
}));

// Mock fetch
global.fetch = vi.fn();

describe('DownloadButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders button with label', () => {
    render(<DownloadButton tableName="inventory" label="Export Inventory" />);
    expect(screen.getByText('Export Inventory')).toBeInTheDocument();
  });

  it('shows loading state when downloading', async () => {
    (global.fetch as any).mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob(['test'])),
        headers: new Headers({ 'Content-Disposition': 'attachment; filename="test.xlsx"' }),
      }), 100))
    );

    render(<DownloadButton tableName="sales" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Exportando...')).toBeInTheDocument();
    });
  });

  it('calls API with correct parameters', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['test'])),
      headers: new Headers(),
    });
    global.fetch = mockFetch;

    render(
      <DownloadButton
        tableName={['inventory', 'sales']}
        format="csv"
        dateRange={{ start: '2026-01-01', end: '2026-01-31' }}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tables: ['inventory', 'sales'],
          format: 'csv',
          dateRange: { start: '2026-01-01', end: '2026-01-31' },
        }),
      });
    });
  });

  it('does not render for non-admin users', () => {
    vi.mocked(require('@/components/auth-provider').useAuth).mockReturnValue({
      role: 'seller',
      user: { id: '2' },
    });

    const { container } = render(<DownloadButton tableName="inventory" />);
    expect(container.firstChild).toBeNull();
  });
});
```

**Step 4: Run test**

```bash
npm test -- components/backups/__tests__/DownloadButton.test.tsx
```

Expected: All tests pass

**Step 5: Commit DownloadButton**

```bash
git add components/backups/
git commit -m "feat(ui): add reusable DownloadButton component with tests"
```

---

### Task 14: Add Export Buttons to Existing Pages

**Files:**

- Modify: `app/page.tsx` (Dashboard)
- Modify: `app/analytics/page.tsx`
- Modify: `app/clientes/page.tsx`

**Step 1: Add to Dashboard**

In `app/page.tsx`, add import and button:

```typescript
import { DownloadButton } from '@/components/backups';

// Inside the component, add button near inventory section:
<div className="flex items-center justify-between mb-4">
  <h2 className="text-2xl font-bold">Inventario</h2>
  <DownloadButton
    tableName="inventory"
    label="Exportar Inventario"
    size="sm"
  />
</div>
```

**Step 2: Add to Analytics**

In `app/analytics/page.tsx`, find the date range selector and add:

```typescript
import { DownloadButton } from '@/components/backups';

// Near the date selector:
<div className="flex gap-2">
  <DateRangeSelector /* existing props */ />
  <DownloadButton
    tableName={['sales', 'sale_items']}
    dateRange={{ start: startDate, end: endDate }}
    label="Exportar Datos"
    size="sm"
  />
</div>
```

**Step 3: Add to Clientes**

In `app/clientes/page.tsx`, add export button:

```typescript
import { DownloadButton } from '@/components/backups';

// In header section:
<div className="flex items-center justify-between mb-6">
  <h1 className="text-3xl font-bold">Clientes</h1>
  <div className="flex gap-2">
    <DownloadButton
      tableName={['customers', 'customer_contacts']}
      label="Exportar Clientes"
      size="sm"
    />
    {/* Existing "Nuevo Cliente" button */}
  </div>
</div>
```

**Step 4: Test in browser**

```bash
npm run dev
```

Visit each page and verify:

- Button appears only for admins
- Clicking downloads file
- Correct tables are exported

**Step 5: Commit integration**

```bash
git add app/page.tsx app/analytics/page.tsx app/clientes/page.tsx
git commit -m "feat(ui): integrate export buttons in Dashboard, Analytics, and Clientes pages"
```

---

## Phase 4: Testing & Documentation

### Task 15: Write Integration Tests

**Files:**

- Create: `tests/api/export.test.ts`

**Step 1: Write API tests**

Create `tests/api/export.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe('Export API Integration', () => {
  let authToken: string;

  beforeAll(async () => {
    // Authenticate as admin user for tests
    // In real scenario, you'd use test credentials
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL!,
      password: process.env.TEST_ADMIN_PASSWORD!,
    });

    authToken = data.session?.access_token || '';
  });

  it('should export single table as CSV', async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        tables: ['inventory'],
        format: 'csv',
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');

    const text = await response.text();
    expect(text).toContain('product_id'); // Header row
  });

  it('should export multiple tables as ZIP', async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        tables: ['inventory', 'sales'],
        format: 'xlsx',
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/zip');
  });

  it('should reject non-admin users', async () => {
    // Sign in as seller
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_SELLER_EMAIL!,
      password: process.env.TEST_SELLER_PASSWORD!,
    });

    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session?.access_token}`,
      },
      body: JSON.stringify({
        tables: ['inventory'],
        format: 'csv',
      }),
    });

    expect(response.status).toBe(403);
  });

  it('should apply date range filters', async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        tables: ['sales'],
        format: 'csv',
        dateRange: {
          start: '2026-01-01',
          end: '2026-01-31',
        },
      }),
    });

    expect(response.status).toBe(200);
  });
});
```

**Step 2: Run integration tests**

```bash
npm run test:db
```

Expected: Tests pass (or skip if no test credentials)

**Step 3: Commit tests**

```bash
git add tests/api/export.test.ts
git commit -m "test(api): add integration tests for export functionality"
```

---

### Task 16: Create User Documentation

**Files:**

- Create: `docs/USER_GUIDE_BACKUPS.md`

**Step 1: Write user guide**

Create `docs/USER_GUIDE_BACKUPS.md`:

```markdown
# Guía de Usuario - Sistema de Respaldo y Exportación

## Para Administradores

Este sistema permite respaldar y exportar todos los datos del sistema Café Mirador.

## Exportación Rápida desde Páginas

### Dashboard - Exportar Inventario

1. Ir a la página principal (Dashboard)
2. Buscar el botón "Exportar Inventario" arriba de la tabla
3. Click para descargar archivo Excel con todos los productos

### Analytics - Exportar Ventas

1. Ir a `/analytics`
2. Seleccionar rango de fechas deseado
3. Click en "Exportar Datos"
4. Descarga incluye ventas y items del período seleccionado

### Clientes - Exportar Lista de Clientes

1. Ir a `/clientes`
2. Click en "Exportar Clientes"
3. Descarga incluye clientes e historial de contactos

## Página de Respaldos (Próximamente)

Ir a `/backups` para acceso completo:

- Exportar tablas específicas
- Elegir formato (CSV o Excel)
- Ver historial de respaldos automáticos
- Descargar respaldos anteriores

## Respaldos Automáticos

El sistema crea respaldos automáticos cada día a las 2:00 AM (hora del servidor).

### ¿Qué se respalda?

- Inventario completo
- Todas las ventas
- Clientes y contactos
- Perfiles de usuario

### ¿Dónde se guardan?

Los respaldos se suben automáticamente a Google Drive en carpetas organizadas:

- **Diarios**: Últimos 7 días
- **Semanales**: Últimas 4 semanas
- **Mensuales**: Últimos 12 meses

### Notificaciones

Recibirás un email diario confirmando que el respaldo fue exitoso, o alertándote si hubo algún problema.

## Preguntas Frecuentes

**¿Puedo exportar solo ciertos productos?**

Actualmente la exportación es de toda la tabla. Usa los filtros de Excel después de descargar.

**¿Cuántos datos puedo exportar a la vez?**

Límite: 10,000 registros por exportación. Para tablas más grandes, usa rangos de fechas.

**¿Los respaldos afectan el rendimiento del sistema?**

No. Los respaldos automáticos se ejecutan en la madrugada cuando no hay usuarios activos.

**¿Puedo restaurar un respaldo anterior?**

Sí, contacta al administrador del sistema con la fecha del respaldo que necesitas restaurar.

## Soporte

Para problemas con exportaciones o respaldos, contacta a soporte técnico.
```

**Step 2: Commit user guide**

```bash
git add docs/USER_GUIDE_BACKUPS.md
git commit -m "docs: add user guide for backup and export features"
```

---

### Task 17: Final Testing Checklist

**Files:**

- Create: `docs/BACKUP_TEST_CHECKLIST.md`

**Step 1: Write test checklist**

Create `docs/BACKUP_TEST_CHECKLIST.md`:

```markdown
# Backup System Test Checklist

## Pre-Deployment Tests

### Scripts Testing

- [ ] `npm run backup:execute` runs without errors
- [ ] JSON files created in temp directory
- [ ] Files are gzipped correctly
- [ ] metadata.json contains accurate information
- [ ] SQL dump generates valid SQL syntax (test restore on dev DB)
- [ ] Google Drive upload succeeds
- [ ] Email notification received
- [ ] Cleanup script deletes old files correctly

### API Testing

- [ ] `/api/export` returns CSV for single table
- [ ] `/api/export` returns XLSX for single table
- [ ] `/api/export` returns ZIP for multiple tables
- [ ] Date range filtering works correctly
- [ ] Non-admin users get 403 error
- [ ] Unauthenticated users get 401 error
- [ ] Audit log entry created for each export
- [ ] Large table export doesn't timeout (test with 5000+ rows)

### UI Testing

- [ ] DownloadButton appears only for admins
- [ ] Button shows loading state during export
- [ ] File downloads automatically
- [ ] Filename is descriptive and timestamped
- [ ] CSV file opens correctly in Excel/Google Sheets
- [ ] XLSX file has styled headers and filters
- [ ] Export from Dashboard works
- [ ] Export from Analytics respects date range
- [ ] Export from Clientes includes related tables

### GitHub Actions Testing

- [ ] Workflow can be triggered manually
- [ ] Workflow runs on schedule (verify after deployment)
- [ ] All environment variables accessible
- [ ] Backup completes within timeout (15 min)
- [ ] Retry logic works on transient failures
- [ ] Logs are captured for debugging
- [ ] Success email received after workflow
- [ ] Files appear in correct Google Drive folder

## Post-Deployment Verification

### Day 1

- [ ] First automatic backup runs successfully
- [ ] Email notification received
- [ ] Files in Google Drive daily folder
- [ ] Audit log has entries

### Week 1

- [ ] 7 daily backups exist
- [ ] No duplicate files
- [ ] File sizes are reasonable
- [ ] Emails received daily

### Month 1

- [ ] First monthly backup created
- [ ] SQL dump file exists
- [ ] Retention policy executed correctly
- [ ] Old dailies moved to weekly folder
- [ ] Storage usage within limits

## Rollback Plan

If backup system fails:

1. Disable GitHub Actions workflow (pause cron)
2. Revert relevant commits
3. Keep existing backups in Google Drive
4. Use manual exports until fixed

## Success Criteria

✅ All scripts run without errors
✅ All tests pass
✅ Documentation complete
✅ GitHub Actions workflow succeeds
✅ Emails deliver correctly
✅ UI export works for admins
✅ Files viewable in Google Drive
✅ Retention policy deletes old files
✅ No performance impact on production
```

**Step 2: Commit checklist**

```bash
git add docs/BACKUP_TEST_CHECKLIST.md
git commit -m "docs: add comprehensive testing checklist for backup system"
```

---

### Task 18: Update Main README

**Files:**

- Modify: `README.md`

**Step 1: Add backup system section**

Add to `README.md` after existing sections:

```markdown
## Backup and Export System

### Automatic Backups

Daily backups run automatically at 2:00 AM UTC via GitHub Actions:

- **Daily**: Last 7 days (JSON format, gzipped)
- **Weekly**: Last 4 weeks
- **Monthly**: Last 12 months (includes SQL dump)

All backups are stored in Google Drive with automatic retention policy.

### Manual Export

Admins can export data anytime:

- **Dashboard**: Export inventory
- **Analytics**: Export sales (with date filter)
- **Clientes**: Export customers and contacts

Supports CSV and Excel (XLSX) formats.

### Setup

See [BACKUP_SETUP_GUIDE.md](docs/BACKUP_SETUP_GUIDE.md) for configuration instructions.

### Documentation

- [Setup Guide](docs/BACKUP_SETUP_GUIDE.md) - Initial configuration
- [User Guide](docs/USER_GUIDE_BACKUPS.md) - How to use exports
- [Test Checklist](docs/BACKUP_TEST_CHECKLIST.md) - Verification steps
```

**Step 2: Commit README update**

```bash
git add README.md
git commit -m "docs: add backup system section to README"
```

---

## Execution Summary

### Implementation Order

1. **Phase 1 (Tasks 1-8)**: Core infrastructure and scripts - 2 days
2. **Phase 2 (Tasks 9-10)**: Automation with GitHub Actions - 1 day
3. **Phase 3 (Tasks 11-14)**: Manual export UI - 2 days
4. **Phase 4 (Tasks 15-18)**: Testing and documentation - 1 day

**Total: 6 days**

### Key Milestones

- ✅ Task 8: Backup scripts working locally
- ✅ Task 10: Automated backups running on schedule
- ✅ Task 14: Export buttons integrated in all pages
- ✅ Task 18: Complete documentation

### Next Steps After Implementation

1. Execute setup guide to configure Google Drive and secrets
2. Run manual workflow trigger to test end-to-end
3. Monitor first week of automatic backups
4. Validate retention policy after 30 days
5. Create `/backups` page (future enhancement)

---

**Plan complete and saved to `docs/plans/2026-01-18-backup-export-implementation.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
