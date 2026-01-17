module.exports = {
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    () => 'tsc --noEmit', // Type check
  ],
  '*.{json,md,yml,yaml}': ['prettier --write'],
  '*.{ts,tsx}': [
    'vitest related --run --passWithNoTests',
  ],
};
