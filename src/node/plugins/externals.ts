import { Plugin } from 'vite';

export function externalsPlugin(nativeModules: string[]): Plugin {
	return {
		name: 'titanium:externals',

		resolveId(id) {
			if (nativeModules.includes(id)) {
				return `/@native/${id}`;
			}
		}
	};
}
