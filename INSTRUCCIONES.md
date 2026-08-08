# 📖 Instrucciones del Proyecto - Café Mirador

> **Cómo poner a andar el sistema, comandos del día a día y qué hacer cuando
> algo falla.** El qué es y el por qué de las decisiones de arquitectura viven
> en [`CLAUDE.md`](CLAUDE.md) y [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md); la
> ficha del proyecto (cuentas, stack, métricas) vive en
> [`FICHA_TECNICA.md`](FICHA_TECNICA.md). Si nunca has visto el proyecto,
> empieza por [`docs/SYLLABUS.md`](docs/SYLLABUS.md).

---

## 🎯 ¿Qué es este proyecto?

Sistema de gestión para **venta de café por libras y medias libras** que incluye:

- 📊 **Dashboard en tiempo real** - KPIs, inventario, ventas
- ☕ **Ventas** - Registro de ventas por libra (500g) y media libra (250g)
- 🛒 **Tienda Online** - Portal self-service para clientes con pedidos y suscripciones
- 👥 **CRM con recurrencia** - Predicción de compras recurrentes por cliente
- 🗣️ **Voz a Voz** - Programa de referidos con códigos únicos
- 📞 **Sistema de contactos** - Alertas WhatsApp para contactar clientes
- 📈 **Analytics** - Gráficas y métricas de rendimiento

**Producción**: https://cafe-pi-steel.vercel.app (deploy automático al push a `main`, sin staging)

---

## 🚀 Inicio Rápido

### 1. Requisitos Previos

- **Node.js v20+** — verificado con v26.4.0 el 2026-07-27; cualquier versión 20 o superior sirve
- **Cuenta Supabase** con proyecto configurado
- **Git** instalado

### 2. Configuración Inicial

