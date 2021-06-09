/* eslint-disable @typescript-eslint/no-explicit-any */

import path from 'path';
import createDebugger from 'debug';
import chalk from 'chalk';

import { CLIENT_PUBLIC_PATH } from './constants';
import { isBuiltinModule } from './utils/titanium';
import { cleanUrl, isJSRequest, isImportRequest } from './utils/vite';

const debug = createDebugger('liveview:client');
debug.log = console.debug.bind(console);
(debug as any).useColors = true;

// injected by the hook when copied
declare const __SERVER_HOSTNAME__: string;
declare const __SERVER_PORT__: string;

// will be re-assigned after Vite client was loaded
let __vite__injectQuery = (url: string, queryToInject: string) => url;

const fetchRemote = (filename: string) => {
	if (!isJSRequest(filename) && !isImportRequest(filename)) {
		// Usually this already would have been done by Vite on the server, but
		// there are some rare edge cases that will not be processes by Vite, e.g.
		// the bootstrap loader or `binding.redirect`.
		filename = __vite__injectQuery(filename, 'import');
	}

	const url = `http://${__SERVER_HOSTNAME__}:${__SERVER_PORT__}${filename}`;
	const request = Ti.Network.createHTTPClient();
	debug('Fetch remote %s', chalk.cyan(filename));
	request.cache = true;
	request.open('GET', url, false);
	request.send();
	if (Ti.Platform.osname === 'android') {
		const timeout = 10 * 1000;
		const expireTime = new Date().getTime() + timeout;
		let done = false;
		// FIXME: Wow this is bad, but Android does not support sync HTTP requests
		while (!done) {
			if (request.readyState === 4 || request.status === 404) {
				done = true;
			} else if (expireTime - new Date().getTime() <= 0) {
				debug(`Failed to load "${filename}", request timeout`);
				return;
			}
		}
	}

	if (request.status !== 200) {
		if (request.status === 408) {
			(Ti.App as any)._restart();
		}
		debug(
			`Failed to load "${chalk.cyan(url)}" with status code ${chalk.yellow(
				request.status
			)}`
		);
		if (request.getResponseHeader('Content-Length') !== '0') {
			debug(request.responseText);
		}
		return;
	}

	return request.responseText;
};

function patchRequire() {
	const Module = (global as any).Module;
	if (Module.__liveViewInstalled === true) {
		return;
	}

	const HYPERLOOP_PREFIX = '/@id/__x00__hyperloop:';
	const originalRequire = Module.prototype.require;
	const skipLoad = new Set();
	const exclude = (filename: string, request: string) => {
		if (skipLoad.has(request)) {
			return true;
		}

		if (request === 'hyperloop' || filename.startsWith('/hyperloop/')) {
			return true;
		}

		return false;
	};

	Module.prototype.require = function liveViewRequire(
		request: string,
		context: any
	) {
		let filename: string | undefined;
		if (request.startsWith('/@native/')) {
			// shortcut for native modules that vite already identified during the transform phase
			const moduleId = cleanUrl(request.substr(9));
			const loaded = originalRequire.call(this, moduleId, context);
			if (loaded) {
				return loaded;
			}
		} else if (request.startsWith(HYPERLOOP_PREFIX)) {
			// shortcut for hyperloop wrapper files
			const loaded = originalRequire.call(
				this,
				`/hyperloop/${request.slice(HYPERLOOP_PREFIX.length)}`,
				context
			);
			if (loaded) {
				return loaded;
			}
		} else if (request.startsWith('.')) {
			filename = path.normalize(this.path + '/' + request);
		} else if (request.startsWith('/')) {
			filename = request;
		} else if (!isBuiltinModule(request)) {
			filename = path.normalize(`/@id/${request}`);
		}

		request = cleanUrl(request).replace('/@id/', '');

		if (filename && !exclude(filename, request)) {
			// First check the cache if this was alrady loaded
			if (Module.cache[filename]) {
				return Module.cache[filename].exports;
			}

			// Fetch from remote dev server
			const source = fetchRemote(filename);
			if (source) {
				const id = cleanUrl(filename);
				const module = new Module(filename, this);
				if (filename.slice(-4) === 'json') {
					module.filename = id;
					module.path = path.dirname(id);
					Module.cache[id] = module;
					module.exports = JSON.parse(source);
					module.loaded = true;
				} else {
					let wrapped = source;
					if (id === '/app' && OS_ANDROID) {
						wrapped = `try {\n${source}\n} catch (e) { console.log(e); }`
					}
					module.load(id, wrapped);
				}

				if (request.includes('build/.vite')) {
					// Optimized deps from Vite are always converted to ES modules first
					// and then back to CJS for use in Titanium. Add an ES module interop
					// to properly assign `default` exports back to `module.exports`.
					module.exports = esModuleInterop(module.exports);
				}

				return module.exports;
			}

			debug('[fallthrough] %s', chalk.cyan(request));
		}

		const loaded = originalRequire.call(this, request, context);
		if (loaded) {
			skipLoad.add(request);
		}
		return loaded;
	};

	Module.__liveViewInstalled = true;
}

function patchI18n() {
	const i18nData: Record<string, Record<string, string>> = {};
	global.L = (key: string, hint?: string) => {
		const currentLocale = Ti.Locale.currentLanguage;
		let messages = i18nData[currentLocale];
		if (!messages) {
			try {
				messages = require(`/@liveview/i18n/${currentLocale}/strings.xml`);
			} catch (e) {
				messages = {};
			}
			i18nData[currentLocale] = messages;
		}
		return messages[key] || hint || key;
	};
}

export async function execute(done: () => void): Promise<void> {
	patchRequire();
	patchI18n();

	// eslint-disable-next-line @typescript-eslint/no-var-requires, security/detect-non-literal-require
	const { connect, injectQuery } = require(CLIENT_PUBLIC_PATH);
	__vite__injectQuery = injectQuery;
	await connect();

	done();
}

const esModuleInterop = (module: any) => {
	const getOwnPropNames = (target: any) => Object.getOwnPropertyNames(target);
	const namedExports = (target: any) =>
		getOwnPropNames(target).filter(
			(n) => n !== '__esModule' && n !== 'default'
		);
	if (
		module.__esModule &&
		'default' in module &&
		namedExports(module).length === 0
	) {
		if (
			typeof module.default === 'object' ||
			typeof module.default === 'function'
		) {
			module.default.default = module.default;
		}
		return module.default;
	}

	return module;
};
