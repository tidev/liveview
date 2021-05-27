import path from 'path';
import { Plugin } from 'vite';

import { Platform, ProjectType } from '../types';
import { otherPlatform } from '../utils';

/**
 * Resolve plugin to lookup files inside platform folders.
 */
export function resolvePlugin(
	projectType: ProjectType,
	platform: Platform
): Plugin {
	let root: string;

	return {
		name: 'titanium:resolve',
		configResolved(config) {
			root = config.root;
		},
		async resolveId(id, importer, options) {
			const platformResolve = async (id: string, base = '') => {
				const platforms = [platform, otherPlatform[platform]];
				for (const platform of platforms) {
					const platformPath = path.join(base, platform, id);
					const result = await this.resolve(platformPath, importer, {
						skipSelf: true
					});
					if (result) {
						return result.id;
					}
				}
			};

			if (id.startsWith(root)) {
				const relPath = path.relative(root, id);
				if (projectType === 'alloy') {
					const pathParts = relPath.split('/');
					const subDir = pathParts.shift() || '';
					return await platformResolve(
						pathParts.join('/'),
						path.join(root, subDir)
					);
				} else {
					return await platformResolve(relPath, root);
				}
			} else if (!id.startsWith(`${platform}/`)) {
				return await platformResolve(path.join(platform, id));
			}
		}
	};
}
