# Sistema de Backup Automático y Exportación de Datos

**Fecha:** 2026-01-18
**Estado:** Diseño validado, pendiente implementación
**Autor:** Diseño colaborativo con usuario

## Resumen Ejecutivo

Sistema completo de backup automático y exportación manual de datos para Café Mirador CRM. Incluye backups diarios automáticos a Google Drive con política de retención rotativa, y exportación manual en múltiples formatos (CSV/XLSX) desde la UI.

**Características principales:**

- Backup automático diario de todas las tablas vía GitHub Actions
- Estrategia de retención: 7 días + 4 semanas + 12 meses
- Exportación manual personalizada (tablas, fechas, formatos)
- Botones de exportación individuales en cada página
- Notificaciones por email del estado de backups
- 100% gratuito con stack actual
- Solo accesible para admins

## 1. Arquitectura General

### Componentes Principales

**1. Backup Automático (GitHub Actions + Google Drive)**

- **Cron diario**: GitHub Actions workflow que se ejecuta a las 2:00 AM UTC (configurable)
- **Proceso**:
  1. Workflow se conecta a Supabase con service role key (almacenada en GitHub Secrets)
  2. Ejecuta queries SELECT para cada tabla y exporta datos
  3. Genera archivos JSON (backups diarios) y SQL dump (primer día del mes)
  4. Sube archivos a Google Drive usando OAuth 2.0 service account
  5. Aplica estrategia de retención: elimina diarios >7 días, semanales >30 días, mensuales >365 días
  6. Envía email de confirmación vía Resend (gratuito hasta 100 emails/día)

**2. Exportación Manual (UI en Next.js)**

- **Página `/backups`** (solo admins): Panel completo con:
  - Selector de tablas (todas o individuales)
  - Selector de rango de fechas
  - Formato: CSV o XLSX
  - Historial de últimos backups automáticos con opción de descarga
  - Estado del último backup (timestamp, tamaño, éxito/error)

- **Botones en páginas individuales**:
  - `/` (Dashboard): Exportar inventario completo
  - `/analytics`: Exportar ventas del rango seleccionado
  - `/clientes`: Exportar todos los clientes
  - Cada botón descarga solo los datos relevantes de esa vista

### Tablas Incluidas en Backup

Todas las tablas del sistema:

- `inventory` - Productos y stock
- `sales` - Ventas
- `sale_items` - Items de cada venta
- `customers` - Clientes
- `customer_contacts` - Historial de contactos
- `profiles` - Roles de usuario

## 2. Implementación del Backup Automático

### Estructura de Archivos

```
.github/workflows/
  └── daily-backup.yml         # Workflow principal

scripts/
  └── backup/
      ├── export-to-json.ts    # Exporta tablas a JSON
      ├── export-to-sql.ts     # Genera SQL dump mensual
      ├── upload-to-gdrive.ts  # Sube a Google Drive
      ├── cleanup-old-backups.ts # Aplica política de retención
      └── send-notification.ts # Envía email de confirmación
```

### Workflow de GitHub Actions

**Trigger:** Cron `0 2 * * *` (2:00 AM UTC diario) + manual dispatch

**Steps:**

1. Checkout del código
2. Setup Node.js 20
3. Instalar dependencias (`npm ci`)
4. Ejecutar script de exportación (JSON diario)
5. Si es día 1 del mes: generar SQL dump adicional
6. Autenticar con Google Drive (service account JSON en GitHub Secrets)
7. Subir archivos con nomenclatura: `backup-YYYY-MM-DD-HH-mm.json` y `monthly-YYYY-MM.sql`
8. Ejecutar limpieza según política de retención
9. Enviar email de confirmación/error

**Reintentos automáticos:**

```yaml
- name: Export and Upload Backup
  uses: nick-invision/retry@v2
  with:
    timeout_minutes: 10
    max_attempts: 3
    retry_wait_seconds: 30
    command: npm run backup:execute
```

### Secrets Requeridos en GitHub

- `SUPABASE_SERVICE_ROLE_KEY`: Para queries directos sin RLS
- `GOOGLE_DRIVE_CREDENTIALS`: JSON del service account de Google
- `GOOGLE_DRIVE_FOLDER_ID`: ID de carpeta destino en Drive
- `NOTIFICATION_EMAIL`: Email donde recibir notificaciones
- `RESEND_API_KEY`: Para envío de emails

### Dependencias Nuevas

```json
{
  "googleapis": "^128.0.0",
  "resend": "^3.0.0",
  "exceljs": "^4.4.0",
  "papaparse": "^5.4.1",
  "jszip": "^3.10.1"
}
```

## 3. Exportación Manual - Página `/backups`

### Estructura de Componentes

