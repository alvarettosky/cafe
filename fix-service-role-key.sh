#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔑 ARREGLAR SERVICE ROLE KEY TRUNCADA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "La Service Role Key en mcp.json está truncada (solo 41 caracteres)."
echo "Necesitas copiar la clave COMPLETA desde Supabase."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PASO 1: Obtener la clave completa"
echo ""
echo "El navegador se abrirá en la página de API Keys de Supabase..."
sleep 2
xdg-open "https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm/settings/api-keys" 2>/dev/null &
echo ""
echo "  1. En Supabase, busca la sección 'Secret keys'"
echo "  2. Encuentra la clave 'default' que empieza con 'sb_secret_'"
echo "  3. Haz click en el ícono de COPIAR (📋) junto a la clave"
echo "  4. La clave COMPLETA estará en tu portapapeles"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PASO 2: Pegar la clave en mcp.json"
echo ""
echo "Presiona Enter cuando hayas copiado la clave..."
read -p ""

echo ""
echo "Abriendo editor nano para editar mcp.json..."
echo ""
echo "INSTRUCCIONES EN NANO:"
echo "  1. Busca la línea: \"SUPABASE_SERVICE_ROLE_KEY\""
echo "  2. Borra el valor actual (la clave truncada)"
echo "  3. Pega la clave completa (Ctrl+Shift+V)"
echo "  4. La clave debe tener ~200+ caracteres"
echo "  5. Guarda: Ctrl+O, luego Enter"
echo "  6. Cierra: Ctrl+X"
echo ""
sleep 3

nano ~/.config/claude/mcp.json

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Verificando la clave..."
echo ""

KEY_LENGTH=$(cat ~/.config/claude/mcp.json | grep -oP 'SUPABASE_SERVICE_ROLE_KEY":\s*"\K[^"]+' | wc -c)

if [ $KEY_LENGTH -gt 100 ]; then
    echo "✅ ¡Perfecto! La clave ahora tiene $KEY_LENGTH caracteres"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🔄 PASO 3: Reiniciar Claude Code"
    echo ""
    echo "Para que los MCPs se carguen con la nueva clave:"
    echo "  1. Cierra Claude Code COMPLETAMENTE"
    echo "  2. Vuelve a abrir Claude Code"
    echo "  3. Inicia una nueva conversación en este proyecto"
    echo "  4. Di: 'Ejecuta el fix de analytics usando Supabase MCP'"
    echo ""
    echo "🎉 ¡Los MCPs funcionarán automáticamente!"
else
    echo "⚠️  La clave aún parece corta ($KEY_LENGTH caracteres)"
    echo ""
    echo "Verifica que:"
    echo "  - Copiaste la clave COMPLETA desde Supabase"
    echo "  - No hay espacios o saltos de línea"
    echo "  - La clave empieza con 'eyJ' (es un JWT)"
    echo ""
    echo "Ejecuta este script de nuevo si necesitas corregirlo."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
