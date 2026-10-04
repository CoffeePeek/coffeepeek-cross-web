module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: { module: 'CommonJS', verbatimModuleSyntax: false, isolatedModules: true, esModuleInterop: true },
      diagnostics: false,
    }],
  },
};
