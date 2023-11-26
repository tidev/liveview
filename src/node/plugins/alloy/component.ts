import path from 'path';
import qs from 'querystring';
import fs from 'fs-extra';
import { createFilter } from '@rollup/pluginutils';
import { ResolvedId } from 'rollup';
import { ModuleNode, Plugin, ResolvedConfig, ViteDevServer } from 'vite';

import { cleanUrl, stripBase } from '../../utils/vite.js';
import { AlloyContext } from './context';

const controllerRE =
	/(?:[/\\]widgets[/\\]([^/\\]+))?[/\\](?:controllers)[/\\](.*)/;
const EMPTY_EXPORT = 'export default {}';
const VIEW_ONLY_PREFIX = '\0alloyview:';

interface AlloyQuery {
	alloy?: boolean;
	type?: 'template' | 'style';
}

function parseAlloyRequest(id: string) {
	const [filename, rawQuery] = id.split('?', 2);
	const query = qs.parse(rawQuery) as AlloyQuery;
	// eslint-disable-next-line eqeqeq, no-eq-null
	if (query.alloy != null) {
		query.alloy = true;
	}
	return {
		filename,
		query
	};
}

export function componentPlugin(ctx: AlloyContext): Plugin {
	const { appDir } = ctx;
	let server: ViteDevServer;
	let config: ResolvedConfig;
	const filter = createFilter(controllerRE, /controllers\/BaseController/);

	return {
		name: 'titanium:alloy:component',

		configureServer(_server) {
			server = _server;
		},

		configResolved(_config) {
			config = _config;
		},

		async resolveId(id, importer) {
			// serve sub-part requests (*?alloy) as virtual modules
			if (parseAlloyRequest(id).query.alloy) {
				return id;
			}

			const componentMatch = id.match(controllerRE);
			if (componentMatch) {
				const widgetId = componentMatch[1];
				const componentId = componentMatch[2];

				let result: ResolvedId | null;
				if (widgetId) {
					result = await this.resolve(
						path.join(appDir, 'widgets', widgetId, 'controllers', componentId),
						importer,
						{ skipSelf: true }
					);
				} else {
					result = await this.resolve(
						path.join(appDir, 'controllers', componentId),
						importer,
						{ skipSelf: true }
					);
					if (!result) {
						// No controller found, but maybe there is a view only
						const view = await this.resolve(
							path.join(appDir, 'views', `${componentId}.xml`),
							importer,
							{ skipSelf: true }
						);
						if (view) {
							return (
								VIEW_ONLY_PREFIX +
								view.id
									.replace('/app/views/', '/app/controllers/')
									.replace(/\.xml$/, '.js')
							);
						}
					}
				}
				if (result) {
					return result.id;
				}
			}
		},

		async load(id) {
			if (id.startsWith(VIEW_ONLY_PREFIX)) {
				return '';
			}

			const { filename, query } = parseAlloyRequest(id);
			// select corresponding block for sub-part virtual modules
			if (query.alloy) {
				console.log('alloy sub-part load', filename, query);
				if (query.type === 'template') {
					throw new Error(
						'Alloy template sub-part loading not implemented yet.'
					);
				}
			}

			return null;
		},

		async transform(code, id) {
			if (id.startsWith(VIEW_ONLY_PREFIX)) {
				// Map virtual view only id back to controller id
				id = id.replace(VIEW_ONLY_PREFIX, '');
			}

			const { filename, query } = parseAlloyRequest(id);
			if (!query.alloy && !filter(filename)) {
				return;
			}

			const cleanId = cleanUrl(id);

			if (!query.alloy) {
				ctx.compiler.purgeStyleCache(cleanId);
				const {
					code: controllerCode,
					map,
					dependencies
				} = ctx.compiler.compileComponent({
					controllerContent: code,
					file: cleanId
				});

				const deps = dependencies
					// Only consider deps that actually exist
					.filter((d) => fs.pathExistsSync(d))
					.map((dep) => {
						// Make sure changes to view and style files trigger a controller rebuild
						this.addWatchFile(dep);

						if (dep.endsWith('.tss')) {
							return dep + '?alloy&type=style';
						} else if (dep.endsWith('.xml')) {
							return dep + '?alloy&type=template';
						} else {
							throw new Error(`Unknown Alloy component dependency: ${dep}`);
						}
					});

				if (server) {
					// server only handling for view and style dependency hmr
					const { moduleGraph } = server;
					const thisModule = moduleGraph.getModuleById(id);
					if (thisModule) {
						// record deps in the module graph so edits to view and style can trigger
						// controller import to hot update
						const depModules = new Set<string | ModuleNode>();
						const devBase = config.base;
						for (const file of deps) {
							depModules.add(
								await moduleGraph.ensureEntryFromUrl(
									stripBase(file, (config.server?.origin ?? '') + devBase),
									false
								)
							);
						}

						moduleGraph.updateModuleInfo(
							thisModule,
							depModules,
							null,
							new Set(),
							null,
							false,
							false
						);
					}
				}

				return { code: controllerCode, map };
			} else if (query.type === 'template' || query.type === 'style') {
				return { code: EMPTY_EXPORT };
			}
		}
	};
}
