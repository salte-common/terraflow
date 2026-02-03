module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^chalk$': '<rootDir>/tests/mocks/chalk.ts',
    // Resolve plugin-loader dynamic .js imports to .ts sources in tests
    '^\\.\\./plugins/backends/(.*)\\.js$': '<rootDir>/src/plugins/backends/$1.ts',
    '^\\.\\./plugins/secrets/(.*)\\.js$': '<rootDir>/src/plugins/secrets/$1.ts',
    '^\\.\\./plugins/auth/(.*)\\.js$': '<rootDir>/src/plugins/auth/$1.ts',
  },
  verbose: true,
};

