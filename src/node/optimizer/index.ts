import { createHash } from 'crypto';
import path from 'path';
import chalk from 'chalk';
import createDebugger from 'debug';
import fs from 'fs-extra';
import {
	DepOptimizationMetadata,
	ResolvedConfig,
	ViteDevServer,
	optimizeDeps
} from 'vite';

import { lookupFile } from '../utils';
import { scanDynamicRequires } from './scan';

const log = createDebugger('titanium:deps');

export async function runDynamicOptimize(
	server: ViteDevServer,
	force = server.config.optimizeDeps.force
): Promise<void> {
	const config = server.config;
	const { cacheDir, logger, root } = config;

	if (!cacheDir) {
		return;
	}

	// Create our own metadata file so we can detect if we need to re-bundle
	const dataPath = path.join(cacheDir, '_dyn_metadata.json');
	const mainHash = getDepHash(root, config);
	const data: DepOptimizationMetadata = {
		hash: mainHash,
		browserHash: mainHash,
		optimized: {},
		chunks: {},
		discovered: {},
		depInfoList: []
	};

	if (!force) {
		let prevData;
		try {
			prevData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
		} catch (e) {}
		// hash is consistent, no need to re-bundle
		if (prevData && prevData.hash === data.hash) {
			return;
		}
	}

	(server as any)._isRunningOptimizer = true;
	const { deps } = await scanDynamicRequires(server);

	const qualifiedIds = Object.keys(deps);

	if (!qualifiedIds.length) {
		await fs.outputFile(dataPath, JSON.stringify(data, null, 2));
		log('No dynamic dependencies to bundle. Skipping.\n\n\n');
		return;
	}

	const uniqueIds = dedupeDeps(qualifiedIds);
	const total = uniqueIds.length;
	const maxListed = 5;
	const listed = Math.min(total, maxListed);
	const extra = Math.max(0, total - maxListed);
	const depsString = chalk.yellow(
		uniqueIds.slice(0, listed).join('\n  ') +
			(extra > 0 ? `\n  (...and ${extra} more)` : '')
	);
	logger.info(
		chalk.greenBright(`Pre-bundling dynamic dependencies:\n  ${depsString}`)
	);
	logger.info(
		'(this will be run only when your dependencies or config have changed)'
	);

	const newDeps = deps;
	const knownOptimized = (server as any)._optimizeDepsMetadata.optimized;
	for (const id in knownOptimized) {
		newDeps[id] = knownOptimized[id].src;
	}
	const meta = await optimizeDeps(server.config, true, false);
	if (meta) {
		// In-place update of known optimized deps so the `_registerMissingImport`
		// function on the server knows about our newly discovered dynamic deps.
		// @see https://github.com/vitejs/vite/blob/7231b5a882a2db8dd2d9cb88a0f446edb5e2cf43/packages/vite/src/node/optimizer/registerMissing.ts#L12
		Object.assign(knownOptimized, meta.optimized);
	}

	// `optimizeDeps` will already store all relevant deps info so we can
	// write our metadata file without any additional data
	await fs.outputFile(dataPath, JSON.stringify(data, null, 2));

	(server as any)._isRunningOptimizer = false;
}

function dedupeDeps(ids: string[]) {
	const deps = new Set<string>();
	for (const id of ids) {
		const normalizedId = id.replace(/\/index(\.\w+)?$/, '');
		deps.add(normalizedId);
	}
	return Array.from(deps);
}

const lockfileFormats = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

let cachedHash: string | undefined;

function getDepHash(root: string, config: ResolvedConfig): string {
	if (cachedHash) {
		return cachedHash;
	}
	let content = lookupFile(root, lockfileFormats) || '';
	// also take config into account
	// only a subset of config options that can affect dep optimization
	content += JSON.stringify(
		{
			mode: config.mode,
			root: config.root,
			resolve: config.resolve,
			assetsInclude: config.assetsInclude,
			plugins: config.plugins.map((p) => p.name),
			optimizeDeps: {
				include: config.optimizeDeps?.include,
				exclude: config.optimizeDeps?.exclude
			}
		},
		(_, value) => {
			if (typeof value === 'function' || value instanceof RegExp) {
				return value.toString();
			}
			return value;
		}
	);
	return createHash('sha256').update(content).digest('hex').substr(0, 8);
}
