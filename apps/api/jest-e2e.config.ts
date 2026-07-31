import type { Config } from 'jest'

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  moduleNameMapper: {
    '^@medicore/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@medicore/database$': '<rootDir>/../../packages/database/src/index.ts',
  },
}

export default config