```
app/backups/
  └── page.tsx                 # Página principal de backups (solo admins)

components/backups/
  ├── ExportForm.tsx           # Formulario de exportación personalizada
  ├── BackupHistory.tsx        # Lista de backups automáticos disponibles
  ├── BackupStatusCard.tsx     # Estado del último backup
  └── DownloadButton.tsx       # Botón reutilizable para exportar
```

### Funcionalidades

**1. Card de Estado** (arriba):

- Último backup exitoso: timestamp, tamaño total, duración
- Próximo backup programado: countdown
- Estado de Google Drive: conectado/desconectado
- Botón "Ejecutar Backup Manual" (trigger del workflow de GitHub via API)

**2. Formulario de Exportación Personalizada**:

- Checkboxes para seleccionar tablas
- Selector de rango de fechas (para tablas con timestamps)
- Radio buttons: CSV vs XLSX
- Botón "Exportar" → descarga archivo zip con las tablas seleccionadas

**3. Historial de Backups** (tabla):

- Columnas: Fecha, Tipo (Diario/Semanal/Mensual), Tamaño, Estado, Acciones
- Botón "Descargar" por cada backup (descarga desde Google Drive)
- Filtros: últimos 7/30/90 días
- Paginación

### Protección de Ruta

```typescript
// Middleware en app/backups/page.tsx
const { role } = useAuth();
if (role !== 'admin') redirect('/');
```

## 4. Botones de Exportación en Páginas Individuales

### Dashboard (`/`) - Exportar Inventario

```typescript
<DownloadButton
  tableName="inventory"
  fileName="inventario-completo"
  format="xlsx"
  label="Exportar Inventario"
/>
```

### Analytics (`/analytics`) - Exportar Ventas Filtradas

```typescript
<DownloadButton
  tableName="sales"
  dateRange={{ start: startDate, end: endDate }}
  includeRelated={['sale_items', 'customers']}
  format="xlsx"
  label="Exportar Datos de Analytics"
/>
```

### Clientes (`/clientes`) - Exportar Clientes

```typescript
<DownloadButton
  tableName="customers"
  includeRelated={['customer_contacts']}
  format="csv"
  label="Exportar Clientes"
/>
```

### Componente `DownloadButton` Reutilizable

**Props:**

- `tableName`: Tabla a exportar
- `dateRange?`: Filtro de fechas opcional
- `includeRelated?`: Tablas relacionadas para JOIN
- `format`: 'csv' | 'xlsx'
- `label`: Texto del botón

**Comportamiento:**

- Al hacer click: llama API route `/api/export` con parámetros
- Muestra loading spinner durante generación
- Descarga automáticamente cuando está listo
- Solo visible para admins (verifica rol desde `useAuth()`)

## 5. API Routes

### Estructura de API

```
app/api/
  ├── export/
  │   └── route.ts             # POST /api/export - Exportación manual
  ├── backups/
  │   ├── list/route.ts        # GET /api/backups/list - Lista backups de GDrive
  │   ├── download/route.ts    # GET /api/backups/download?fileId=X
  │   └── trigger/route.ts     # POST /api/backups/trigger - Trigger manual
```

### `/api/export` - Endpoint Principal

**Proceso:**

1. Verificar rol admin (middleware)
2. Conectar a Supabase con service role
3. Para cada tabla:
   - Ejecutar SELECT con filtros de fecha si aplica
   - Si includeRelated: hacer JOINs para datos relacionados
4. Generar archivo según formato:
   - CSV: usar 'papaparse'
   - XLSX: usar 'exceljs' (con estilos: headers en negrita, filtros)
5. Si múltiples tablas: crear ZIP con 'jszip'
6. Return archivo como blob con headers correctos

**Optimizaciones:**

- Streaming para tablas grandes (paginación de 1000 filas)
- Límite de 10,000 filas por exportación manual
- Compresión gzip para archivos grandes

### `/api/backups/*` - Endpoints de Gestión

- **`/list`**: Lee metadata de Google Drive folder, retorna lista de backups disponibles
- **`/download`**: Genera signed URL de Google Drive o proxy descarga
- **`/trigger`**: Dispara workflow de GitHub usando GitHub API (requiere Personal Access Token)

## 6. Configuración de Google Drive

### Setup Inicial (una sola vez)

**1. Crear proyecto en Google Cloud Console:**

- Ir a console.cloud.google.com
- Crear proyecto "Cafe-Mirador-Backups"
- Habilitar Google Drive API

**2. Crear Service Account:**

- IAM & Admin → Service Accounts → Create
- Nombre: "backup-automation"
- Generar JSON key → guardar como `google-service-account.json`

**3. Crear carpeta en Google Drive:**

