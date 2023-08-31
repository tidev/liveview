// @ts-check
const { defineConfig } = require('eslint-define-config');

module.exports = defineConfig({
	extends: [
		'eslint:recommended',
		'plugin:n/recommended',
		'plugin:@typescript-eslint/recommended'
	],
	plugins: ['import'],
	parser: '@typescript-eslint/parser',
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: 2020
	},
	rules: {
		'@typescript-eslint/ban-ts-comment': [
			'error',
			{
				'ts-ignore': 'allow-with-description'
			}
		],
		'import/no-duplicates': 'error',
		'import/order': 'error',
		'n/no-process-exit': 'off',
		'n/no-missing-import': 'off',
		'n/no-unsupported-features/es-syntax': 'off',
		'no-empty': ['warn', { allowEmptyCatch: true }],
		'sort-imports': [
			'error',
			{
				ignoreCase: false,
				ignoreDeclarationSort: true,
				ignoreMemberSort: false,
				memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
				allowSeparatedGroups: false
			}
		]
	}
});
