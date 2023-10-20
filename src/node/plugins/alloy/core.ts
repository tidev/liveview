import path from 'path';
import { Plugin } from 'vite';

import { Platform } from '../../types';
import { otherPlatform } from '../../utils';
import { AlloyContext } from './context';

const DEFAULT_BACKBONE_VERSION = '0.9.2';

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
			if (id === ALLOY_MAIN || id === ALLOY_WIDGET) {
				return (
					code
						// remove ucfirst in model/collection requires
						.replace(/models\/'\s\+\sucfirst\(name\)/g, "models/' + name")
				);
			}
		}
	};
}
