import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url';
import path from 'path';
import { defineConfig } from 'rollup';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url)).toString(),
)

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const envConfig = defineConfig({
	input: 'src/client/env.ts',
	output: {
		dir: path.resolve(__dirname, 'dist/client'),
		sourcemap: true
	},
	plugins: [
		typescript({
			tsconfig: path.resolve(__dirname, 'src/client/tsconfig.json')
		})
	]
});

const clientConfig = defineConfig({
	input: 'src/client/client.ts',
	output: {
		file: path.resolve(__dirname, 'dist/client', 'client.js'),
		// CJS output format is important to prevent Vite's import analysis plugin
		// from creating a circular dependency within the client. We change the
		// client path but the plugin doesn't know about it and only skips the
		// original client.
		// @see https://github.com/vitejs/vite/blob/06b9935208abaa7885ded2a780cbb5699d14c8da/packages/vite/src/node/plugins/importAnalysis.ts#L390
		format: 'cjs',
		sourcemap: true,
		sourcemapPathTransform(relativeSourcePath) {
			return path.basename(relativeSourcePath);
		},
		sourcemapIgnoreList() {
			return true;
		}
	},
	external: ['./env', '@vite/env'],
	plugins: [
		commonjs(),
		nodeResolve({
			preferBuiltins: true
		}),
		typescript({
			tsconfig: path.resolve(__dirname, 'src/client/tsconfig.json')
		})
	]
});

const nodeConfig = defineConfig({
	input: 'src/node/index.ts',
	output: {
		dir: 'dist/node',
		format: 'cjs',
		sourcemap: true
	},
	external: [
		...Object.keys(pkg.dependencies),
		'alloy-compiler/lib/compilerUtils'
	],
	plugins: [
		commonjs(),
		nodeResolve({
			preferBuiltins: true
		}),
		typescript({
			tsconfig: path.resolve(__dirname, 'src/node/tsconfig.json')
		})
	]
});

const bootstrapConfig = {
	input: 'src/node/liveview.bootstrap.ts',
	output: {
		dir: 'dist/node',
		format: 'cjs',
		sourcemap: true
	},
	treeshake: {
		moduleSideEffects: 'no-external'
	},
	plugins: [
		commonjs(),
		nodeResolve({
			preferBuiltins: true,
			exportConditions: ['node']
		}),
		json(),
		typescript({
			tsconfig: path.resolve(__dirname, 'src/node/tsconfig.json')
		})
	]
};

export default [envConfig, clientConfig, bootstrapConfig];
