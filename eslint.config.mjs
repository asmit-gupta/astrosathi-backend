// Lint rules for the backend. Formatting is Prettier's job (eslint-config-prettier turns off style rules).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', '.test-pg/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
    },
  },
  {
    // The admin CLI talks to a person at a terminal.
    files: ['scripts/**', 'prisma/**'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['tests/**'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  prettier,
);
