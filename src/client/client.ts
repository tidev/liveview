/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Modified Vite client that works inside the Titanium JavaScript runtime.
 *
 * @see https://github.com/vitejs/vite/blob/57980d27ee10f1f92e532a0975d4ab39ce27d3ed/packages/vite/src/client/client.ts
 */

import WebSocket from 'tiws';
import { HMRPayload, Update } from 'vite';

import '@vite/env';

// injected by the hmr plugin when served
declare const __HMR_PROTOCOL__: string | null;
declare const __HMR_DIRECT_TARGET__: string;
declare const __HMR_TIMEOUT__: number;

console.log('[vite] connecting...');

const socketProtocol = __HMR_PROTOCOL__;
const directSocketHost = __HMR_DIRECT_TARGET__;
const socket = new WebSocket(
	`${socketProtocol}://${directSocketHost}`,
	'vite-hmr'
);
const base = '/';

socket.on('error', (e) => console.log(e));
socket.on('message', ({ data }) => {
	handleMessage(JSON.parse(data));
});

let isRestarting = false;

async function handleMessage(payload: HMRPayload) {
	switch (payload.type) {
		case 'connected':
			console.log('[vite] connected.');
			// proxy(nginx, docker) hmr ws maybe caused timeout,
			// so send ping package let ws keep alive.
			setInterval(() => socket.send('ping'), __HMR_TIMEOUT__);
			break;
		case 'update':
			// if this is the first update and there's already an error overlay, it
			// means the page opened with existing server compile error and the whole
			// module script failed to load (since one of the nested imports is 500).
			// in this case a normal update won't work and a full reload is needed.
			// TODO: Implement error overlay for Titanium?
			/*
				if (isFirstUpdate && hasErrorOverlay()) {
					window.location.reload()
					return
				} else {
					clearErrorOverlay()
					isFirstUpdate = false
				}
				*/
			payload.updates.forEach((update) => {
				if (update.type === 'js-update') {
					queueUpdate(fetchUpdate(update));
				}
			});
			break;
		case 'full-reload': {
			socket.close();
			if (!isRestarting) {
				isRestarting = true;
				(Ti.App as any)._restart();
			}
			break;
		}
	}
}

let pending = false;
let queued: Promise<(() => void) | undefined>[] = [];

/**
 * buffer multiple hot updates triggered by the same src change
 * so that they are invoked in the same order they were sent.
 * (otherwise the order may be inconsistent because of the http request round trip)
 */
async function queueUpdate(p: Promise<(() => void) | undefined>) {
	queued.push(p);
	if (!pending) {
		pending = true;
		await Promise.resolve();
		pending = false;
		const loading = [...queued];
		queued = [];
		(await Promise.all(loading)).forEach((fn) => fn && fn());
	}
}

async function fetchUpdate({ path, acceptedPath, timestamp }: Update) {
	const mod = hotModulesMap.get(path);
	if (!mod) {
		// In a code-splitting project,
		// it is common that the hot-updating module is not loaded yet.
		// https://github.com/vitejs/vite/issues/721
		return;
	}

	const moduleMap = new Map();
	const isSelfUpdate = path === acceptedPath;

	// make sure we only import each dep once
	const modulesToUpdate = new Set<string>();
	if (isSelfUpdate) {
		// self update - only update self
		modulesToUpdate.add(path);
	} else {
		// dep update
		for (const { deps } of mod.callbacks) {
			deps.forEach((dep) => {
				if (acceptedPath === dep) {
					modulesToUpdate.add(dep);
				}
			});
		}
	}

	// determine the qualified callbacks before we re-import the modules
	const qualifiedCallbacks = mod.callbacks.filter(({ deps }) => {
		return deps.some((dep) => modulesToUpdate.has(dep));
	});

	await Promise.all(
		Array.from(modulesToUpdate).map(async (dep) => {
			const disposer = disposeMap.get(dep);
			if (disposer) {
				await disposer(dataMap.get(dep));
			}
			const [path, query] = dep.split('?');
			try {
				const newMod = await import(
					/* @vite-ignore */
					base +
						path.slice(1) +
						`?import&t=${timestamp}${query ? `&${query}` : ''}`
				);
				moduleMap.set(dep, newMod);
			} catch (e) {
				warnFailedFetch(e, dep);
			}
		})
	);

	return () => {
		for (const { deps, fn } of qualifiedCallbacks) {
			fn(deps.map((dep) => moduleMap.get(dep)));
		}
		const loggedPath = isSelfUpdate ? path : `${acceptedPath} via ${path}`;
		console.log(`[vite] hot updated: ${loggedPath}`);
	};
}

