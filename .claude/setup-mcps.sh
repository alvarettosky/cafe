#!/bin/bash

echo "🔧 Configurando MCPs para Claude Code..."
echo ""

# Crear directorio de configuración
mkdir -p ~/.config/claude

# Copiar archivo de configuración
cp "$(dirname "$0")/mcp-config-example.json" ~/.config/claude/mcp.json

echo "✅ Archivo copiado a: ~/.config/claude/mcp.json"
echo ""
echo "⚠️  IMPORTANTE: Ahora debes editar el archivo para agregar tu Service Role Key"
echo ""
echo "Pasos siguientes:"
echo "1. Ve a: https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm/settings/api"
echo "2. Copia tu 'service_role' key (NO la 'anon' key)"
echo "3. Ejecuta: nano ~/.config/claude/mcp.json"
echo "4. Reemplaza 'REEMPLAZA_CON_TU_SERVICE_ROLE_KEY' con tu clave real"
echo "5. Guarda (Ctrl+O, Enter) y cierra (Ctrl+X)"
echo "6. Reinicia Claude Code"
echo ""
echo "¿Quieres abrir el archivo ahora para editarlo? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    nano ~/.config/claude/mcp.json
fi

echo ""
echo "🎉 ¡Listo! Reinicia Claude Code para usar los MCPs."
