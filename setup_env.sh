#!/bin/bash

# Definir versión de Node.js (LTS v20)
NODE_VERSION="v20.11.0"
NODE_DIST="node-$NODE_VERSION-linux-x64"
NODE_URL="https://nodejs.org/dist/$NODE_VERSION/$NODE_DIST.tar.xz"
INSTALL_DIR="$(pwd)/.node_env"

echo "Creando entorno virtual local para Node.js en $INSTALL_DIR..."

# Crear directorio
mkdir -p "$INSTALL_DIR"

# Descargar si no existe
if [ ! -f "$INSTALL_DIR/node.tar.xz" ]; then
    echo "Descargando Node.js $NODE_VERSION..."
    if command -v curl >/dev/null 2>&1; then
        curl -o "$INSTALL_DIR/node.tar.xz" "$NODE_URL"
    elif command -v wget >/dev/null 2>&1; then
        wget -O "$INSTALL_DIR/node.tar.xz" "$NODE_URL"
    else
        echo "Error: Se requiere curl o wget para descargar Node.js"
        exit 1
    fi
else
    echo "Archivo ya descargado."
fi

# Descomprimir
echo "Descomprimiendo..."
tar -xf "$INSTALL_DIR/node.tar.xz" -C "$INSTALL_DIR" --strip-components=1

# Configurar variables de entorno
export PATH="$INSTALL_DIR/bin:$PATH"

echo "Verificando instalación..."
node -v
npm -v

echo "Entorno configurado exitosamente."
echo "Instalando dependencias del proyecto..."
npm install

echo "Listo. Para usar este entorno, asegúrate de añadir $INSTALL_DIR/bin a tu PATH o usa los scripts de npm."
