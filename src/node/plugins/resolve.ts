import path from 'path';
import { Plugin } from 'vite';

import { Platform, ProjectType } from '../types';
import { otherPlatform } from '../utils';

/**
 * Resolve plugin for Titanium specific resolve rules.
 *
 * - Checks for files inside `platform` sub folders
 * - Support bare module and absolute ids as relative to source root
 */
export function resolvePlugin(
	projectType: ProjectType,
	platform: Platform
): Plugin {
	let root: string;

	return {
		name: 'titanium:resolve',
		// Enforce as pre plugin so it comes before vite's default resolve plugin
		enforce: 'pre',
		configResolved(config) {
			root = config.root;
		},
		async resolveId(id, importer, options) {
			const platformResolve = async (id: string, base: string) => {
				const result = await this.resolve(path.join(base, id), importer, {
					skipSelf: true
				});
				if (result) {
					return result.id;
				}
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

			id = id.replace(/^\//, '');
			const dirs = [];
			if (projectType === 'alloy') {
				dirs.push(path.join(root, 'lib'), path.join(root, 'assets'));
			} else {
				dirs.push(root);
			}
			for (const base of dirs) {
				const result = await platformResolve(id, base);
				if (result) {
					return result;
				}
			}

			/*
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
			*/
		}
	};
}