- En Google Drive personal crear carpeta "Cafe-Mirador-Backups"
- Dentro crear subcarpetas: `/daily`, `/weekly`, `/monthly`
- Share → agregar email del service account con rol "Editor"
- Copiar ID de carpeta desde URL

### Estructura de Carpetas en Google Drive

```
Cafe-Mirador-Backups/
├── daily/
│   ├── backup-2026-01-18-02-00.json.gz
│   ├── backup-2026-01-19-02-00.json.gz
│   └── ... (últimos 7 días)
├── weekly/
│   ├── weekly-2026-W03.json.gz
│   └── ... (últimas 4 semanas)
└── monthly/
    ├── monthly-2026-01.sql.gz
    ├── monthly-2026-01.json.gz
    └── ... (últimos 12 meses)
```

### Política de Retención

- **Diarios**: Mantener últimos 7, mover el del domingo a `/weekly`, eliminar resto >7 días
- **Semanales**: Mantener últimos 4 (último mes), mover el del último domingo del mes a `/monthly`, eliminar resto >30 días
- **Mensuales**: Mantener últimos 12 (SQL + JSON), eliminar resto >365 días

## 7. Sistema de Notificaciones por Email

### Servicio: Resend

- Plan gratuito: 100 emails/día, 3,000/mes
- Setup: crear cuenta en resend.com → generar API key

### Tipos de Emails

**1. Backup Exitoso (diario):**

```
Asunto: ✅ Backup Diario Exitoso - Café Mirador
Cuerpo:
- Fecha/hora del backup
- Tablas incluidas (con número de registros cada una)
- Tamaño total del backup
- Tiempo de ejecución
- Link directo a carpeta de Google Drive
```

**2. Backup con Errores:**

```
Asunto: ⚠️ Error en Backup Automático - Café Mirador
Cuerpo:
- Fecha/hora del intento
- Tabla(s) que fallaron
- Mensaje de error específico
- Stack trace (si disponible)
- Acción recomendada
```

**3. Resumen Semanal (opcional, cada lunes):**

```
Asunto: 📊 Resumen Semanal de Backups - Café Mirador
Cuerpo:
- Backups exitosos: 7/7
- Espacio usado en Google Drive
- Crecimiento de datos vs semana anterior
- Próximo backup mensual programado
```

## 8. Manejo de Errores y Recuperación

### Estrategias de Resiliencia

**1. Reintentos automáticos:**

- 3 intentos con 30 segundos de espera entre cada uno
- Timeout de 10 minutos por intento

**2. Backup parcial:**

- Si una tabla falla, continuar con las demás
- Email de notificación indica cuál falló
- Archivo de log incluido: `backup-log-YYYY-MM-DD.txt`

**3. Validación de integridad:**

- Verificar tamaño > 0 bytes
- Contar registros exportados vs SELECT COUNT(\*)
- Validar JSON parseability
- Hash SHA-256 del archivo (guardado en metadata)

**4. Logs detallados:**

- GitHub Actions guarda logs automáticamente (90 días)
- Cada backup incluye `metadata.json`:

```json
{
  "timestamp": "2026-01-18T02:00:00Z",
  "tables": {
    "inventory": { "rows": 15, "size_bytes": 2048 },
    "sales": { "rows": 1234, "size_bytes": 45000 }
  },
  "duration_seconds": 8,
  "github_run_id": "12345",
  "hash_sha256": "abc123..."
}
```

### Restauración de Backups

**Página `/backups/restore`** (solo super-admin):

- Sube archivo SQL/JSON
- Preview de datos a restaurar
- Opciones:
  - "Restaurar todo" (TRUNCATE + INSERT)
  - "Merge" (INSERT nuevos, UPDATE existentes)
  - "Rollback específico" (restaurar solo tabla X a fecha Y)
- Confirmación con typing "CONFIRMAR RESTAURACIÓN"
- Crea backup automático antes de restaurar

## 9. Seguridad y Permisos

### Protecciones a Nivel de Código

**1. Autenticación y autorización:**

```typescript
// Middleware en todas las rutas de backup
export async function GET/POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
```

**2. Secrets y variables sensibles:**

- Agregar a `.gitignore`:
  ```
  google-service-account.json
  .env.backup
  scripts/backup/.secrets/
  ```
- Usar GitHub Secrets para CI/CD
- Usar Vercel Environment Variables para API routes
- Rotar `SUPABASE_SERVICE_ROLE_KEY` cada 90 días

**3. Rate limiting:**

- 5 exportaciones por hora por usuario
- Implementar con Upstash Redis o in-memory cache

**4. Sanitización de inputs:**

- Validar nombres de tablas contra whitelist
- Validar rangos de fechas (no permitir fechas futuras)
- Limitar tamaño de exportación (máx 50MB o 100k filas)

