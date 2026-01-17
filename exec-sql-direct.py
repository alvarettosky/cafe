#!/usr/bin/env python3
"""
Ejecutar SQL directamente en Supabase usando Management API
"""
import urllib.request
import urllib.error
import json
import sys

SUPABASE_URL = "https://inszvqzpxfqibkjsptsm.supabase.co"
ACCESS_TOKEN = "sbp_80994edcf4c3fd2b6b13210caa6da87f5add6a05"
PROJECT_REF = "inszvqzpxfqibkjsptsm"

def execute_sql_file(filepath):
    """Execute SQL from file"""
    print(f"📄 Leyendo {filepath}...")

    with open(filepath, 'r') as f:
        sql = f.read()

    print(f"📝 SQL a ejecutar ({len(sql)} caracteres)")
    print("=" * 60)
    print(sql[:500] + "..." if len(sql) > 500 else sql)
    print("=" * 60)

    # Intentar ejecutar via Management API
    api_url = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"

    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    data = json.dumps({"query": sql}).encode('utf-8')

    try:
        req = urllib.request.Request(api_url, data=data, headers=headers, method='POST')
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            print("✅ SQL ejecutado exitosamente!")
            print(json.dumps(result, indent=2))
            return True
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        print(f"❌ Error HTTP {e.code}: {error_body}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python3 exec-sql-direct.py <archivo.sql>")
        sys.exit(1)

    success = execute_sql_file(sys.argv[1])
    sys.exit(0 if success else 1)
