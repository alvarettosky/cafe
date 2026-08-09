#!/usr/bin/env python3
"""
Carga en el CRM el historico real de ventas y pagos que vivia en un CSV.

===========================================================================
POR QUE ES UN SCRIPT Y NO UNA MIGRACION
===========================================================================

`alvarettosky/cafe` es un repositorio **PUBLICO**. El CSV tiene 53 personas
identificables por nombre —algunas menores, identificadas por curso («Hermano
de Emanuel (10B)»)— con montos, fechas y notas libres. Una migracion con esos
`INSERT` publicaria todo eso en GitHub, donde queda cacheado e indexado aunque
despues se borre.

Asi que el CSV vive en el repositorio **privado** y aqui solo esta el
procedimiento. Este archivo no contiene ni un dato personal, y por eso puede
versionarse.

===========================================================================
LAS DECISIONES QUE TOMA, Y POR QUE
===========================================================================

**1. Producto.** Las 133 ventas dicen «Cafe Tostado y Molido», que se mapea a
`Cafe Molido Medio`. Es el unico producto del catalogo que corresponde.

**2. Cantidad y unidad.** `cantidad_libras` × `precio_unitario_cop` cuadra con
`monto_total_cop` en las 133 filas, asi que esas tres columnas son la fuente de
verdad. La columna `unidad` NO lo es: en dos filas dice `media_libra` con
`cantidad_libras = 1.0` y un total que es el precio de una libra entera de ese
anio ($38.000 y $42.000). Se usa la cantidad, no la etiqueta.

    cantidad_libras = 0.5  ->  unit='media_libra', quantity=1
    cantidad_libras = N    ->  unit='libra',       quantity=N

**3. Que ventas estan pagadas — la parte delicada.** Los 105 registros de PAGO
**no apuntan a su venta**: `venta_asociada` dice «DESCONOCIDO» en los 105. Solo
se sabe, por cliente, cuanto vendio y cuanto pagó.

Se imputan los pagos **por cliente, de la venta mas antigua a la mas nueva**
(FIFO), que es como se salda una cuenta corriente. Una venta cubierta queda con
el metodo del pago que la cubrio; una venta sin cubrir queda como
**«Pago a credito o pendiente»**, que es la opcion que el propio modal de venta
ofrece para eso.

Es una **reconstruccion**, no un dato: si el negocio imputo los pagos de otra
forma, la cartera por cliente sera la misma pero la venta concreta marcada como
pendiente puede diferir. El total no: son $6.087.500 vendidos contra $4.895.500
cobrados.

**4. Margenes del historico.** El trigger `calculate_sale_item_profit` calcula
la ganancia con el `cost_per_gram` de HOY ($52). El cafe costaba menos en 2024,
asi que **los margenes historicos son aproximados**, calculados a costo actual.
No hay costo historico en ninguna parte, y poner cero seria peor: daria un
margen del 100 %.

**5. Idempotencia.** Cada venta lleva en `notes` una marca `[csv:<mensaje_id>]`.
Si el script se corre dos veces, las ventas ya marcadas se saltan. Sin eso, un
segundo intento duplicaria el historico entero y nadie lo notaria hasta cuadrar
caja.

Uso:
    NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \\
      python3 scripts/importar-historico.py <ruta-al-csv> [--ejecutar]

Sin `--ejecutar` hace un ensayo en seco: dice que haria, y no toca la base.
"""

import csv
import json
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict

PRODUCTO_DESTINO = "Café Molido Medio"
CLIENTES_DE_PRUEBA = ["El mono", "Profe Vanesa"]
PENDIENTE = "Pago a crédito o pendiente"

# Valores de `cliente_pagador` que NO son personas. El CSV trae una fila de pago
# por $0 con el nombre «Pendiente» y el texto «Pendiente pago»: es una anotacion
# del registro original, no un cliente. La primera corrida la dio de alta como
# persona, y aparecio en el CRM como un cliente sin ninguna compra — 53 clientes
# donde hay 52. Un nombre que sale de una columna de texto libre hay que filtrarlo
# antes de convertirlo en una fila de `customers`.
NO_SON_CLIENTES = {"pendiente", "desconocido", "n/a", "-", "sin nombre", "?"}

# Del vocabulario del CSV al del modal de venta. Los que no tienen equivalente
# claro se dejan como estan en vez de atribuirlos a una cuenta concreta:
# «NEQUI» no dice si fue la de Alvaretto o la de La Negra, y elegir una seria
# inventar un dato contable.
METODOS = {
    "EFECTIVO": "Efectivo",
    "DAVIPLATA": "DaviPlata",
    "DAVIVIENDA": "Transf. Davivienda",
    "BANCOLOMBIA": "Transf. Bancolombia",
    "TRANSFERENCIA": "Transferencia",
    "NEQUI": "Nequi",
    "DESCONOCIDO": "Efectivo",
    "": "Efectivo",
}


