import { Plugin } from 'vite';

import { clientInjectionsPlugin } from './clientInjections';
import { resolveAlloyPlugins } from './alloy';
import { esbuildPlugin } from './esbuild';
import { Platform, ProjectType } from '../types';
import { externalsPlugin } from './externals';
import { hyperloopPlugin } from './hyperloop';
import { nodeBuiltinsPlugin } from './nodeBuiltins';
import { requireAnalysisPlugin } from './requireAnalysis';

interface ResolveOptions {
	projectDir: string;
	type: ProjectType;
	platform: Platform;
	nativeModules: string[];
}

export async function resolvePlugins({
	projectDir,
	type,
	platform,
	nativeModules
}: ResolveOptions): Promise<Plugin[]> {
	const normalPlugins = [
		clientInjectionsPlugin(),
		externalsPlugin(nativeModules),
		nodeBuiltinsPlugin()
	];
	if (nativeModules.includes('hyperloop')) {
		normalPlugins.push(await hyperloopPlugin(projectDir, platform));
	}

	const postPlugins = [requireAnalysisPlugin(), esbuildPlugin()];
	const projectPlugins =
		type === 'alloy' ? resolveAlloyPlugins(projectDir, platform) : [];
	return [...normalPlugins, ...projectPlugins, ...postPlugins];
}
