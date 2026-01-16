#!/bin/bash

# Identificar directorio base del proyecto
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configurar PATH para usar el Node.js local
export PATH="$BASE_DIR/.node_env/bin:$PATH"

echo "☕ Iniciando Café Palestina CRM..."
echo "📂 Directorio del proyecto: $BASE_DIR"

# Entrar a la carpeta frontend
cd "$BASE_DIR/frontend" || exit

# Verificar si npm existe
if ! command -v npm &> /dev/null; then
    echo "❌ Error: No se encuentra npm. Asegúrate de haber ejecutado ./setup_env.sh primero."
    exit 1
fi

# Iniciar servidor de desarrollo
echo "🚀 Arrancando servidor..."
npm run dev
