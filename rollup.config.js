import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import path from 'path';

const envConfig = {
	input: 'src/client/env.ts',
	output: {
		dir: path.resolve(__dirname, 'dist/client'),
		sourcemap: true
	},
	plugins: [
		typescript({
			target: 'es2018',
			include: ['src/client/env.ts'],
			baseUrl: path.resolve(__dirname, 'src/env')
		})
	]
};

const clientConfig = {
	input: 'src/client/client.ts',
	output: {
		dir: 'dist/client',
		// CJS output format is important to prevent Vite's import analysis plugin
		// from creating a circular dependency within the client. We change the
		// client path but the plugin doesn't know about it and only skips the
		// original client.
		// @see https://github.com/vitejs/vite/blob/06b9935208abaa7885ded2a780cbb5699d14c8da/packages/vite/src/node/plugins/importAnalysis.ts#L390
		format: 'cjs',
		sourcemap: true
	},
	external: ['./env'],
	plugins: [
		commonjs(),
		nodeResolve({
			preferBuiltins: true
		}),
		typescript({
			target: 'es2018',
			include: ['src/client/**/*.ts'],
			baseUrl: path.resolve(__dirname, 'src/client')
		})
	]
};

const nodeConfig = {
	input: 'src/node/index.ts',
	output: {
		dir: 'dist/node',
		format: 'cjs',
		sourcemap: true
	},
	external: [
		...Object.keys(require('./package.json').dependencies),
		'alloy-compiler/lib/compilerUtils'
	],
	plugins: [
		commonjs(),
		nodeResolve({
			preferBuiltins: true
		}),
		typescript({
			target: 'es2019',
			include: ['src/**/*.ts'],
			esModuleInterop: true
		})
	]
};

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
			preferBuiltins: true
		}),
		json(),
		typescript({
			target: 'es2019',
			include: ['src/**/*.ts']
		})
	]
};

export default [envConfig, clientConfig, bootstrapConfig];
