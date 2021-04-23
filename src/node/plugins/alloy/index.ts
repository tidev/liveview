import { nodeResolve } from '@rollup/plugin-node-resolve';
import path from 'path';
import { Plugin } from 'vite';

import { initContextPlugin, AlloyContext } from './context';
import { componentPlugin } from './component';
import { corePlugin } from './core';
import { configPlugin } from './config';
import { entryPlugin } from './entry';
import { globImportsPlugin } from './globImports';
import { modelPlugin } from './model';
import { resolvePlugin } from './resolve';
import { Platform } from '../../types';
import { bareImportRE } from '../../constants';

export function resolveAlloyPlugins(
	projectDir: string,
	platform: Platform
): Plugin[] {
	const appDir = path.join(projectDir, 'app');

	const context = new AlloyContext(projectDir, platform);
	return [
		initContextPlugin(context),
		corePlugin(context),
		configPlugin(context),
		entryPlugin(appDir),
		globImportsPlugin(projectDir),
		resolvePlugin(appDir),
		/**
		 * Alloy supports installing Node modules under `app/lib`, which cannot be
		 * resolved by the default node resolve algorithim that Vite uses when the
		 * import comes from `app/controllers`. Perform an additional Node style
		 * resolve jailed to `app/lib` to handle those edge cases.
		 */
		nodeResolve({
			rootDir: path.join(context.appDir, 'lib'),
			jail: path.join(context.appDir, 'lib'),
			preferBuiltins: true,
			dedupe(importee) {
				// Enable dedupe for all bare imports to force resolve from `rootDir`
				return bareImportRE.test(importee);
			}
		}),
		componentPlugin(context),
		modelPlugin(context)
	];
}
