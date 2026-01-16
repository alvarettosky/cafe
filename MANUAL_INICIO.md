# Manual de Inicio Rápido - Café Mirador

Este documento describe paso a paso cómo iniciar el sistema para empezar a trabajar.

## Resumen Rápido (Comandos para copiar y pegar)

Si ya tienes todo configurado, abre tu terminal y ejecuta estos comandos en orden:

```bash
# 1. Activar entorno de herramientas (Importante)
source setup_env.sh

# 2. Entrar a la carpeta del sitio web
cd frontend

# 3. (Opcional) Asegurar que las librerías estén al día
npm install

# 4. Encender el servidor
npm run dev
```

---

## Guía Detallada Paso a Paso

### Paso 1: Abrir la Terminal
Abre tu terminal en la carpeta del proyecto `Cafe-Mirador`.
*Debes ver archivos como `README.md` y la carpeta `frontend`.*

### Paso 2: Activar Entorno Virtual (¡CRÍTICO!)
El proyecto usa una versión específica de Node.js para evitar errores. Debes "activarla" cada vez que abras una nueva terminal.

**Comando:**
```bash
source setup_env.sh
```
*Si no ves ningún mensaje de error, funcionó. Ahora tu terminal sabe qué herramientas usar.*

### Paso 3: Navegar al Frontend
El código de la aplicación web está en la carpeta `frontend`.

**Comando:**
```bash
cd frontend
```

### Paso 4: Instalar Dependencias (Solo si hubo cambios)
Si descargaste cambios nuevos o es la primera vez, instala las librerías necesarias. Si lo haces diario no pasa nada, solo toma unos segundos.

**Comando:**
```bash
npm install
```

### Paso 5: Activar el Servidor Local
Esto enciende la página web en tu computadora para que puedas verla y editarla.

**Comando:**
```bash
npm run dev
```

**Resultado esperado:**
Verás un mensaje parecido a:
```
 ▲ Next.js 16.x.x
   - Local:        http://localhost:3000
   - Network:      http://192.168.x.x:3000
```

### Paso 6: Ver la Aplicación
Abre tu navegador (Chrome, Firefox, etc.) y visita:
[http://localhost:3000](http://localhost:3000)

### Paso 7: Verificar instalación (Tests) (Opcional)
Si quieres asegurarte de que todo funciona correctamente (cálculos, validaciones, etc.), puedes correr las pruebas automáticas.

**En la Terminal (desde la carpeta raíz `Cafe-Mirador`):**
```bash
npm test
```
*Esto ejecutará las pruebas del sistema e indicará si todo está "Verde" (Passed).*

---

## Preguntas Frecuentes

### ¿Y el servidor de Base de Datos (Backend)?
Este proyecto usa **Supabase**, que está **en la nube**. 
*   **No necesitas activar nada extra** en tu computadora para la base de datos.
*   Mientras tengas internet y tu archivo `.env.local` configurado correctamente, la aplicación se conectará automáticamente.

### ¿Cómo detengo el servidor?
En la terminal donde corre `npm run dev`, presiona las teclas:
`Ctrl` + `C`

### Me sale error "command not found: npm" o similar
Seguramente olvidaste el **Paso 2**. Ejecuta `source setup_env.sh` en la raíz del proyecto e intenta de nuevo.
