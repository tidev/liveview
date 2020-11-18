module.exports = {
  root: true,
  rules: {
    'eol-last': ['error', 'always'],
    semi: ['error', 'always']
  },
  overrides: [
    {
      files: ['*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: ['./tsconfig.eslint.json', './packages/*/tsconfig.json'],
      },
      plugins: [
        '@typescript-eslint',
      ],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
      ]
    },
    {
      files: ['*.js'],
      extends: 'axway/env-node',
      rules: {
        'array-bracket-spacing': ['error', 'never'],
        indent: ['error', 2]
      }
    }
  ]
};
