# ROADMAP — Café Mirador CRM

Qué se construyó, en qué orden y qué sigue.

- **Última verificación contra el código:** 2026-08-09
- **Documentos hermanos:** [BLUEPRINT](BLUEPRINT.md) · [BACKLOG](BACKLOG.md) · [SYLLABUS](SYLLABUS.md) · [README](../README.md) · [CLAUDE.md](../CLAUDE.md)

---

## Estado actual, medido

| Indicador          | Valor                                                                    | Cómo se comprobó             |
| ------------------ | ------------------------------------------------------------------------ | ---------------------------- |
| Tests unitarios    | **866 en 40 archivos, todos en verde**                                   | `npm test`                   |
| Cobertura          | Líneas 93,15 % · Sentencias 91,31 % · Ramas 87,81 % · Funciones 88,38 %  | `npm run test:coverage`      |
| Umbral exigido     | 80 % en las cuatro métricas                                              | `vitest.config.mts`          |
| Tipos              | Sin errores                                                              | `npx tsc --noEmit`           |
| Lint               | 0 errores, 10 warnings                                                   | `npm run lint`               |
| Formato            | Todo el repo conforme                                                    | `npm run format:check`       |
| Build              | **21 rutas** (18 estáticas + 3 dinámicas)                                | `npm run build`              |
| Tests E2E          | **23 en verde × 3 navegadores** (chromium, firefox, webkit)              | CI de GitHub, run del merge  |
| Contrato de RPC    | **37 invocadas, 48 expuestas**; y 50 columnas de exportación existen     | `npm run check:rpc`          |
| Exposición anónima | **0 objetos devuelven datos y 0 aceptan escritura** con la clave pública | `npm run check:anon`         |
| RLS                | 19 tablas, **todas** con RLS activo                                      | `pg_class.relrowsecurity`    |
| Funciones `anon`   | **13** (la lista blanca del portal, `029`)                               | `has_function_privilege`     |
| Restauración       | **42 migraciones, 19 tablas, 33 filas** desde el esquema del propio ZIP  | `./scripts/restore-drill.sh` |
| Paridad de esquema | **21 objetos, 48 RPC y 193 columnas** de producción salen de migraciones | paso 6 del ensayo            |

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

| OE   | Objetivo                                                         | Criterio ejecutable                                        | Estado                                               |
| ---- | ---------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| OE9  | Ningún objeto de `public` devuelve datos a un anónimo            | `npm run check:anon` en verde, con su autoprueba           | ✅ cerrado (`030` + fase 8)                          |
| OE10 | El verificador de exposición detecta una fuga real, no simulada  | Trampa accesible por HTTP ⇒ el gate sale con 1             | ✅ verificado y retirado con rastro cero             |
| OE11 | Toda cifra medida dice lo mismo en los 6 archivos que la repiten | `grep` de la cifra vieja no devuelve nada                  | ✅ cerrado (tests, cobertura, build)                 |
| OE12 | Toda RPC citada en la documentación existe en la base            | `comm` entre las citadas y `pg_proc`                       | ✅ cerrado (5 fantasmas corregidas)                  |
| OE13 | Las funciones `SECURITY DEFINER` fijan su `search_path`          | `get_advisors security` sin `function_search_path_mutable` | ⬜ abierto — BACKLOG A17 (62 casos)                  |
| OE14 | Ninguna función de la base queda sin llamador ni sin motivo      | `pg_proc` menos las `.rpc()` del código = solo triggers    | ⬜ abierto — BACKLOG A19 (21 casos)                  |
| OE15 | El portal puede listar productos                                 | `get_products_for_customer_order` devuelve 200             | ✅ cerrado (`031`) — hoy lista lo que tenga stock    |
| OE16 | El último backup sirve para restaurar la base                    | `./scripts/restore-drill.sh` en verde                      | ✅ cerrado — 42 migraciones, 19 tablas, 33 filas     |
| OE17 | Nada existe solo en producción: todo sale de una migración       | Paso 6 del ensayo: paridad producción ↔ reconstruido       | ✅ cerrado (`033` + `034`) — 6 funciones versionadas |
| OE18 | El portal no muestra productos duplicados                        | La RPC devuelve tantas entradas como nombres únicos        | ✅ cerrado (`032`) — 4 productos, 4 nombres          |

## Objetivos del ciclo del 2026-08-09

Este ciclo no empezó con una lista de objetivos, sino con una pregunta del
dueño: **«¿estamos listos para producción, con un inventario completo de
clientes y productos?»**. Los objetivos salieron de contestarla mirando el
sistema real, y lo que apareció no era lo que la pregunta buscaba.

