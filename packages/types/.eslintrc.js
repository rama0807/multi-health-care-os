/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@medicore/eslint-config/base'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  env: { node: true },
  ignorePatterns: ['dist/', 'node_modules/', '*.js'],
}
