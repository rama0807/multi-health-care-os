/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@medicore/eslint-config/nextjs'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  env: { browser: true, node: true, jest: true },
  ignorePatterns: ['.next/', 'node_modules/', '*.js', '*.mjs'],
}