function warnFailedFetch(err: unknown, path: string | string[]) {
	if (err instanceof Error && !err.message.match('fetch')) {
		console.error(err);
	}
	console.error(
		`[hmr] Failed to reload ${path}. ` +
			'This could be due to syntax errors or importing non-existent ' +
			'modules. (see errors above)'
	);
}

interface HotModule {
	id: string;
	callbacks: HotCallback[];
}

interface HotCallback {
	// the dependencies must be fetchable paths
	deps: string[];
	fn: (modules: Record<string, unknown>[]) => void;
}

/* eslint-disable no-spaced-func */
const hotModulesMap = new Map<string, HotModule>();
const disposeMap = new Map<string, (data: any) => void | Promise<void>>();
const pruneMap = new Map<string, (data: any) => void | Promise<void>>();
const dataMap = new Map<string, any>();
const customListenersMap = new Map<string, ((customData: any) => void)[]>();
const ctxToListenersMap = new Map<
	string,
	Map<string, ((customData: any) => void)[]>
>();
/* eslint-enable no-spaced-func */

export const createHotContext = (ownerPath: string): any => {
	if (!dataMap.has(ownerPath)) {
		dataMap.set(ownerPath, {});
	}

	// when a file is hot updated, a new context is created
	// clear its stale callbacks
	const mod = hotModulesMap.get(ownerPath);
	if (mod) {
		mod.callbacks = [];
	}

	// clear stale custom event listeners
	const staleListeners = ctxToListenersMap.get(ownerPath);
	if (staleListeners) {
		for (const [event, staleFns] of staleListeners) {
			const listeners = customListenersMap.get(event);
			if (listeners) {
				customListenersMap.set(
					event,
					listeners.filter((l) => !staleFns.includes(l))
				);
			}
		}
	}

	const newListeners = new Map();
	ctxToListenersMap.set(ownerPath, newListeners);

	function acceptDeps(
		deps: string[],
		callback: HotCallback['fn'] = () => {
			/* empty default handler */
		}
	) {
		const mod: HotModule = hotModulesMap.get(ownerPath) || {
			id: ownerPath,
			callbacks: []
		};
		mod.callbacks.push({
			deps,
			fn: callback
		});
		hotModulesMap.set(ownerPath, mod);
	}

	const hot = {
		get data() {
			return dataMap.get(ownerPath);
		},

		accept(deps: any, callback?: any) {
			if (typeof deps === 'function' || !deps) {
				// self-accept: hot.accept(() => {})
				acceptDeps([ownerPath], ([mod]) => deps && deps(mod));
			} else if (typeof deps === 'string') {
				// explicit deps
				acceptDeps([deps], ([mod]) => callback && callback(mod));
			} else if (Array.isArray(deps)) {
				acceptDeps(deps, callback);
			} else {
				throw new Error('invalid hot.accept() usage.');
			}
		},

		acceptDeps() {
			throw new Error(
				'hot.acceptDeps() is deprecated. ' +
					'Use hot.accept() with the same signature instead.'
			);
		},

		dispose(cb: (data: any) => void) {
			disposeMap.set(ownerPath, cb);
		},

		prune(cb: (data: any) => void) {
			pruneMap.set(ownerPath, cb);
		},

		decline() {
			// TODO
		},

		invalidate() {
			// TODO should tell the server to re-perform hmr propagation
			// from this module as root
			(Ti.App as any)._restart();
		},

		// custom events
		on(event: string, cb: () => void) {
			const addToMap = (map: Map<string, any[]>) => {
				const existing = map.get(event) || [];
				existing.push(cb);
				map.set(event, existing);
			};
			addToMap(customListenersMap);
			addToMap(newListeners);
		}
	};

	return hot;
};

/**
 * urls here are dynamic require() urls that couldn't be statically analyzed
 */
export function injectQuery(url: string, queryToInject: string): string {
	// can't use pathname from URL since it may be relative like ../
	const pathname = url.replace(/#.*$/, '').replace(/\?.*$/, '');
	// const { search, hash } = new URL(url, 'http://vitejs.dev');
	// simple regex search for now since we don't have URL class polyfill yet
	const search = url.match(/\?[^#]+/)?.[0];
	const hash = url.match(/#.+/)?.[0];

	return `${pathname}?${queryToInject}${search ? '&' + search.slice(1) : ''}${
		hash || ''
	}`;
}
