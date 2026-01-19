# Guía de Configuración del Sistema de Backup

## Resumen

El sistema de backup de Café Mirador proporciona:

- **Backups automáticos diarios** via GitHub Actions
- **Exportación manual** desde la interfaz web (CSV/XLSX)
- **Almacenamiento en Google Drive** con política de retención
- **Notificaciones por email** via Resend

## Requisitos Previos

### 1. Cuenta de Google Cloud (para Google Drive)

1. Crear proyecto en [Google Cloud Console](https://console.cloud.google.com)
2. Habilitar la API de Google Drive
3. Crear una cuenta de servicio:
   - Ir a "IAM & Admin" → "Service Accounts"
   - Crear cuenta de servicio
   - Descargar el archivo JSON de credenciales
4. Crear carpeta en Google Drive y compartirla con el email de la cuenta de servicio

### 2. Cuenta de Resend (para notificaciones)

1. Registrarse en [Resend](https://resend.com)
2. Verificar dominio o usar dominio de prueba
3. Obtener API key desde el dashboard

## Configuración de Variables de Entorno

### GitHub Secrets

Configurar en Settings → Secrets → Actions:

```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Clave de servicio (NO la anon key)
GDRIVE_FOLDER_ID=1abc...          # ID de la carpeta en Google Drive
GDRIVE_CREDENTIALS={"type":"service_account",...}  # JSON completo
RESEND_API_KEY=re_...             # API key de Resend
NOTIFICATION_EMAIL=admin@tudominio.com
```

### Variables Locales (.env.local)

Para pruebas locales, agregar al `.env.local`:

```env
# Supabase (ya deberían existir)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Backup (solo para pruebas locales)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GDRIVE_FOLDER_ID=1abc...
GDRIVE_CREDENTIALS={"type":"service_account",...}
RESEND_API_KEY=re_...
NOTIFICATION_EMAIL=admin@tudominio.com
```

## Ejecutar Migración de Base de Datos

Ejecutar en Supabase SQL Editor:

```sql
-- Crear tabla de auditoría de backups
CREATE TABLE IF NOT EXISTS backup_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    backup_type TEXT NOT NULL CHECK (backup_type IN ('daily', 'weekly', 'monthly', 'manual')),
    status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
    file_name TEXT,
    file_size_bytes BIGINT,
    gdrive_file_id TEXT,
    tables_included TEXT[],
    row_counts JSONB,
    duration_seconds NUMERIC,
    error_message TEXT,
    triggered_by TEXT,
    github_run_id TEXT
);

-- Habilitar RLS
ALTER TABLE backup_audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Admins can view backup logs" ON backup_audit_log
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Service role can insert backup logs" ON backup_audit_log
    FOR INSERT
    TO service_role
    WITH CHECK (true);
```

## Estructura del Sistema

```
scripts/backup/
├── types.ts              # Interfaces TypeScript
├── export-to-json.ts     # Exportación JSON con compresión
├── export-to-sql.ts      # Dumps SQL mensuales
├── upload-to-gdrive.ts   # Subida a Google Drive
├── cleanup-old-backups.ts# Limpieza según retención
├── send-notification.ts  # Notificaciones email
└── index.ts              # Orquestador principal

lib/
└── export-utils.ts       # Utilidades CSV/XLSX

components/backups/
├── DownloadButton.tsx    # Componente de exportación
├── index.ts              # Exports
└── __tests__/            # Tests

app/api/export/
└── route.ts              # API de exportación manual

.github/workflows/
└── daily-backup.yml      # GitHub Actions workflow
```

## Política de Retención

| Tipo    | Frecuencia | Retención |
| ------- | ---------- | --------- |
| Daily   | Diario     | 7 días    |
| Weekly  | Domingos   | 4 semanas |
| Monthly | Día 1      | 12 meses  |

## Verificación de Configuración

### 1. Verificar GitHub Actions

```bash
# Ver ejecuciones del workflow
gh run list --workflow=daily-backup.yml

# Ejecutar manualmente
gh workflow run daily-backup.yml
```

### 2. Verificar Google Drive

1. Abrir la carpeta compartida
2. Verificar que aparecen archivos con formato:
   - `backup-YYYY-MM-DD.json.gz` (diarios)
   - `backup-YYYY-MM-DD-sql.gz` (mensuales)

### 3. Verificar Notificaciones

El email de notificación incluye:

- Estado del backup (éxito/error)
- Tablas incluidas con conteo de filas
- Duración del proceso
- Link al archivo en Google Drive

## Troubleshooting

### Error: "Google Drive upload failed"

1. Verificar que `GDRIVE_CREDENTIALS` es un JSON válido
2. Verificar que la carpeta está compartida con la cuenta de servicio
3. Verificar que `GDRIVE_FOLDER_ID` es correcto

### Error: "Supabase connection failed"

1. Verificar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`
2. La service role key es diferente de la anon key
3. Verificar que las tablas existen

### Error: "Resend notification failed"

1. Verificar `RESEND_API_KEY`
2. Verificar que el dominio está verificado o usar dominio de prueba
3. Verificar que `NOTIFICATION_EMAIL` es válido

## Exportación Manual

Los botones de exportación aparecen en:

- **Dashboard**: Exportar inventario
- **Clientes**: Exportar clientes y contactos
- **Analytics**: Exportar ventas con rango de fechas

Solo usuarios con rol `admin` pueden ver estos botones.

## Seguridad

- Las credenciales nunca se almacenan en el código
- La API de exportación requiere autenticación y rol admin
- RLS protege los logs de auditoría
- Los archivos en Google Drive heredan permisos de la carpeta
