const createJestConfig = require('../../scripts/createJestConfig');

module.exports = createJestConfig({
  projectPath: __dirname,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/packages/compiler/src/$1'
  }
});
