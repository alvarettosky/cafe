# Diseño de Deployment: Café Mirador en Vercel

**Fecha:** 2026-01-16
**Plataforma:** Vercel (vía CLI)
**Proyecto:** Café Mirador CRM (Next.js 16 + Supabase)

## Contexto

El proyecto Café Mirador es un sistema CRM con:
- Frontend: Next.js 16, TailwindCSS 4, Framer Motion
- Backend: Supabase (PostgreSQL, Auth, RLS)
- Repositorio: https://github.com/alvarettosky/cafe

El usuario prefiere Vercel sobre GitHub Pages por ser gratuito y más adecuado para Next.js con server-side rendering y API routes. Se utilizará el método de deployment vía CLI por preferencia del usuario.

## Objetivos

1. Deployar la aplicación Next.js a Vercel usando CLI
2. Configurar variables de entorno de Supabase de forma segura
3. Establecer deploys automáticos desde GitHub
4. Verificar que la autenticación y conexión con Supabase funcionen

## Enfoque Seleccionado: Deploy desde CLI de Vercel

**Por qué CLI vs Dashboard:**
- Usuario prefiere flujo de terminal
- Más rápido para usuarios con experiencia técnica
- Permite scripting futuro

## Arquitectura de Deployment

### Estructura del Proyecto
```
Cafe-Mirador/
├── frontend/              # Aplicación Next.js (se deploya)
│   ├── package.json
│   ├── next.config.ts
│   ├── app/
│   └── .env.local        # Solo local, NO se deploya
├── supabase/             # Migraciones (no se deployan)
└── src/                  # Backend tests (no se deployan)
```

**Root Directory en Vercel:** `frontend/`
Solo el contenido de `frontend/` se deploya a Vercel.

### Variables de Entorno

**Variables requeridas (Production):**
- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Clave anónima pública de Supabase

**Configuración:**
- Se configuran vía `vercel env add` después del primer deploy
- Se aplican a: Production, Preview, Development
- Nunca se commitean a git (están en `.gitignore`)

## Plan de Implementación

### Fase 1: Preparación del Entorno

**1.1 Instalación de Vercel CLI**
```bash
npm install -g vercel
```

**1.2 Autenticación**
```bash
vercel login
```
- Abre navegador automáticamente
- Login con GitHub
- Token guardado en `~/.vercel`

**1.3 Verificación de Estructura**
```bash
cd frontend
ls package.json next.config.ts  # Confirmar archivos existen
npm install                      # Si node_modules no existe
```

### Fase 2: Configuración del Proyecto

**2.1 Primer Deploy (Interactivo)**
```bash
vercel
```

Respuestas al wizard:
1. Set up and deploy? → **Yes**
2. Which scope? → **[Tu username]**
3. Link to existing project? → **No**
4. Project name? → **cafe-mirador** (o el que prefieras)
5. In which directory is your code located? → **./`**
6. Want to override settings? → **No**

**Detección automática:**
- Framework: Next.js
- Build Command: `npm run build`
- Output Directory: `.next`
- Development Command: `npm run dev`

**Resultado:**
- Crea directorio `.vercel/` (agregar a `.gitignore`)
- Deploy inicial (puede fallar/funcionar parcialmente sin variables)
- Preview URL generada

### Fase 3: Configuración de Variables de Entorno

**3.1 Agregar Variables**
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Pegar el valor cuando pida
# Seleccionar: Production, Preview, Development

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Pegar el valor cuando pida
# Seleccionar: Production, Preview, Development
```

**3.2 Verificar Variables**
```bash
vercel env ls
```

### Fase 4: Deploy Final a Producción

**4.1 Deploy con Variables**
```bash
vercel --prod
```

**Resultado esperado:**
- Build exitoso (2-3 minutos)
- Production URL: `cafe-mirador.vercel.app` (o similar)
- Preview URL también generada

**4.2 Verificación Post-Deploy**

Checklist:
- [ ] Abrir Production URL en navegador
- [ ] Verificar que carga página de login
- [ ] Intentar login con credenciales de Supabase
- [ ] Verificar que dashboard carga correctamente
- [ ] Abrir DevTools (F12) y revisar console por errores
- [ ] Verificar que no hay errores de CORS o Auth

### Fase 5: Configuración de Deploys Automáticos

**Auto-deploy desde GitHub:**
Vercel detecta automáticamente el repo vinculado y configura:
- Push a `main` → Deploy a Production
- Push a otras ramas → Preview Deploy
- Pull Requests → Preview Deploy con URL única

**No requiere configuración adicional** si el repo ya está en GitHub.

## Troubleshooting

### Error: "No se puede conectar a Supabase"
- Verificar variables con `vercel env ls`
- Confirmar que las URLs no tienen espacios ni caracteres extra
- Re-deployar: `vercel --prod`

### Error: "Build failed"
- Verificar que `npm run build` funciona localmente
- Revisar logs en terminal o dashboard de Vercel
- Verificar versiones de Node.js (Vercel usa Node 18+ por default)

### Rollback a versión anterior
```bash
vercel rollback
```

## Seguridad

- `.env.local` nunca se sube a git (ya en `.gitignore`)
- Variables de entorno en Vercel están encriptadas
- Anon key de Supabase es segura para uso público (RLS protege datos)
- No exponer Service Key en variables públicas (`NEXT_PUBLIC_*`)

## Costos

**Vercel Hobby (Gratuito):**
- 100 GB bandwidth/mes
- Deploys ilimitados
- Dominios `.vercel.app` incluidos
- Suficiente para proyectos personales/MVP

## Próximos Pasos Post-Deploy

1. Configurar dominio personalizado (opcional)
2. Configurar monitoring/analytics
3. Revisar límites de Supabase free tier
4. Considerar CI/CD adicional (tests en PRs)

## Referencias

- Vercel CLI Docs: https://vercel.com/docs/cli
- Next.js on Vercel: https://vercel.com/docs/frameworks/nextjs
- Supabase + Vercel: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
