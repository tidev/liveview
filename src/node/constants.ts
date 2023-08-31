/**
 * Most of these are copied from Vite as they are not exported directly and there
 * is no reliable deep import URL since Vite's dist build is split into chunks with
 * random hashes.
 *
 * The client and env entries were adjusted to use our own Titanium versions.
 *
 * @see https://github.com/vitejs/vite/blob/61ea32056048e902ca69d88e1b0a2d21660dae2a/packages/vite/src/node/constants.ts
 */

import path from 'path';

export const JS_TYPES_RE = /\.(?:j|t)sx?$|\.mjs$/;

export const OPTIMIZABLE_ENTRY_RE = /\.[cm]?[jt]s$/;

/**
 * Prefix for resolved fs paths, since windows paths may not be valid as URLs.
 */
export const FS_PREFIX = `/@fs/`;

/**
 * Prefix for resolved Ids that are not valid browser import specifiers
 */
export const VALID_ID_PREFIX = `/@id/`;

/**
 * Plugins that use 'virtual modules' (e.g. for helper functions), prefix the
 * module ID with `\0`, a convention from the rollup ecosystem.
 * This prevents other plugins from trying to process the id (like node resolution),
 * and core features like sourcemaps can use this info to differentiate between
 * virtual modules and regular files.
 * `\0` is not a permitted char in import URLs so we have to replace them during
 * import analysis. The id will be decoded back before entering the plugins pipeline.
 * These encoded virtual ids are also prefixed by the VALID_ID_PREFIX, so virtual
 * modules in the browser end up encoded as `/@id/__x00__{id}`
 */
export const NULL_BYTE_PLACEHOLDER = `__x00__`;

export const bareImportRE = /^[\w@](?!.*:\/\/)/;

export const CLIENT_PUBLIC_PATH = '/@vite/client';
export const CLIENT_ENTRY = path.resolve(__dirname, '../client/client.js');
export const CLIENT_DIR = path.dirname(CLIENT_ENTRY);
export const ENV_ENTRY = path.resolve(__dirname, '../client/env.js');

export const DEP_VERSION_RE = /[?&](v=[\w.-]+)\b/;

export const wildcardHosts = new Set([
	'0.0.0.0',
	'::',
	'0000:0000:0000:0000:0000:0000:0000:0000'
]);
