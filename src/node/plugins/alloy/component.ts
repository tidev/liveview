import path from 'path';
import qs from 'querystring';
import { createFilter } from '@rollup/pluginutils';
import { ResolvedId } from 'rollup';
import { ModuleNode, Plugin, ResolvedConfig, ViteDevServer } from 'vite';

import { stripBase } from '../../utils/vite.js';
import { AlloyContext } from './context';

const controllerRE =
	/(?:[/\\]widgets[/\\]([^/\\]+))?[/\\](?:controllers)[/\\](.*)/;
const EMPTY_EXPORT = 'export default {}';

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
				}
				if (result) {
					return result.id;
				}
			}
		},

		async load(id) {
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
			const { filename, query } = parseAlloyRequest(id);
			if (!query.alloy && !filter(filename)) {
				return;
			}

			if (!query.alloy) {
				ctx.compiler.purgeStyleCache(id);
				const {
					code: controllerCode,
					map,
					dependencies
				} = ctx.compiler.compileComponent({
					controllerContent: code,
					file: id
				});

				const deps = dependencies.map((dep) => {
					if (dep.endsWith('.tss')) {
						return dep + '?alloy&type=style';
					} else if (dep.endsWith('.xml')) {
						return dep + '?alloy&type=template';
					} else {
						throw new Error(`Unknown Alloy component dependency: ${dep}`);
					}
				});
				// Dummy function to trigger dependency detection im vite's import analysis plugin.
				// This is required to properly clear caches for the generated controller JS
				// when a template or style file changes.
				const importAnalysisTrigger = `function __vite_import_dummy__() {
					${deps.map((d) => `import(${JSON.stringify(d)})`).join('\n')}
				}`;

				const output = [controllerCode, importAnalysisTrigger];

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

				return { code: output.join('\n'), map };
			} else if (query.type === 'template' || query.type === 'style') {
				return { code: EMPTY_EXPORT };
			}
		}
	};
}
