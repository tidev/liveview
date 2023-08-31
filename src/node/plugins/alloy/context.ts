import path from 'path';
import { AlloyCompiler, AlloyConfig, createCompiler } from 'alloy-compiler';
import globalPaths from 'global-paths';
import { Plugin, ViteDevServer, normalizePath } from 'vite';

import { Platform } from '../../types';

// A mapping of files in an Alloy project that require us to recreate the
// Alloy compiler to properly update all internals
const fullRecompileFiles = ['app/styles/app.tss', 'app/config.json'];

export function initContextPlugin(context: AlloyContext): Plugin {
	return {
		name: 'alloy:context',

		configureServer(_server) {
			context.server = _server;
		}
	};
}

export class AlloyContext {
	public readonly root: string;

	public readonly appDir: string;

	private _compiler?: AlloyCompiler;

	private _server?: ViteDevServer;

	constructor(
		public readonly projectDir: string,
		private readonly platform: Platform
	) {
		// eslint-disable-next-line n/no-missing-require
		const alloyModuleMain = require.resolve('alloy', {
			paths: [projectDir, ...globalPaths(projectDir)]
		});
		if (!alloyModuleMain) {
			throw new Error(
				`Unable to resolve Alloy. Please make sure you have Alloy installed globally, or locally in the current project (${projectDir}).`
			);
		}
		this.root = path.dirname(alloyModuleMain);
		this.appDir = path.join(projectDir, 'app');
	}

	get compiler(): AlloyCompiler {
		if (!this._compiler) {
			this._compiler = this.createCompiler();
		}

		return this._compiler;
	}

	set server(_server: ViteDevServer) {
		this._server = _server;

		this._server.watcher.on('change', (file) => {
			file = normalizePath(file);

			const relFile = path.relative(this.projectDir, file);
			if (fullRecompileFiles.includes(relFile)) {
				this._compiler = this.createCompiler();
				// Cached transform results may have stale Alloy state so they need to
				// be invalidated before sending reload message
				this.server.moduleGraph.invalidateAll();
				this.server.ws.send({
					type: 'full-reload',
					path: '*'
				});
			}
		});
	}

	get server(): ViteDevServer {
		return this._server!;
	}

	private createCompiler() {
		const alloyConfig: AlloyConfig = {
			platform: this.platform,
			deploytype: 'development'
		};

		return createCompiler({
			compileConfig: {
				projectDir: this.projectDir,
				alloyConfig
			}
		});
	}
}
