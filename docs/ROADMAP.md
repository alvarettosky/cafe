# ROADMAP — Café Mirador CRM

Qué se construyó, en qué orden y qué sigue.

- **Última verificación contra el código:** 2026-07-27
- **Documentos hermanos:** [BLUEPRINT](BLUEPRINT.md) · [BACKLOG](BACKLOG.md) · [SYLLABUS](SYLLABUS.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)

---

## Estado actual, medido

| Indicador       | Valor                                                                  | Cómo se comprobó             |
| --------------- | ---------------------------------------------------------------------- | ---------------------------- |
| Tests unitarios | **865 en 38 archivos, todos en verde**                                 | `npm test`                   |
| Cobertura       | Líneas 93,79 % · Sentencias 92,1 % · Ramas 88,22 % · Funciones 89,01 % | `npm run test:coverage`      |
| Umbral exigido  | 80 % en las cuatro métricas                                            | `vitest.config.mts`          |
| Tipos           | Sin errores                                                            | `npx tsc --noEmit`           |
| Lint            | 0 errores, 10 warnings                                                 | `npm run lint`               |
| Build           | 21 rutas generadas                                                     | `npm run build`              |
| Tests E2E       | 7 escritos, **sin ejecutar** en esta verificación                      | ver [BACKLOG](BACKLOG.md) B5 |

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

| #   | Trabajo                                                          | Estado                       |
| --- | ---------------------------------------------------------------- | ---------------------------- |
| 5.1 | Aplicar los tokens del design system y corregir el 404 del fondo | ✅ `bbf34f4`                 |
| 5.2 | Centralizar los tipos duplicados (`Product` ×7, `Customer` ×2)   | ✅ `07ebdda`                 |
| 5.3 | Corregir el contrato roto de la API de backups                   | ✅ `5ce639e`                 |
| 5.4 | Anclar la regla de `.gitignore` que rompía el hook de pre-commit | ✅ `c7d9335`                 |
| 5.5 | Documentación de gestión (este set de 4 documentos)              | ✅                           |
| 5.6 | Homonimia restante: `Referral`, `ReferralStats`, `DeliveryZone`  | ⬜ [BACKLOG](BACKLOG.md) A12 |
| 5.7 | Verificación automática del contrato de las RPC                  | ⬜ [BACKLOG](BACKLOG.md) B4  |

## Siguiente paso vigente

**[BACKLOG](BACKLOG.md) A12 — cerrar la homonimia restante.** Es el mismo patrón
que produjo el bug `5ce639e`, y los tres casos (`Referral`, `ReferralStats`,
`DeliveryZone`) tienen formas **distintas** bajo el mismo nombre, que es la
variante peligrosa: no es duplicación, es ambigüedad.

Después, en orden de valor: B4 (contrato de las RPC), A1/A3 (accesibilidad),
A8/A9 (métricas de recurrencia).

## Al retomar

1. Leer [BACKLOG §D](BACKLOG.md#d--cerrado-y-por-qué) antes de proponer nada.
2. Correr `npm test` y confirmar **865/865** antes de tocar código.
3. Nada de `git add -A`: [BLUEPRINT §5](BLUEPRINT.md#5-estado-de-despliegue)
   explica por qué el repo público no puede recibir datos de clientes.
