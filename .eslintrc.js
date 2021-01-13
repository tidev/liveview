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
        'jest',
        'import',
        'eslint-comments'
      ],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
      ]
    },
    {
      files: ['*.spec.ts', '__mocks__/*.ts'],
      extends: ['plugin:jest/recommended'],
      rules: {
        '@typescript-eslint/ban-ts-comment': ['error', {
          'ts-ignore': 'allow-with-description'
        }],
        'jest/no-done-callback': 'off'
      },
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
