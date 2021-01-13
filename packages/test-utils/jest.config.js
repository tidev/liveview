const path = require('path');

module.exports = {
  preset: 'ts-jest',
  rootDir: '../../',
  testEnvironment: 'node',
  testMatch: [path.join(__dirname, 'test', '**/?(*.)spec.ts')],
  moduleNameMapper: {
    '^@liveview/(.*)$': '<rootDir>/packages/$1/src'
  }
};