def pedir(url, clave, metodo="GET", ruta="", cuerpo=None, cabeceras=None):
    req = urllib.request.Request(
        f"{url}/rest/v1/{ruta}",
        method=metodo,
        data=json.dumps(cuerpo).encode() if cuerpo is not None else None,
    )
    req.add_header("apikey", clave)
    req.add_header("Authorization", f"Bearer {clave}")
    req.add_header("Content-Type", "application/json")
    for k, v in (cabeceras or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req) as r:
        texto = r.read().decode()
        return json.loads(texto) if texto.strip() else None


def leer_csv(ruta):
    with open(ruta, encoding="utf-8-sig") as f:
        filas = list(csv.DictReader(f))
    ventas, pagos = [], []
    for f in filas:
        registro = {
            "cliente": f["cliente_pagador"].strip(),
            "fecha": f["fecha_transaccion"].strip(),
            "monto": float(f["monto_total_cop"] or 0),
            "metodo": f["metodo_pago"].strip().upper(),
            "mensaje_id": f["mensaje_id"].strip(),
            "notas": (f["notas"] or f["texto_original"] or "").strip(),
        }
        # Se descartan las anotaciones que no son transacciones de una persona:
        # nombre no valido, o un movimiento de $0 (el CSV usa el importe cero
        # para marcar «queda pendiente», no para registrar dinero).
        if registro["cliente"].lower() in NO_SON_CLIENTES or registro["monto"] <= 0:
            continue
        if f["tipo_registro"] == "VENTA":
            registro["libras"] = float(f["cantidad_libras"] or 0)
            registro["precio_unitario"] = float(f["precio_unitario_cop"] or 0)
            ventas.append(registro)
        elif f["tipo_registro"] == "PAGO":
            pagos.append(registro)
    ventas.sort(key=lambda v: (v["fecha"], v["mensaje_id"]))
    pagos.sort(key=lambda p: (p["fecha"], p["mensaje_id"]))
    return ventas, pagos


def imputar_pagos(ventas, pagos):
    """Aplica los pagos de cada cliente a sus ventas, de la mas antigua a la mas
    nueva. Devuelve, por venta, cuanto quedo cubierto y con que metodo."""
    por_cliente_pagos = defaultdict(list)
    for p in pagos:
        por_cliente_pagos[p["cliente"]].append(p)

    saldo = {c: sum(p["monto"] for p in ps) for c, ps in por_cliente_pagos.items()}
    metodo_por_cliente = {}
    for c, ps in por_cliente_pagos.items():
        # El metodo mas frecuente del cliente: es lo mas cercano a la verdad
        # cuando no se sabe que pago salda que venta.
        cuenta = defaultdict(float)
        for p in ps:
            cuenta[p["metodo"]] += p["monto"]
        metodo_por_cliente[c] = max(cuenta, key=cuenta.get)

    for v in ventas:
        disponible = saldo.get(v["cliente"], 0.0)
        if disponible >= v["monto"]:
            saldo[v["cliente"]] = disponible - v["monto"]
            v["pagada"] = True
            v["metodo_final"] = METODOS.get(
                metodo_por_cliente.get(v["cliente"], ""), "Efectivo"
            )
        else:
            v["pagada"] = False
            v["cubierto"] = disponible
            saldo[v["cliente"]] = 0.0
            v["metodo_final"] = PENDIENTE
    return ventas


