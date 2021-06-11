import { Plugin } from 'vite';

import { clientInjectionsPlugin } from './clientInjections';
import { resolveAlloyPlugins } from './alloy';
import { esbuildPlugin } from './esbuild';
import { Platform, ProjectType } from '../types';
import { nativeModulesPlugin } from './nativeModules';
import { hyperloopPlugin } from './hyperloop';
import { i18nPlugin } from './i18n';
import { nodeBuiltinsPlugin } from './nodeBuiltins';
import { requireAnalysisPlugin } from './requireAnalysis';
import { resolvePlugin } from './resolve';

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
		nativeModulesPlugin(nativeModules),
		nodeBuiltinsPlugin(),
		resolvePlugin(type, platform),
		i18nPlugin(projectDir, type)
	];
	if (nativeModules.includes('hyperloop')) {
		normalPlugins.push(await hyperloopPlugin(projectDir, platform));
	}

	const postPlugins = [requireAnalysisPlugin(), esbuildPlugin()];
	const projectPlugins =
		type === 'alloy' ? resolveAlloyPlugins(projectDir, platform) : [];
	return [...normalPlugins, ...projectPlugins, ...postPlugins];
}
