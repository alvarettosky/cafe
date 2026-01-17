#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 REEMPLAZAR SERVICE ROLE KEY DIRECTAMENTE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Este script reemplazará la Service Role Key en mcp.json"
echo ""
echo "IMPORTANTE: Copia la clave COMPLETA desde Supabase primero"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Mostrar clave actual
CURRENT_KEY=$(cat ~/.config/claude/mcp.json | grep -oP 'SUPABASE_SERVICE_ROLE_KEY":\s*"\K[^"]+')
KEY_LENGTH=${#CURRENT_KEY}

echo "Clave actual (primeros 50 caracteres):"
echo "${CURRENT_KEY:0:50}..."
echo "Longitud: $KEY_LENGTH caracteres"
echo ""

if [ $KEY_LENGTH -gt 100 ]; then
    echo "✅ La clave ya tiene longitud válida ($KEY_LENGTH caracteres)"
    echo "No se necesita reemplazo."
    exit 0
fi

echo "⚠️  La clave está truncada (solo $KEY_LENGTH caracteres)"
echo ""
echo "Pega la clave COMPLETA de Supabase aquí:"
echo "(Ctrl+Shift+V para pegar, luego Enter)"
echo ""
read -r NEW_KEY

# Validar nueva clave
NEW_KEY_LENGTH=${#NEW_KEY}

if [ $NEW_KEY_LENGTH -lt 100 ]; then
    echo ""
    echo "❌ ERROR: La clave pegada es muy corta ($NEW_KEY_LENGTH caracteres)"
    echo "Debe tener al menos 100 caracteres."
    echo ""
    echo "Asegúrate de copiar la clave COMPLETA desde:"
    echo "https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm/settings/api-keys"
    echo ""
    exit 1
fi

# Hacer backup
cp ~/.config/claude/mcp.json ~/.config/claude/mcp.json.backup

# Reemplazar clave usando sed
sed -i "s|\"SUPABASE_SERVICE_ROLE_KEY\": \"$CURRENT_KEY\"|\"SUPABASE_SERVICE_ROLE_KEY\": \"$NEW_KEY\"|g" ~/.config/claude/mcp.json

# Verificar reemplazo
UPDATED_KEY=$(cat ~/.config/claude/mcp.json | grep -oP 'SUPABASE_SERVICE_ROLE_KEY":\s*"\K[^"]+')
UPDATED_LENGTH=${#UPDATED_KEY}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $UPDATED_LENGTH -gt 100 ]; then
    echo "✅ ¡ÉXITO! Service Role Key actualizada"
    echo ""
    echo "Nueva longitud: $UPDATED_LENGTH caracteres"
    echo "Backup guardado en: ~/.config/claude/mcp.json.backup"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🔄 REINICIA CLAUDE CODE:"
    echo "  1. Cierra Claude Code COMPLETAMENTE"
    echo "  2. Vuelve a abrir"
    echo "  3. Los MCPs funcionarán automáticamente"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "❌ ERROR: El reemplazo no funcionó correctamente"
    echo ""
    echo "Restaurando backup..."
    cp ~/.config/claude/mcp.json.backup ~/.config/claude/mcp.json
    echo "Archivo restaurado."
    echo ""
    exit 1
fi
