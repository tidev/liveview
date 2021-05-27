import path from 'path';
import { createServer, ViteDevServer } from 'vite';

import { runDynamicOptimize } from './optimizer';
import { resolvePlugins } from './plugins';
import { Platform, ProjectType } from './types';

interface ProjectOptions {
	dir: string;
	type: ProjectType;
	platform: Platform;
	tiapp: any;
}

interface ServerOptions {
	host: string;
	port: number | undefined;
	force: boolean;
}

export interface LiveViewOpions {
	project: ProjectOptions;
	server: ServerOptions;
}

export async function startServer({
	project,
	server
}: LiveViewOpions): Promise<ViteDevServer> {
	const { dir: projectDir, type: projectType, platform, tiapp } = project;
	const isAlloy = projectType === 'alloy';
	const root = path.join(projectDir, isAlloy ? 'app' : 'Resources');
	const appEntry = isAlloy ? 'alloy.js' : 'app.js';
	const nativeModules = [
		...new Set<string>(tiapp.modules.map((m: any) => m.id))
	];
	const viteSever = await createServer({
		clearScreen: false,
		root,
		plugins: await resolvePlugins({
			projectDir,
			type: projectType,
			platform,
			nativeModules
		}),
		cacheDir: path.join(projectDir, 'build/.vite'),
		optimizeDeps: {
			entries: [appEntry],
			exclude: [...nativeModules]
		},
		server: {
			...server,
			fsServe: {
				strict: false
			},
			hmr: true
		}
	});
	await viteSever.listen();
	await runDynamicOptimize(viteSever);

	return viteSever;
}
