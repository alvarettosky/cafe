# 🚀 Configuración Permanente de MCPs para Claude Code

Esta guía te ayudará a configurar **Supabase MCP** y **Context7 MCP** de forma permanente.

## 📋 Contenido de esta Guía

1. [Opción Rápida: Script Automático](#opción-1-script-automático-linux-recomendado)
2. [Opción Manual: Paso a Paso](#opción-2-manual-paso-a-paso)
3. [Obtener Service Role Key](#cómo-obtener-tu-service-role-key)
4. [Verificar que Funciona](#verificar-que-los-mcps-están-funcionando)
5. [Solución de Problemas](#solución-de-problemas)

---

## Opción 1: Script Automático (Linux) - RECOMENDADO

### Para sistemas Linux (Manjaro, Ubuntu, Debian, etc.):

```bash
# Desde el directorio del proyecto
cd /mnt/datos/Documentos/Proyectos/Cafe-Mirador
./.claude/setup-mcps.sh
```

El script:

- ✅ Crea el directorio `~/.config/claude/` si no existe
- ✅ Copia la configuración de ejemplo
- ✅ Te guía para agregar tu Service Role Key
- ✅ Opcionalmente abre el editor para editar la clave

---

## Opción 2: Manual (Paso a Paso)

### Paso 1: Localizar el Archivo de Configuración

El archivo `mcp.json` debe estar en:

**Linux/Mac:**

```
~/.config/claude/mcp.json
```

**Windows:**

```
%APPDATA%\Claude\mcp.json
```

O alternativamente en:

```
~/.claude/mcp.json
```

### Paso 2: Crear el Directorio (si no existe)

**Linux/Mac:**

```bash
mkdir -p ~/.config/claude
```

**Windows (PowerShell):**

```powershell
New-Item -ItemType Directory -Force -Path "$env:APPDATA\Claude"
```

### Paso 3: Crear el Archivo mcp.json

**Opción A - Copiar desde el proyecto:**

```bash
# Linux/Mac
cp /mnt/datos/Documentos/Proyectos/Cafe-Mirador/.claude/mcp-config-example.json ~/.config/claude/mcp.json
```

```powershell
# Windows
Copy-Item "C:\ruta\al\proyecto\.claude\mcp-config-example.json" "$env:APPDATA\Claude\mcp.json"
```

**Opción B - Crear manualmente:**

Crea el archivo `~/.config/claude/mcp.json` con este contenido:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-supabase"],
      "env": {
        "SUPABASE_URL": "https://inszvqzpxfqibkjsptsm.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "REEMPLAZA_CON_TU_SERVICE_ROLE_KEY"
      }
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@context-labs/context7-mcp"]
    }
  }
}
```

### Paso 4: Obtener y Configurar tu Service Role Key

Ver sección: [Cómo Obtener tu Service Role Key](#cómo-obtener-tu-service-role-key)

### Paso 5: Editar el Archivo

**Linux/Mac:**

```bash
nano ~/.config/claude/mcp.json
# O usa tu editor favorito: vim, gedit, kate, etc.
```

**Windows:**

```powershell
notepad "%APPDATA%\Claude\mcp.json"
```

Reemplaza `REEMPLAZA_CON_TU_SERVICE_ROLE_KEY` con tu clave real.

### Paso 6: Guardar y Reiniciar

1. Guarda el archivo
2. **REINICIA Claude Code COMPLETAMENTE** (cierra y vuelve a abrir)
3. Los MCPs estarán disponibles en todas tus conversaciones

---

## Cómo Obtener tu Service Role Key

### Paso a Paso:

1. **Ve a tu proyecto Supabase:**

   ```
   https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm/settings/api
   ```

2. **Busca la sección "Project API keys"**

3. **Copia la clave `service_role`**:
   - ⚠️ **IMPORTANTE**: Es la clave que dice **`service_role`**
   - ❌ NO copies la clave `anon` (esa es pública)
   - La clave `service_role` es secreta y tiene permisos completos

4. **Pega la clave** en el archivo `mcp.json` reemplazando el placeholder

### Seguridad de la Service Role Key:

⚠️ **MUY IMPORTANTE**:

- La `service_role` key tiene acceso COMPLETO a tu base de datos
- NUNCA la compartas públicamente
- NUNCA la subas a git
- Solo úsala en tu configuración local de MCPs

---

## Verificar que los MCPs están Funcionando

### Después de reiniciar Claude Code:

1. **Inicia una nueva conversación** en tu proyecto
2. **Escribe**: "Lista las tablas de mi base de datos usando Supabase MCP"
3. Si funciona, deberías ver las tablas de tu base de datos

O simplemente di:

```
Ejecuta: SELECT 1 as test
```

Si ves el resultado, ¡los MCPs están funcionando! 🎉

---

## Solución de Problemas

### Problema 1: "MCPs not found" o no aparecen

**Solución:**

1. Verifica que el archivo esté en la ubicación correcta:
   ```bash
   ls -la ~/.config/claude/mcp.json
   ```
2. Verifica que el JSON sea válido (usa un validador online)
3. Reinicia Claude Code COMPLETAMENTE (no solo la ventana)

### Problema 2: "Connection failed" para Supabase

**Solución:**

1. Verifica que la Service Role Key sea correcta
2. Verifica que la SUPABASE_URL sea correcta
3. Prueba la conexión manualmente:
   ```bash
   curl -H "apikey: TU_SERVICE_ROLE_KEY" \
        https://inszvqzpxfqibkjsptsm.supabase.co/rest/v1/
   ```

### Problema 3: Context7 no funciona

**Solución:**

1. Context7 puede requerir instalación adicional
2. Ejecuta: `npx @context-labs/context7-mcp --version`
3. Si falla, instala globalmente:
   ```bash
   npm install -g @context-labs/context7-mcp
   ```

### Problema 4: npx no encontrado

**Solución:**

1. Asegúrate de tener Node.js instalado:
   ```bash
   node --version
   npm --version
   ```
2. Si no está instalado, instálalo:

   ```bash
   # Manjaro/Arch
   sudo pacman -S nodejs npm

   # Ubuntu/Debian
   sudo apt install nodejs npm
   ```

---

## Ubicaciones Alternativas del Archivo

Si `~/.config/claude/mcp.json` no funciona, prueba estas ubicaciones:

**Linux:**

- `~/.claude/mcp.json`
- `~/.config/claude-code/mcp.json`
- `$XDG_CONFIG_HOME/claude/mcp.json`

**Mac:**

- `~/Library/Application Support/Claude/mcp.json`
- `~/.claude/mcp.json`

**Windows:**

- `%APPDATA%\Claude\mcp.json`
- `%USERPROFILE%\.claude\mcp.json`
- `%LOCALAPPDATA%\Claude\mcp.json`

---

## Contenido Completo del Archivo (Referencia)

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-supabase"],
      "env": {
        "SUPABASE_URL": "https://inszvqzpxfqibkjsptsm.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "tu_service_role_key_aqui"
      }
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@context-labs/context7-mcp"]
    }
  }
}
```

Reemplaza `tu_service_role_key_aqui` con tu clave real de Supabase.

---

## ✅ Checklist Final

Antes de reiniciar Claude Code, verifica:

- [ ] Archivo `mcp.json` creado en la ubicación correcta
- [ ] Service Role Key configurada (reemplazado el placeholder)
- [ ] SUPABASE_URL correcta: `https://inszvqzpxfqibkjsptsm.supabase.co`
- [ ] JSON válido (sin errores de sintaxis)
- [ ] Node.js y npm instalados
- [ ] Claude Code cerrado completamente antes de volver a abrir

---

## 🎯 Próximos Pasos

Una vez configurados los MCPs:

1. **Reinicia esta conversación**
2. **Di**: "Ejecuta el fix de analytics usando Supabase MCP"
3. **Yo ejecutaré automáticamente** todo el SQL sin que tengas que copiar/pegar

---

**Creado**: 2026-01-17
**Archivos relacionados**:

- `.claude/mcp-config-example.json` - Plantilla de configuración
- `.claude/setup-mcps.sh` - Script de instalación automática (Linux)
- `supabase/migrations/FIX_ANALYTICS_TABLES.sql` - Fix de analytics que se ejecutará automáticamente
