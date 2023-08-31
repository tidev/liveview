import path from 'path';
import glob from 'fast-glob';
import fs from 'fs-extra';
import { Plugin } from 'vite';

import { Platform } from '../types';

const PREFIX = '\0hyperloop:';

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
			const className = path.basename(file, '.js');
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
			Object.keys(metadata).map((name) => [name, name.toLowerCase()])
		);
	}
	hyperloopModules.set('Titanium', 'titanium');

	return {
		name: 'titanium:hyperloop',

		async resolveId(id, importer) {
			if (id.startsWith('/hyperloop/')) {
				return `${PREFIX}${id.slice(11)}.js`;
			}

			if (id.startsWith('/')) {
				return;
			}

			if (id.startsWith('.')) {
				if (importer?.startsWith(PREFIX)) {
					const result = await this.resolve(
						id,
						path.join(hyperloopResourcesDir, importer.slice(PREFIX.length)),
						{
							skipSelf: true
						}
					);
					if (result) {
						return `${PREFIX}${result.id.slice(
							hyperloopResourcesDir.length + 1
						)}`;
					}
				}
				return;
			}

			let [pkg, type] = id.split('/');
			if (platform === 'android' && !type) {
				if (pkg.endsWith('.*')) {
					pkg = pkg.replace('.*', '');
				}
				if (hyperloopModules.has(pkg)) {
					const resourcePath = path.join(
						hyperloopResourcesDir,
						`${hyperloopModules.get(pkg)!}.js`
					);
					if (await fs.pathExists(resourcePath)) {
						return `${PREFIX}${hyperloopModules.get(pkg)!}.js`;
					}
				}
			} else if (hyperloopModules.has(pkg)) {
				type = type?.toLowerCase();
				if (type === undefined) {
					type = pkg.toLowerCase();
				}
				const resourcePath = path.join(
					hyperloopResourcesDir,
					`${pkg}/${type}.js`
				);
				if ((await fs.pathExists(resourcePath)) || pkg === 'Titanium') {
					return `${PREFIX}${pkg}/${type}.js`;
				}
			}
		},

		async load(id) {
			if (id.startsWith(PREFIX)) {
				return await fs.readFile(
					path.join(hyperloopResourcesDir, id.slice(PREFIX.length)),
					'utf-8'
				);
			}
		}
	};
}
