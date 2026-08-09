# Manual de usuario — Café Mirador

Guía para **usar** el sistema día a día. No hace falta saber programar ni instalar nada:
todo se hace desde el navegador.

- **Dirección del sistema:** <https://cafe-pi-steel.vercel.app>
- **Última revisión contra el sistema real:** 2026-07-27

> Si lo que buscas es instalar, modificar o desplegar el sistema, este no es el documento.
> Para eso están [`INSTRUCCIONES.md`](INSTRUCCIONES.md) y [`CLAUDE.md`](CLAUDE.md).

---

## 1. Entrar por primera vez

1. Abre <https://cafe-pi-steel.vercel.app> en el navegador (sirve el del celular).
2. Escribe tu **correo** y tu **contraseña**.

La primera vez verás una pantalla que dice que tu cuenta está **pendiente de aprobación**.
Es normal y no es un error: por seguridad, nadie entra solo por registrarse. Un
administrador tiene que autorizarte.

**Si eres administrador y alguien está esperando:** en la pantalla principal aparece un
aviso con la cantidad de personas pendientes. Al abrirlo puedes aprobar o rechazar a cada
una.

### Los dos tipos de usuario

| Tipo              | Qué puede hacer                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Vendedor**      | Registrar ventas, crear y editar clientes, ver inventario, ver analíticas                                                                |
| **Administrador** | Todo lo anterior, **más**: modificar el inventario, gestionar listas de precios, descargar copias de seguridad y aprobar usuarios nuevos |

Si intentas entrar a una sección que no te corresponde, sencillamente no la verás.

---

## 2. Registrar una venta

Es la tarea más frecuente. Desde la pantalla principal, botón de **Nueva Venta**.

1. **Elige el cliente.** Si es alguien nuevo, puedes crearlo ahí mismo sin salir.
   Si es una venta suelta a alguien de paso, existe el cliente **«Venta Rápida»**.
2. **Elige el producto y la cantidad**, en libra (**500 g**) o media libra (**250 g**).
3. **Indica el método de pago** y, si la venta no es de hoy, cambia la fecha.
4. Confirma.

Al confirmar, el sistema hace solo tres cosas más: descuenta el café del inventario,
actualiza la fecha de última compra del cliente y calcula la ganancia.

### Te vas a equivocar alguna vez: tienes 24 horas

Una venta se puede **editar durante las 24 horas siguientes** a haberla registrado.
Pasado ese plazo queda cerrada. Esto es a propósito: evita que se toquen las cuentas de
días ya cerrados.

Si necesitas corregir algo más viejo, tendrá que hacerlo un administrador directamente
sobre los datos.

### Repetir el pedido de siempre

En la ficha de un cliente hay un botón para **repetir su última compra**. Trae los mismos
productos y cantidades, y solo tienes que confirmar. Para clientes fijos ahorra casi todo
el trabajo.

---

## 3. Saber a quién llamar hoy

Esta es la parte que más vende, y la que más se desaprovecha.

El sistema aprende cada cuánto compra cada cliente y avisa cuando a alguien «le toca».

**Cómo lo calcula:** necesita **al menos 2 compras registradas**. Con eso saca el promedio
de días entre las **últimas 3**. Con una sola compra todavía no puede predecir nada — por
eso importa registrar hasta las ventas pequeñas.

En la pantalla de **Contactos** ves la lista ya ordenada por urgencia:

| Color / urgencia | Qué significa                                             |
| ---------------- | --------------------------------------------------------- |
| **Alta**         | Lleva 7 días o más de retraso respecto de lo normal en él |
| **Media**        | Ya pasó su fecha esperada                                 |
| **Baja**         | Le toca en los próximos 3 días                            |

Junto a cada persona hay un botón de **WhatsApp** que abre el chat con un mensaje ya
escrito, adaptado a su situación (cuánto lleva sin comprar, qué suele llevar).

> **El mensaje no se envía solo.** El botón abre WhatsApp con el texto preparado; tú lo
> lees, lo cambias si quieres y le das a enviar. El sistema nunca escribe a nadie por su
> cuenta.

En esa misma pantalla hay una sección de **Prospectos**: personas registradas que **nunca
han comprado**. Son la lista de primeras llamadas.

---

## 4. Clientes

En **Clientes** está todo el mundo, con su estado. Al abrir una ficha puedes cambiar
nombre, teléfono, correo, dirección, tipo de cliente y zona de entrega.

Dos campos que conviene entender:

- **Recurrencia:** cada cuántos días compra. El sistema propone un número cuando ya tiene
  datos suficientes; puedes aceptarlo o poner el tuyo si conoces al cliente mejor que él.
- **Tipo de cliente:** determina qué lista de precios se le aplica (por ejemplo, mayorista
  o cafetería pagan distinto que una venta al detal).

---

## 5. Inventario

**Inventario** muestra lo que hay, cuánto queda y qué está por acabarse. Las alertas de
stock bajo aparecen también en la pantalla principal.

