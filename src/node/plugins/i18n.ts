import path from 'path';
import { Plugin, normalizePath } from 'vite';
import xmlParser from 'fast-xml-parser';

import { ProjectType } from '../types';

const I18N_PUBLIC_PATH = '/@liveview/i18n/';

/**
 *
 */
export function i18nPlugin(
	projectDir: string,
	projectType: ProjectType
): Plugin {
	const i18nDir =
		projectType === 'alloy'
			? path.join(projectDir, 'app/i18n')
			: path.join(projectDir, 'i18n');

	return {
		name: 'titanium:i18n',
		resolveId(id) {
			id = normalizePath(id);
			if (id.startsWith(I18N_PUBLIC_PATH)) {
				return path.join(i18nDir, id.replace(I18N_PUBLIC_PATH, ''));
			}
		},
		async transform(code, id) {
			id = normalizePath(id);
			if (id.startsWith(i18nDir)) {
				const messages: Record<string, string> = {};
				const result = xmlParser.parse(code, {
					ignoreAttributes: false
				});
				if (result.resources) {
					let stringNodes = result.resources.string || [];
					if (!Array.isArray(stringNodes)) {
						stringNodes = [stringNodes];
					}
					for (const node of stringNodes) {
						const key = node['@_name'];
						const value = node['#text'];
						messages[key] = value;
					}

					return `module.exports = ${JSON.stringify(messages)}`;
				}
			}
		}
	};
}
