import fs from 'fs';
import path from 'path';
import { parseConfig } from 'alloy-compiler/lib/compilerUtils';
import { Plugin } from 'vite';
import { AlloyContext } from './context';

const ALLOY_CONFIG = '/alloy/CFG';

export function configPlugin(ctx: AlloyContext): Plugin {
	return {
		name: 'titanium:alloy:config',

		resolveId(id) {
			if (id === ALLOY_CONFIG) {
				return id;
			}
		},

		load(id) {
			if (id === ALLOY_CONFIG) {
				const { alloyConfig, theme } = ctx.compiler.config;
				const { home: appDir } = ctx.compiler.config.dir;
				const config = {};
				const appConfigFile = path.join(appDir, 'config.json');
				if (fs.existsSync(appConfigFile)) {
					parseConfig(appConfigFile, alloyConfig, config);

					if (theme) {
						const themeConfigFile = path.join(
							appDir,
							'themes',
							theme,
							'config.json'
						);
						if (fs.existsSync(themeConfigFile)) {
							parseConfig(themeConfigFile, alloyConfig, config);
						}
					}
				}
				return `module.exports = ${JSON.stringify(config)}`;
			}
		}
	};
}