Cada producto tiene un **historial de movimientos** (el «kardex»): quién metió o sacó café,
cuándo y por qué. Se registran cuatro tipos de movimiento: reposición, devolución, merma y
ajuste.

> **En mermas y devoluciones el motivo es obligatorio.** No es burocracia: sin el motivo,
> dentro de tres meses un faltante es indistinguible de un robo o de un error de digitación.

Modificar el inventario es cosa de **administradores**. Un vendedor lo ve pero no lo toca;
las ventas sí descuentan solas.

### El stock puede aparecer en negativo, y no es un error

Desde el 9 de agosto de 2026, el sistema **nunca te impide registrar una venta**
por falta de existencias. Antes te bloqueaba, y eso era peor de lo que parece:
aquí primero se vende y después se registra, así que te impedía anotar algo que
**ya había pasado** — y esa venta no descontaba café, no contaba en las cuentas,
no actualizaba a quién hay que llamar ni entraba en lo que te deben.

Si ves **−500 g** en un producto, el sistema te está diciendo:

> «Vendiste media libra más de la que yo sabía que tenías. Anota la entrada que falta.»

Se arregla solo en cuanto registres el café que entró. Un número negativo es un
recordatorio, no un fallo.

---

## 6. Precios (solo administradores)

En **Precios** se arman listas de precios distintas según el tipo de cliente. Se define una
vez y a partir de ahí cada venta toma el precio que corresponde, sin que nadie tenga que
acordarse.

**El precio base de cada café se pone en Inventario**, al editar el producto: precio de la
libra y precio de la media libra. Hoy son **$45.000 y $25.000**. Fíjate en que la media
libra **no es la mitad**: es su propio precio, y el sistema lo respeta.

> **Sobre la ganancia que verás.** El sistema calcula cuánto ganas restando lo que te cuesta
> el café. Ese costo está en **$52 por gramo**, que es el que hace que una libra deje los
> **$19.000** que dejas de verdad. La media libra te aparecerá con $12.000 de ganancia
> cuando en realidad deja $11.500: la diferencia son $500 y viene de que el empaque de media
> libra cuesta casi lo mismo que el de una libra. Está medido y es conocido; si algún día
> vendes muchas medias libras, avisa y se afina.

---

## 7. Analíticas

**Analytics** responde a «¿cómo vamos?». Puedes elegir el periodo (hoy, semana, mes, año o
un rango a mano) y ver ventas en el tiempo, productos más vendidos, ganancia y margen, y
comportamiento de los métodos de pago.

Es la pantalla para mirar una vez por semana, no todos los días.

---

## 8. Copias de seguridad (solo administradores)

Hay dos cosas distintas, y conviene no confundirlas.

**Descargar datos** (pantalla de **Backups**): eliges qué tablas quieres y en qué formato
—CSV o Excel—, con filtro de fechas si aplica. Sirve para trabajar los datos aparte, pasarlos
al contador o revisarlos en una hoja de cálculo. Máximo 10.000 registros por tabla.

**Copia de seguridad automática:** funciona sola, todos los días, sin que nadie haga nada.
Guarda una copia completa y conserva las de los últimos 7 días, los 4 domingos anteriores y
el primero de cada mes del último año.

> **Una copia automática que nadie revisa no es una copia de seguridad.** En este proyecto
> ya pasó: el proceso dejó de correr en abril de 2026 y nadie se enteró en **111 días**.
> Vale la pena entrar a esta pantalla una vez al mes y confirmar que la copia más reciente
> es de ayer, no de hace meses.

---

## 9. El portal del cliente

Tus clientes pueden entrar a su propia pantalla y pedir sin llamarte.

**Cómo darle acceso a alguien:** en la lista de **Clientes**, el botón con el ícono de llave
genera un enlace personal y lo prepara para enviárselo por WhatsApp.

Dos cosas que hay que saber para no confundirse:

- **El enlace se vence en 24 horas.** Si el cliente lo abre al tercer día, no funciona: hay
  que generarle otro. No es una falla.
- **Una vez que entra, no vuelve a pedir clave durante 30 días.** No hay contraseñas que
  recordar ni recuperar.

Desde su portal, el cliente puede ver su último pedido y cuándo le tocaría el siguiente,
hacer un pedido nuevo, consultar su historial, corregir sus datos de contacto, dejar
programado un pedido automático cada X días (y pausarlo, saltarse una entrega o cancelarlo)
y generar códigos para referir amigos.

**Lo que llega a ti:** los pedidos del portal entran como **pendientes**. No descuentan
inventario ni se dan por buenos hasta que tú los confirmas y les pones el precio. El cliente
propone; tú decides.

---

## 10. Referidos (voz a voz)

Cada cliente puede generar un código para pasarle a un conocido. Cuando esa persona compra,
el sistema registra el referido y la recompensa que corresponde a cada parte. En el panel de
administración ves todos los códigos, cuáles se usaron y cuánto se ha dado en recompensas.

