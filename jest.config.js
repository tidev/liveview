module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  projects: ['<rootDir>/packages/*'],
  rootDir: './',
  reporters: ['default', 'jest-junit'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  verbose: false,
  silent: false,
  useStderr: true
};
