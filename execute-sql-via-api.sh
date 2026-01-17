#!/bin/bash

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 EJECUTAR SQL VIA SUPABASE API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get Service Role Key from mcp.json
SERVICE_ROLE_KEY=$(cat ~/.config/claude/mcp.json | grep -oP 'SUPABASE_SERVICE_ROLE_KEY":\s*"\K[^"]+')

echo "Service Role Key encontrada: ${SERVICE_ROLE_KEY:0:50}..."
echo "Longitud: ${#SERVICE_ROLE_KEY} caracteres"
echo ""

if [ ${#SERVICE_ROLE_KEY} -lt 100 ]; then
    echo "❌ ERROR: Service Role Key muy corta"
    exit 1
fi

# Read SQL file
SQL_CONTENT=$(cat /tmp/fix_analytics.sql)

echo "SQL file leído: $(echo "$SQL_CONTENT" | wc -l) líneas"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Ejecutando SQL en Supabase..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Try to execute using Supabase Management API
# Note: This endpoint might not be publicly available
curl -X POST \
  "https://inszvqzpxfqibkjsptsm.supabase.co/rest/v1/rpc/exec" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"query\": $(echo "$SQL_CONTENT" | jq -Rs .)}" \
  2>&1

echo ""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