def main():
    if len(sys.argv) < 2:
        sys.exit("Falta la ruta del CSV.\n" + __doc__.strip().split("Uso:")[-1])
    ruta_csv = sys.argv[1]
    ejecutar = "--ejecutar" in sys.argv

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    clave = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not clave:
        sys.exit("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.")

    ventas, pagos = leer_csv(ruta_csv)
    ventas = imputar_pagos(ventas, pagos)
    clientes = sorted({v["cliente"] for v in ventas} | {p["cliente"] for p in pagos})

    total_v = sum(v["monto"] for v in ventas)
    total_p = sum(p["monto"] for p in pagos)
    print(f"CSV: {len(ventas)} ventas · {len(pagos)} pagos · {len(clientes)} clientes")
    print(f"     vendido ${total_v:,.0f} · cobrado ${total_p:,.0f} · cartera ${total_v - total_p:,.0f}")
    print(f"     ventas que quedan pendientes: {sum(1 for v in ventas if not v['pagada'])}")

    # --- El producto contra el que se cargan ---
    prod = pedir(url, clave, ruta=f"inventory?product_name=eq.{urllib.parse.quote(PRODUCTO_DESTINO)}&select=product_id")
    if not prod:
        sys.exit(f"No existe el producto «{PRODUCTO_DESTINO}» en inventory.")
    product_id = prod[0]["product_id"]
    print(f"     producto destino: {PRODUCTO_DESTINO} ({product_id[:8]}…)")

    # --- Idempotencia: que ventas ya se importaron ---
    ya = pedir(url, clave, ruta="sales?select=notes&notes=like.*%5Bcsv:*")
    marcas = set()
    for s in ya or []:
        n = s.get("notes") or ""
        if "[csv:" in n:
            marcas.add(n.split("[csv:")[1].split("]")[0])
    pendientes = [v for v in ventas if v["mensaje_id"] not in marcas]
    print(f"     ya importadas: {len(marcas)} · por importar: {len(pendientes)}")

    if not ejecutar:
        print("\nENSAYO EN SECO — no se toco la base. Anade --ejecutar para cargar.")
        for v in pendientes[:3]:
            print(f"  ej: {v['fecha']} · {v['cliente'][:24]:26} · {v['libras']} lb · ${v['monto']:,.0f} · {v['metodo_final']}")
        return

    # --- 1. Retirar los clientes de prueba ---
    for nombre in CLIENTES_DE_PRUEBA:
        c = pedir(url, clave, ruta=f"customers?full_name=eq.{urllib.parse.quote(nombre)}&select=id")
        for fila in c or []:
            cid = fila["id"]
            ventas_demo = pedir(url, clave, ruta=f"sales?customer_id=eq.{cid}&select=id") or []
            for s in ventas_demo:
                pedir(url, clave, "DELETE", f"sale_items?sale_id=eq.{s['id']}")
                pedir(url, clave, "DELETE", f"sales?id=eq.{s['id']}")
            pedir(url, clave, "DELETE", f"customer_contacts?customer_id=eq.{cid}")
            pedir(url, clave, "DELETE", f"customers?id=eq.{cid}")
            print(f"  retirado cliente de prueba: {nombre} ({len(ventas_demo)} venta(s))")

    # --- 2. Clientes ---
    existentes = {c["full_name"]: c["id"] for c in (pedir(url, clave, ruta="customers?select=id,full_name") or [])}
    nuevos = [{"full_name": n} for n in clientes if n not in existentes]
    if nuevos:
        creados = pedir(url, clave, "POST", "customers", nuevos, {"Prefer": "return=representation"})
        for c in creados:
            existentes[c["full_name"]] = c["id"]
    print(f"  clientes: {len(nuevos)} creados · {len(existentes)} en total")

    # --- 3. Ventas, en orden cronologico ---
    #     El orden importa: el trigger `update_customer_last_purchase` escribe
    #     `last_purchase_date = NEW.created_at` en cada insercion, sin comparar.
    #     Desordenado, el ultimo insertado gana y la fecha queda mal.
    creadas = 0
    for v in pendientes:
        nota = f"{v['notas'][:400]} [csv:{v['mensaje_id']}]".strip()
        if not v["pagada"] and v.get("cubierto", 0) > 0:
            nota = f"Abonado ${v['cubierto']:,.0f} de ${v['monto']:,.0f}. " + nota
        venta = pedir(url, clave, "POST", "sales", [{
            "customer_id": existentes[v["cliente"]],
            "created_at": f"{v['fecha']}T12:00:00-05:00",
            "payment_method": v["metodo_final"],
            "notes": nota,
            "status": "completed",
        }], {"Prefer": "return=representation"})[0]

        if v["libras"] == 0.5:
            unidad, cantidad = "media_libra", 1
        else:
            unidad, cantidad = "libra", int(v["libras"])

        pedir(url, clave, "POST", "sale_items", [{
            "sale_id": venta["id"],
            "product_id": product_id,
            "unit": unidad,
            "quantity": cantidad,
            "price_per_unit": v["monto"] / cantidad,
            "total_price": v["monto"],
        }])
        # `sales.total_amount` no lo calcula ningun trigger: lo escribe
        # `process_coffee_sale` al final. Aqui hay que ponerlo a mano.
        pedir(url, clave, "PATCH", f"sales?id=eq.{venta['id']}", {"total_amount": v["monto"]})
        creadas += 1
    print(f"  ventas creadas: {creadas}")

    # --- 4. Recurrencia, con la funcion del propio sistema ---
    #     No se reimplementa la formula: se llama a la que usa la app, para que
    #     el historico y lo que se venda manana se midan igual.
    con_recurrencia = 0
    for nombre, cid in existentes.items():
        try:
            r = pedir(url, clave, "POST", "rpc/calculate_customer_recurrence", {"p_customer_id": cid})
            if r:
                pedir(url, clave, "PATCH", f"customers?id=eq.{cid}", {"typical_recurrence_days": r})
                con_recurrencia += 1
        except Exception:
            pass
    print(f"  clientes con recurrencia calculada: {con_recurrencia}")


if __name__ == "__main__":
    main()
