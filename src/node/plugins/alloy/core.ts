import path from 'path';
import { Plugin } from 'vite';

import { Platform } from '../../types';
import { cleanUrl, otherPlatform } from '../../utils';
import { AlloyContext } from './context';

const DEFAULT_BACKBONE_VERSION = '0.9.2';

const appControllerRequestPattern = "'/alloy/controllers/' \\+ ";
const widgetControllerRequestPattern =
	"'/alloy/widgets/'.*?'/controllers/' \\+ ";

export function corePlugin(ctx: AlloyContext, platform: Platform): Plugin {
	const { root: alloyRoot } = ctx;
	const ALLOY_MAIN = path.join(alloyRoot, 'template/lib/alloy.js');
	const ALLOY_WIDGET = path.join(alloyRoot, 'lib/alloy/widget.js');
	const ALLOY_UTILS_ROOT = path.dirname(require.resolve('alloy-utils'));

	return {
		name: 'titanium:alloy:core',

		config(config) {
			const { appDir, root: alloyRoot, compiler } = ctx;
			const compileConfig = compiler.config;
			const backboneVersion = compileConfig.backbone
				? compileConfig.backbone
				: DEFAULT_BACKBONE_VERSION;
			if (!config.resolve) {
				config.resolve = {};
			}
			config.resolve.alias = [
				...(Array.isArray(config.resolve.alias) ? config.resolve.alias : []),
				{
					find: /^\/?alloy$/,
					replacement: ALLOY_MAIN
				},
				{
					find: /^\/?alloy\/backbone$/,
					replacement: path.join(
						alloyRoot,
						'lib/alloy/backbone',
						backboneVersion,
						'backbone.js'
					)
				},
				{
					find: /^\/?alloy\/constants$/,
					replacement: path.join(ALLOY_UTILS_ROOT, 'constants.js')
				},
				{
					find: /^\/?alloy\/models/,
					replacement: path.join(appDir, 'models')
				},
				{
					find: /^\/?alloy\/styles/,
					replacement: path.join(appDir, 'styles')
				},
				{
					find: /^\/?alloy\/widgets/,
					replacement: path.join(appDir, 'widgets')
				},
				{
					find: /^\/?alloy\/(animation|dialogs|measurement|moment|sha1|social|string)/,
					replacement: path.resolve(alloyRoot, 'builtins/$1')
				},
				{
					find: /^\/?alloy\/(sync|underscore|widget|controllers\/BaseController)/,
					replacement: path.resolve(alloyRoot, 'lib/alloy/$1')
				},
				{
					find: /^alloy.bootstrap$/,
					replacement: path.join(alloyRoot, 'template/alloy.bootstrap.js')
				}
			];

			config.define = {
				...config.define,
				ALLOY_VERSION: JSON.stringify('1.0.0'),
				ENV_DEV: true,
				ENV_DEVELOPMENT: true,
				ENV_TEST: false,
				ENV_PROD: false,
				ENV_PRODUCTION: false,
				OS_MOBILEWEB: false,
				DIST_ADHOC: false,
				DIST_STORE: false
			};

			if (!config.optimizeDeps) {
				config.optimizeDeps = {};
			}
			config.optimizeDeps.entries = [
				...(config.optimizeDeps.entries ?? []),
				`controllers/!(${otherPlatform[platform]})/**/*.@(j|t)s`,
				`lib/!(${otherPlatform[platform]})/**/*.@(j|t)s`
			];
			config.optimizeDeps.exclude = [
				...(config.optimizeDeps.exclude ?? []),
				'alloy.bootstrap'
			];

			config.server = {
				...config.server,
				fs: {
					...config.server?.fs,
					allow: [
						...(config.server?.fs?.allow ?? []),
						alloyRoot,
						ALLOY_UTILS_ROOT
					]
				}
			};
		},

		resolveId(id, importer) {
			if (id === 'jquery' && importer?.includes('/backbone.js')) {
				// backbone includes an unused require to `jquery` that needs to be
				// marked as external so vite does not try to handle it
				return { id, external: true };
			}
		},

		transform(code, id) {
			const cleanId = cleanUrl(id);
			if (cleanId === ALLOY_MAIN || cleanId === ALLOY_WIDGET) {
				return patchForViteCompatibility(code);
			}
		}
	};
}

/**
 * Applies various patches in the given content to be compatible with Vite.
 *
 * @param content File content to modify
 */
function patchForViteCompatibility(content: string) {
	// requires for controllers need to use `.default`
	// FIXME: Re-enable once we can control ESM mode per project
	// content = requireDefaultExport(content, appControllerRequestPattern);
	// content = requireDefaultExport(content, widgetControllerRequestPattern);

	content = content
		// remove ucfirst in model/collection requires
		.replace(/models\/'\s\+\sucfirst\(name\)/g, "models/' + name")
		// remove double slash in controller requires
		.replace(/(controllers\/' \+ \(?)(name)/g, "$1$2?.replace(/^\\//, '')");

	return content;
}

/**
 * Modifies require statements to use `.default`.
 *
 * @param content Content string to search in.
 * @param requestFilter RegExp to filter for specific requires.
 */
function requireDefaultExport(content: string, requestFilter: string) {
	const searchPattern = new RegExp(
		`(require\\(${requestFilter})(\\(?name(?: \\|\\| DEFAULT_WIDGET\\))?)(\\))`,
		'g'
	);
	return content.replace(
		searchPattern,
		"$1$2.replace(/^\\.?\\//, '')$3.default"
	);
}
