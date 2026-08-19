---
name: Café Mirador
description: CRM y portal de una venta directa de café de origen de Salento, en español y a dos temas.
colors:
  tierra-tostada: '#8b4513'
  tierra-tostada-oscuro: '#a0522d'
  tierra-media: '#c07b55'
  tierra-clara: '#e0b89c'
  crema: '#f5e9d7'
  crema-suave: '#fbf5ea'
  superficie: '#ffffff'
  superficie-tinta: '#171717'
  superficie-apagada: '#f5f5f5'
  tinta-apagada: '#737373'
  borde: '#e5e5e5'
  alerta: '#dc2626'
  logro: '#22c55e'
  aviso: '#f59e0b'
typography:
  display:
    fontFamily: "Fraunces, 'Source Serif Pro', Georgia, serif"
    fontSize: '36px'
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: '-0.02em'
  headline:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '30px'
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: '-0.02em'
  title:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '18px'
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '16px'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '14px'
    fontWeight: 500
    lineHeight: 1.3
rounded:
  sm: '6px'
  md: '7px'
  lg: '8px'
  xl: '12px'
  full: '9999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
  xl: '32px'
components:
  button-primary:
    backgroundColor: '{colors.tierra-tostada}'
    textColor: '#ffffff'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '36px'
  button-primary-hover:
    backgroundColor: '{colors.tierra-tostada-oscuro}'
  button-outline:
    backgroundColor: '{colors.superficie}'
    textColor: '{colors.superficie-tinta}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.superficie-tinta}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
  input-field:
    backgroundColor: '{colors.superficie}'
    textColor: '{colors.superficie-tinta}'
    rounded: '{rounded.md}'
    padding: '8px 12px'
    height: '40px'
  card-surface:
    backgroundColor: '{colors.superficie}'
    textColor: '{colors.superficie-tinta}'
    rounded: '{rounded.xl}'
    padding: '24px'
---

# Design System: Café Mirador

## Overview

**Creative North Star: "El mirador al amanecer"**

