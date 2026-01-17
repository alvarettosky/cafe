#!/bin/bash

clear

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 INSTALAR NPM/NPX SIN SUDO (Entorno Virtual)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Este script instalará nvm (Node Version Manager) para obtener"
echo "npm y npx SIN necesidad de permisos sudo."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}PASO 1: Instalar nvm (Node Version Manager)${NC}"
echo ""

# Verificar si nvm ya está instalado
if [ -d "$HOME/.nvm" ]; then
    echo -e "${GREEN}✅ nvm ya está instalado en ~/.nvm${NC}"
else
    echo "Descargando e instalando nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ nvm instalado correctamente${NC}"
    else
        echo -e "${YELLOW}⚠️  Error instalando nvm${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${CYAN}PASO 2: Cargar nvm en esta sesión${NC}"
echo ""

# Cargar nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Verificar que nvm está cargado
if command -v nvm >/dev/null 2>&1; then
    echo -e "${GREEN}✅ nvm cargado correctamente${NC}"
else
    echo -e "${YELLOW}⚠️  nvm no se pudo cargar. Intenta cerrar y abrir la terminal.${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}PASO 3: Instalar Node.js v25 con npm incluido${NC}"
echo ""

# Instalar Node.js v25 (actual)
nvm install 25

echo ""
echo -e "${CYAN}PASO 4: Configurar v25 como predeterminada${NC}"
echo ""

nvm use 25
nvm alias default 25

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ VERIFICACIÓN${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node --version
npm --version
npx --version

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ ¡INSTALACIÓN COMPLETA!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}IMPORTANTE: Configurar terminal para futuras sesiones${NC}"
echo ""
echo "Para que npm/npx estén disponibles en futuras terminales,"
echo "necesitas agregar nvm a tu shell configuration:"
echo ""
echo "  echo 'export NVM_DIR=\"\$HOME/.nvm\"' >> ~/.bashrc"
echo "  echo '[ -s \"\$NVM_DIR/nvm.sh\" ] && \\. \"\$NVM_DIR/nvm.sh\"' >> ~/.bashrc"
echo ""
echo "O si usas zsh:"
echo ""
echo "  echo 'export NVM_DIR=\"\$HOME/.nvm\"' >> ~/.zshrc"
echo "  echo '[ -s \"\$NVM_DIR/nvm.sh\" ] && \\. \"\$NVM_DIR/nvm.sh\"' >> ~/.zshrc"
echo ""
echo "Luego reinicia tu terminal o ejecuta: source ~/.bashrc"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${CYAN}🎯 PRÓXIMOS PASOS:${NC}"
echo ""
echo "1. Cierra y abre tu terminal (para que nvm se cargue automáticamente)"
echo "2. Verifica: npm --version && npx --version"
echo "3. Ejecuta: ./verify-all-fixes.sh"
echo "4. Si todo está OK, ejecuta: ./FIX_TODO.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
