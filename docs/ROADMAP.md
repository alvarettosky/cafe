# ROADMAP — Café Mirador CRM

Qué se construyó, en qué orden y qué sigue.

- **Última verificación contra el código:** 2026-08-07
- **Documentos hermanos:** [BLUEPRINT](BLUEPRINT.md) · [BACKLOG](BACKLOG.md) · [SYLLABUS](SYLLABUS.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)

---

## Estado actual, medido

| Indicador          | Valor                                                                   | Cómo se comprobó            |
| ------------------ | ----------------------------------------------------------------------- | --------------------------- |
| Tests unitarios    | **893 en 41 archivos, todos en verde**                                  | `npm test`                  |
| Cobertura          | Líneas 93,15 % · Sentencias 91,31 % · Ramas 87,81 % · Funciones 88,38 % | `npm run test:coverage`     |
| Umbral exigido     | 80 % en las cuatro métricas                                             | `vitest.config.mts`         |
| Tipos              | Sin errores                                                             | `npx tsc --noEmit`          |
| Lint               | 0 errores, 10 warnings                                                  | `npm run lint`              |
| Formato            | Todo el repo conforme                                                   | `npm run format:check`      |
| Build              | **21 rutas** (18 estáticas + 3 dinámicas)                               | `npm run build`             |
| Tests E2E          | **23 en verde × 3 navegadores** (chromium, firefox, webkit)             | CI de GitHub, run del merge |
| Contrato de RPC    | **38 invocadas, 38 existen** en la base                                 | `npm run check:rpc` / MCP   |
| Exposición anónima | **0 objetos de `public` devuelven datos** a la clave pública            | `npm run check:anon`        |
| RLS                | 21 tablas, **todas** con RLS activo                                     | `pg_class.relrowsecurity`   |
| Funciones `anon`   | **13** (la lista blanca del portal, `029`)                              | `has_function_privilege`    |

## Fases entregadas

| Fase | Nombre                         | Estado | Plan                                                          |
| ---- | ------------------------------ | ------ | ------------------------------------------------------------- |
| 1    | Maximizar recurrencia          | ✅     | [plan](plans/2026-01-19-fase1-maximizar-recurrencia.md)       |
| 2    | Portal de cliente self-service | ✅     | [plan](plans/2026-01-19-fase2-portal-cliente-self-service.md) |
| 3    | Crecimiento y escalabilidad    | ✅     | [plan](plans/2026-01-19-fase3-crecimiento.md)                 |
| 4    | Arquitectura POS profesional   | ✅     | sin plan escrito — ver nota                                   |

> **Nota sobre la Fase 4.** [`plans/2026-01-19-roadmap-mejoras-competitivas.md`](plans/2026-01-19-roadmap-mejoras-competitivas.md)
> declara «Estado general: ✅ Completado (**3** fases implementadas)» y no
> contiene la Fase 4. Quien la implementó (Kardex de inventario y variantes de
> producto, migraciones `023`–`026`) no actualizó ese documento. **Este ROADMAP
> es la fuente de verdad**; aquel plan queda como registro histórico de las
> fases 1–3.

## Fase 5 — Consolidación (en curso, 2026-07)

No agrega funcionalidad: paga deuda estructural que ya causó un fallo en
producción.

| #    | Trabajo                                                          | Estado                        |
| ---- | ---------------------------------------------------------------- | ----------------------------- |
| 5.1  | Aplicar los tokens del design system y corregir el 404 del fondo | ✅ `bbf34f4`                  |
| 5.2  | Centralizar los tipos duplicados (`Product` ×7, `Customer` ×2)   | ✅ `07ebdda`                  |
| 5.3  | Corregir el contrato roto de la API de backups                   | ✅ `5ce639e`                  |
| 5.4  | Anclar la regla de `.gitignore` que rompía el hook de pre-commit | ✅ `c7d9335`                  |
| 5.5  | Documentación de gestión (este set de 4 documentos)              | ✅                            |
| 5.6  | Homonimia restante: `Referral`, `ReferralStats`, `DeliveryZone`  | ✅ `3988e52`                  |
| 5.7  | Formatear el repositorio completo (137 archivos)                 | ✅ `256f7d0`                  |
| 5.8  | **Bug de producción**: `get_dashboard_stats` devolvía 404        | ✅ migración `028`            |
| 5.9  | Errores de Supabase descartados en 13 llamadas                   | ✅ +11 tests                  |
| 5.10 | Verificadores propios: contrato de RPC y credenciales            | ✅ fases 6 y 7 de `/validate` |
| 5.11 | Firma (no solo existencia) de las RPC                            | ⬜ [BACKLOG](BACKLOG.md) B4   |

