import { clientInjectionsPlugin } from './clientInjections';
import { resolveAlloyPlugins } from './alloy';
import { esbuildPlugin } from './esbuild';
import { Platform, ProjectType } from '../types';
import { externalsPlugin } from './externals';
import { nodeBuiltinsPlugin } from './nodeBuiltins';
import { requireAnalysisPlugin } from './requireAnalysis';

interface ResolveOptions {
	projectDir: string;
	type: ProjectType;
	platform: Platform;
	nativeModules: string[];
}

export function resolvePlugins({
	projectDir,
	type,
	platform,
	nativeModules
}: ResolveOptions) {
	const normalPlugins = [
		clientInjectionsPlugin(),
		externalsPlugin(nativeModules),
		nodeBuiltinsPlugin()
	];
	const postPlugins = [requireAnalysisPlugin(), esbuildPlugin()];
	const projectPlugins =
		type === 'alloy' ? resolveAlloyPlugins(projectDir, platform) : [];
	return [...normalPlugins, ...projectPlugins, ...postPlugins];
}
