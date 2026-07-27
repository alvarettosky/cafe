# BACKLOG — Café Mirador CRM

Pendientes reales, clasificados por lo que hace falta para cerrarlos.
Sustituye a `.claude/TODO.md`, que queda como puntero.

- **Última verificación contra el código:** 2026-07-27
- **Documentos hermanos:** [BLUEPRINT](BLUEPRINT.md) · [ROADMAP](ROADMAP.md) · [SYLLABUS](SYLLABUS.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)

## Clasificación

| Clase   | Significado                                                         |
| ------- | ------------------------------------------------------------------- |
| **[A]** | Automatizable ahora: todo lo necesario está en el repo              |
| **[B]** | Requiere una fuente externa (cuenta, clave, aprobación de terceros) |
| **[C]** | Requiere juicio humano o una decisión de producto                   |
| **[D]** | Bloqueado por una dependencia                                       |

---

## A — Automatizable ahora

| #   | Pendiente                                                         | Notas                                                                                                                                            |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | Warnings de accesibilidad en `Dialog` (falta `Description`)       | Radix los emite en consola; 10 warnings de ESLint conviven aparte                                                                                |
| A2  | Modo oscuro/claro con toggle                                      | Hoy el dark es fijo (`<html className="dark">`)                                                                                                  |
| A3  | Accesibilidad: etiquetas ARIA y navegación por teclado            |                                                                                                                                                  |
| A4  | Caché de consultas frecuentes                                     | El dashboard reconsulta en cada montaje                                                                                                          |
| A5  | Lazy loading de componentes pesados                               | `app/portal/suscripcion/page.tsx` son 707 líneas                                                                                                 |
| A6  | Optimización de imágenes                                          |                                                                                                                                                  |
| A7  | Service Worker / PWA                                              |                                                                                                                                                  |
| A8  | Dashboard de métricas de recurrencia                              | Los datos ya existen (`customer_segments`)                                                                                                       |
| A9  | Gráficas de predicción de ventas basadas en recurrencia           | Depende de A8 para no duplicar consultas                                                                                                         |
| A10 | Animaciones de transición                                         | framer-motion ya está en el proyecto                                                                                                             |
| A11 | Etiqueta «Ver en Drive» en `/backups`                             | **Es un fósil**: el almacenamiento es Supabase Storage desde la migración; ya no hay Drive. Cambiar el texto y su aserción en el test            |
| A12 | Homonimia pendiente: `Referral`, `ReferralStats` y `DeliveryZone` | Cada uno declarado 2 veces **con formas distintas** (portal vs admin). Mismo patrón que causó el bug `5ce639e`. Darles nombre propio en `types/` |

## B — Requiere fuente externa

| #   | Pendiente                                       | Qué falta exactamente                                                                                                                                                                 |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Integración con WhatsApp Business API           | Cuenta de WhatsApp Business + aprobación de Meta. Hoy la integración son enlaces `wa.me` generados                                                                                    |
| B2  | Monitoreo de errores con Sentry                 | Cuenta + DSN                                                                                                                                                                          |
| B3  | Analytics de producto (GA o Plausible)          | Cuenta + decidir cuál                                                                                                                                                                 |
| B4  | Verificación automática del contrato de las RPC | Necesita `.env.local` con credenciales de Supabase para generar tipos desde el esquema (`supabase gen types`). Ver [BLUEPRINT §3](BLUEPRINT.md#3-contratos-que-typescript-no-protege) |
| B5  | Ejecutar la suite E2E de Playwright             | Requiere navegadores instalados + servidor levantado. Los 7 tests existen pero **no se han ejecutado en esta verificación**                                                           |

## C — Requiere juicio humano

| #   | Pendiente                                       | La decisión                                                                                                                                             |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Notificaciones push / recordatorios automáticos | ¿Por qué canal? WhatsApp ya es el canal real; push web tiene adopción baja en este público                                                              |
| C2  | Tour guiado para nuevos usuarios                | Es contenido, no código                                                                                                                                 |
| C3  | `/login` no usa la paleta del design system     | Usa `zinc-950`/`emerald-500` de Tailwind, no el café `#A0522D`. ¿Deuda o decisión?                                                                      |
| C4  | Alias «cafe-maghela»                            | No existe en disco. ¿Es un renombre del proyecto o solo un alias conversacional?                                                                        |
| C5  | Dónde vive el design system a largo plazo       | Hoy en el repo privado `proyectos-varios`. Traerlo a `cafe-repo` lo haría público (no tiene datos sensibles) y lo pondría junto a la app que lo consume |

## D — Cerrado, y por qué

> **Leer esta sección antes de proponer algo.** Lo que está aquí ya se decidió;
> re-proponerlo cuesta el tiempo de volver a descartarlo.

| Qué                                                                 | Cuándo                 | Por qué se cerró así                                                                                                                                  |
| ------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enlaces de descarga de backups rotos                                | 2026-07-27 (`5ce639e`) | `BackupFile` duplicado; productor emitía `downloadUrl`, consumidor leía `webViewLink`. Tipo único en `types/backups.ts`                               |
| Fondo `/coffee-bg-dark.jpg` daba 404                                | 2026-07-27 (`bbf34f4`) | El asset nunca se commiteó. Se agregó el archivo, **no** se quitó la referencia                                                                       |
| `interface Product` ×7                                              | 2026-07-27 (`07ebdda`) | Tres formas distintas bajo un mismo nombre. Cada una con nombre propio en `types/`                                                                    |
| Regla `backups/` en `.gitignore`                                    | 2026-07-27 (`c7d9335`) | Sin anclar, sombreaba `app/backups/` y `app/api/backups/`; el paso «Applying modifications» de lint-staged fallaba en silencio. Anclada a `/backups/` |
| «Tests fallando en `.worktrees/customer-recurrence-sales-editing/`» | 2026-07-27             | **Afirmación fósil**: `git worktree list` muestra solo el principal y `.worktrees/` no existe. No hay nada que arreglar                               |
| Deprecation de Husky v9→v10                                         | 2026-07-27             | Eliminadas las dos líneas que fallarían en v10                                                                                                        |
| `/alinear-completo` como comando del proyecto                       | 2026-07-27             | Es del pipeline ICFES de otro proyecto. No aplica. Su lugar lo ocupa `/validate`                                                                      |
| Datos de ventas en este repositorio                                 | 2026-07-27             | El repo es **público** y el CSV tiene 53 clientes identificables. Viven en el repo privado `proyectos-varios`                                         |
| Node 20 vía `setup_env.sh`                                          | 2026-07-27             | `.node_env` no existe y todo (lint, tsc, 865 tests, build) pasa con node v26.4.0. El requisito era de enero                                           |

---

## Cómo se alimenta este backlog

1. Un pendiente entra **solo** si está escrito en el código, en un doc del repo o
   se descubrió como consecuencia directa de un trabajo (con su evidencia).
2. Al cerrarse, se mueve a **§D con el motivo**, no se borra.
3. Si un pendiente resulta ser una afirmación fósil, también va a §D — para que
   nadie lo vuelva a «arreglar».
