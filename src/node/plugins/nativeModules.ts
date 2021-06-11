import { Plugin } from 'vite';

const PREFIX = '\0titanium:';

export function nativeModulesPlugin(nativeModules: string[]): Plugin {
	return {
		name: 'titanium:modules',

		resolveId(id) {
			if (nativeModules.includes(id)) {
				return `${PREFIX}${id}`;
			}
		}
	};
}
