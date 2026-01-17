# Solución al Error 404 de Vercel

## Error Actual
```
404: NOT_FOUND
Code: DEPLOYMENT_NOT_FOUND
ID: iad1::r5t6l-1768622286268-418f1450fee2
```

Este error indica que Vercel no puede encontrar el deployment. Esto sucedió porque movimos la aplicación de `/frontend` a la raíz del repositorio.

## Solución Paso a Paso

### Opción 1: Reconfigurar el Proyecto Existente (Recomendado)

1. **Ve al Dashboard de Vercel**
   - Accede a: https://vercel.com/dashboard
   - Busca tu proyecto "cafe-mirador" o "frontend"

2. **Elimina el Proyecto Antiguo**
   - Click en el proyecto
   - Settings → General
   - Scroll hasta el final
   - Click en "Delete Project"
   - Confirma escribiendo el nombre del proyecto

3. **Reimporta desde GitHub**
   - Click en "Add New..." → "Project"
   - Selecciona tu repositorio: `alvarettosky/cafe`
   - Vercel detectará automáticamente Next.js
   - **IMPORTANTE**: NO configures un "Root Directory" - déjalo vacío
   - Configura las Environment Variables:
     - `NEXT_PUBLIC_SUPABASE_URL` = (tu URL de Supabase)
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (tu clave anon de Supabase)
   - Click en "Deploy"

4. **Espera el Deployment**
   - Vercel tomará 2-3 minutos
   - Verás el proceso de build en tiempo real
   - Una vez completo, te dará la URL final

### Opción 2: Forzar Redespliegue del Proyecto Existente

1. **Ve al Dashboard de Vercel**
   - https://vercel.com/dashboard

2. **Abre tu proyecto**
   - Click en "cafe-mirador" o el nombre de tu proyecto

3. **Verifica la configuración**
   - Settings → General
   - **Root Directory**: Debe estar VACÍO o ser `.` (punto)
   - Si dice `frontend`, cámbialo a vacío y guarda

4. **Verifica Environment Variables**
   - Settings → Environment Variables
   - Asegúrate de tener:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

5. **Fuerza un nuevo deployment**
   - Ve a la pestaña "Deployments"
   - Click en el deployment más reciente
   - Click en "..." (tres puntos) → "Redeploy"
   - Selecciona "Use existing Build Cache" DESACTIVADO
   - Click "Redeploy"

### Opción 3: Deploy desde la Terminal (Avanzado)

```bash
# Instala Vercel CLI si no la tienes
npm i -g vercel

# Desde la raíz del proyecto
cd /mnt/datos/Documentos/Proyectos/Cafe-Mirador

# Login a Vercel
vercel login

# Deploy
vercel --prod
```

## Verificación

Una vez completado el deployment, verifica:

1. **URL de producción**: https://cafe-mirador.vercel.app
2. **Estado del build**: Debe mostrar "Ready"
3. **Logs**: No debe haber errores en los logs de build

## Problemas Comunes

### Error: "No Next.js detected"
**Solución**: Asegúrate de que `package.json`, `next.config.ts` y la carpeta `app/` están en la raíz del repositorio.

### Error: "Build failed"
**Solución**:
- Verifica que las environment variables estén configuradas
- Revisa los logs de build para ver el error específico
- Asegúrate de que `npm run build` funciona localmente

### Error: "Environment variables not found"
**Solución**:
- Ve a Settings → Environment Variables en Vercel
- Agrega `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Haz un nuevo deployment

## Cambios Realizados

✅ Movimos toda la app de `/frontend` a raíz
✅ Actualizamos todos los workflows de GitHub Actions
✅ Eliminamos configuración vieja de Vercel
✅ Creamos `vercel.json` con configuración explícita
✅ Actualizamos README.md

## Estructura Actual del Proyecto

```
cafe-mirador/
├── app/              ← Next.js App Router
├── components/       ← React components
├── lib/              ← Utilities
├── types/            ← TypeScript types
├── public/           ← Static files
├── package.json      ← Dependencies
├── next.config.ts    ← Next.js config
├── vercel.json       ← Vercel config
└── frontend/         ← [DEPRECADO] No usar
```

## Contacto

Si después de seguir estos pasos el problema persiste:
1. Revisa los logs de Vercel en el dashboard
2. Verifica que el último commit está en GitHub
3. Comparte los logs de error para diagnosticar
