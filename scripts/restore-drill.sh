#!/usr/bin/env bash
#
# ENSAYO DE RESTAURACION — reconstruye la base desde cero y le carga un backup real.
#
# ---------------------------------------------------------------------------
# POR QUE EXISTE
# ---------------------------------------------------------------------------
#
# El 2026-08-07 se descubrio que el backup diario llevaba meses respaldando
# **20 de las 21 tablas** y reportando exito. Faltaba `customer_type_price_lists`.
# Nadie lo noto porque **nunca se habia intentado restaurar**: el workflow decia
# "success", el ZIP existia, y ahi terminaba la comprobacion.
#
# Un backup que no se ha restaurado nunca no es un backup: es un archivo.
#
# Este script contesta la unica pregunta que importa, y la contesta ejecutando:
#
#     ¿puedo reconstruir la base y dejarla con los datos del ultimo backup?
#
# Lo hace contra un Postgres EFIMERO en Docker. No toca produccion ni necesita
# credenciales de Supabase: el esquema sale de `supabase/migrations/` (que es lo
# que hay versionado) y los datos del ZIP del backup.
#
# ---------------------------------------------------------------------------
# LO QUE ESTE ENSAYO DESTAPO LA PRIMERA VEZ QUE SE CORRIO
# ---------------------------------------------------------------------------
#
#   · `021_fase1_recurrencia.sql` dependia de columnas que NINGUNA migracion de
#     `supabase/migrations/` crea: vivian en `migrations/` (otro directorio, sin
#     numero de orden). La base NO era reconstruible desde el repo.
#   · El guard de `029` abortaba en una base nueva, porque comprueba un estado
#     que en produccion se habia creado a mano.
#
# Las dos cosas estaban invisibles mientras nadie intentara reconstruir.
#
# Uso:
#   ./scripts/restore-drill.sh                    # usa el backup mas reciente del espejo
#   ./scripts/restore-drill.sh ruta/al/backup.zip
#
# Requiere: docker, unzip. Sale con 1 si la restauracion no es posible.

set -uo pipefail

CONTENEDOR="${DRILL_CONTAINER:-cafe-restore-drill}"
PUERTO="${DRILL_PORT:-55432}"
ESPEJO="${DRILL_MIRROR:-$HOME/Backups/cafe-mirador}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRABAJO="$(mktemp -d)"
FALLOS=0

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }

limpiar() {
  docker rm -f "$CONTENEDOR" >/dev/null 2>&1
  rm -rf "$TRABAJO"
}
trap limpiar EXIT

# `-i` no es opcional: sin el, `docker exec` NO conecta stdin y todo heredoc que
# se le pase se pierde en silencio. La primera version de este script lo omitia,
# el andamiaje de `auth` nunca llegaba a crearse, y el ensayo reportaba 16
# migraciones fallidas «por culpa del repo» cuando la culpa era suya. Lo delato
# leer el error: «schema auth does not exist» es imposible si el paso 2 corrio.
psql_drill() { docker exec -i -e PGPASSWORD=drill "$CONTENEDOR" psql -U postgres -d drill "$@"; }

# --- 0. El backup a restaurar -----------------------------------------------
BACKUP="${1:-}"
if [ -z "$BACKUP" ]; then
  BACKUP="$(ls -t "$ESPEJO"/*.zip 2>/dev/null | head -1)"
fi

# Sin espejo local (el caso de CI), se baja el ultimo backup REAL del bucket.
# Es deliberado que el ensayo use el artefacto de produccion y no un fixture:
# lo que hay que probar es que ESE archivo sirve para restaurar.
if [ -z "$BACKUP" ] && [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Sin espejo local: bajando el ultimo backup del bucket…"
  NOMBRE="$(curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/list/backups" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"prefix":"","limit":1,"sortBy":{"column":"created_at","order":"desc"}}' \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['name'] if d else '')" 2>/dev/null)"
  if [ -n "$NOMBRE" ]; then
    BACKUP="$TRABAJO/$NOMBRE"
    curl -s "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/backups/$NOMBRE" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -o "$BACKUP"
  fi
