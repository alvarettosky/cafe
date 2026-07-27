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

## 🚨 P0 — La base de datos de producción se congela el ~2026-07-29

**Estado verificado el 2026-07-27.** El proyecto Supabase **`cafe-de-salento`**
(`inszvqzpxfqibkjsptsm`) lleva ~85 días pausado. Supabase avisó por correo el
24-jul-2026 de que lo **congela permanentemente en 5 días**. Pasada esa fecha
**no se puede restaurar**: solo descargar los datos.

No es un riesgo futuro, ya se materializó: `inszvqzpxfqibkjsptsm.supabase.co`
**no resuelve en DNS**. La app lleva ~85 días sin backend. `/login` sigue
viéndose porque es una ruta prerenderizada, no porque funcione.

Que es el mismo proyecto de esta app está probado: el bundle servido en
<https://cafe-pi-steel.vercel.app> contiene ese host.

### Causa raíz

| #   | Cuándo      | Qué pasó                                                                                                                                                                                          |
| --- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 2026-02-03  | Último commit. El repositorio queda inactivo                                                                                                                                                      |
| 2   | ~2026-04-06 | GitHub deshabilita los workflows programados por inactividad del repo. `gh workflow list --all` los marca `disabled_inactivity`: Daily Backup, E2E Tests, Nightly Tests y **Keep Supabase Alive** |
| 3   | 2026-04-06  | Última ejecución de `keep-alive.yml`, el workflow que existía **exactamente para impedir esta pausa** (ping cada 5 días contra el umbral de 7 de Supabase)                                        |
| 4   | ~2026-04-30 | Supabase pausa el proyecto. Cuadra con los «85 días» del correo                                                                                                                                   |
| 5   | ~2026-07-29 | Congelación permanente                                                                                                                                                                            |

**El keep-alive no falló: lo apagaron.** Un guardián cuya ejecución depende de la
misma actividad que vigila no es un guardián. Mientras el repo tenga commits, el
ping sobra; en cuanto deja de tenerlos —el único caso en que hace falta— GitHub
lo desactiva.

**Agravante:** el último backup automático es del **2026-04-05** (Daily Backup
murió el mismo día que el resto) y vive **dentro del proyecto congelable**. No
existe copia externa más reciente.

### Acciones

| #    | Acción                                                                                 | Clase   | Notas                                                                                                                                                     |
| ---- | -------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0.1 | **Restaurar el proyecto desde <https://supabase.com/dashboard>** antes del 29-jul-2026 | **[B]** | Requiere la sesión de Supabase del dueño. Es la única acción con fecha límite                                                                             |
| P0.2 | Descargar los datos como respaldo externo, restaure o no                               | **[B]** | Ídem                                                                                                                                                      |
| P0.3 | Reactivar los 4 workflows (`gh workflow enable`)                                       | **[B]** | Bloqueado: la cuenta autenticada es `alvaretto` y el repo es de `alvarettosky` (403)                                                                      |
| P0.4 | Romper la circularidad del keep-alive                                                  | **[C]** | Opciones: disparador externo a GitHub (cron propio, cron-job.org), plan Pro de Supabase (sin pausa por inactividad), o un commit programado. Decidir cuál |
| P0.5 | Que el backup deje una copia **fuera** de Supabase                                     | **[C]** | Un backup alojado en el sistema del que protege no protege de la pérdida de ese sistema                                                                   |

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

### A13 — Formatear el repositorio completo

`npm run format:check` reporta **137 archivos** con diferencias de estilo
(medido 2026-07-27 sobre `main`). El repo nunca se formateó entero: prettier
solo corre sobre los archivos que toca cada commit, vía lint-staged.

No es cosmético del todo: mientras siga así, la fase 3 de `/validate` nace en
rojo y hay que verificarla a mano archivo por archivo. Cerrarlo es un commit
propio, aislado, que no mezcle reformateo con cambios de comportamiento.

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

---

## Nota técnica — cómo se cierra B4

Consultado en la documentación oficial del CLI de Supabase (context7,
`/supabase/cli`, 2026-07-27).

El CLI genera los tipos del esquema, **incluidas las firmas de las RPC**:

```bash
supabase gen types --linked          # desde el proyecto enlazado (Management API)
supabase gen types --local           # desde la base local de desarrollo
supabase gen types --db-url '...'    # desde una URL de conexión
```

Con `--linked` o `--project-id` no se abre conexión a la base: el CLI llama al
endpoint `generateTypescriptTypes` de la Management API. Por eso B4 está en §B y
no en §A — hace falta la credencial del proyecto.

**Detalle que importa al implementarlo:** el archivo generado exporta `Json`,
`Database`, `Tables`, `TablesInsert`, `TablesUpdate`, `Enums` y `CompositeTypes`.
**`Functions` NO se exporta como helper independiente**: existe solo como
propiedad anidada dentro de `Database`, por esquema
(`Database['public']['Functions']['process_coffee_sale']`). Quien intente
`import type { Functions }` va a fallar sin entender por qué.

Cerrar B4 significa: generar el archivo, tipar el cliente con
`createClient<Database>(...)` y hacer que las llamadas `.rpc(...)` validen sus
parámetros contra el esquema real. Eso convierte «cambiar una migración rompe el
frontend en silencio» ([BLUEPRINT §3](BLUEPRINT.md#3-contratos-que-typescript-no-protege))
en un error de compilación.
