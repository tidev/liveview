import path from 'path';
import { ModuleNode, Plugin, ViteDevServer } from 'vite';

type ViteDevServerInternal = ViteDevServer & {
	_globImporters: Record<
		string,
		{
			base: string;
			pattern: string;
			module: ModuleNode;
		}
	>;
};

export function globImportsPlugin(projectDir: string): Plugin {
	let server: ViteDevServerInternal;
	return {
		name: 'titanium:alloy:globImports',
		configureServer(_server) {
			server = _server as ViteDevServerInternal;
		},
		transform(code, id) {
			// Manually register Alloy's glob requires so vite can trigger a reload
			if (id.endsWith('alloy.js')) {
				const { moduleGraph } = server;
				const importerModule = moduleGraph.getModuleById(id)!;
				server._globImporters[importerModule.file!] = {
					module: importerModule,
					base: path.resolve(projectDir, 'app'),
					pattern: '@(controllers|views)/*.js'
				};
			}

			return null;
		}
	};
}
