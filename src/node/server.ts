import path from 'path';
import { ViteDevServer, createServer, normalizePath } from 'vite';

import { runDynamicOptimize } from './optimizer';
import { resolvePlugins } from './plugins';
import { Platform, ProjectType } from './types';
import { CLIENT_DIR, CLIENT_ENTRY, ENV_ENTRY, FS_PREFIX } from './constants.js';

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
	const define: Record<string, string> = {
		OS_ANDROID: JSON.stringify(platform === 'android'),
		OS_IOS: JSON.stringify(platform === 'ios')
	};
	const viteSever = await createServer({
		clearScreen: false,
		root,
		plugins: await resolvePlugins({
			projectDir,
			type: projectType,
			platform,
			nativeModules
		}),
		define,
		resolve: {
			alias: [
				{
					find: /^\/?@vite\/env/,
					replacement: path.posix.join(FS_PREFIX, normalizePath(ENV_ENTRY))
				},
				{
					find: /^\/?@vite\/client/,
					replacement: path.posix.join(FS_PREFIX, normalizePath(CLIENT_ENTRY))
				}
			]
		},
		cacheDir: path.join(projectDir, 'build/.vite'),
		optimizeDeps: {
			entries: [appEntry],
			exclude: [...nativeModules],
			esbuildOptions: {
				define
			}
		},
		server: {
			...server,
			hmr: true,
			fs: {
				allow: [root, CLIENT_DIR]
			}
		},
		appType: 'custom'
	});
	await viteSever.listen();
	await runDynamicOptimize(viteSever);

	return viteSever;
}
