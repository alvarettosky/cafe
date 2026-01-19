# Checklist de Testing: Sistema de Backup

## Tests Automatizados

### DownloadButton Component (13 tests)

- [x] Renderiza botón con etiqueta personalizada
- [x] Renderiza etiqueta por defecto cuando no se proporciona label
- [x] No renderiza para usuarios no-admin
- [x] No renderiza mientras auth está cargando
- [x] No renderiza cuando role es null
- [x] Aplica clases de tamaño sm correctamente
- [x] Aplica clases de tamaño md correctamente
- [x] Aplica clases de tamaño lg correctamente
- [x] Aplica clases de variante default correctamente
- [x] Aplica clases de variante outline correctamente
- [x] Aplica clases de variante ghost correctamente
- [x] Acepta className adicional
- [x] Renderiza ícono de descarga

## Testing Manual

### Pre-requisitos

- [ ] Variables de entorno configuradas
- [ ] Usuario admin disponible para pruebas
- [ ] Acceso a Supabase dashboard
- [ ] Acceso a Google Drive (si aplica)

### Exportación desde Dashboard

- [ ] Botón visible solo para admins
- [ ] Botón NO visible para sellers
- [ ] Click descarga archivo CSV
- [ ] Archivo contiene datos de inventario
- [ ] Formato CSV válido (abrir en Excel/Sheets)

### Exportación desde Clientes

- [ ] Botón visible solo para admins
- [ ] Click descarga archivo ZIP
- [ ] ZIP contiene customers.csv
- [ ] ZIP contiene customer_contacts.csv
- [ ] Datos coinciden con base de datos

### Exportación desde Analytics

- [ ] Botón visible solo para admins
- [ ] Selector de fechas funciona
- [ ] Exportación respeta rango de fechas
- [ ] Archivo contiene ventas y sale_items

### API /api/export

- [ ] GET sin auth retorna 401
- [ ] GET con seller retorna 403
- [ ] GET con admin retorna 200
- [ ] Parámetro tables funciona (single)
- [ ] Parámetro tables funciona (array)
- [ ] Parámetro format=csv funciona
- [ ] Parámetro format=xlsx funciona
- [ ] Parámetro dateRange filtra correctamente

### GitHub Actions (si configurado)

- [ ] Workflow aparece en Actions tab
- [ ] Trigger manual funciona
- [ ] Backup se sube a Google Drive
- [ ] Notificación email se recibe
- [ ] Cleanup elimina backups antiguos

### Integridad de Datos

- [ ] Conteo de filas coincide con DB
- [ ] Fechas formateadas correctamente
- [ ] Caracteres especiales preservados
- [ ] Valores null manejados correctamente
- [ ] IDs UUID exportados correctamente

### Seguridad

- [ ] No se exponen credenciales en logs
- [ ] RLS protege backup_audit_log
- [ ] API requiere autenticación
- [ ] Solo admins pueden exportar

## Comandos de Verificación

```bash
# Ejecutar tests unitarios
npm test

# Verificar build
npm run build

# Ejecutar workflow manualmente (requiere gh cli)
gh workflow run daily-backup.yml

# Ver logs del workflow
gh run list --workflow=daily-backup.yml
gh run view <run-id> --log
```

## Datos de Prueba

Para testing completo, asegurar que existan:

- [ ] Al menos 5 productos en inventario
- [ ] Al menos 10 clientes
- [ ] Al menos 20 ventas con items
- [ ] Ventas en diferentes rangos de fechas
- [ ] Usuarios admin y seller

## Criterios de Aceptación

### Funcionalidad

- Todos los tests automatizados pasan
- Exportación manual funciona desde todas las páginas
- Archivos descargados son válidos y completos

### Rendimiento

- Exportación de 1000 registros < 5 segundos
- No hay timeout en exports grandes
- No afecta rendimiento de otros usuarios

### Seguridad

- Solo admins pueden exportar
- No hay fugas de información sensible
- Logs no contienen credenciales
