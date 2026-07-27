// UNA sola clave por patron. Este archivo tenia '*.{ts,tsx}' declarado dos
// veces: en un objeto literal la segunda gana, asi que eslint --fix,
// prettier --write y tsc --noEmit NUNCA se ejecutaron en pre-commit. El hook
// pasaba en verde corriendo solo los tests relacionados, y los errores de tipos
// o de formato aparecian mas tarde, en CI o en el build de produccion.
//
// Comprobacion de que sigue resolviendo a lo que se espera:
//   node -e "console.log(require('./.lintstagedrc.js'))"
module.exports = {
  // Se aplica a TODO lo que se commitea, no solo al codigo fuente: la fuga de
  // 2026-01-19 estaba en un .js suelto de la raiz que eslint tenia ignorado.
  '*': ['node scripts/check-secrets.mjs'],
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    () => 'tsc --noEmit', // Type check
    'vitest related --run --passWithNoTests',
  ],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
