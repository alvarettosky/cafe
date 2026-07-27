#!/usr/bin/env node
/**
 * Bloquea commits que contengan credenciales.
 *
 * Existe por un incidente real: `execute-sql-node.js` entro el 2026-01-19 con
 * la clave `service_role` de produccion incrustada, y estuvo **189 dias** en un
 * repositorio PUBLICO antes de que nadie lo notara. Esa clave ignora RLS por
 * completo: da lectura y escritura sobre todas las tablas.
 *
 * Nada lo detecto en su momento porque no habia nada que mirara. Lint mira
 * estilo, tsc mira tipos, los tests miran comportamiento; ninguno mira si lo
 * que estas subiendo es un secreto.
 *
 * Solo revisa lo que se va a commitear, no el arbol entero: el objetivo es
 * impedir la proxima fuga, no auditar la historia (para eso, `git log -S`).
 *
 * Uso:  node scripts/check-secrets.mjs <archivo>...
 */
import { readFileSync } from 'node:fs';

const PATRONES = [
  {
    nombre: 'JWT de Supabase (anon / service_role)',
    re: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{30,}/,
  },
  { nombre: 'clave secreta de Supabase', re: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  { nombre: 'personal access token de Supabase', re: /\bsbp_[a-f0-9]{40,}/ },
  // Los dos patrones de abajo cubren formatos *clasicos*. Los actuales llevan
  // separadores intermedios que rompen una clase de caracteres continua, y se
  // colaban enteros: `gh[pousr]_` exige exactamente dos letras antes del guion
  // bajo, asi que no veia `github_pat_…` (el formato de grano fino que GitHub
  // genera por defecto desde 2022); y `sk-[A-Za-z0-9]{32,}` exige 32 seguidos,
  // pero en `sk-proj-…` solo hay cuatro (`proj`) antes del siguiente guion.
  // Tampoco caian en el patron generico de asignacion, porque prettier parte
  // las lineas largas y deja el nombre de la variable y el valor separados.
  { nombre: 'token clasico de GitHub', re: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
  { nombre: 'token de grano fino de GitHub', re: /\bgithub_pat_[A-Za-z0-9_]{50,}/ },
  { nombre: 'clave de API de OpenAI (clasica)', re: /\bsk-[A-Za-z0-9]{32,}/ },
  {
    nombre: 'clave de API de OpenAI (proyecto)',
    re: /\bsk-(proj|svcacct|admin)-[A-Za-z0-9_-]{20,}/,
  },
  { nombre: 'clave de API de Anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { nombre: 'clave de API de Resend', re: /\bre_[A-Za-z0-9]{20,}/ },
  { nombre: 'token de Vercel', re: /\b(vercel_blob_rw_)[A-Za-z0-9_]{20,}/ },
  { nombre: 'clave de servicio de Google', re: /"type"\s*:\s*"service_account"/ },
  { nombre: 'URL de Postgres con contrasena', re: /postgres(ql)?:\/\/[^:\s]+:[^@\s]{8,}@/ },
  { nombre: 'clave privada PEM', re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  {
    nombre: 'credencial asignada en codigo',
    re: /(SERVICE_ROLE|SECRET_KEY|API_KEY|PASSWORD|PRIVATE_KEY)\s*[:=]\s*['"][A-Za-z0-9_\-./+]{20,}['"]/i,
  },
];

// La anon key es publica por diseño y viaja en el bundle; lo que no puede
// aparecer es una clave de servicio. Aun asi el patron de JWT las captura a las
// dos: distinguirlas exige decodificar el payload, y un falso positivo que
// obliga a mirar es preferible a un falso negativo que cuesta 189 dias.
const archivos = process.argv.slice(2);
const hallazgos = [];

for (const archivo of archivos) {
  let contenido;
  try {
    contenido = readFileSync(archivo, 'utf8');
  } catch {
    continue; // borrado o binario: nada que revisar
  }
  contenido.split('\n').forEach((linea, i) => {
    for (const { nombre, re } of PATRONES) {
      if (re.test(linea)) hallazgos.push({ archivo, linea: i + 1, nombre });
    }
  });
}

if (hallazgos.length > 0) {
  console.error('\n\x1b[31m✖ COMMIT BLOQUEADO: posible credencial en el codigo\x1b[0m\n');
  for (const h of hallazgos) {
    console.error(`  ${h.archivo}:${h.linea}  →  ${h.nombre}`);
  }
  console.error(`
  Este repositorio es PUBLICO. Un secreto commiteado aqui debe darse por
  comprometido aunque se borre despues: queda en la historia de git, en los
  forks y en las cachés de GitHub. Borrar el archivo NO lo arregla — hay que
  ROTAR la credencial.

  Que hacer:
    1. Saca el valor del codigo. Usa una variable de entorno.
    2. Si ya se commiteo alguna vez, rotala antes de seguir.
    3. Si es un falso positivo, documenta por que en la linea y vuelve a
       intentarlo con --no-verify.
`);
  process.exit(1);
}
