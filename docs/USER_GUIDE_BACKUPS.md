# Guía de Usuario: Sistema de Backup y Exportación

## Exportación Manual de Datos

### Requisitos

- Debes tener rol de **administrador** para exportar datos
- Estar autenticado en el sistema

### Desde el Dashboard

1. Ir a la página principal (Dashboard)
2. En la esquina superior derecha, hacer clic en **"Exportar Inventario"**
3. El archivo se descargará automáticamente en formato CSV

### Desde Gestión de Clientes

1. Ir a **Clientes** desde el menú
2. Hacer clic en **"Exportar Clientes"**
3. Se descargará un archivo ZIP con:
   - `customers.csv` - Datos de clientes
   - `customer_contacts.csv` - Historial de contactos

### Desde Analytics

1. Ir a **Analytics** desde el menú
2. Seleccionar el rango de fechas deseado
3. Hacer clic en **"Exportar Ventas"**
4. Se descargarán las ventas del período seleccionado

## Formatos de Exportación

### CSV (Predeterminado)

- Compatible con Excel, Google Sheets, LibreOffice
- Formato universal, fácil de importar
- Separador: coma (,)
- Codificación: UTF-8

### XLSX (Próximamente)

- Formato nativo de Excel
- Soporta múltiples hojas
- Mejor formato de fechas y números

## Backups Automáticos

El sistema realiza backups automáticos diarios a las 2:00 AM (UTC):

### ¿Qué se respalda?

- Inventario completo
- Todas las ventas y sus items
- Clientes y contactos
- Perfiles de usuario

### ¿Dónde se guardan?

- Google Drive (carpeta configurada por el administrador)
- Nombrados como `backup-YYYY-MM-DD.json.gz`

### Política de Retención

| Tipo              | Se mantiene     |
| ----------------- | --------------- |
| Backups diarios   | Últimos 7 días  |
| Backups semanales | Últimos 30 días |
| Backups mensuales | Último año      |

## Notificaciones

El administrador recibe un email después de cada backup con:

- Estado: Éxito o Error
- Resumen de datos respaldados
- Duración del proceso
- Enlace al archivo (si fue exitoso)

## Preguntas Frecuentes

### ¿Por qué no veo el botón de exportar?

El botón solo aparece para usuarios con rol de administrador. Contacta al administrador si necesitas exportar datos.

### ¿Los datos exportados incluyen información sensible?

Los datos exportados incluyen toda la información de las tablas. No incluyen contraseñas ni tokens de autenticación.

### ¿Puedo restaurar desde un backup?

La restauración debe hacerse por el administrador técnico desde el panel de Supabase. Los backups JSON contienen toda la información necesaria para restaurar.

### ¿Qué pasa si un backup falla?

El administrador recibe una notificación por email con los detalles del error. Los backups fallidos no afectan los datos en producción.

### ¿Los backups afectan el rendimiento del sistema?

No. Los backups se ejecutan a las 2:00 AM cuando el sistema tiene menor uso. La exportación manual es instantánea y no afecta a otros usuarios.

## Contacto

Para problemas con backups o exportaciones, contactar al administrador del sistema.
