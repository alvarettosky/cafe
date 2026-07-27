# 🚨 ARREGLO CRÍTICO REQUERIDO

**Estado actual**: 2026-01-17 - Sistema parcialmente configurado

## ❌ PROBLEMA CRÍTICO DESCUBIERTO

### Node.js instalado pero npm/npx NO disponibles

```bash
node --version   # ✅ v25.2.1
npm --version    # ❌ command not found
npx --version    # ❌ command not found
```

### Impacto

Esto está **bloqueando TODO**:

1. ❌ **MCPs no pueden funcionar** (requieren npx)
2. ❌ **Pre-commit hooks fallan** (requieren npx)
3. ❌ **No se pueden hacer commits normales** (hooks bloqueados)
4. ❌ **Analytics no se puede arreglar automáticamente** (MCP Supabase necesita npx)

## 🔧 SOLUCIÓN (EJECUTA ESTO PRIMERO)

### ⭐ RECOMENDADO: Instalar npm SIN SUDO (Entorno Virtual)

Ya que estamos en un entorno virtual, usa el script automático:

```bash
./install-npm-no-sudo.sh
```

Este script:

- ✅ Instala nvm (Node Version Manager) sin permisos sudo
- ✅ Instala Node.js v25 con npm/npx incluidos
- ✅ Configura todo automáticamente
- ✅ Funciona en cualquier entorno (no requiere permisos de administrador)

**Después de ejecutar el script:**

1. Cierra y abre tu terminal
2. Verifica: `npm --version && npx --version`
3. Continúa con los siguientes pasos

### Opción Manual: Instalar nvm manualmente

Si prefieres hacerlo manual:

```bash
# 1. Instalar nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# 2. Reiniciar terminal o cargar nvm:
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 3. Instalar Node.js v25
nvm install 25
nvm use 25
nvm alias default 25

# 4. Verificar
node --version  # Debe mostrar v25.x.x
npm --version   # Debe mostrar versión de npm
npx --version   # Debe mostrar versión de npx
```

## ✅ VERIFICACIÓN POST-INSTALACIÓN

Después de instalar npm, verifica que todo funciona:

```bash
# Verificar npm y npx
npm --version
npx --version

# Ejecutar script de verificación completa
./verify-all-fixes.sh
```

Deberías ver:

```
✅ npm instalado (x.x.x)
✅ npx disponible
```

## 📋 ORDEN DE EJECUCIÓN DESPUÉS DE INSTALAR NPM

Una vez que npm/npx estén instalados, ejecuta en este orden:

### 1. Verificar estado actual

```bash
./verify-all-fixes.sh
```

### 2. Arreglar Service Role Key truncada

```bash
./fix-service-role-key.sh
```

Esto:

- Abre Supabase dashboard en tu navegador
- Te guía para copiar la Service Role Key COMPLETA
- Abre nano para editar `~/.config/claude/mcp.json`
- Valida que la clave tenga >100 caracteres

### 3. Ejecutar fix completo de Analytics

```bash
./FIX_TODO.sh
```

Esto:

- Copia el SQL a `/tmp/fix_analytics.sql`
- Abre Supabase SQL Editor
- Te guía para ejecutar el SQL
- Ejecuta `fix-service-role-key.sh` (si aún no lo hiciste)

### 4. Reiniciar Claude Code

```bash
# Cierra Claude Code COMPLETAMENTE
# Vuelve a abrirlo

# En una nueva conversación, verifica:
```

Di en Claude Code:

> "Lista las tablas de mi base de datos usando Supabase MCP"

Si funciona, verás las tablas → MCPs funcionando correctamente ✅

### 5. Verificar que Analytics funciona

Abre en tu navegador:

```
https://cafe-pi-steel.vercel.app/analytics
```

Si la página carga con gráficos → ✅ TODO FUNCIONA

## 📊 RESUMEN DE CHECKS ACTUALES

Según `verify-all-fixes.sh`:

✅ **Pasando (10/14):**

- Scripts creados y ejecutables
- SQL fix existe
- mcp.json configurado
- Supabase URL correcta
- Context7 MCP configurado
- Node.js instalado

❌ **Fallando (4/14):**

1. **CRÍTICO**: npm no instalado → **ARREGLA ESTO PRIMERO**
2. **CRÍTICO**: npx no disponible → **ARREGLA ESTO PRIMERO**
3. Service Role Key truncada (42 chars en vez de 200+)
4. Git con archivos sin commitear (verificación script sin commitear aún)

## 🎯 PRÓXIMOS PASOS

### Paso 1: Instalar npm (CRÍTICO - SIN SUDO)

```bash
./install-npm-no-sudo.sh
```

Luego **cierra y abre tu terminal** para que nvm se cargue automáticamente.

### Paso 2: Verificar

```bash
./verify-all-fixes.sh
```

### Paso 3: Si npm funciona, continuar con:

```bash
./FIX_TODO.sh
```

## 📁 ARCHIVOS CREADOS

Todos los scripts están listos en el directorio del proyecto:

- `FIX_TODO.sh` - Script maestro que orquesta todo
- `fix-service-role-key.sh` - Arregla la clave truncada en mcp.json
- `fix-analytics-auto.js` - Diagnóstico automático de MCPs
- `verify-all-fixes.sh` - Verificación completa de 14 checks
- `.claude/MCP_SETUP_INSTRUCTIONS.md` - Guía completa de configuración MCP
- `.claude/setup-mcps.sh` - Script de setup automático de MCPs
- `supabase/migrations/FIX_ANALYTICS_TABLES.sql` - Fix SQL para analytics

## ⚠️ NOTAS IMPORTANTES

1. **npm es OBLIGATORIO** - Sin npm, los MCPs NO funcionarán
2. **Service Role Key debe ser COMPLETA** - 200+ caracteres, no 42
3. **Reiniciar Claude Code** después de arreglar mcp.json
4. **Ejecutar SQL** en Supabase SQL Editor (no REST API)

## 🆘 SI ALGO FALLA

1. Ejecuta `./verify-all-fixes.sh` para ver qué checks fallan
2. Lee los mensajes de error detalladamente
3. Sigue las instrucciones de "→" en rojo/amarillo
4. Si npm sigue sin funcionar, prueba con nvm (Opción 3 arriba)

---

**Creado**: 2026-01-17
**Última actualización**: 2026-01-17
**Estado**: npm/npx NO instalados - REQUIERE ACCIÓN URGENTE