fi

if [ -z "$BACKUP" ] || [ ! -f "$BACKUP" ]; then
  rojo "❌ No hay backup que restaurar (espejo: $ESPEJO; bucket: sin credenciales o vacio)."
  rojo "   Un ensayo sin backup no prueba nada, asi que NO se sale en verde."
  exit 1
fi
echo "Backup: $(basename "$BACKUP") ($(du -h "$BACKUP" | cut -f1))"
unzip -q -o "$BACKUP" -d "$TRABAJO/datos" || { rojo "❌ El ZIP no se puede descomprimir."; exit 1; }

# --- 1. Postgres efimero -----------------------------------------------------
echo ""
echo "[1/6] Levantando Postgres efimero…"
docker rm -f "$CONTENEDOR" >/dev/null 2>&1
docker run -d --name "$CONTENEDOR" -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=drill \
  -p "$PUERTO":5432 postgres:17 >/dev/null || { rojo "❌ No se pudo levantar el contenedor."; exit 1; }

for _ in $(seq 1 90); do
  psql_drill -tAc "select 1" >/dev/null 2>&1 && break
  sleep 1 2>/dev/null || true
done
psql_drill -tAc "select 1" >/dev/null 2>&1 || { rojo "❌ Postgres no respondio."; exit 1; }

# --- 2. Andamiaje de Supabase que las migraciones dan por hecho --------------
# Las migraciones usan `auth.uid()`, `auth.role()`, los roles anon/authenticated
# y columnas de `auth.users`. En Supabase lo pone la plataforma; aqui hay que
# ponerlo a mano, y por eso este bloque forma parte del ensayo: describe con
# precision de que depende el esquema ademas de sus propias migraciones.
echo "[2/6] Andamiaje de Supabase (roles, esquema auth)…"
psql_drill -q <<'SQL' >/dev/null 2>&1
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE ROLE anon NOLOGIN;                    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN;           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS;  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  confirmation_token text,
  recovery_token text,
  email_change_token_new text,
  email_change text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION auth.uid()   RETURNS uuid AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',   true), '')::uuid $$ LANGUAGE sql STABLE;
CREATE OR REPLACE FUNCTION auth.role()  RETURNS text AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$ LANGUAGE sql STABLE;
CREATE OR REPLACE FUNCTION auth.email() RETURNS text AS $$ SELECT nullif(current_setting('request.jwt.claim.email', true), '') $$ LANGUAGE sql STABLE;
SQL

# --- 3. El esquema, desde las migraciones versionadas ------------------------
# El esquema sale del PROPIO BACKUP si lo trae (desde 2026-08-07 el ZIP incluye
# `schema/`). Es la unica forma de probar que el archivo guardado fuera de
# Supabase es autosuficiente: si se usara siempre el repo, el ensayo estaria
# comprobando el repo de HOY contra datos de ayer, que no es la situacion real
# de una restauracion.
if [ -d "$TRABAJO/datos/schema" ] && [ -n "$(ls -A "$TRABAJO/datos/schema" 2>/dev/null)" ]; then
  ORIGEN_ESQUEMA="$TRABAJO/datos/schema"
  echo "[3/6] Aplicando el esquema que viene DENTRO del backup ($(ls "$ORIGEN_ESQUEMA"/*.sql | wc -l) migraciones)…"
else
  ORIGEN_ESQUEMA="$RAIZ/supabase/migrations"
  echo "[3/6] El backup NO trae esquema: usando supabase/migrations/ del repo…"
  echo "      (backup anterior al 2026-08-07; el ZIP deberia ser autosuficiente)"