**5. Auditoría:**

Nueva tabla para logs:

```sql
CREATE TABLE backup_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'manual_export', 'auto_backup', 'restore'
  tables TEXT[],
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN,
  error_message TEXT
);
```

## 10. Rendimiento y Costos

### Optimizaciones de Rendimiento

**1. Exportación de tablas grandes:**

```typescript
// Usar paginación para evitar memory overflow
async function exportLargeTable(tableName: string) {
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data } = await supabase
      .from(tableName)
      .select('*')
      .range(offset, offset + pageSize - 1);

    if (data.length < pageSize) hasMore = false;
    offset += pageSize;

    writeToStream(data);
  }
}
```

**2. Compresión:**

- Archivos JSON/SQL: comprimir con gzip antes de subir (reduce ~70%)
- Extensión: `.json.gz` y `.sql.gz`
- Descomprimir automáticamente al descargar desde UI

**3. Parallel processing:**

- Exportar máximo 3 tablas en paralelo (evitar saturar Supabase)

### Estimación de Costos (mensual)

| Servicio       | Plan                       | Costo      |
| -------------- | -------------------------- | ---------- |
| Supabase       | Free tier (hasta 500MB DB) | $0         |
| Vercel         | Hobby                      | $0         |
| GitHub Actions | 2,000 min/mes gratis       | $0         |
| Google Drive   | 15GB gratis                | $0         |
| Resend         | 3,000 emails/mes gratis    | $0         |
| **TOTAL**      |                            | **$0/mes** |

### Uso de Storage

Asumiendo 1,000 ventas/mes, 50 productos, 200 clientes:

- Tamaño por backup: ~5MB (JSON) + ~8MB (SQL) = 13MB
- Mensual total:
  - Diarios: 7 × 5MB = 35MB
  - Semanales: 4 × 5MB = 20MB
  - Mensuales: 12 × 13MB = 156MB
  - **Total**: ~211MB (bien dentro del free tier de 15GB)

### Monitoreo

Dashboard en `/backups` muestra:

- Espacio usado en Google Drive
- Tendencia de crecimiento
- Proyección de cuándo necesitarás upgrade
- Alerta cuando llegues al 80% del free tier (12GB)

## 11. Plan de Implementación

### Fase 1 - Infraestructura (1-2 días)

1. Setup Google Cloud + Service Account
2. Configurar carpetas en Google Drive
3. Agregar GitHub Secrets y Vercel Environment Variables
4. Crear scripts de backup en `/scripts/backup/`
   - `export-to-json.ts`
   - `export-to-sql.ts`
   - `upload-to-gdrive.ts`
   - `cleanup-old-backups.ts`
   - `send-notification.ts`

### Fase 2 - Automatización (1 día)

5. Crear GitHub Actions workflow `.github/workflows/daily-backup.yml`
6. Configurar Resend y sistema de notificaciones
7. Testing del backup automático (trigger manual)

### Fase 3 - UI Manual (2-3 días)

8. Crear API routes:
   - `/api/export/route.ts`
   - `/api/backups/list/route.ts`
   - `/api/backups/download/route.ts`
   - `/api/backups/trigger/route.ts`

9. Crear página `/backups` y componentes:
   - `BackupStatusCard.tsx`
   - `ExportForm.tsx`
   - `BackupHistory.tsx`
   - `DownloadButton.tsx`

10. Agregar botones de exportación en:
    - Dashboard (`/`)
    - Analytics (`/analytics`)
    - Clientes (`/clientes`)

11. Crear tabla `backup_audit_log` en Supabase

### Fase 4 - Testing y Deploy (1 día)

12. Tests de exportación CSV/XLSX
13. Tests de permisos (admin vs seller)
14. Documentación de uso en `docs/BACKUP_SYSTEM_GUIDE.md`
15. Deploy a producción

**Total estimado: 5-7 días de desarrollo**

## 12. Criterios de Éxito

✅ Backup automático se ejecuta diariamente sin intervención
✅ Notificación por email llega correctamente
✅ Admins pueden exportar datos en CSV/XLSX desde cualquier página
✅ Política de retención funciona correctamente (7/30/365 días)
✅ Sistema funciona 100% gratis con stack actual
✅ Restauración de backups funciona sin pérdida de datos
✅ Audit log registra todas las acciones de backup/exportación

## 13. Próximos Pasos

Una vez implementado:

1. Monitorear primeros 7 días de backups automáticos
2. Validar tamaño de archivos vs proyecciones
3. Ajustar hora de ejecución si causa conflictos
4. Considerar backup incremental si DB crece significativamente
5. Agregar soporte para restauración selectiva de registros específicos

---

**Documento validado el 2026-01-18**
**Listo para implementación**
