const path = require('path');
const pluginTester = require('babel-plugin-tester');

const plugin = require('../lib/global-plugin');

pluginTester({
	plugin,

	tests: {
		'exposes declerations as global variables': {
			babelOptions: {
				filename: 'app.js'
			},
			fixture: path.join(__dirname, 'fixtures', 'global-plugin', 'app.js'),
			outputFixture: path.join(__dirname, 'fixtures', 'global-plugin', 'output.js'),
		},
		'should only operate on app.js': {
			babelOptions: {
				filename: 'another-file.js'
			},
			fixture: path.join(__dirname, 'fixtures', 'global-plugin', 'app.js'),
			outputFixture: path.join(__dirname, 'fixtures', 'global-plugin', 'app.js'),
		}
	}
});
