import { Plugin, ResolvedConfig } from 'vite';

import { CLIENT_ENTRY, CLIENT_DIR, ENV_ENTRY } from '../constants';

/**
 * Titanium specific replacment for the default Vite client injects plugins.
 *
 * @see https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/clientInjections.ts
 */
export function clientInjectionsPlugin(): Plugin {
	let config: ResolvedConfig;
	return {
		name: 'titanium:client-inject',

		configResolved(resolved) {
			config = resolved;

			// replace the default vite client injections plugin
			const plugins = resolved.plugins as Plugin[];
			const titaniumPlugin = plugins.find(
				({ name }) => name === 'titanium:client-inject'
			);
			if (!titaniumPlugin) {
				throw new Error('Unable to find titanium:client-inject');
			}
			const vitePluginIndex = plugins.findIndex(
				({ name }) => name === 'vite:client-inject'
			);
			plugins.splice(vitePluginIndex, 1, titaniumPlugin);

			// replace /@vite/ resolve alias to point to our own client
			const clientAlias = resolved.resolve.alias.find((alias) => {
				return (
					alias.find instanceof RegExp && alias.find.source === '^\\/@vite\\/'
				);
			});
			if (!clientAlias) {
				throw new Error('Unable to find vite client alias');
			}
			// @ts-ignore: because @rollup/plugin-alias' type doesn't allow function
			// replacement, but its implementation does work with function values.v
			clientAlias.replacement = () => CLIENT_DIR + '/';
		},

		transform(code, id) {
			if (id === CLIENT_ENTRY || id === ENV_ENTRY) {
				const host = config.server.host;
				const port = config.server.port;

				let options = config.server.hmr;
				options = options && typeof options !== 'boolean' ? options : {};
				const timeout = options.timeout || 30000;

				return code
					.replace('__DEFINES__', serializeDefine(config.define || {}))
					.replace('__SERVER_HOSTNAME__', JSON.stringify(host))
					.replace('__SERVER_PORT__', JSON.stringify(port))
					.replace('__HMR_TIMEOUT__', JSON.stringify(timeout));
			}
		}
	};
}

function serializeDefine(define: Record<string, any>): string {
	let res = '{';
	for (const key in define) {
		const val = define[key];
		res += `${JSON.stringify(key)}: ${
			typeof val === 'string' ? `(${val})` : JSON.stringify(val)
		}, `;
	}
	return res + '}';
}
