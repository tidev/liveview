import glob from 'fast-glob';
import fs from 'fs-extra';
import path from 'path';
import { normalizePath, Plugin } from 'vite';

import { Platform } from '../types';

export async function hyperloopPlugin(
	projectDir: string,
	platform: Platform
): Promise<Plugin> {
	const hyperloopBuildDir = path.join(projectDir, 'build/hyperloop', platform);
	const hyperloopResourcesDir =
		platform === 'android'
			? path.join(hyperloopBuildDir, 'Resources/hyperloop')
			: path.join(hyperloopBuildDir, 'js');
	let hyperloopModules = new Map<string, string>();

	if (platform === 'android') {
		const files = await glob('*.js', { cwd: hyperloopResourcesDir });
		files.forEach((file) => {
			const className = path.basename(file, '.js').toLowerCase();
			if (className.startsWith('hyperloop.bootstrap')) {
				return;
			}
			hyperloopModules.set(className.replace(/\$/g, '.'), className);
		});
	} else {
		const metadataFile = path.join(
			hyperloopBuildDir,
			'metadata-framework-availability.json'
		);
		const metadata = await fs.readJSON(metadataFile);
		hyperloopModules = new Map(
			Object.keys(metadata).map((name) => [name.toLowerCase(), name])
		);
	}
	hyperloopModules.set('titanium', 'Titanium');

	return {
		name: 'titanium:hyperloop',

		async resolveId(id) {
			id = normalizePath(id).replace(/^\/hyperloop\//, '');

			if (id.startsWith('/') || id.startsWith('.')) {
				return;
			}

			let [pkg, type] = id.split('/');
			pkg = pkg.toLowerCase();
			if (platform === 'android') {
				if (pkg.endsWith('.*')) {
					pkg = pkg.replace('.*', '');
				}
				if (hyperloopModules.has(pkg)) {
					const resourcePath = path.join(
						hyperloopResourcesDir,
						`${hyperloopModules.get(pkg)!}.js`
					);
					if (await fs.pathExists(resourcePath)) {
						return resourcePath;
					}
				}
			} else if (hyperloopModules.has(pkg)) {
				type = type?.toLowerCase();
				if (type === undefined) {
					type = pkg;
				}
				const resourcePath = path.join(
					hyperloopResourcesDir,
					`${pkg}/${type}.js`
				);
				if (await fs.pathExists(resourcePath)) {
					return resourcePath;
				}
			}
		}
	};
}
