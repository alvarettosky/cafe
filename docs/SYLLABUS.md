# SYLLABUS — Café Mirador CRM

Ruta de lectura para entender el sistema. Ordenada por dependencia: cada módulo
supone el anterior. Pensado tanto para una persona que entra al proyecto como
para un agente que lo retoma sin contexto.

- **Última verificación contra el código:** 2026-08-09
- **Documentos hermanos:** [BLUEPRINT](BLUEPRINT.md) · [ROADMAP](ROADMAP.md) · [BACKLOG](BACKLOG.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)

---

## Módulo 0 — Qué es el negocio (15 min)

Sin esto, el código parece un CRM genérico y las decisiones no se entienden.

- [`../../project/README.md`](../../project/README.md) §Content Fundamentals — el
  tono, el vocabulario (`libra`, `media libra`, `recurrencia`), el público.
- [BLUEPRINT §1](BLUEPRINT.md#1-qué-es-este-sistema) — las dos superficies.

**Comprobación:** ¿por qué el portal de cliente no tiene contraseñas?
→ [BLUEPRINT D4](BLUEPRINT.md#d4--portal-sin-contraseña)

## Módulo 1 — Levantar el proyecto (20 min)

```bash
npm install
npm test          # 865 tests, ~11 s. Si no da 865/865, para y averigua por qué
npm run lint
npx tsc --noEmit
npm run build
```

Los tests **no** necesitan `.env.local`: Supabase está mockeado con MSW
(`__mocks__/handlers.ts`). Para levantar la app de verdad sí hacen falta
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**Comprobación:** correr los cinco comandos y ver los cinco en verde.

## Módulo 2 — El modelo de datos (45 min)

El sistema es una base de datos con una interfaz encima. Empezar por aquí y no
por los componentes.

1. [`../CLAUDE.md`](../CLAUDE.md) §Base de Datos — tablas y RPC.
2. `supabase/migrations/038_la_rpc_de_ventas_que_usa_la_app_estaba_rota.sql` — la
   RPC central, y por qué **hay cuatro** `process_coffee_sale` de las que la app
   llamaba a la única rota. Si solo lees un `.sql`, que sea este.
3. `supabase/migrations/010_security_rls.sql` — dónde vive de verdad la
   autorización, y `035` — por qué una política de `UPDATE` sin `WITH CHECK`
   dejaba que cualquiera se hiciera administrador.
4. `036` — por qué hay **un solo** catálogo y vive en `inventory`, no en
   `products`. [BLUEPRINT D7](BLUEPRINT.md#2-decisiones-de-arquitectura).

**Comprobación:** ¿qué cuatro escrituras hace `process_coffee_sale` y por qué
tienen que ser atómicas? → [BLUEPRINT D1](BLUEPRINT.md#d1--la-lógica-de-negocio-vive-en-la-base-de-datos-no-en-el-cliente)

## Módulo 3 — Recurrencia (30 min)

Es el diferencial del producto, no una funcionalidad más.

1. `calculate_customer_recurrence` en las migraciones.
2. `components/recurrence-input.tsx` y `app/contactos/page.tsx`.
3. [BLUEPRINT D5](BLUEPRINT.md#d5--recurrencia-calculada-no-declarada).

**Comprobación:** ¿por qué con dos compras la recurrencia es `null` en vez de un
promedio de dos puntos?

## Módulo 4 — Los tipos y sus fronteras (30 min)

El módulo que más caro sale saltarse.

1. [BLUEPRINT §3](BLUEPRINT.md#3-contratos-que-typescript-no-protege) y
   [§4](BLUEPRINT.md#4-estructura-de-tipos).
2. `git show 5ce639e` — el bug de los backups, de punta a punta.
3. `types/backups.ts` — cómo queda un contrato bien declarado.

**Comprobación:** ¿por qué 865 tests en verde no detectaron que los enlaces de
descarga no se renderizaban? → porque el mock replicaba el error del consumidor.
Un mock que miente convierte a la suite en cómplice del bug.

## Módulo 5 — Testing (30 min)

- `vitest.config.mts` — umbral del 80 % en las cuatro métricas.
- `__mocks__/handlers.ts` — MSW. **Regla: el mock se tipa con el mismo tipo que
  usa el productor real.**
- `tests/` — E2E de Playwright (escritos; ver [BACKLOG](BACKLOG.md) B5).

**Comprobación:** agregar un campo a una respuesta de API y ver que el mock deja
de compilar.

## Módulo 6 — Portal de cliente (30 min)

- `context/customer-portal-context.tsx` — sesión de 30 días en `localStorage`.
- `app/portal/auth/page.tsx` — validación del magic link.
- `types/portal.ts` — por qué el portal no reutiliza los tipos del CRM.

## Módulo 7 — Operación (20 min)

- Despliegue: Vercel, automático al push a `main`. **Sin staging.**
- Backups: `scripts/backup/`, diarios 02:00 UTC, retención 7/4/12.
- [BLUEPRINT §5](BLUEPRINT.md#5-estado-de-despliegue) — ⚠️ el repositorio es
  público.

**Comprobación:** ¿dónde viven los datos de ventas con nombres de clientes, y por
qué no aquí?

---

## Errores que este proyecto ya cometió

Están en [BACKLOG §D](BACKLOG.md#d--cerrado-y-por-qué) con su causa raíz. Los
cuatro patrones que se repiten:

1. **Homonimia de tipos** — dos `interface` con el mismo nombre y distinta forma.
2. **Mocks que mienten** — el mock copia al consumidor en vez del productor.
3. **Documentación fósil** — afirmaciones ciertas en enero, falsas en julio.
4. **Patrones de `.gitignore` sin anclar** — `backups/` casaba con código fuente.
5. **Verificadores que aprueban sin mirar** — un `[]` de una consulta con
   `limit=0`, un backup con `success` que nadie restauró, un gate que salía con 0
   cuando le faltaban los secretos. Ver
   [`.claude/commands/validate.md`](../.claude/commands/validate.md) §«El hueco que
   queda» y [`scripts/restore-drill.sh`](../scripts/restore-drill.sh).
6. **Cosas que solo viven en producción** — seis funciones, una vista y dos
   columnas que ninguna migración creaba. Las encontró el paso de paridad del
   ensayo de restauración, que **bajó un escalón cada vez**: primero objetos,
   luego funciones, ahora columnas.
7. **La documentación afirmando lo contrario del código** — el ROADMAP pedía
   «migrar el portal al modelo que ya usa el POS» cuando el POS usaba el otro.
   Nadie lo había contrastado contra `pg_proc`.
8. **Comprobaciones en dos capas** — retirar la validación de una función no
   permitió el stock negativo: había además un `CHECK` en la tabla. Solo se vio
   ejecutando la operación.

Antes de tocar la base, lee también
[`docs/BACKLOG.md` §P0-BACKUP](BACKLOG.md) y §P0-SEC-4: son los dos incidentes que
explican por qué hay ocho fases de validación y un ensayo de restauración diario.
