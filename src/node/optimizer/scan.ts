import createDebugger from 'debug';
import { Loader, Plugin, build, transform } from 'esbuild';
import glob from 'fast-glob';
import fs from 'fs';
import MagicString from 'magic-string';
import path from 'path';
import { PartialResolvedId } from 'rollup';
import { PluginContainer, ResolvedConfig, ViteDevServer } from 'vite';

import { JS_TYPES_RE, OPTIMIZABLE_ENTRY_RE } from '../constants';
import {
	cleanUrl,
	createDynamicRequireContext,
	normalizePath,
	parseRequires
} from '../utils';

const debug = createDebugger('titanium:deps');

export async function scanDynamicRequires({
	config,
	pluginContainer
}: ViteDevServer) {
	const s = Date.now();

	const explicitEntryPatterns = config.optimizeDeps?.entries || [];
	let entries = await globEntries(explicitEntryPatterns, config);

	entries = entries.filter(
		(entry) => JS_TYPES_RE.test(entry) && fs.existsSync(entry)
	);

	if (!entries.length) {
		debug('No entry files detected');
		return { deps: {}, missing: {} };
	} else {
		debug(
			`Crawling dynamic dependencies using entries:\n  ${entries.join('\n  ')}`
		);
	}

	const deps: Record<string, string> = {};
	const missing: Record<string, string> = {};
	const plugin = esbuildScanPlugin(
		config,
		pluginContainer,
		deps,
		missing,
		entries
	);

	await Promise.all(
		entries.map((entry) =>
			build({
				write: false,
				entryPoints: [entry],
				bundle: true,
				platform: 'node',
				logLevel: 'error',
				plugins: [plugin]
			})
		)
	);

	debug(`Scan completed in ${Date.now() - s}ms:`, deps);

	return {
		deps,
		missing
	};
}

function globEntries(pattern: string | string[], config: ResolvedConfig) {
	return glob(pattern, {
		cwd: config.root,
		ignore: [
			'**/node_modules/**',
			`**/${config.build.outDir}/**`,
			'**/__tests__/**'
		],
		absolute: true
	});
}

function esbuildScanPlugin(
	config: ResolvedConfig,
	container: PluginContainer,
	depImports: Record<string, string>,
	missing: Record<string, string>,
	entries: string[]
): Plugin {
	const seen = new Map<string, string | undefined>();

	const resolve = async (id: string, importer?: string) => {
		const key = id + (importer && path.dirname(importer));
		if (seen.has(key)) {
			return seen.get(key);
		}
		const resolved = await container.resolveId(
			id,
			importer && normalizePath(importer)
		);
		const res = resolved?.id;
		seen.set(key, res);
		return res;
	};

	const include = config.optimizeDeps?.include;
	const exclude = config.optimizeDeps?.exclude;

	const externalUnlessEntry = ({ path }: { path: string }) => ({
		path,
		external: !entries.includes(path)
	});

	return {
		name: 'titanium:dyn-dep-scan',
		setup(build) {
			// bare imports: record and externalize ----------------------------------
			build.onResolve(
				{
					// avoid matching windows volume
					filter: /^[\w@][^:]/
				},
				async ({ path: id, importer }) => {
					if (exclude?.some((e) => e === id || id.startsWith(e + '/'))) {
						return externalUnlessEntry({ path: id });
					}
					if (depImports[id]) {
						return externalUnlessEntry({ path: id });
					}
					const resolved = await resolve(id, importer);
					if (resolved) {
						if (shouldExternalizeDep(resolved, id)) {
							return externalUnlessEntry({ path: id });
						}
						if (resolved.includes('node_modules') || include?.includes(id)) {
							// dependency or forced included, externalize and stop crawling
							if (OPTIMIZABLE_ENTRY_RE.test(resolved)) {
								depImports[id] = resolved;
							}
							return externalUnlessEntry({ path: id });
						} else {
							// linked package, keep crawling
							return {
								path: path.resolve(resolved)
							};
						}
					} else {
						missing[id] = normalizePath(importer);
					}
				}
			);

			// catch all -------------------------------------------------------------
			build.onResolve(
				{
					filter: /.*/
				},
				async ({ path: id, importer }) => {
					// use vite resolver to support urls and omitted extensions
					const resolved = await resolve(id, importer);
					if (resolved) {
						if (shouldExternalizeDep(resolved, id)) {
							return externalUnlessEntry({ path: id });
						}

						return { path: path.resolve(cleanUrl(resolved)) };
					} else {
						// resolve failed... probably unsupported type
						return externalUnlessEntry({ path: id });
					}
				}
			);

			// for jsx/tsx, we need to access the content and check for
			// presence of dynamic requires, since it results in dependency relationships
			// but isn't crawled by esbuild.
			// @see
			build.onLoad({ filter: JS_TYPES_RE }, async ({ path: id }) => {
				let ext = path.extname(id).slice(1);
				if (ext === 'mjs') {
					ext = 'js';
				}

				let contents = fs.readFileSync(id, 'utf-8');
				if (ext.endsWith('x') && config.esbuild && config.esbuild.jsxInject) {
					contents = config.esbuild.jsxInject + '\n' + contents;
				}

				if (contents.includes('require')) {
					const resolveId = container.resolveId.bind(container);
					contents = await transformDynamicRequire(
						contents,
						id,
						resolveId,
						ext as Loader
					);
					return {
						loader: ext as Loader,
						contents
					};
				}
				return {
					loader: ext as Loader,
					contents
				};
			});
		}
	};
}

async function transformDynamicRequire(
	source: string,
	importer: string,
	resolve: (id: string, importer?: string) => Promise<PartialResolvedId | null>,
	loader: Loader
) {
	if (loader !== 'js') {
		source = (await transform(source, { loader, target: 'node10' })).code;
	}

	const requires = parseRequires(source, importer);
	const s = new MagicString(source);
	for (let index = 0; index < requires.length; index++) {
		const { start, end, specifier } = requires[index];
		if (specifier) {
			continue;
		}

		const url = source.slice(start, end + 1);
		const context = await createDynamicRequireContext(url, importer, resolve);
		if (
			context === null ||
			context.prefix.startsWith('.') ||
			context.prefix.startsWith('/')
		) {
			continue;
		}

		index++;
		const requireString = Object.keys(context.files)
			.filter((id) => OPTIMIZABLE_ENTRY_RE.test(context.files[id]))
			.map(
				(id, fileIndex) =>
					`const __dyn_${index}_${fileIndex} = require('${id}');`
			)
			.join('\n');
		s.prepend(requireString);
	}

	return s.toString();
}

export function shouldExternalizeDep(
	resolvedId: string,
	rawId: string
): boolean {
	// not a valid file path
	if (!path.isAbsolute(resolvedId)) {
		return true;
	}
	// virtual id
	if (resolvedId === rawId || resolvedId.includes('\0')) {
		return true;
	}
	// resolved is not a scannable type
	if (!JS_TYPES_RE.test(resolvedId)) {
		return true;
	}
	return false;
}
