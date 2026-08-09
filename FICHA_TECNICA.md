# Ficha Técnica del Proyecto

> Qué es, con qué stack corre, qué cuentas usa y qué se midió. El cómo ponerlo
> a andar y operarlo día a día vive en [`INSTRUCCIONES.md`](INSTRUCCIONES.md).

## Información General

| Campo                   | Valor                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nombre del Proyecto** | Café Mirador CRM                                                                                                                                          |
| **Descripción**         | Sistema de gestión para venta de café por libras y medias libras, con tienda online, programa de referidos (voz a voz), y gestión de clientes recurrentes |
| **Versión**             | 0.1.0                                                                                                                                                     |
| **Estado**              | En producción                                                                                                                                             |
| **Licencia**            | Repositorio público sin archivo `LICENSE` (no hay licencia abierta declarada)                                                                             |

## Fechas

| Evento                   | Fecha               |
| ------------------------ | ------------------- |
| **Inicio del proyecto**  | 16 de enero de 2026 |
| **Última actualización** | 27 de julio de 2026 |

## Cuentas y Accesos

### GitHub

| Campo           | Valor                                 |
| --------------- | ------------------------------------- |
| **Usuario**     | alvarettosky                          |
| **Correo**      | alvaroangelm@iepedacitodecielo.edu.co |
| **Repositorio** | https://github.com/alvarettosky/cafe  |
| **Visibilidad** | **Público**                           |