| OE   | Objetivo                                                      | Criterio ejecutable                                               | Estado                                                                                                                                                                                       |
| ---- | ------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OE19 | Nadie puede darse a sí mismo permisos de administrador        | `UPDATE profiles SET role='admin'` como el propio usuario ⇒ 42501 | ✅ cerrado ([`035`](../supabase/migrations/035_cerrar_escalada_de_privilegios_y_escritura_anonima.sql))                                                                                      |
| OE20 | Ningún objeto de `public` acepta **escritura** anónima        | `npm run check:anon` sonda `PATCH`, no solo `SELECT`              | ✅ cerrado — probado con trampa real y retirada                                                                                                                                              |
| OE21 | **Se puede registrar una venta**                              | `process_coffee_sale` completa: stock, Kardex y totales           | ✅ cerrado ([`037`](../supabase/migrations/037_ninguna_venta_podia_registrarse.sql) + [`038`](../supabase/migrations/038_la_rpc_de_ventas_que_usa_la_app_estaba_rota.sql)) — **no se podía** |
| OE22 | Un solo catálogo, sin duplicados y con precios reales         | 5 productos, índice único por nombre, $45.000/$25.000             | ✅ cerrado ([`036`](../supabase/migrations/036_catalogo_unico_sobre_inventory.sql))                                                                                                          |
| OE23 | Los márgenes que muestra el sistema son los del negocio       | Vender 1 libra ⇒ ganancia $19.000 (42,22 %)                       | ✅ cerrado ([`040`](../supabase/migrations/040_costo_real_del_gramo_de_cafe.sql))                                                                                                            |
| OE24 | El CRM refleja el negocio real, no datos de demostración      | 52 clientes · 143 ventas · $6.440.000                             | ✅ cerrado — [`scripts/importar-historico.py`](../scripts/importar-historico.py)                                                                                                             |
| OE25 | Registrar una venta nunca se bloquea por falta de existencias | Vender con stock 0 ⇒ entra y deja negativo                        | ✅ cerrado ([`041`](../supabase/migrations/041_permitir_stock_negativo.sql) + [`042`](../supabase/migrations/042_el_stock_negativo_tambien_estaba_prohibido_en_la_tabla.sql))                |
| OE26 | Lo que la exportación promete existe en la base               | `npm run check:rpc` compara también columnas                      | ✅ cerrado — 12 columnas fantasma, entre ellas el nombre del cliente                                                                                                                         |

**Lo que este ciclo enseña, y no estaba en ningún objetivo:** los cinco defectos
más graves —la escalada a administrador, las dos causas de que no se pudiera
vender, el CSV de clientes sin la columna del nombre y las dos columnas que solo
existían en producción— **no los encontró ninguna suite**. Salieron de
preguntarle al sistema real: ejecutar una venta, mirar qué devuelve una RPC,
reconstruir la base desde cero. Cada uno vivía justo debajo del enunciado de
algún objetivo que estaba en verde.

## Siguiente paso vigente

**Del dueño, y bloquea lo demás: registrar el inventario real** en `/inventario`.
Hoy todo está en cero y el Café Molido Medio en **−500 g** por la venta del 6 de
agosto. Al 2026-08-09 hay café **esperando tueste y sin pesar**, así que la cifra
no existe todavía; en cuanto se pese, se registra la entrada y el negativo se
apaga solo. Un stock negativo no es un error: es esa señal. Ver
[BACKLOG §«Stock negativo permitido»](BACKLOG.md).

Después, por orden de valor:

1. **[A17](BACKLOG.md#a--automatizable-ahora) — 62 funciones con `search_path`
   mutable.** Único hallazgo de seguridad abierto; una migración por lotes los
   cierra de golpe.
2. **[A22](BACKLOG.md#a--automatizable-ahora) — la suite no es hermética.** Con
   variables `SUPABASE_*` exportadas fallan 30 tests sin que cambie el código. Un
   test que depende de quién lo lanza no sirve como prueba el día que falle de
   verdad.
3. **[A27](BACKLOG.md#a--automatizable-ahora) — pagos parciales.** Sin una tabla
   de pagos, la cartera del CRM ($1.845.500) es un techo y no la cifra: la real,
   sumando saldos deudores, es **$1.506.500**.
4. **[A19](BACKLOG.md#a--automatizable-ahora)** — funciones sin llamador, y
   **[B4](BACKLOG.md#b--requiere-fuente-externa)** — la firma de las RPC, cuya
   factura ya se pagó una vez: la app llamaba a la única de cuatro sobrecargas
   de `process_coffee_sale` que estaba rota.

Y dos decisiones que solo puede tomar el dueño:
**[C7](BACKLOG.md#c--requiere-juicio-humano)** (si la recurrencia ajustada al
vender debe pisar la del cliente) y
**[C8](BACKLOG.md#c--requiere-juicio-humano)** (si el portal debe aceptar
pedidos sin existencias).

> ⚠️ **Corrección a lo que este documento decía.** Hasta el 2026-08-09 el
> siguiente paso «de fondo» era _migrar el portal a `products`/`product_variants`,
> el modelo que ya usa el POS interno_. **Era falso**: al preguntárselo a la base,
> 28 funciones trabajaban sobre `inventory` y solo 5 sobre las variantes, ninguna
> invocada por una página. El modelo vivo era el que este ROADMAP llamaba viejo.
> [`036`](../supabase/migrations/036_catalogo_unico_sobre_inventory.sql) retiró
> `products` y `product_variants`, así que ese trabajo ya no existe.

~~A15, A21, A23~~ y ~~C6~~ cerrados; ver [BACKLOG](BACKLOG.md).

## Al retomar

1. Leer [BACKLOG §D](BACKLOG.md#d--cerrado-y-por-qué) antes de proponer nada.
2. Correr `npm test` y confirmar **866/866** antes de tocar código, **en una terminal sin variables `SUPABASE_*` exportadas** (ver BACKLOG A22).
3. Nada de `git add -A`: [BLUEPRINT §5](BLUEPRINT.md#5-estado-de-despliegue)
   explica por qué el repo público no puede recibir datos de clientes.
