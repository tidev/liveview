module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  projects: [ '<rootDir>/packages/*' ],
  rootDir: './',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  verbose: false,
  silent: false,
  useStderr: true
};