Es la vista desde la montaña de Salento a primera hora: aire, horizonte amplio y una
sola línea de tierra tostada cruzando la luz. La interfaz respira antes de hablar. Las
superficies son grandes y tranquilas, la crema (#f5e9d7) hace de horizonte cálido, y el
marrón aparece pocas veces —siempre donde hay que actuar o donde empieza una sección—
para que su presencia signifique algo.

La personalidad es de negocio pequeño que se toma en serio su oficio: cálido pero
exacto, sin florituras y sin lenguaje de campaña. La densidad se adapta al momento de
uso en lugar de imponer una sola postura: el mismo componente se abre y se vuelve
táctil en el móvil, donde se registra una venta de pie, y se compacta en el escritorio,
donde se revisa el inventario sentado. **Ninguna pantalla puede asumir fondo oscuro:**
el tema sigue al sistema operativo del visitante, y claro y oscuro son igual de reales.

Lo que este mundo rechaza —confirmado por el detector sobre el código actual— es el
gradiente morado-violeta y el cian sobre oscuro: son la firma más reconocible de una
interfaz generada por IA y no tienen nada que ver con un café de origen.

**Key Characteristics:**

- Horizonte cálido: crema y blanco como respiración, tierra tostada como acento raro.
- Doble tema real, gobernado por `prefers-color-scheme`, nunca por una clase.
- Plano en reposo; la sombra es una respuesta, no un estado.
- Táctil bajo 768 px, denso por encima.
- Español de Colombia, trato de tú, iconos Lucide y cero emoji en la interfaz.

## Colors

Una paleta de tierra y luz: dos neutros amplios, una familia marrón que va del grano
tostado al café con leche, y una crema que hace de horizonte.

### Primary

- **Tierra Tostada** (#8b4513 en claro, #a0522d en oscuro): el color de la acción y del
  título de página. Vive en el botón principal, en el anillo de foco y en el encabezado
  de sección. En modo oscuro sube a Sienna para conservar contraste sobre #0a0a0a.
- **Tierra Media** (#c07b55): estados intermedios y series secundarias de gráfica.
- **Tierra Clara** (#e0b89c): fondos de énfasis muy suaves y bordes cálidos.

### Secondary

- **Crema** (#f5e9d7) y **Crema Suave** (#fbf5ea): el horizonte del mundo. Fondos de
  bloque hospitalario, sobre todo en el portal del cliente y en materiales impresos.

### Neutral

- **Superficie** (#ffffff) / **Superficie Tinta** (#171717): fondo y texto en claro;
  se invierten a #0a0a0a y #ededed cuando el sistema pide oscuro.
- **Superficie Apagada** (#f5f5f5): zonas secundarias, filas alternas, estados vacíos.
- **Tinta Apagada** (#737373): texto de apoyo, ayudas y metadatos.
- **Borde** (#e5e5e5): divisiones y contorno de campo. Una línea, nunca dos.

### Status

- **Alerta** (#dc2626) destructivo, **Logro** (#22c55e) confirmación, **Aviso**
  (#f59e0b) stock bajo y fechas de recurrencia vencidas.

### Named Rules

**La Regla del Acento Escaso.** La tierra tostada ocupa como mucho el 10 % de una
pantalla. Si aparece en el botón, en el título, en el borde de la tarjeta y en el icono
a la vez, ha dejado de ser señal y es decoración: quítala de todos menos de uno.

**La Regla del Morado Prohibido.** Ningún gradiente morado, violeta o cian sobre
oscuro. La paleta es de tierra; un violeta en pantalla es una importación accidental de
plantilla, no una decisión.

**La Regla de los Dos Temas.** Todo color se escribe con la variable semántica
(`var(--primary)`, `bg-background`), nunca con la utilidad clara fija. Una etiqueta
`text-gray-700` sobre `bg-background` da ~2:1 de contraste cuando el sistema está en
oscuro; ya ocurrió en este proyecto y está documentado en `app/globals.css`.

## Typography

**Display Font:** Fraunces (con Source Serif Pro, Georgia, serif)
**Body Font:** Inter (con system-ui, Segoe UI, Roboto, sans-serif)

**Character:** Inter lleva todo el trabajo funcional —cifras, tablas, formularios— sin
llamar la atención. Fraunces es la excepción con voz: se reserva a títulos de marca y
piezas de presentación mediante la utilidad `.display-serif`, no al texto del CRM.
Inter está registrada como fuente de marca deliberada en la configuración del detector.

### Hierarchy

- **Display** (Fraunces 700, 36px, 1.1, -0.02em): nombre de marca y portadas.
- **Headline** (Inter 700, 30px, 1.1): título de página ("Panel de Control").
- **Title** (Inter 600, 18px, 1.3): título de tarjeta y de sección.
- **Body** (Inter 400, 16px, 1.5): texto corriente. 16px es el piso, no el techo.
- **Label** (Inter 500, 14px, 1.3): etiquetas de campo, badges y metadatos.

### Named Rules

**La Regla de los 16 px.** Ningún texto que el cliente deba leer baja de 16px, y
ninguna etiqueta funcional baja de 14px. Hay personas mayores entre los clientes, y el
detector ya encontró 51 casos de texto por debajo del piso en los prototipos del
sistema de diseño: es la deriva más frecuente de este proyecto.

## Layout

Rejilla fluida de una sola columna en móvil y de dos a cuatro en escritorio, con
contenedor centrado y respiración lateral de 16px en pantallas pequeñas. El ritmo
vertical se apoya en la escala de 4 (4, 8, 16, 24, 32): el salto de 24px separa
bloques, el de 16px separa elementos dentro de un bloque.

El corte que gobierna todo es **768px**: por debajo, el objetivo es el pulgar de alguien
de pie en la calle; por encima, la vista de alguien sentado que quiere ver muchas filas
sin desplazarse. No hay una versión móvil recortada: las mismas acciones existen en
ambos anchos.

## Elevation & Depth

Sistema **plano en reposo**. Las superficies se distinguen por tono —tarjeta (#ffffff)
sobre fondo apagado, o #171717 sobre #0a0a0a— y no por sombra. La sombra es la respuesta
del sistema a una intención: aparece en hover, en foco y en lo que flota de verdad
(diálogos, menús). El resplandor de marca se reserva a la acción principal, nunca a una
tarjeta cualquiera.

### Shadow Vocabulary

- **Contacto** (`0 1px 2px rgba(0,0,0,.16)`): elementos que apenas se despegan.
- **Reposo elevado** (`0 1px 3px rgba(0,0,0,.24), 0 1px 2px rgba(0,0,0,.16)`): hover de
  tarjeta interactiva.
- **Flotante** (`0 4px 12px rgba(0,0,0,.32)`): menús y popovers.
- **Diálogo** (`0 10px 24px rgba(0,0,0,.4)`): modales, y solo modales.
- **Resplandor de marca** (`0 10px 24px rgba(160,82,45,.2)`): exclusivo del CTA
  principal de una pantalla. Uno por pantalla, o ninguno.

### Named Rules

**La Regla del Reposo Plano.** Una tarjeta en reposo no lleva sombra ni cristal. Hoy
`components/ui/card.tsx` aplica `shadow-sm glass` por defecto a todas: es deriva
respecto de esta doctrina y debe corregirse haciendo opt-in el efecto, no al revés.

## Shapes

Esquinas suavizadas de forma constante: 12px en tarjetas y contenedores (`--radius-xl`),
7-8px en controles (botón, campo, menú), y píldora completa solo en badges de segmento y
chips de estado. El contorno es una línea de 1px; la marca no usa bordes gruesos.

**La Regla del Borde Único.** Nada de bordes de acento gruesos sobre esquinas
redondeadas: el `border-b-2` choca con el radio y el detector lo marca. Si una sección
necesita separarse, se separa con espacio o con tono, no con una línea gorda.

## Components

### Buttons

- **Shape:** esquinas suaves (7px), altura de control uniforme.
- **Primary:** fondo tierra tostada con texto blanco, 8px 16px de relleno.
- **Hover / Focus:** el fondo se oscurece; el foco visible dibuja un anillo de 1px en
  color de marca. La pulsación encoge la pieza al 98 % (framer-motion), un gesto
  discreto que confirma el toque sin animar de más.
- **Outline / Ghost:** contorno de 1px sobre fondo de página, y fantasma sin fondo hasta
  el hover. Para acciones secundarias dentro de una fila densa.
- **Altura y tacto:** la altura actual por defecto es de 36px (`h-9`), **por debajo del
  mínimo táctil de 44px**. Bajo 768px, el botón principal y todo control primario deben
  alcanzar 44px; en escritorio, 36px es correcto.

### Cards / Containers

- **Corner Style:** 12px (`rounded-xl`).
- **Background:** superficie de tarjeta, que se invierte con el tema.
- **Shadow Strategy:** ninguna en reposo (ver Elevation).
- **Border:** 1px del token de borde.
- **Internal Padding:** 24px; 16px cuando la tarjeta vive dentro de una rejilla densa.

### Inputs / Fields

- **Style:** 40px de alto, contorno de 1px, radio de 7px, fondo de página.
- **Focus:** anillo de 2px en color de marca con desplazamiento de 2px. El foco se ve
  siempre: es el único elemento que puede permitirse gritar.
- **Disabled:** opacidad al 50 % y cursor bloqueado.

### Badges de segmento (componente distintivo)

Píldora con contorno de 1px, icono Lucide a la izquierda y etiqueta en español:
Champion, Leal, Potencial, Nuevo, En Riesgo, Perdido, Prospecto. Cada segmento tiene su
terna de color (texto, fondo, borde) definida como token `--seg-*`.

**La Regla de la Terna Única.** El badge debe leer los tokens `--seg-*`, no utilidades
Tailwind sueltas. Hoy `customer-segment-badge.tsx` usa `text-yellow-700 bg-yellow-50`
mientras los tokens definen exactamente lo mismo: dos fuentes de verdad para un color
terminan divergiendo, y la que se olvida es siempre la del modo oscuro.

## Do's and Don'ts

### Do:

- **Do** escribir todo color mediante la variable semántica o su utilidad de tema, de
  forma que la pieza funcione en claro y en oscuro sin retoque.
- **Do** dar 44px de altura táctil a los controles primarios por debajo de 768px.
- **Do** mantener 16px como piso del texto que lee un cliente.
- **Do** reservar Fraunces (`.display-serif`) a títulos de marca, y dejar Inter para
  todo lo funcional.
- **Do** decir los estados en lenguaje de persona ("Pasó su fecha de recurrencia,
  contactar pronto"), como ya hacen los tooltips de segmento.

### Don't:

- **Don't** usar gradientes morados o violetas. Hay tres en el código
  (`app/contactos/page.tsx:173` y `app/portal/page.tsx:376`) y son deuda, no estilo.
- **Don't** poner sombra o cristal a una tarjeta en reposo.
- **Don't** usar bordes de acento gruesos (`border-b-2`) sobre esquinas redondeadas.
- **Don't** meter emoji en la interfaz; los iconos son Lucide. El emoji vive en
  documentación y plantillas de WhatsApp.
- **Don't** mostrar identidad de clientes en pantallas pensadas para proyectarse,
  exportarse o capturarse: la base tiene personas reales y el repositorio es público.