⚠️ El repositorio es público. Ningún dato real de clientes puede entrar aquí:
el histórico de ventas con nombres vive en el repositorio privado
`alvaretto/proyectos-varios`. Detalle en
[`docs/BLUEPRINT.md` §5](docs/BLUEPRINT.md#5-estado-de-despliegue).

### Supabase

| Campo        | Valor                                    |
| ------------ | ---------------------------------------- |
| **Proyecto** | cafe-de-salento                          |
| **URL**      | https://inszvqzpxfqibkjsptsm.supabase.co |
| **Región**   | us-east-1 (North Virginia)               |
| **Plan**     | Free Tier                                |
| **Correo**   | alvaroangelm@iepedacitodecielo.edu.co    |

### Vercel (Deploy)

| Campo                 | Valor                                                   |
| --------------------- | ------------------------------------------------------- |
| **Usuario**           | alvaroangelm-1068                                       |
| **Correo**            | alvaroangelm@iepedacitodecielo.edu.co                   |
| **URL Producción**    | https://cafe-pi-steel.vercel.app                        |
| **Branch de deploy**  | main                                                    |
| **Deploy automático** | Sí (en cada push a main)                                |
| **Staging**           | No existe: push a `main` despliega directo a producción |

## Stack Tecnológico

### Frontend

| Tecnología    | Versión  | Propósito                       |
| ------------- | -------- | ------------------------------- |
| Next.js       | 16.1.2   | Framework React con App Router  |
| React         | 19.2.3   | Librería UI                     |
| TypeScript    | ^5       | Tipado estático (strict mode)   |
| TailwindCSS   | 4        | Estilos                         |
| Framer Motion | ^12.26.2 | Animaciones                     |
| Radix UI      | ^1.1.15  | Componentes accesibles (Dialog) |
| Lucide Icons  | ^0.562.0 | Iconografía                     |
| Recharts      | ^2.15.0  | Gráficos y visualizaciones      |

### Backend

| Tecnología   | Versión | Propósito                                                                                                                                                                         |
| ------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase     | ^2.90.1 | Base de datos PostgreSQL, Auth, RLS, Storage                                                                                                                                      |
| Supabase RPC | —       | Lógica de negocio (`process_coffee_sale`, etc.). Por qué vive ahí: [`docs/BLUEPRINT.md` D1](docs/BLUEPRINT.md#d1--la-lógica-de-negocio-vive-en-la-base-de-datos-no-en-el-cliente) |

### Testing

| Herramienta     | Versión | Propósito                                                 |
| --------------- | ------- | --------------------------------------------------------- |
| Vitest          | ^4.0.17 | Tests unitarios e integración                             |
| Testing Library | ^16.3.1 | Tests de componentes React                                |
| Playwright      | ^1.48.2 | Tests E2E                                                 |
| Stryker         | ^9.5.1  | Mutation testing                                          |
| k6              | —       | Load testing (binario externo, no está en `package.json`) |
| MSW             | ^2.6.8  | Mock de APIs                                              |

### CI/CD

| Servicio       | Propósito                                                                  |
| -------------- | -------------------------------------------------------------------------- |
| GitHub Actions | 6 workflows: lint/tests/build, E2E, cobertura, backup, nightly, keep-alive |
| Vercel         | Deploy automático                                                          |
| Husky          | ^9.0.11 — Git hooks (pre-commit)                                           |

## Métricas del Proyecto

Medido el 2026-07-27 con `npm test`, `npm run test:coverage` y el run de CI del
merge (ver [`docs/ROADMAP.md`](docs/ROADMAP.md) para el detalle completo).

| Métrica               | Valor                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Tests unitarios**   | 889 en 41 archivos, todos en verde (~9,5 s)                                                                  |
| **Cobertura**         | Líneas 93,15 % · Sentencias 91,31 % · Ramas 87,81 % · Funciones 88,38 % (umbral exigido: 80 % en las cuatro) |
| **Tests E2E**         | 23 × 3 navegadores (chromium, firefox, webkit), verdes en CI                                                 |
| **Build**             | 21 rutas: 18 estáticas + 3 dinámicas (`app/api/`)                                                            |
| **Tablas en BD**      | 21                                                                                                           |
| **RPCs documentadas** | 43 (listado completo en [`CLAUDE.md`](CLAUDE.md))                                                            |

## Fases de Desarrollo

| Fase | Nombre                         | Estado        |
| ---- | ------------------------------ | ------------- |
| 1    | Maximizar Recurrencia          | ✅ Completado |
| 2    | Portal de Cliente Self-Service | ✅ Completado |
| 3    | Crecimiento y Escalabilidad    | ✅ Completado |
| 4    | Arquitectura POS Profesional   | ✅ Completado |

Fase 5 (consolidación de deuda técnica) está en curso — ver
[`docs/ROADMAP.md`](docs/ROADMAP.md).

## Funcionalidades Principales

- **Inventario**: Gestión de café con stock en kg, alertas de stock bajo, Kardex de movimientos
- **Ventas**: Venta por libras (500g) y medias libras (250g), múltiples métodos de pago, variantes (presentación, tipo de molido)
- **Clientes recurrentes**: Predicción de próxima compra basada en historial, segmentación RFM automática, contacto vía WhatsApp
- **Tienda Online (Portal)**: Acceso self-service con magic links, pedidos online, suscripciones automáticas de café
- **Voz a Voz (Referidos)**: Programa de referidos con códigos únicos, seguimiento y recompensas
- **Analytics**: Dashboard con KPIs, gráficos de ventas, métricas de profit
- **Precios diferenciados**: Listas de precios por tipo de cliente (retail, mayorista, cafetería)
- **Zonas de entrega**: Gestión de entregas a domicilio por zona y día
- **Exportación**: Backup a CSV/XLSX, backup automático diario a Supabase Storage

## Variables de Entorno Requeridas

### Desarrollo Local (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` es la clave **publishable** (`sb_publishable_…`)
del dashboard de Supabase, no el JWT legacy `anon`. Las claves legacy
(`anon`/`service_role`) están desactivadas desde 2026-07-27 — ver
[`docs/BACKLOG.md` §P0-SEC](docs/BACKLOG.md#-p0-sec--la-base-estaba-abierta-a-internet-cerrado-el-2026-07-27).

### GitHub Secrets (para CI/CD)

| Secret                          | Propósito                                                  | Requerido           |
| ------------------------------- | ---------------------------------------------------------- | ------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL del proyecto Supabase                                  | ✅                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave publishable (`sb_publishable_…`)                     | ✅                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | Clave secreta (`sb_secret_…`) para backups y scripts admin | ✅                  |
| `TEST_USER_EMAIL`               | Usuario de prueba para los E2E de Playwright               | ✅ (para `e2e.yml`) |
| `TEST_USER_PASSWORD`            | Contraseña del usuario de prueba E2E                       | ✅ (para `e2e.yml`) |
| `CODECOV_TOKEN`                 | Sube el reporte de cobertura (`coverage-report.yml`)       | Opcional            |
| `RESEND_API_KEY`                | Notificaciones por email                                   | Opcional            |
| `NOTIFICATION_EMAIL`            | Destinatario de alertas                                    | Opcional            |

**Nunca** escribir el valor real de una clave en este archivo ni en ningún
documento del repo público — solo el nombre de la variable y de dónde sacarla.

## Workflows Automáticos

| Workflow              | Disparador                                           | Propósito                                |
| --------------------- | ---------------------------------------------------- | ---------------------------------------- |
| `ci.yml`              | Push/PR a `main` o `develop`                         | Lint, tests, type-check, build           |
| `e2e.yml`             | Push/PR a `main` + diario 02:00 UTC (21:00 Colombia) | Tests E2E con Playwright (3 navegadores) |
| `coverage-report.yml` | Push/PR a `main`                                     | Genera y publica el reporte de cobertura |
| `daily-backup.yml`    | Diario 02:00 UTC (21:00 Colombia)                    | Backup completo a Supabase Storage       |
| `nightly.yml`         | Diario 03:00 UTC (22:00 Colombia)                    | Mutation testing y load testing          |
| `keep-alive.yml`      | Cada 5 días, 12:00 UTC (07:00 Colombia)              | Ping a Supabase para evitar la pausa     |

`keep-alive.yml` es el respaldo secundario, no el guardián principal: GitHub
deshabilita los workflows programados tras 60 días sin actividad en el repo,
que es justo cuando más falta hacen. El guardián real es un timer de systemd
en la máquina del desarrollador, externo a GitHub — ver
[`docs/BACKLOG.md` P0.4](docs/BACKLOG.md#p04--keep-alive-externo-a-github-resuelto-2026-07-27).

## Contacto y Soporte

| Canal             | Información                                 |
| ----------------- | ------------------------------------------- |
| **Desarrollador** | alvarettosky                                |
| **Email**         | alvaroangelm@iepedacitodecielo.edu.co       |
| **Issues**        | https://github.com/alvarettosky/cafe/issues |

## Documentación Relacionada

| Archivo                                                              | Descripción                                                            |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`README.md`](README.md)                                             | Presentación del proyecto                                              |
| [`CLAUDE.md`](CLAUDE.md)                                             | Guía técnica para Claude Code (arquitectura, comandos, convenciones)   |
| [`INSTRUCCIONES.md`](INSTRUCCIONES.md)                               | Guía de inicio rápido y flujo de trabajo del día a día                 |
| [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md)                             | Por qué el sistema es así (decisiones D1–D6, contratos sin protección) |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)                                 | Qué se entregó, estado medido y el siguiente paso vigente              |
| [`docs/BACKLOG.md`](docs/BACKLOG.md)                                 | Pendientes clasificados [A]/[B]/[C]/[D]                                |
| [`docs/SYLLABUS.md`](docs/SYLLABUS.md)                               | Ruta de lectura para entrar al proyecto sin contexto                   |
| [`manual-de-usuario-no-tecnico.md`](manual-de-usuario-no-tecnico.md) | Cómo usar el sistema — para quien vende, no para quien programa        |
| [`.claude/commands/validate.md`](.claude/commands/validate.md)       | Comando `/validate`: las 5 fases de verificación del codebase          |
| [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md)                             | Configuración y migraciones de base de datos                           |
| [`VERCEL_DEPLOYMENT.md`](VERCEL_DEPLOYMENT.md)                       | Configuración de deploy en Vercel                                      |
| [`docs/testing/`](docs/testing/)                                     | Guías de testing (estrategia, CI/CD, cómo escribir tests)              |

---

_Última actualización: 27 de julio de 2026_