---

## 11. Cuando algo no funciona

| Lo que ves                                  | Qué pasa y qué hacer                                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| «Tu cuenta está pendiente»                  | Nadie te ha aprobado todavía. Pídeselo a un administrador                    |
| No aparece Inventario, Precios o Backups    | Esas secciones son solo de administradores                                   |
| No puedes editar una venta                  | Pasaron más de 24 horas. Es a propósito                                      |
| El enlace del portal no le sirve al cliente | Se venció (dura 24 horas). Genera otro                                       |
| El sistema no sugiere recurrencia           | Ese cliente tiene menos de 2 compras registradas                             |
| Todo carga pero no aparece ningún dato      | Puede que la base de datos esté dormida. Avisa a quien administra el sistema |

**Regla general:** antes de dar algo por roto, recarga la página. Si sigue igual, anota
**qué estabas haciendo** y **qué decía exactamente el mensaje**. Un reporte con esos dos
datos se resuelve en minutos; un «no funciona» puede tardar días.

---

## 12. Lo que el sistema NO hace

Conviene tenerlo claro para no esperar algo que no va a pasar:

- **No envía mensajes solo.** Prepara el texto de WhatsApp; enviarlo es siempre decisión tuya.
- **No cobra ni procesa pagos.** Registra cómo se pagó, no mueve dinero.
- **No factura electrónicamente.** No emite documentos ante la DIAN.
- **No controla varias sedes.** Está pensado para una sola operación.
- **No funciona sin internet.** Todo vive en línea; no hay modo desconectado.
- **No lleva abonos parciales.** Una venta está pagada o pendiente, sin puntos medios. Si un
  cliente te abona una parte, el sistema seguirá mostrando la venta entera como pendiente:
  por eso **lo que ves en «pendiente de cobro» es un techo, no la cifra exacta**.
- **No sabe qué pago corresponde a qué venta.** Sabe cuánto te compró y cuánto te pagó cada
  cliente; el emparejamiento lo hace de la compra más vieja a la más nueva.

---

## 13. Sobre los datos de tus clientes

En este sistema hay nombres, teléfonos, direcciones y hábitos de compra de personas reales,
y algunos son menores de edad. Eso son datos personales y la ley colombiana los protege
(Ley 1581 de 2012).

En la práctica, tres cosas:

1. **No compartas tu usuario.** Si alguien más necesita entrar, que tenga su propia cuenta:
   así se sabe quién hizo cada cosa.
2. **Lo que exportas deja de estar protegido.** Un Excel descargado a tu computador ya no
   tiene los controles del sistema. Trátalo como tratarías una libreta con los teléfonos de
   tus clientes.
3. **No pegues esos archivos en grupos de WhatsApp ni en carpetas compartidas.** Es la forma
   más común de que se filtren.

---

## 14. Qué hay dentro hoy (9 de agosto de 2026)

El sistema ya no tiene datos de prueba: tiene tu negocio.

|                    |                                            |
| ------------------ | ------------------------------------------ |
| Clientes           | **52**                                     |
| Ventas registradas | **143**, desde el 26 de septiembre de 2024 |
| Facturado          | **$6.440.000**                             |
| Pendiente de cobro | **$1.506.500** repartido en 27 clientes    |
| Café en existencia | **sin registrar todavía**                  |

De esas 143 ventas, **9 no estaban documentadas**: se reconstruyeron a partir de
pagos tuyos que no correspondían a ninguna venta anotada. Cada una coincide
exactamente con el precio que tenía la libra ese día, y llevan una nota que lo
dice.

> **Lo que falta:** registrar cuánto café tienes. Al 9 de agosto hay café
> **esperando tueste y sin pesar**, así que la cifra todavía no existe. En cuanto
> lo peses, se anota en **Inventario** y el sistema queda al día — incluido el
> −500 g que hoy marca el Café Molido Medio por la venta del jueves 6.

---

## Documentos relacionados

| Documento                                | Para qué                                            |
| ---------------------------------------- | --------------------------------------------------- |
| [`INSTRUCCIONES.md`](INSTRUCCIONES.md)   | Guía técnica del proyecto                           |
| [`README.md`](README.md)                 | Qué es el proyecto y cómo levantarlo                |
| [`docs/SYLLABUS.md`](docs/SYLLABUS.md)   | Por dónde empezar a leer el código                  |
| [`docs/BACKLOG.md`](docs/BACKLOG.md)     | Lo que falta y lo que ya se descartó, con su motivo |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)     | Qué se entregó y cuál es el siguiente paso          |
| [`docs/BLUEPRINT.md`](docs/BLUEPRINT.md) | Por qué el sistema es así (decisiones D1–D9)        |
| [`CLAUDE.md`](CLAUDE.md)                 | Referencia técnica completa                         |
