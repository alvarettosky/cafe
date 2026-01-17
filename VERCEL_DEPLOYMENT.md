# Vercel Deployment Guide

## 🚀 Estado Actual

✅ **La aplicación está desplegada exitosamente en Vercel**

- **URL de Producción:** https://cafe-pi-steel.vercel.app
- **Repositorio:** https://github.com/alvarettosky/cafe
- **Branch:** main
- **Auto-deploy:** Habilitado (cada push a main despliega automáticamente)

## 📋 Configuración Actual

### Estructura del Proyecto
```
cafe-mirador/
├── app/              # Next.js App Router (raíz del proyecto)
├── components/       # React components
├── lib/              # Utilities
├── public/           # Static assets
├── package.json      # En la raíz
└── next.config.ts    # En la raíz
```

### Environment Variables en Vercel

Variables configuradas en Vercel (Production, Preview, Development):

```
NEXT_PUBLIC_SUPABASE_URL=https://inszvqzpxfqibkjsptsm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### Build Settings

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "rootDirectory": "."
}
```

## 🔄 Workflow de Deployment

### Deployment Automático

Cada push a la rama `main` activa automáticamente:

1. **Clone** del repositorio
2. **Install** de dependencias (`npm install`)
3. **Build** de Next.js (`npm run build`)
4. **Deploy** a producción
5. **Actualización** de la URL https://cafe-pi-steel.vercel.app

### Deployment Manual

Si necesitas hacer un deployment manual:

1. Ve a https://vercel.com/alvaros-projects-0e720e49/cafe
2. Click en "Deployments"
3. Click en "Redeploy" en el último deployment exitoso
4. Desmarca "Use existing Build Cache"
5. Click "Redeploy"

## 🐛 Troubleshooting

### Error: "DEPLOYMENT_NOT_FOUND"

**Causa:** El proyecto no existe o fue eliminado.

**Solución:**
1. Reimporta el proyecto desde GitHub
2. Asegúrate de dar permisos a Vercel en GitHub
3. URL: https://github.com/settings/installations

### Error: "Build Failed - npm install exited with 1"

**Causa:** Dependencias con versiones incompatibles.

**Solución:**
1. Verifica que `package.json` tenga versiones válidas
2. Revisa los Build Logs en Vercel para ver qué paquete falló
3. Arregla la versión y haz push

### Error: "TypeScript errors"

**Causa:** Errores de tipo en el código.

**Solución:**
1. Ejecuta localmente: `npx tsc --noEmit`
2. Corrige los errores de TypeScript
3. Haz push de los cambios

### Error: "Missing environment variables"

**Causa:** Variables de entorno no configuradas en Vercel.

**Solución:**
1. Ve a Settings → Environment Variables
2. Agrega las variables necesarias
3. Redeploy el proyecto

## 📊 Monitoreo

### Ver Logs de Deployment

1. Ve a https://vercel.com/alvaros-projects-0e720e49/cafe/deployments
2. Click en el deployment que quieres revisar
3. Revisa las secciones:
   - Build Logs
   - Runtime Logs
   - Deployment Summary

### Ver Métricas

1. Ve al proyecto en Vercel
2. Click en "Analytics" (requiere plan Pro)
3. O usa Vercel CLI: `vercel logs [deployment-url]`

## 🔐 Permisos de GitHub

### Verificar Permisos

1. Ve a https://github.com/settings/installations
2. Busca "Vercel"
3. Click en "Configure"
4. Verifica que tenga acceso al repositorio "alvarettosky/cafe"

### Actualizar Permisos

Si Vercel no puede acceder al repositorio:

1. En GitHub Settings → Installations → Vercel
2. Repository access → Select repositories
3. Agrega "cafe"
4. Save

## 🚀 Deployment desde CLI (Opcional)

### Instalar Vercel CLI

```bash
npm i -g vercel
```

### Login

```bash
vercel login
```

### Deploy

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

## 📝 Notas Importantes

- ✅ El Root Directory debe estar **vacío** o ser `.`
- ✅ **NO** usar `frontend/` como Root Directory (el directorio fue movido a la raíz)
- ✅ Las Environment Variables deben estar configuradas en **todos** los entornos
- ✅ El proyecto usa Next.js 16.1.2 con Turbopack
- ✅ Node.js version: 24.x (configurado en Vercel)

## 🔗 Links Útiles

- **Dashboard de Vercel:** https://vercel.com/alvaros-projects-0e720e49/cafe
- **Repositorio GitHub:** https://github.com/alvarettosky/cafe
- **Documentación Vercel:** https://vercel.com/docs
- **Supabase Dashboard:** https://supabase.com/dashboard/project/inszvqzpxfqibkjsptsm

## 📧 Soporte

Si encuentras problemas:

1. Revisa los Build Logs en Vercel
2. Verifica que las Environment Variables estén configuradas
3. Asegúrate de que el código compile localmente (`npm run build`)
4. Consulta la documentación oficial de Vercel

---

**Última actualización:** Deployment exitoso con commit `e5d629e`