Con 5.6 queda cerrada la deuda de tipos que abrió `5ce639e`: no quedan formas
distintas compartiendo nombre. El caso destapó además que las declaraciones no
eran dos por forma sino **tres** —había una copia anónima inline en cada
`.map()`— y que una de ellas mentía sobre la nulabilidad de dos columnas. El
detalle está en [BACKLOG §«La mentira de nulabilidad»](BACKLOG.md#la-mentira-de-nulabilidad-que-destapó-a12).

## Objetivos del ciclo de endurecimiento (2026-08-07)

Cada uno con el comando o consulta que lo demuestra. Un objetivo sin criterio
ejecutable no es un objetivo, es una intención.

| OE   | Objetivo                                                         | Criterio ejecutable                                        | Estado                                              |
| ---- | ---------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| OE9  | Ningún objeto de `public` devuelve datos a un anónimo            | `npm run check:anon` en verde, con su autoprueba           | ✅ cerrado (`030` + fase 8)                         |
| OE10 | El verificador de exposición detecta una fuga real, no simulada  | Trampa accesible por HTTP ⇒ el gate sale con 1             | ✅ verificado y retirado con rastro cero            |
| OE11 | Toda cifra medida dice lo mismo en los 6 archivos que la repiten | `grep` de la cifra vieja no devuelve nada                  | ✅ cerrado (tests, cobertura, build)                |
| OE12 | Toda RPC citada en la documentación existe en la base            | `comm` entre las citadas y `pg_proc`                       | ✅ cerrado (5 fantasmas corregidas)                 |
| OE13 | Las funciones `SECURITY DEFINER` fijan su `search_path`          | `get_advisors security` sin `function_search_path_mutable` | ⬜ abierto — BACKLOG A17 (62 casos)                 |
| OE14 | Ninguna función de la base queda sin llamador ni sin motivo      | `pg_proc` menos las `.rpc()` del código = solo triggers    | ⬜ abierto — BACKLOG A19 (21 casos)                 |
| OE15 | El portal puede listar productos                                 | `get_products_for_customer_order` devuelve 200             | ✅ cerrado (`031`) — 10 productos, orden de la base |

## Siguiente paso vigente

**[BACKLOG](BACKLOG.md) A21 — el portal listaría productos duplicados.** Salió al
arreglar A15: la RPC ya responde, pero devuelve **10 entradas para 4 productos**
porque `inventory` guarda una fila por lote y las diez están migradas al modelo
de variantes. No se arregla dentro de la RPC —`create_customer_order` valida el
stock contra la fila concreta— sino decidiendo si el portal pasa al modelo nuevo
(`products`/`product_variants`) o si se consolida `inventory`. Es la decisión que
más valor desbloquea, y es de arquitectura.

En paralelo, sin decisiones de por medio: **A17** (62 funciones con `search_path`
mutable: una migración por lotes cierra los 62 de golpe) y **A19** (decidir, una
por una, si las 21 funciones sin llamador se cablean o se borran).

~~A15 — la RPC del portal devolvía SQL inválido~~ — **cerrada el 2026-08-07**
(`031`), verificada llamándola con la clave del portal.

~~Revocar el token `cafedesalento`~~ — **hecho el 2026-07-27**, verificado con
HTTP 401 contra la Management API. Este documento seguía pidiéndolo once días
después: un pendiente cumplido que nadie tachó se lee como trabajo vivo.

Y **[BACKLOG](BACKLOG.md) B4 — la firma de las RPC.** Su mitad fácil ya
está cerrada: `npm run check:rpc` garantiza que las RPC invocadas **existan**, y
eso bastaba para el bug del dashboard. Lo que queda es más fino — que los
**parámetros** cuadren— y exige generar los tipos desde el esquema real con
`supabase gen types`. La receta está al final del BACKLOG.

Sin credenciales de por medio, lo siguiente en valor es A1/A3 (accesibilidad) y
A8/A9 (métricas de recurrencia, cuyos datos ya existen en `customer_segments`).

## Al retomar

1. Leer [BACKLOG §D](BACKLOG.md#d--cerrado-y-por-qué) antes de proponer nada.
2. Correr `npm test` y confirmar **893/893** antes de tocar código.
3. Nada de `git add -A`: [BLUEPRINT §5](BLUEPRINT.md#5-estado-de-despliegue)
   explica por qué el repo público no puede recibir datos de clientes.
