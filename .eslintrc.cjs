// @ts-check
const { defineConfig } = require('eslint-define-config')

module.exports = defineConfig({
  "extends": [
    "eslint:recommended",
    "plugin:node/recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "plugins": ["jsdoc"],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "sourceType": "module",
    "ecmaVersion": 2020
  },
  "rules": {
    "@typescript-eslint/ban-ts-comment": ["error", {
      "ts-ignore": "allow-with-description"
    }],
    'node/no-missing-import': [
      'error',
      {
        allowModules: ['types', 'estree', 'less', 'sass', 'stylus'],
        tryExtensions: ['.ts', '.js', '.jsx', '.tsx', '.d.ts'],
      },
    ],
    "node/no-unsupported-features/es-syntax": ["error", {
      "ignores": ["modules", "dynamicImport"]
    }],
    "valid-jsdoc": "off"
  }
});