```bash
# 1. Clonar repositorio
git clone https://github.com/alvarettosky/cafe.git
cd cafe

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
# Crear archivo .env.local en la raíz con:
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-publishable

# 4. Configurar base de datos
# Seguir pasos en SUPABASE_SETUP.md para ejecutar migraciones

# 5. Iniciar servidor de desarrollo
npm run dev
# Abrir http://localhost:3000
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` es la clave **publishable** (`sb_publishable_…`)
del dashboard de Supabase, no el JWT legacy `anon` (desactivado desde
2026-07-27). Detalle en [`FICHA_TECNICA.md`](FICHA_TECNICA.md#variables-de-entorno-requeridas).

> **Nota sobre `setup_env.sh`.** Existió un entorno Node aislado en
> `.node_env/` que era obligatorio activar en cada terminal. Ya no aplica: el
> directorio no existe, y lint, `tsc`, los tests y el build pasan con el Node
> del sistema. El script se conserva por si hace falta fijar versión en una
> máquina con un Node antiguo, pero el paso 2 de arriba (activarlo) ya no es
> necesario.

Los tests **no** necesitan `.env.local`: Supabase está mockeado con MSW
(`__mocks__/handlers.ts`). Solo hace falta para levantar la app de verdad.

---

## 📋 Comandos del Día a Día

### Desarrollo

```bash
npm run dev              # Servidor desarrollo (localhost:3000)
npm run build            # Build de producción (21 rutas)
npm start                # Servidor producción local
```

### Testing

```bash
# Unitarios e integración (Vitest)
npm test                    # Todos los tests (893 en 41 archivos)
npm run test:coverage       # Con reporte de cobertura (umbral 80% en líneas/sentencias/ramas/funciones)
npm run test:watch          # Modo watch (desarrollo)
npm run test:ui             # Interfaz UI interactiva
npm run test:coverage:watch # Cobertura en modo watch
npm run test:ci             # Cobertura + reporte verbose/json/html (el que corre en CI)
npm run test:db             # Tests de integración con base de datos (requiere .env.local)

# E2E (Playwright)
npx playwright test      # Todos los navegadores (chromium, firefox, webkit)
npx playwright test --ui # Modo UI interactivo

# Avanzados — no son para cada cambio, ver docs/testing/
npm run test:mutation    # Mutation testing con Stryker (minutos, no segundos)
npm run test:load        # Load testing con k6
npm run test:spike       # Spike testing con k6
npm run test:soak        # Soak testing con k6
```

### Calidad de Código

```bash
npm run lint             # ESLint (detectar problemas)
npm run format            # Prettier — escribe en TODO el repo (evitar en un cambio funcional puntual, ver abajo)
npm run format:check     # Verificar formato
```

⚠️ **No corras `npm run format` sobre todo el repo dentro de un cambio
funcional.** El repositorio tiene una línea base de archivos sin formatear
(ver [`docs/BACKLOG.md`](docs/BACKLOG.md) A13); reformatearlo entero sepulta
el diff que de verdad importa. Para formatear solo lo que tocaste:
`npx prettier --write <archivos>`.

### Backup manual

```bash
npm run backup            # Ejecuta scripts/backup/run-backup.ts (requiere SUPABASE_SERVICE_ROLE_KEY en .env.local)
```

### Git

```bash
git add <archivos>       # Nunca "git add -A": el repo es público, no puede llevarse datos de clientes por accidente
git commit -m "mensaje"  # Pre-commit hook automático (lint-staged) se ejecuta
git push origin main     # Deploy automático en Vercel — no hay entorno de staging
```

---

## ✅ Antes de dar por buena una tarea

Correr `/validate` ([`.claude/commands/validate.md`](.claude/commands/validate.md)),
que ejecuta en orden y se detiene en la primera fase roja:

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm run format:check`
4. `npm test` (y `npm run test:coverage`)
5. `npm run build`

`tsc` en verde **no** significa que todo esté cubierto: no protege los
contratos que cruzan procesos (RPC de Supabase, respuestas HTTP, datos de
mock). Ver [`docs/BLUEPRINT.md` §3](docs/BLUEPRINT.md#3-contratos-que-typescript-no-protege).

---

## 🔄 Flujo de Trabajo

### Para Nueva Funcionalidad

1. **Planificar**
   - ¿Requiere cambios en DB? → Crear migración SQL en `supabase/migrations/`
   - ¿Requiere nuevos tipos? → Actualizar `types/` (un tipo por forma, ver [`docs/BLUEPRINT.md` §4](docs/BLUEPRINT.md#4-estructura-de-tipos))
   - ¿Es grande? → Considerar worktree

2. **Implementar**

   ```bash
   # Si usas worktree
   git worktree add .worktrees/nombre-feature nombre-branch
   cd .worktrees/nombre-feature
   npm install

   # Desarrollo normal
   npm run dev
   ```

3. **Testing**
   - Escribir tests (unit + integration)
   - Correr `/validate` antes de dar por cerrada la tarea

4. **Commit & Deploy**
   ```bash
   git add <archivos>
   git commit -m "feat: descripción del cambio"  # Pre-commit hook se ejecuta
   git push origin main  # Deploy automático en Vercel
   ```

### Para Bug Fix

1. **Reproducir** el error en `npm run dev`
2. **Verificar**:
   - Console del navegador (F12)
   - Terminal de Next.js
   - Errores de Supabase (RLS, RPCs) — revisar `get_logs`/`get_advisors` si tienes el MCP de Supabase
   - Orden de hooks en componentes (ver Errores Comunes en [`CLAUDE.md`](CLAUDE.md#errores-comunes-a-evitar))
3. **Fix** → Test → Commit
   ```bash
   git commit -m "fix: descripción del bug corregido"
   ```

### Para Cambios de Base de Datos

1. Crear archivo SQL en `supabase/migrations/XXX_nombre.sql`
2. Ejecutar en Supabase SQL Editor (dashboard)
3. Actualizar `SUPABASE_SETUP.md`
4. Actualizar tipos TypeScript si cambiaron tablas
5. Documentar RPCs nuevas con parámetros y return type en [`CLAUDE.md`](CLAUDE.md)

---

## 🆘 Dónde mirar cuando algo falla

**"Module not found"**

```bash
rm -rf node_modules package-lock.json
npm install
```

**"Supabase client error"**

- Verificar que `.env.local` existe y tiene las variables correctas
- Verificar que importas de `@/lib/supabase` (no de `@/lib/supabase/client`)

**"RLS policy violation"**

- Verificar que el usuario está autenticado y aprobado (`profiles.approved`)
- Verificar rol en `profiles` — solo `admin` puede editar inventario

**Tests fallando en pre-commit**

```bash
# Ejecutar tests manualmente
npm test

# Si es urgente, saltarse hook (NO RECOMENDADO)
git commit --no-verify -m "mensaje"
```

**Un test falla justo después de tocar un tipo compartido**

Sospecha primero del _mock_ (`__mocks__/handlers.ts`), no del código. Es el
patrón exacto que rompió los enlaces de descarga de backups — precedente en
`git show 5ce639e` y en [`docs/BLUEPRINT.md` §3](docs/BLUEPRINT.md#3-contratos-que-typescript-no-protege).

**Nada de esto lo resuelve**

Revisar [`docs/BACKLOG.md`](docs/BACKLOG.md) — puede que ya esté diagnosticado
ahí, con causa raíz y estado. Leer **§D antes de proponer un fix**: lista lo
ya cerrado y por qué, para no volver a proponerlo.

### Contacto

Para bugs o sugerencias: crear issue en GitHub, incluir screenshots si aplica
y describir pasos para reproducir.

---

## 📚 Documentación Relacionada

| Archivo                                        | Descripción                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| [`FICHA_TECNICA.md`](FICHA_TECNICA.md)         | Qué es, stack con versiones, cuentas y servicios, métricas medidas   |
| [`CLAUDE.md`](CLAUDE.md)                       | Guía técnica para Claude Code (arquitectura, comandos, convenciones) |
| [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md)       | Por qué el sistema es así — decisiones de arquitectura               |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)           | Qué se entregó y el siguiente paso vigente                           |
| [`docs/BACKLOG.md`](docs/BACKLOG.md)           | Pendientes clasificados y lo ya cerrado (§D)                         |
| [`docs/SYLLABUS.md`](docs/SYLLABUS.md)         | Ruta de lectura para entrar al proyecto sin contexto                 |
| [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md)       | Configuración y migraciones de base de datos                         |
| [`VERCEL_DEPLOYMENT.md`](VERCEL_DEPLOYMENT.md) | Configuración de deploy en Vercel                                    |
| [`docs/testing/`](docs/testing/)               | Guías de testing detalladas                                          |

---

**Última actualización**: 2026-07-27

**Desarrollado para Mirador Montañero Café Selecto**
