# ROADMAP — Café Mirador CRM

Qué se construyó, en qué orden y qué sigue.

- **Última verificación contra el código:** 2026-07-27
- **Documentos hermanos:** [BLUEPRINT](BLUEPRINT.md) · [BACKLOG](BACKLOG.md) · [SYLLABUS](SYLLABUS.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)

---

## Estado actual, medido

| Indicador       | Valor                                                                   | Cómo se comprobó            |
| --------------- | ----------------------------------------------------------------------- | --------------------------- |
| Tests unitarios | **876 en 39 archivos, todos en verde**                                  | `npm test`                  |
| Cobertura       | Líneas 93,23 % · Sentencias 91,46 % · Ramas 87,83 % · Funciones 88,76 % | `npm run test:coverage`     |
| Umbral exigido  | 80 % en las cuatro métricas                                             | `vitest.config.mts`         |
| Tipos           | Sin errores                                                             | `npx tsc --noEmit`          |
| Lint            | 0 errores, 10 warnings                                                  | `npm run lint`              |
| Formato         | Todo el repo conforme                                                   | `npm run format:check`      |
| Build           | **23 páginas estáticas** (21 rutas + `/_not-found` y raíz)              | `npm run build`             |
| Tests E2E       | **23 en verde × 3 navegadores** (chromium, firefox, webkit)             | CI de GitHub, run del merge |

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

## Siguiente paso vigente

**Primero, y no es código: [BACKLOG](BACKLOG.md) §P0-SEC-2 — revocar el token
`cafedesalento` (`sbp_8099…`).** Estuvo 188 días en el repositorio público y
sigue vivo. Da acceso a la cuenta de Supabase entera, no a una base. Solo puede
hacerlo el dueño de la cuenta, desde el dashboard.

Después, **[BACKLOG](BACKLOG.md) B4 — la firma de las RPC.** Su mitad fácil ya
está cerrada: `npm run check:rpc` garantiza que las RPC invocadas **existan**, y
eso bastaba para el bug del dashboard. Lo que queda es más fino — que los
**parámetros** cuadren— y exige generar los tipos desde el esquema real con
`supabase gen types`. La receta está al final del BACKLOG.

Sin credenciales de por medio, lo siguiente en valor es A1/A3 (accesibilidad) y
A8/A9 (métricas de recurrencia, cuyos datos ya existen en `customer_segments`).

## Al retomar

1. Leer [BACKLOG §D](BACKLOG.md#d--cerrado-y-por-qué) antes de proponer nada.
2. Correr `npm test` y confirmar **876/876** antes de tocar código.
3. Nada de `git add -A`: [BLUEPRINT §5](BLUEPRINT.md#5-estado-de-despliegue)
   explica por qué el repo público no puede recibir datos de clientes.
