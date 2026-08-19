# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Operador del CRM (staff).** Hoy el negocio lo opera su dueño, en modo mixto: móvil
en la calle (entregas, visitas, ventas en el momento) y escritorio en casa (registro
por lotes, análisis, inventario). Ambos anchos son de primera clase; el móvil no es
una versión recortada del escritorio.

**Cliente final (portal).** Compradores de café de un círculo cercano, en Colombia.
Acceden por magic link desde el móvil. **El portal todavía no se ha abierto a
clientes:** el código existe y está probado, pero ninguna persona externa lo ha usado.
Cualquier afirmación sobre comportamiento observado en el portal sería inventada.

## Product Purpose

Gestionar la venta directa de café de origen de Salento (Quindío, Colombia) —grano y
molido, por libra (453,6 g) y media libra (226,8 g)— desde el registro de la venta
hasta el seguimiento del cliente. El éxito es que ninguna venta quede sin registrar y
que el operador sepa a quién contactar y cuándo, sin llevar cuentas aparte.

No es una cafetería: es venta directa al consumidor con pedidos recurrentes
coordinados por WhatsApp, programa de referidos ("voz a voz") y zonas de entrega.

## Positioning

Un CRM escrito para un negocio de café específico, no un CRM genérico adaptado. La
recurrencia se expresa en días reales del ciclo de consumo ("cada 14 días",
"Recurrencia: 21d") y los segmentos son etiquetas humanas —Champion, Leal, Potencial,
Nuevo, En Riesgo, Perdido, Prospecto— con la explicación en lenguaje llano, nunca
jerga RFM. La pregunta que el producto responde y una hoja de cálculo no:
"¿cuándo vuelve a comprar esta persona?".

## Operating Context

- Dos superficies en una misma app Next.js: CRM del staff en `/` y Portal de Cliente
  en `/portal`, con autenticación por magic link.
- WhatsApp es el canal real de coordinación con el cliente (plantillas de mensaje).
- La venta ocurre primero en la vida real y se registra después. El sistema documenta
  lo ya ocurrido; no autoriza la transacción.
- Entregas por zonas; referidos por voz a voz dentro de un círculo conocido.
- Registro en movimiento: el operador anota ventas desde el móvil, a veces de pie y
  con una mano.

## Capabilities and Constraints

- **El stock puede ser negativo, por decisión explícita del dueño.** Un negativo
  significa "falta registrar la entrada", no un error a bloquear. Bloquear por
  existencias impedía anotar ventas ya ocurridas.
- **`create_customer_order` sí valida stock**, y es la única que lo hace: ahí quien
  pide es un cliente, no el dueño.
- Media libra no cuesta la mitad que la libra: son precios independientes fijados por
  el negocio y gestionados dentro de la app (`/precios`), no constantes del código.
- El costo se lleva por gramo (`cost_per_gram`), no por libra.
- **El tema sigue al sistema operativo**, vía `@media (prefers-color-scheme: dark)`.
  El sistema de diseño del bundle declara "dark canónico" y `app/layout.tsx` monta
  `<html lang="es" className="dark">`, pero esa clase **no tiene efecto**: Tailwind v4
  resuelve la variante `dark:` por media query y el proyecto no declara
  `@custom-variant dark`. Migrar a oscuro canónico exige declararla y además revisar
  los componentes que fijan utilidades claras sin contraparte `dark:` (documentado en
  la cabecera de `app/globals.css`, con un caso medido de contraste ~2:1). Hasta
  entonces, claro y oscuro son ambos reales y ninguna pantalla puede asumir fondo oscuro.
- Stack existente: Next.js (App Router) + TypeScript + Supabase + Tailwind v4, con
  Radix, framer-motion, lucide-react y recharts. Tests con Vitest y Playwright.
- **El repositorio es público.** Ningún artefacto de diseño, captura, exportación ni
  reporte puede contener datos de clientes reales.

## Brand Commitments

- Nombre: **Mirador Montañero Café Selecto** ("Café Mirador" en corto).
- Idioma: español de Colombia, siempre. Trato de **tú**, nunca "usted".
- Tono: cálido y montañero, práctico, con familiaridad de negocio pequeño. Ni
  corporativo ni tierno. El artesano serio que conoce a sus clientes por el nombre.
- Casing: Title Case en navegación y títulos de página ("Panel de Control", "Nueva
  Venta"); sentence case en texto descriptivo. Nunca versalitas salvo en badges.
- Unidades en minúscula (`g`, `kg`, `libra`, `media libra`); peso colombiano con
  espacio: `$ 12.500`. Recurrencia siempre en días.
- **Emoji solo en documentación y plantillas de WhatsApp, nunca en la interfaz.** La
  UI usa iconos Lucide.
- Estados vacíos honestos ("No hay ventas recientes"), sin relleno motivacional.
- Sistema de diseño de referencia: `../project/` (tokens en `colors_and_type.css`,
  kits en `ui_kits/crm` y `ui_kits/portal`, guía en `README.md` y `SKILL.md`).

## Evidence on Hand

- Sistema de diseño completo y versionado en `../project/`: tokens de color y tipo,
  15 prototipos HTML en `preview/`, kits de CRM y Portal, primitivas compartidas.
- Historial comercial real cargado en la base: 52 clientes, 143 ventas y $6.440.000
  desde 2024-09-26 (estado registrado en la bitácora del proyecto el 2026-08-09).
- **No hay** testimonios, casos de estudio, prensa, métricas de conversión ni
  benchmarks. Ninguna superficie puede fabricarlos.
- **No hay** datos de uso del portal, porque el portal no se ha abierto.

## Product Principles

1. **Registrar gana a validar.** El sistema documenta lo que ya pasó; una restricción
   que impida anotar la realidad es un defecto, no una salvaguarda.
2. **El móvil y el escritorio son el mismo producto.** Mismo poder en ambos: lo que se
   puede hacer sentado se puede hacer de pie.
3. **Lenguaje de persona, no de sistema.** Segmentos, alertas y errores se dicen como
   se los diría a un vecino.
4. **Los datos de los clientes no salen a pantalla compartida ni a un repo público.**
   Toda decisión de diseño que exponga identidad se resuelve del lado de ocultar.
5. **El portal se diseña para el primer ingreso**, porque nadie lo ha visto todavía.

## Accessibility & Inclusion

Restricciones confirmadas por el dueño sobre los clientes del portal:

- **Móviles de gama baja y planes de datos limitados.** Presupuesto de peso estricto;
  nada esencial puede depender de imágenes grandes ni de animación costosa.
- **Hay personas mayores entre los clientes.** Tamaño de texto, contraste y áreas
  táctiles por encima del mínimo; copy sin jerga y sin depender de iconos sin rótulo.
