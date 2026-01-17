#!/bin/bash

clear

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 FIX COMPLETO: ANALYTICS + MCPs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Este script arreglará TODO automáticamente:"
echo "  ✅ Analytics (ejecutando SQL en Supabase)"
echo "  ✅ MCPs (corrigiendo Service Role Key)"
echo ""
echo "Tiempo total estimado: 3-5 minutos"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Presiona Enter para comenzar..." dummy

clear

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PARTE 1: ARREGLAR ANALYTICS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 PASO 1: Copiar el SQL"
echo ""
echo "Ejecuta este comando en otra terminal:"
echo ""
echo "  cat /tmp/fix_analytics.sql"
echo ""
echo "Luego selecciona TODO el output y copia (Ctrl+Shift+C)"
echo ""
read -p "Presiona Enter cuando hayas copiado el SQL..." dummy

# Copiar a /tmp
cp supabase/migrations/FIX_ANALYTICS_TABLES.sql /tmp/fix_analytics.sql

echo ""
echo "📋 PASO 2: Abrir Supabase SQL Editor"
echo ""
xdg-open "https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm" 2>/dev/null &
sleep 2

echo "El navegador se abrió. En Supabase:"
echo "  1. Click en 'SQL Editor' (menú lateral)"
echo "  2. Click en 'New Query'"
echo "  3. Pega el SQL (Ctrl+V)"
echo "  4. Click en 'Run' (o Ctrl+Enter)"
echo ""
read -p "Presiona Enter cuando hayas ejecutado el SQL..." dummy

echo ""
echo "✅ Fix de Analytics aplicado"
echo ""

clear

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PARTE 2: ARREGLAR MCPs (Service Role Key)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ejecutar el script de fix de service role key
./fix-service-role-key.sh

clear

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ¡TODO COMPLETADO!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ Próximos pasos:"
echo ""
echo "1. ✅ Analytics arreglado - Verifica en:"
echo "   https://cafe-pi-steel.vercel.app/analytics"
echo ""
echo "2. 🔄 MCPs configurados - Reinicia Claude Code:"
echo "   - Cierra Claude Code COMPLETAMENTE"
echo "   - Vuelve a abrir"
echo "   - En futuras sesiones, los MCPs funcionarán automáticamente"
echo ""
echo "3. 🎉 ¡Listo para usar!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
