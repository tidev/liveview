const path = require('path');
const pluginTester = require('babel-plugin-tester');

const plugin = require('../lib/global-plugin');

pluginTester({
	plugin,
	fixtures: path.join(__dirname, 'fixtures', 'global-plugin')
});
