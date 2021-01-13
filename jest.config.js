module.exports = {
  projects: ['<rootDir>/packages/*'],
  reporters: ['default', 'jest-junit'],
  testPathIgnorePatterns: ['/node_modules/', '/test-utils/fixtures/'],
  collectCoverage: true,
  verbose: false,
  silent: false,
  useStderr: true
};
