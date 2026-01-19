-- Create backup audit log table
-- This table tracks all backup and export operations for auditing purposes

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
CREATE INDEX IF NOT EXISTS idx_backup_audit_user_timestamp ON backup_audit_log(user_id, timestamp DESC);

-- Add index for querying recent logs
CREATE INDEX IF NOT EXISTS idx_backup_audit_timestamp ON backup_audit_log(timestamp DESC);

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

-- Anyone authenticated can insert (for system logs)
CREATE POLICY "Allow inserting backup logs"
  ON backup_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE backup_audit_log IS 'Audit trail for all backup and export operations';
COMMENT ON COLUMN backup_audit_log.action IS 'Type of operation: manual_export, auto_backup, restore, download';
COMMENT ON COLUMN backup_audit_log.tables IS 'Array of table names included in the operation';
COMMENT ON COLUMN backup_audit_log.format IS 'Export format used: csv, xlsx, json, sql';
