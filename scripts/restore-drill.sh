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
echo "[1/5] Levantando Postgres efimero…"
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
echo "[2/5] Andamiaje de Supabase (roles, esquema auth)…"
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
echo "[3/5] Aplicando migraciones de supabase/migrations/…"
docker cp "$RAIZ/supabase/migrations" "$CONTENEDOR":/mig >/dev/null 2>&1
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
echo "[4/5] Cargando los datos del backup…"
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
echo "[5/5] Cobertura del backup…"
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

echo ""
if [ "$FALLOS" -gt 0 ]; then
  rojo "❌ ENSAYO DE RESTAURACION FALLIDO ($FALLOS bloque(s) con problemas)."
  rojo "   La base NO es reconstruible hoy con lo que hay versionado + el ultimo backup."
  exit 1
fi
verde "✅ ENSAYO DE RESTAURACION CORRECTO — esquema reconstruido y datos cargados."
exit 0
