import path from 'path';
import { Plugin } from 'vite';

import { AlloyContext } from './context';

export function corePlugin(ctx: AlloyContext): Plugin {
	const { root: alloyRoot } = ctx;
	const ALLOY_MAIN = path.join(alloyRoot, 'template/lib/alloy.js');
	const ALLOY_WIDGET = path.join(alloyRoot, 'lib/alloy/widget.js');

	return {
		name: 'titanium:alloy:core',

		config(config) {
			const { appDir, root: alloyRoot, compiler } = ctx;
			const compileConfig = compiler.config;
			const backboneVersion = compileConfig.backbone
				? compileConfig.backbone
				: '0.9.2';
			if (!config.resolve) {
				config.resolve = {};
			}
			config.resolve.alias = [
				{
					find: /\/?alloy$/,
					replacement: ALLOY_MAIN
				},
				{
					find: /\/?alloy\/backbone$/,
					replacement: path.join(
						alloyRoot,
						'lib/alloy/backbone',
						backboneVersion,
						'backbone.js'
					)
				},
				{
					find: /\/?alloy\/constants$/,
					replacement: path.join(
						path.dirname(require.resolve('alloy-utils')),
						'constants.js'
					)
				},
				{
					find: /\/?alloy\/models/,
					replacement: path.join(appDir, 'models')
				},
				{
					find: /\/?alloy\/styles/,
					replacement: path.join(appDir, 'styles')
				},
				{
					find: /\/?alloy\/widgets/,
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

			config.optimizeDeps!.entries = [
				...(config.optimizeDeps!.entries as string[]),
				'controllers/**/*.@(j|t)s',
				'lib/**/*.@(j|t)s'
			];
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
