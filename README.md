# Café Mirador — Sistema de Gestión Integral

[![Deploy](https://img.shields.io/badge/deploy-vercel-black)](https://cafe-pi-steel.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)](https://supabase.com)

Sistema de gestión para **Mirador Montañero Café Selecto**: venta de café por
libra y media libra, CRM con recurrencia de clientes, portal de autoservicio y
programa de referidos. Desplegado en producción sobre Next.js + Supabase.

- **Demo en producción:** <https://cafe-pi-steel.vercel.app>
- **Repositorio:** <https://github.com/alvarettosky/cafe> — **público**
- **Última actualización de este documento:** 2026-07-27

> ⚠️ **No hay entorno de staging.** Un push a `main` va directo a producción.

## Objetivo

Dejar Café Mirador con código modularizado, documentación de gestión completa
y verificable, y orquestadores (`CLAUDE.md`, `.claude/`, `docs/`) sincronizados
con lo que el código realmente hace — sin romper la app en producción.

| #   | Objetivo específico                                 | Estado            |
| --- | --------------------------------------------------- | ----------------- |
| OE1 | Modularizar el código                               | ✅                |
| OE2 | Restyle con el design system                        | ✅                |
| OE3 | Versionar el design system                          | ✅ (repo privado) |
| OE4 | Escribir los 4 documentos de gestión                | ✅                |
| OE5 | Llevar la documentación al estado real              | 🚧                |
| OE6 | Cablear los orquestadores (`CLAUDE.md`, `.claude/`) | 🚧                |
| OE7 | Comando `/validate` funcionando                     | ✅                |
| OE8 | Documentación oficial de librerías vía context7     | 🚧 (1 de 4)       |

## Aviso de seguridad

Este repositorio es **público**. No debe entrar aquí ningún dato real de
clientes (nombres, teléfonos, direcciones, historial de compras): ese
histórico vive en el repositorio privado `alvaretto/proyectos-varios`. Detalle
completo en [`docs/BLUEPRINT.md` §5](docs/BLUEPRINT.md#5-estado-de-despliegue).

Producción usa las claves nuevas de Supabase (`sb_publishable_…` en el
cliente, `sb_secret_…` en servidor/CI). Las claves legacy tipo JWT (`anon` /
`service_role`) están **desactivadas** desde el 2026-07-27, tras una fuga
corregida — ver [`docs/BACKLOG.md`](docs/BACKLOG.md) §«P0-SEC».

## Documentación

| Documento                                                            | Qué responde                                                                                       |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md)                             | **Por qué** el sistema es así: decisiones de arquitectura y contratos no protegidos por TypeScript |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)                                 | **Qué** se entregó, el estado medido y el siguiente paso vigente                                   |
| [`docs/BACKLOG.md`](docs/BACKLOG.md)                                 | Pendientes clasificados [A]/[B]/[C]. **§D lista lo ya cerrado con su motivo**                      |
| [`docs/SYLLABUS.md`](docs/SYLLABUS.md)                               | Ruta de lectura en 8 módulos para entrar al proyecto sin contexto                                  |
| [`CLAUDE.md`](CLAUDE.md)                                             | Referencia operativa: comandos, esquema de datos, convenciones de código                           |
| [`FICHA_TECNICA.md`](FICHA_TECNICA.md)                               | Cuentas, stack y métricas del proyecto                                                             |
| [`INSTRUCCIONES.md`](INSTRUCCIONES.md)                               | Guía de inicio rápido                                                                              |
| [`manual-de-usuario-no-tecnico.md`](manual-de-usuario-no-tecnico.md) | Cómo **usar** el sistema día a día — para quien vende, no para quien programa                      |
| [`.claude/commands/validate.md`](.claude/commands/validate.md)       | Comando `/validate`: las 5 fases de verificación, en orden                                         |
| [`docs/testing/`](docs/testing/)                                     | Guías de testing y CI/CD                                                                           |

## Funcionalidades

- Dashboard en tiempo real con KPIs de inventario y ventas
- Punto de venta (POS) con gestión de productos e inventario
- CRM con recurrencia calculada por cliente y segmentación RFM automática
- Sistema de contactos con alertas por urgencia y mensajes de WhatsApp contextuales
- Analytics: ventas, inventario y tendencias por rango de fechas
- Aprobación manual de usuarios nuevos, controlada por admin
- Portal de cliente self-service: pedidos, suscripciones y referidos, sin contraseña (magic link por WhatsApp)
- Programa de referidos con códigos y recompensas configurables
- Listas de precios diferenciadas por tipo de cliente
- Zonas de entrega con reparto agrupado por día
- Kardex de inventario con trazabilidad completa de movimientos
- Productos con variantes (SKU, presentación, tipo de molido)
- Exportación CSV/XLSX y backups automáticos diarios a Supabase Storage

El porqué de varias de estas decisiones (RPC en la base de datos, RLS en vez
de control en el frontend, portal sin contraseña, recurrencia calculada y no
declarada) está en [`docs/BLUEPRINT.md` §2](docs/BLUEPRINT.md#2-decisiones-de-arquitectura).

## Tecnologías

**Frontend:** Next.js 16 (App Router) · React 19 · TypeScript 5 · TailwindCSS 4
· Framer Motion · Radix UI · Recharts

**Backend:** Supabase — PostgreSQL con RLS, funciones RPC para la lógica que
toca varias tablas, autenticación integrada.

**Testing:** Vitest + Testing Library (unit/integración) · Playwright (E2E) ·
MSW (mocks de API) · Stryker (mutation testing) · k6 (carga)

## Requisitos previos

1. **Node.js**: el proyecto pasa lint, `tsc`, los 893 tests unitarios y el
   build con el Node del sistema — verificado con v26.4.0 el 2026-07-27. No
   hace falta ningún entorno aislado.
2. **Supabase**: proyecto configurado (ver [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md)).

## Cómo ejecutar localmente

```bash
npm install                 # Instalar dependencias
```

Crea `.env.local` en la raíz con tus credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-publica
```

```bash
npm run dev                 # Servidor de desarrollo → http://localhost:3000
```

## Testing

**Estado medido el 2026-07-27** (fuente: [`docs/ROADMAP.md`](docs/ROADMAP.md)):

| Indicador       | Valor                                                                           |
| --------------- | ------------------------------------------------------------------------------- |
| Tests unitarios | **893 en 41 archivos, todos en verde**                                          |
| Cobertura       | Líneas 93,15 % · Sentencias 91,31 % · Ramas 87,81 % · Funciones 88,38 %         |
| Umbral exigido  | 80 % en las cuatro métricas (`vitest.config.mts`)                               |
| Tests E2E       | **23 en verde × 3 navegadores** (chromium, firefox, webkit), en el CI de GitHub |

```bash
# Unit e integración
npm test                    # Ejecutar todos los tests
npm run test:coverage       # Con reporte de cobertura
npm run test:watch          # Modo watch
npm run test:ui             # Interfaz UI interactiva

# E2E
npx playwright test         # Todos los navegadores
npx playwright test --ui    # Modo UI interactivo

# Avanzado
npm run test:mutation       # Mutation testing (Stryker)
npm run test:db             # Tests de integración con base de datos real
npm run test:load           # Load testing (k6)
```

**Regla:** nunca ajustar un mock para que un test pase. Si el mock y el
código real discrepan, uno de los dos está mal — ver el precedente en
[`docs/BLUEPRINT.md` §3](docs/BLUEPRINT.md#3-contratos-que-typescript-no-protege).

### Validación completa: `/validate`

El comando [`.claude/commands/validate.md`](.claude/commands/validate.md)
ejecuta cinco fases en orden y se detiene en la primera que falla: lint →
tipos (`tsc`) → formato → tests unitarios con cobertura → build de
producción.

### CI/CD

- **Pre-commit**: lint con auto-fix, formato, type-check y tests relacionados con los archivos modificados (Husky + lint-staged)
- **On push**: pipeline completo (lint, tests, type-check, build)
- **Nightly / E2E**: tests de mutación, carga y Playwright

## Cómo desplegar (Vercel)

1. Importa el repositorio en [Vercel](https://vercel.com).
2. Configura las variables de entorno: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Despliega. Cada push a `main` redespliega automáticamente.

## Estructura del proyecto

```
cafe-repo/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Dashboard principal
│   ├── analytics/                # Analytics
│   ├── clientes/                 # Gestión de clientes
│   ├── contactos/                # Lista de contacto
│   ├── login/                    # Autenticación staff
│   ├── pendiente/                # Espera de aprobación
│   ├── ventas/nueva/             # Nueva venta
│   ├── precios/                  # Listas de precios (admin)
│   ├── backups/                  # Exportación y backups (admin)
│   └── portal/                   # Portal de cliente self-service
├── components/                   # Componentes React
│   ├── ui/                       # Componentes base (Radix UI)
│   └── charts/                   # Gráficas (Recharts)
├── context/                      # Providers de React (auth, portal de cliente)
├── lib/                          # Utilidades (cliente Supabase, exportación)
├── types/                        # Tipos TypeScript, uno por dominio
│   ├── index.ts                  # Dashboard, ítems de venta
│   ├── analytics.ts              # Métricas y series temporales
│   ├── customer-recurrence.ts    # Cliente completo con recurrencia
│   ├── inventory.ts              # Kardex, resumen de inventario
│   ├── products.ts               # Catálogo padre/variantes
│   ├── portal.ts                 # Tipos del portal de cliente
│   ├── sales.ts                  # Opciones de cliente para venta
│   ├── backups.ts                # Contrato de la API de backups
│   ├── referrals.ts              # Referidos (Admin* vs Portal*)
│   └── deliveries.ts             # Zonas y entregas
├── supabase/                     # migrations/ y seed.sql
├── docs/                         # Documentación de gestión (BLUEPRINT, ROADMAP, BACKLOG, SYLLABUS)
├── tests/                        # Tests de integración con base de datos
├── e2e/                          # Tests E2E (Playwright)
├── .claude/                      # Configuración de Claude Code (comandos, CLAUDE.md)
└── README.md                     # Este archivo
```

Convención de nombres de tipos y por qué el prefijo indica el universo del
dato (`Admin*` vs `Portal*`), no el archivo consumidor:
[`docs/BLUEPRINT.md` §4](docs/BLUEPRINT.md#4-estructura-de-tipos).

## Base de datos (Supabase)

El esquema completo — tablas, vistas, funciones RPC y políticas RLS — está
documentado en [`CLAUDE.md` §Base de Datos](CLAUDE.md#base-de-datos-supabase),
que es la única copia: mantener una segunda lista aquí garantizaría que una de
las dos quedara obsoleta, que es justo lo que le pasó a este documento con
`customer_tokens`/`subscriptions` (las tablas reales son `customer_auth` y
`customer_subscriptions`) y con los nombres de las RPC del portal de cliente.

La lógica que toca varias tablas vive en funciones RPC de PostgreSQL, no en el
frontend, y la autorización se aplica con RLS — el porqué está en
[`docs/BLUEPRINT.md` D1 y D2](docs/BLUEPRINT.md#2-decisiones-de-arquitectura).

## Roadmap

El roadmap vive en un solo lugar: [`docs/ROADMAP.md`](docs/ROADMAP.md). Es la
**fuente de verdad** sobre qué fases están entregadas y qué sigue —
mantener una segunda lista aquí ya produjo una contradicción real (esta
sección llamaba «Fase 5» a Backups mientras el ROADMAP oficial usa ese mismo
número para Consolidación de deuda técnica).

## Contribución

El repositorio es **público**, pero el proyecto es de uso interno para
**Mirador Montañero Café Selecto**. Si encuentras un bug o tienes una
sugerencia:

1. Crea un issue en GitHub.
2. Describe el problema o la solicitud, con capturas si aplica.

Antes de proponer un cambio, lee [`docs/BACKLOG.md` §D](docs/BACKLOG.md#d--cerrado-y-por-qué) — lo que ya se decidió y por qué.

---

**Stack:** Next.js 16 · TypeScript · Supabase · TailwindCSS
**Deploy:** Vercel
**Última actualización:** 2026-07-27
