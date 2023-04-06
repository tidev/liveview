import { Plugin, ResolvedConfig, normalizePath } from 'vite';
import path from 'path';

import { CLIENT_ENTRY, CLIENT_DIR, ENV_ENTRY } from '../constants.js';
import { isObject, resolveHostname } from '../utils/vite.js';

// ids in transform are normalized to unix style
const normalizedClientEntry = normalizePath(CLIENT_ENTRY)
const normalizedEnvEntry = normalizePath(ENV_ENTRY)

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
					alias.find instanceof RegExp &&
					alias.find.source === '^\\/?@vite\\/client'
				);
			});
			if (!clientAlias) {
				throw new Error('Unable to find vite client alias');
			}
			// @ts-ignore: because @rollup/plugin-alias' type doesn't allow function
			// replacement, but its implementation does work with function values.v
			clientAlias.replacement = CLIENT_ENTRY;
		},

		async transform(code, id, options) {
			if (id === normalizedClientEntry || id === normalizedEnvEntry) {
				const resolvedServerHostname = (
					await resolveHostname(config.server.host)
				).name;
				const resolvedServerPort = config.server.port!;
				const devBase = config.base;

				const serverHost = `${resolvedServerHostname}:${resolvedServerPort}${devBase}`;

				let hmrConfig = config.server.hmr;
				hmrConfig = isObject(hmrConfig) ? hmrConfig : undefined;
				const host = hmrConfig?.host || null;
				const protocol = hmrConfig?.protocol || null;
				const timeout = hmrConfig?.timeout || 30000;
				const overlay = hmrConfig?.overlay !== false;
				const isHmrServerSpecified = !!hmrConfig?.server;

				// hmr.clientPort -> hmr.port
				// -> (24678 if middleware mode and HMR server is not specified) -> new URL(import.meta.url).port
				let port = hmrConfig?.clientPort || hmrConfig?.port || null;
				if (config.server.middlewareMode && !isHmrServerSpecified) {
					port ||= 24678;
				}

				let directTarget = hmrConfig?.host || resolvedServerHostname;
				directTarget += `:${hmrConfig?.port || resolvedServerPort}`;
				directTarget += devBase;

				let hmrBase = devBase;
				if (hmrConfig?.path) {
					hmrBase = path.posix.join(hmrBase, hmrConfig.path);
				}

				return code
					.replace(`__MODE__`, JSON.stringify(config.mode))
					.replace(/__BASE__/g, JSON.stringify(devBase))
					.replace(`__DEFINES__`, serializeDefine(config.define || {}))
					.replace(`__SERVER_HOST__`, JSON.stringify(serverHost))
					.replace(`__HMR_PROTOCOL__`, JSON.stringify(protocol))
					.replace(`__HMR_HOSTNAME__`, JSON.stringify(host))
					.replace(`__HMR_PORT__`, JSON.stringify(port))
					.replace(`__HMR_DIRECT_TARGET__`, JSON.stringify(directTarget))
					.replace(`__HMR_BASE__`, JSON.stringify(hmrBase))
					.replace(`__HMR_TIMEOUT__`, JSON.stringify(timeout))
					.replace(`__HMR_ENABLE_OVERLAY__`, JSON.stringify(overlay));
			} else if (!options?.ssr && code.includes('process.env.NODE_ENV')) {
				// replace process.env.NODE_ENV instead of defining a global
				// for it to avoid shimming a `process` object during dev,
				// avoiding inconsistencies between dev and build
				return code.replace(
					/(\bglobal(This)?\.)?\bprocess\.env\.NODE_ENV\b/g,
					config.define?.['process.env.NODE_ENV'] ||
						JSON.stringify(process.env.NODE_ENV || config.mode)
				);
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
