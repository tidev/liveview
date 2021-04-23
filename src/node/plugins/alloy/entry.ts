import path from 'path';
import { Plugin } from 'vite';

export function entryPlugin(appDir: string): Plugin {
	const ALLOY_ENTRY = path.resolve(appDir, 'alloy.js');

	return {
		name: 'titanium:alloy:entry',

		resolveId(id) {
			if (id === '/app') {
				return ALLOY_ENTRY;
			}
		},

		transform(code, id) {
			if (id === ALLOY_ENTRY) {
				return `import Alloy from '/alloy';

// Always define globals to make sure they are the correct ones loaded via LiveView
global.Alloy = Alloy;
global._ = _;
global.Backbone = Alloy.Backbone;

${code}

Ti.UI.addEventListener('sessionbegin', function () {
	Alloy.createController('index');
});

if ((typeof Ti.UI.hasSession === 'undefined') || Ti.UI.hasSession) {
	Alloy.createController('index');
}`;
			}
		}
	};
}
