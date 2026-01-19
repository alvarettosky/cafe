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
