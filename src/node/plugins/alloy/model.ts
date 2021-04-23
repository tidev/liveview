import path from 'path';
import { Plugin } from 'vite';

import { AlloyContext } from './context';

const modelRE = /(?:[/\\]widgets[/\\][^/\\]+)?[/\\]models[/\\](.*)/;

export function modelPlugin(ctx: AlloyContext): Plugin {
	return {
		name: 'titanium:alloy:model',

		async resolveId(id, importer) {
			if (modelRE.test(id)) {
				const result = await this.resolve(
					path.join(ctx.appDir, id.replace(/\/alloy\//, '')),
					importer,
					{ skipSelf: true }
				);
				if (result) {
					return result.id;
				}
			}
		},

		transform(code, id) {
			if (modelRE.test(id)) {
				const { code: modelCode } = ctx.compiler.compileModel({
					file: id,
					content: code
				});

				return modelCode;
			}
		}
	};
}