fi
docker cp "$ORIGEN_ESQUEMA" "$CONTENEDOR":/mig >/dev/null 2>&1
SALIDA_MIG="$(docker exec "$CONTENEDOR" bash -c '
ok=0; fallo=0
for f in $(ls /mig/*.sql | grep -E "/[0-9]{3}[a-z]?_" | sort); do
  if timeout 30 psql -U postgres -d drill -v ON_ERROR_STOP=1 -q -f "$f" > /tmp/o.log 2>&1; then
    ok=$((ok+1))
  else
    fallo=$((fallo+1))
    echo "FALLO|$(basename $f)|$(grep -m1 -E "ERROR" /tmp/o.log | cut -c1-160)"
  fi
done
echo "RESUMEN|$ok|$fallo"')"

echo "$SALIDA_MIG" | grep '^FALLO|' | while IFS='|' read -r _ archivo err; do
  rojo "  ✗ $archivo"
  echo "     $err"
done
OKS=$(echo "$SALIDA_MIG"   | grep '^RESUMEN|' | cut -d'|' -f2)
FALLIDAS=$(echo "$SALIDA_MIG" | grep '^RESUMEN|' | cut -d'|' -f3)
echo "  migraciones aplicadas: $OKS · fallidas: $FALLIDAS"
[ "${FALLIDAS:-1}" -gt 0 ] && FALLOS=$((FALLOS+1))

# --- 4. Los datos del backup -------------------------------------------------
# `session_replication_role = replica` desactiva triggers y comprobacion de FK,
# que es lo que hace cualquier restauracion: los datos ya eran consistentes.
echo "[4/6] Cargando los datos del backup…"
docker cp "$TRABAJO/datos" "$CONTENEDOR":/datos >/dev/null 2>&1
CARGA="$(docker exec "$CONTENEDOR" bash -c '
cargadas=0; fallidas=0; filas=0
for j in /datos/*.json; do
  t=$(basename "$j" .json)
  [ "$t" = "_metadata" ] && continue
  n=$(psql -U postgres -d drill -tAc "SELECT to_regclass('\''public.$t'\'') IS NOT NULL")
  if [ "$n" != "t" ]; then echo "SINTABLA|$t"; fallidas=$((fallidas+1)); continue; fi
  # TRUNCATE antes de insertar: varias migraciones SIEMBRAN datos (021 mete las
  # plantillas de WhatsApp, 003 el inventario de ejemplo). Sin vaciar, restaurar
  # el backup encima choca contra los UNIQUE de la semilla — pasó de verdad con
  # `whatsapp_templates`. En una restauración real el backup es la fuente de
  # verdad, no la semilla.
  if psql -U postgres -d drill -v ON_ERROR_STOP=1 -q >/tmp/c.log 2>&1 <<EOF
SET session_replication_role = replica;
TRUNCATE public.$t CASCADE;
INSERT INTO public.$t SELECT * FROM jsonb_populate_recordset(NULL::public.$t, pg_read_file('\''/datos/$t.json'\'')::jsonb);
EOF
  then
    c=$(psql -U postgres -d drill -tAc "SELECT count(*) FROM public.$t")
    filas=$((filas+c)); cargadas=$((cargadas+1))
  else
    echo "ERRORCARGA|$t|$(grep -m1 ERROR /tmp/c.log | cut -c1-150)"; fallidas=$((fallidas+1))
  fi
done
echo "RESUMENCARGA|$cargadas|$fallidas|$filas"')"

echo "$CARGA" | grep -E '^(SINTABLA|ERRORCARGA)\|' | while IFS='|' read -r tipo t err; do
  [ "$tipo" = "SINTABLA" ] && rojo "  ✗ $t: el backup la trae pero el esquema reconstruido no la tiene"
  [ "$tipo" = "ERRORCARGA" ] && { rojo "  ✗ $t: no se pudieron cargar sus filas"; echo "     $err"; }
done
CARGADAS=$(echo "$CARGA" | grep '^RESUMENCARGA|' | cut -d'|' -f2)
FCARGA=$(echo  "$CARGA" | grep '^RESUMENCARGA|' | cut -d'|' -f3)
FILAS=$(echo   "$CARGA" | grep '^RESUMENCARGA|' | cut -d'|' -f4)
echo "  tablas cargadas: $CARGADAS · con problemas: $FCARGA · filas restauradas: $FILAS"
[ "${FCARGA:-1}" -gt 0 ] && FALLOS=$((FALLOS+1))

# --- 5. Cobertura: ¿el backup trae TODAS las tablas del esquema? -------------
# Este es el chequeo que faltaba el dia que el backup respaldaba 20 de 21.
echo "[5/6] Cobertura del backup…"
TABLAS_ESQUEMA="$(psql_drill -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1" | tr -d '\r')"
SIN_RESPALDO=""
for t in $TABLAS_ESQUEMA; do
  [ -f "$TRABAJO/datos/$t.json" ] || SIN_RESPALDO="$SIN_RESPALDO $t"
done
if [ -n "$SIN_RESPALDO" ]; then
  rojo "  ✗ tablas del esquema SIN respaldo en el ZIP:$SIN_RESPALDO"
  echo "     (si el exportador ya las incluye, el ZIP es anterior al arreglo:"
  echo "      lo dirá la comprobación siguiente, que mira el CÓDIGO y no el ZIP)"
  FALLOS=$((FALLOS+1))
else
  echo "  todas las tablas del esquema tienen su JSON en el backup"
fi

# Y la misma pregunta hecha al CODIGO, que es lo que decide los backups FUTUROS.
# El ZIP de hoy solo dice qué pasó anoche; `TABLES_TO_EXPORT` dice qué pasará
# mañana, y es donde vivía el defecto de las 20 tablas.
EXPORTADAS="$(sed -n "/^const TABLES_TO_EXPORT/,/^\]/p" "$RAIZ/scripts/backup/export-tables.ts" \
  | grep -oE "^\s*'[a-z_]+'" | tr -d " '")"
FUTURO_SIN_RESPALDO=""
for t in $TABLAS_ESQUEMA; do
  echo "$EXPORTADAS" | grep -qx "$t" || FUTURO_SIN_RESPALDO="$FUTURO_SIN_RESPALDO $t"
done
if [ -n "$FUTURO_SIN_RESPALDO" ]; then
  rojo "  ✗ el exportador NO respaldará estas tablas del esquema:$FUTURO_SIN_RESPALDO"
  rojo "    Añádelas a TABLES_TO_EXPORT en scripts/backup/export-tables.ts"
  FALLOS=$((FALLOS+1))
else
  echo "  el exportador cubre las $(echo "$TABLAS_ESQUEMA" | wc -w) tablas del esquema"
fi

# --- 6. Paridad con produccion ----------------------------------------------
# Reconstruir "algo que acepta los datos" no basta: hay que reconstruir LA base.
# Si en produccion vive un objeto que ninguna migracion crea —paso con
# `inventory_for_pricing`, creada a mano en el dashboard— el dia de la
# restauracion aparece de menos y nadie se entera hasta que algo lo llama.
echo "[6/6] Paridad con produccion…"
if [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  PROD_JSON="$(curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")"
  PROD_OBJETOS="$(printf '%s' "$PROD_JSON" | python3 -c "import sys,json;print('\n'.join(sorted(json.load(sys.stdin).get('definitions',{}))))" 2>/dev/null)"
  # `len('/rpc/')` y no un 6 a ojo: con el 6 se comia la primera letra de cada
  # nombre y la comparacion reprobaba las 54 funciones de golpe. Un verificador
  # que suspende el 100% esta roto, no ha encontrado algo.
  PROD_RPC="$(printf '%s' "$PROD_JSON" | python3 -c "import sys,json;P='/rpc/';print('\n'.join(sorted(p[len(P):] for p in json.load(sys.stdin).get('paths',{}) if p.startswith(P))))" 2>/dev/null)"

  LOCAL_OBJETOS="$(psql_drill -tAc "SELECT c.relname FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','v') ORDER BY 1" | tr -d '\r')"
  LOCAL_RPC="$(psql_drill -tAc "SELECT DISTINCT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY 1" | tr -d '\r')"

  if [ -z "$PROD_OBJETOS" ]; then
    rojo "  ✗ no se pudo leer el esquema de produccion; la paridad queda SIN COMPROBAR"
    FALLOS=$((FALLOS+1))
  else
    FALTAN_OBJ=""; for o in $PROD_OBJETOS; do echo "$LOCAL_OBJETOS" | grep -qx "$o" || FALTAN_OBJ="$FALTAN_OBJ $o"; done
    FALTAN_RPC=""; for f in $PROD_RPC;     do echo "$LOCAL_RPC"     | grep -qx "$f" || FALTAN_RPC="$FALTAN_RPC $f"; done
    if [ -n "$FALTAN_OBJ" ]; then
      rojo "  ✗ objetos que existen en PRODUCCION y no en la base reconstruida:$FALTAN_OBJ"
      rojo "    Viven solo en produccion: si se pierde, se pierden. Versionalos o retiralos."
      FALLOS=$((FALLOS+1))
    fi
    if [ -n "$FALTAN_RPC" ]; then
      rojo "  ✗ funciones que existen en PRODUCCION y no en la base reconstruida:$FALTAN_RPC"
      FALLOS=$((FALLOS+1))
    fi

    # --- Y las COLUMNAS, que es el escalon que faltaba --------------------
    #
    # Comparar objetos y funciones no dice nada de lo que hay DENTRO de cada
    # tabla. Lo demostro `price_list_items.custom_price`: existia en produccion
    # y en ninguna migracion, asi que la 036 —que la nombra— reventaba con
    # `42703` contra una base reconstruida. Los pasos 1-5 no podian verlo, y el
    # paso 6 daba «paridad completa» con la columna ausente.
    #
    # Es el mismo modo de fallo que ya se cerro dos veces en este repo, un
    # escalon mas abajo cada vez: primero funciones (033), luego vistas (030),
    # ahora columnas. **Revisar el mecanismo que conoces no dice nada del que no
    # estas mirando.**
    PROD_COLS="$(printf '%s' "$PROD_JSON" | python3 -c "
import sys, json
d = json.load(sys.stdin).get('definitions', {})
for tabla in sorted(d):
    for col in sorted(d[tabla].get('properties', {})):
        print(f'{tabla}.{col}')
" 2>/dev/null)"
    LOCAL_COLS="$(psql_drill -tAc "
      SELECT c.relname || '.' || a.attname
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
       WHERE c.relnamespace = 'public'::regnamespace
         AND c.relkind IN ('r','v')
         AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY 1" | tr -d '\r')"

    FALTAN_COL=""
    for c in $PROD_COLS; do
      # Solo se reclaman columnas de tablas que SI existen localmente: si falta
      # la tabla entera, ya lo dijo FALTAN_OBJ y repetirlo por cada columna
      # convierte un fallo en veinte.
      tabla="${c%%.*}"
      echo "$LOCAL_OBJETOS" | grep -qx "$tabla" || continue
      echo "$LOCAL_COLS" | grep -qx "$c" || FALTAN_COL="$FALTAN_COL $c"
    done
    if [ -n "$FALTAN_COL" ]; then
      rojo "  ✗ columnas que existen en PRODUCCION y no en la base reconstruida:$FALTAN_COL"
      rojo "    Alguien las creo a mano. Versionalas en una migracion o la restauracion"
      rojo "    devolvera unas tablas con menos campos de los que el codigo espera."
      FALLOS=$((FALLOS+1))
    fi

    [ -z "$FALTAN_OBJ$FALTAN_RPC$FALTAN_COL" ] && \
      echo "  todo lo que produccion expone ($(echo "$PROD_OBJETOS" | wc -w) objetos, $(echo "$PROD_RPC" | wc -w) RPC, $(echo "$PROD_COLS" | wc -w) columnas) sale de las migraciones"
  fi
else
  echo "  sin credenciales: paridad con produccion NO comprobada (no es un aprobado)"
fi

echo ""
if [ "$FALLOS" -gt 0 ]; then
  rojo "❌ ENSAYO DE RESTAURACION FALLIDO ($FALLOS bloque(s) con problemas)."
  rojo "   La base NO es reconstruible hoy con lo que hay versionado + el ultimo backup."
  exit 1
fi
verde "✅ ENSAYO DE RESTAURACION CORRECTO — esquema reconstruido y datos cargados."
exit 0
