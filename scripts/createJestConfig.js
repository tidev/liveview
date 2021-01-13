const path = require('path');
const { pathsToModuleNameMapper } = require('ts-jest/utils');

const { compilerOptions } = require('../tsconfig.base');

module.exports = function ({ projectPath, moduleNameMapper = {} }) {
  return {
    preset: 'ts-jest',
    rootDir: '../../',
    testEnvironment: 'node',
    testMatch: [path.join(projectPath, 'test', '**/?(*.)spec.ts')],
    moduleNameMapper: {
      ...pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>' }),
      ...moduleNameMapper
    },
    globals: {
      'ts-jest': {
        tsconfig: path.resolve(projectPath, 'tsconfig.json')
      }
    }
  };
};
