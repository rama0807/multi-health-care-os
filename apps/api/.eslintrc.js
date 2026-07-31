/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@medicore/eslint-config/nestjs'],
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
  env: { node: true, jest: true },
  ignorePatterns: ['dist/', 'node_modules/', '*.js'],
  overrides: [
    {
      // Test assertions routinely touch loosely-typed response bodies
      // (supertest's `res.body` is `any`) — the strict unsafe-* rules add
      // noise here without catching real bugs.
      files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
      rules: {
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
      },
    },
  ],
}
