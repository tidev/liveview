import path from 'path';
import { Plugin } from 'vite';

import { bareImportRE } from '../../constants';

/**
 * Provides special resolve rules for Alloy.
 *
 * - Resolves files from the `lib` or `assets` directories.
 * - Resolves URLs generated by `WPATH` to their source files inside a
 *   Widget's `lib` directory.
 */
export function resolvePlugin(appDir: string): Plugin {
	return {
		name: 'titanium:alloy:resolve',
		async resolveId(id, importer) {
			if (id.startsWith('/')) {
				// check WPATH generated url `/<widget>/<id>`
				const secondSlashIndex = id.indexOf('/', 1);
				if (secondSlashIndex === -1) {
					return undefined;
				}
				const widgetId = id.slice(1, secondSlashIndex);
				const relativeId = id.slice(secondSlashIndex + 1);
				const result = await this.resolve(
					path.join(appDir, 'widgets', widgetId, 'lib', relativeId),
					importer,
					{ skipSelf: true }
				);
				return result?.id;
			}

			if (bareImportRE.test(id)) {
				// check `app/lib` folder
				let result = await this.resolve(
					path.resolve(appDir, 'lib', id.replace(/^\//, '')),
					importer,
					{ skipSelf: true }
				);
				if (result) {
					return result.id;
				}

				// check `app/assets` folder
				result = await this.resolve(
					path.resolve(appDir, 'assets', id.replace(/^\//, '')),
					importer,
					{ skipSelf: true }
				);
				if (result) {
					return result.id;
				}
			}
		}
	};
}