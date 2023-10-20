import path from 'path';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { Plugin } from 'vite';

import { Platform } from '../../types';
import { bareImportRE } from '../../constants';
import { AlloyContext, initContextPlugin } from './context';
import { componentPlugin } from './component';
import { corePlugin } from './core';
import { configPlugin } from './config';
import { entryPlugin } from './entry';
import { modelPlugin } from './model';
import { widgetPlugin } from './widget';

export function resolveAlloyPlugins(
	projectDir: string,
	platform: Platform
): Plugin[] {
	const appDir = path.join(projectDir, 'app');

	const context = new AlloyContext(projectDir, platform);
	return [
		initContextPlugin(context),
		corePlugin(context, platform),
		configPlugin(context),
		entryPlugin(appDir),
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
		modelPlugin(context),
		widgetPlugin(appDir)
	];
}
