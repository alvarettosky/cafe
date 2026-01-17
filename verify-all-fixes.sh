#!/bin/bash

clear

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 VERIFICACIÓN COMPLETA DE FIXES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador de checks
TOTAL_CHECKS=0
PASSED_CHECKS=0

check() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅${NC} $2"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}❌${NC} $2"
        if [ -n "$3" ]; then
            echo -e "   ${YELLOW}→${NC} $3"
        fi
    fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PARTE 1: VERIFICAR SCRIPTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check 1: FIX_TODO.sh exists and is executable
[ -x "FIX_TODO.sh" ]
check $? "Script FIX_TODO.sh existe y es ejecutable" "Ejecuta: chmod +x FIX_TODO.sh"

# Check 2: fix-service-role-key.sh exists and is executable
[ -x "fix-service-role-key.sh" ]
check $? "Script fix-service-role-key.sh existe y es ejecutable" "Ejecuta: chmod +x fix-service-role-key.sh"

# Check 3: fix-analytics-auto.js exists and is executable
[ -x "fix-analytics-auto.js" ]
check $? "Script fix-analytics-auto.js existe y es ejecutable" "Ejecuta: chmod +x fix-analytics-auto.js"

# Check 4: SQL fix file exists
[ -f "supabase/migrations/FIX_ANALYTICS_TABLES.sql" ]
check $? "SQL fix file existe" "Verifica que el archivo supabase/migrations/FIX_ANALYTICS_TABLES.sql exista"

# Check 5: SQL copied to /tmp
[ -f "/tmp/fix_analytics.sql" ]
check $? "SQL copiado a /tmp/fix_analytics.sql" "Ejecuta: cp supabase/migrations/FIX_ANALYTICS_TABLES.sql /tmp/fix_analytics.sql"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PARTE 2: VERIFICAR MCP CONFIGURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check 6: mcp.json exists
[ -f "$HOME/.config/claude/mcp.json" ]
check $? "Archivo mcp.json existe en ~/.config/claude/" "Ejecuta: ./FIX_TODO.sh para crearlo"

# Check 7: Service Role Key length
if [ -f "$HOME/.config/claude/mcp.json" ]; then
    KEY_LENGTH=$(cat "$HOME/.config/claude/mcp.json" | grep -oP 'SUPABASE_SERVICE_ROLE_KEY":\s*"\K[^"]+' | wc -c)
    [ $KEY_LENGTH -gt 100 ]
    check $? "Service Role Key tiene longitud válida ($KEY_LENGTH caracteres)" "Ejecuta: ./fix-service-role-key.sh para arreglar la clave truncada"
fi

# Check 8: Supabase URL configured
if [ -f "$HOME/.config/claude/mcp.json" ]; then
    grep -q "https://inszvqzpxfqibkjsptsm.supabase.co" "$HOME/.config/claude/mcp.json"
    check $? "Supabase URL configurada correctamente"
fi

# Check 9: Context7 MCP configured
if [ -f "$HOME/.config/claude/mcp.json" ]; then
    grep -q "context7" "$HOME/.config/claude/mcp.json"
    check $? "Context7 MCP configurado"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PARTE 3: VERIFICAR GIT STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check 10: Git repo clean (except for backup file)
UNTRACKED=$(git status --short | grep -v "mcp (copia).json" | wc -l)
[ $UNTRACKED -eq 0 ]
check $? "Git repository limpio (todos los cambios commiteados)" "Hay archivos sin commitear"

# Check 11: Last commit is the fix scripts
git log -1 --oneline | grep -q "add automated fix scripts"
check $? "Último commit contiene los fix scripts"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PARTE 4: VERIFICAR DEPENDENCIAS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check 12: Node.js installed
command -v node >/dev/null 2>&1
check $? "Node.js instalado ($(node --version 2>/dev/null || echo 'no instalado'))" "Instala Node.js: sudo pacman -S nodejs npm"

# Check 13: npm installed
command -v npm >/dev/null 2>&1
check $? "npm instalado ($(npm --version 2>/dev/null || echo 'no instalado'))" "Instala npm: sudo pacman -S nodejs npm"

# Check 14: npx available
command -v npx >/dev/null 2>&1
check $? "npx disponible" "Reinstala npm para obtener npx"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RESUMEN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $PASSED_CHECKS -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}✅ TODOS LOS CHECKS PASARON ($PASSED_CHECKS/$TOTAL_CHECKS)${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎯 PRÓXIMOS PASOS:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1. ✅ Scripts listos"
    echo "2. ✅ MCP configurado"
    echo "3. ✅ Git limpio"
    echo ""
    echo "🔄 AHORA VERIFICA QUE ANALYTICS FUNCIONA:"
    echo ""
    echo "   Ve a: https://cafe-pi-steel.vercel.app/analytics"
    echo ""
    echo "   Si la página carga correctamente → ✅ TODO FUNCIONA"
    echo "   Si hay errores → Ejecuta el SQL fix en Supabase SQL Editor"
    echo ""
else
    echo -e "${YELLOW}⚠️  ALGUNOS CHECKS FALLARON ($PASSED_CHECKS/$TOTAL_CHECKS pasaron)${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔧 PARA ARREGLAR:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Ejecuta el script maestro que arreglará todo:"
    echo ""
    echo "   ./FIX_TODO.sh"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
