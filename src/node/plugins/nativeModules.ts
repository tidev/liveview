import { Plugin } from 'vite';

// Null-byte based prefix triggers internal server error
// const PREFIX = '\0titanium:';
const PREFIX = '/@titanium/';

export function nativeModulesPlugin(nativeModules: string[]): Plugin {
	return {
		name: 'titanium:modules',

		resolveId(id) {
			if (nativeModules.includes(id)) {
				return { id: `${PREFIX}${id}`, external: true };
			}
		}
	};
}
