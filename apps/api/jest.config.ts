import type { Config } from 'jest'

// `@medicore/types`/`@medicore/database` are mapped straight to their source
// (not their built `dist`) so `pnpm --filter @medicore/api test` works even
// when CI runs it directly without a prior turbo `^build` pass.
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  moduleNameMapper: {
    '^@medicore/types$': '<rootDir>/../../../packages/types/src/index.ts',
    '^@medicore/database$': '<rootDir>/../../../packages/database/src/index.ts',
  },
  collectCoverageFrom: ['**/*.(t|j)s', '!**/*.module.ts', '!main.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
}

export default config
