import type { Config } from 'jest'
import nextJest from 'next/jest'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
}

// Explicit annotation (rather than a bare `export default createJestConfig(...)`)
// avoids TS4082: next/jest's returned function type references a private
// helper type it doesn't export, which trips `isolatedModules` declaration
// checks if TS has to infer-and-print it for the module's own type.
const resolvedConfig: () => Promise<Config> = createJestConfig(config)
export default resolvedConfig
