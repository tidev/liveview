import { Plugin } from 'vite';

import { isBuiltinModule } from '../utils';

/**
 * Resolves built-in Node core modules provided by Titanium
 */
export function nodeBuiltinsPlugin(): Plugin {
	return {
		name: 'titanium:node-builtins',

		// Enforce as pre plugin so it comes before vite's default resolve plugin
		// which tries to replace Node core modules with empty browser shims
		enforce: 'pre',

		async resolveId(id) {
			return isBuiltinModule(id) && id;
		}
	};
}
