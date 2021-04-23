import { createFilter } from '@rollup/pluginutils';
import { transform, TransformOptions } from 'esbuild';
import { Plugin, normalizePath } from 'vite';

import { CLIENT_DIR } from '../constants';
import { cleanUrl } from '../utils';

const clientDir = normalizePath(CLIENT_DIR);

export function esbuildPlugin(): Plugin {
	const filter = createFilter([/.(j|t)sx?/], 'node_modules/!(alloy)');

	return {
		name: 'titanium:esbuild',

		/**
		 * Make sure this plugin runs last so vite can still apply all core plugins
		 * on ES code.
		 */
		configResolved(resolved) {
			const plugins = resolved.plugins as Plugin[];
			const index = plugins.findIndex(
				({ name }) => name === 'titanium:esbuild'
			);
			const [titaniumPlugin] = plugins.splice(index, 1);
			plugins.push(titaniumPlugin);
		},

		/**
		 * Transforms all code to CJS so Titanium can use it.
		 */
		async transform(code, id) {
			if (filter(cleanUrl(id))) {
				const options: TransformOptions = {
					target: 'node10',
					format: 'cjs'
				};
				if (!id.includes('build/.vite') && !id.startsWith(clientDir)) {
					// Enable source maps except for optimized deps from Vite or the
					// client as they contain references to virtual modules or non-existent
					// files that cannot be resolved
					options.sourcemap = true;
					options.sourcefile = id;
				}
				const result = await transform(code, options);
				return options.sourcemap
					? {
							...result,
							map: JSON.parse(result.map)
					  }
					: result;
			}
		}
	};
}
