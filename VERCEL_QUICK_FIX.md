# 🚨 Arreglo Rápido de Vercel - 5 Minutos

## Estado Actual
❌ **https://cafe-mirador.vercel.app** → 404 NOT_FOUND

## Problema
Vercel está intentando desplegar desde el subdirectorio `/frontend` que **ya no existe**. Todos los archivos ahora están en la raíz del repositorio.

## ✅ Solución en 3 Pasos

### Paso 1: Ve al Dashboard de Vercel
Abre: https://vercel.com/dashboard

### Paso 2: Encuentra tu proyecto
- Busca el proyecto llamado **"cafe-mirador"** o **"frontend"**
- Click en el nombre del proyecto

### Paso 3A: Opción Rápida - Reconfigurar Root Directory

1. Click en **"Settings"** (⚙️)
2. Click en **"General"** en el menú lateral
3. Busca la sección **"Root Directory"**
4. Si dice `frontend`, haz click en **"Edit"**
5. **Borra todo** y déjalo **VACÍO** (o pon solo un punto: `.`)
6. Click en **"Save"**
7. Ve a **"Deployments"** en el menú superior
8. Click en el deployment más reciente
9. Click en **"⋯"** (tres puntos) → **"Redeploy"**
10. **IMPORTANTE**: Desmarca "Use existing Build Cache"
11. Click en **"Redeploy"**

### Paso 3B: Opción Alternativa - Reimportar Proyecto (Más Limpia)

1. En Settings → General, scroll hasta el final
2. Click en **"Delete Project"**
3. Confirma escribiendo el nombre del proyecto
4. Vuelve al dashboard: https://vercel.com/new
5. Click en **"Add New..."** → **"Project"**
6. Selecciona tu repositorio **"alvarettosky/cafe"**
7. **Configure Project:**
   - Framework Preset: **Next.js** (debe detectarlo automáticamente)
   - Root Directory: **DÉJALO VACÍO** ⚠️
   - Build Command: `npm run build`
   - Output Directory: `.next`
8. **Environment Variables** - Agrega estas 2:
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://inszvqzpxfqibkjsptsm.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imluc3p2cXpweGZxaWJranNwdHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MTE2ODIsImV4cCI6MjA4NDA4NzY4Mn0.kZhQpUKEKfKcFubla1L_MUYlkn6ifU3JUVIxMT7NwoE
   ```
9. Click en **"Deploy"**

## ⏱️ Tiempo de Build
- Vercel tomará **2-4 minutos** para hacer el build
- Verás el progreso en tiempo real
- Una vez completo, verás ✅ **"Ready"**

## ✅ Verificación

Cuando termine el deployment, verifica:
1. La URL debe funcionar: https://cafe-mirador.vercel.app
2. Debe mostrar la página principal del CRM de Café Mirador
3. No debe haber errores 404

## 📁 Verificación Local (Opcional)

Si quieres probar localmente que todo funciona:

```bash
cd /mnt/datos/Documentos/Proyectos/Cafe-Mirador
npm install
npm run build
npm start
```

Abre: http://localhost:3000

## ❓ Si Aún Falla

Revisa los logs de build en Vercel:
1. Deployments → Click en el deployment
2. Revisa la pestaña **"Build Logs"**
3. Busca errores en rojo

Errores comunes:
- **"Cannot find module"** → Las environment variables no están configuradas
- **"Build failed"** → Revisa que el Root Directory esté vacío
- **"404 Not Found"** → Vercel aún está usando configuración antigua, intenta reimportar (Opción 3B)

## 📧 Notas Importantes

⚠️ **NO configures Root Directory como "frontend"** - ese directorio ya no existe
✅ **Root Directory debe estar VACÍO o ser "."** para que funcione
🔑 **Environment Variables son obligatorias** para que la app se conecte a Supabase

---

**Última actualización**: Todos los commits están en GitHub (commit `f48f18b`)
**Estructura del repo**: Todo en la raíz (app/, components/, lib/, etc.)
