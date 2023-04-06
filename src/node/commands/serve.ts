/* eslint-disable @typescript-eslint/no-explicit-any */

import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import hash from 'hash-sum';
import merge from 'lodash.merge';
import get from 'lodash.get';
import set from 'lodash.set';
import ti from 'node-titanium-sdk';
import tiappxml from 'node-titanium-sdk/lib/tiappxml';
import { promisify } from 'util';

import { startServer } from '../server';
import { resolveHost } from '../utils';
import { ProjectType } from '../types';

interface LiveViewMetadata {
	hash: string;
}

export const title = 'Serve';
export const desc = 'Serve App through LiveView';
export const extendedDesc =
	'Launches app and serves all content through LiveView';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const NOOP = () => {};
let buildCommand: any;

export const config = (logger: any, config: any, cli: any) => {
	const platform = cli.argv._[1];
	// eslint-disable-next-line security/detect-non-literal-require
	buildCommand = require(cli.globalContext.commands.build.path);
	const createBuildConfig = buildCommand.config(logger, config, cli);
	return (done: (cmdConfig: any) => void) => {
		createBuildConfig((buildConfig: any) => {
			const platformOption = buildConfig.options.platform;
			if (platform && platformOption.values.includes(platform)) {
				// Remove platform name shortcut and add proper `-p` option to original
				// argv array
				cli.argv._.splice(1, 1);
				cli.argv.$_.push('-p', platform);
			}

			const mergedConfig = merge(buildConfig, {
				options: {
					'project-dir': {
						/**
						 * Override project dir callback to make sure this is an app project
						 * and to use serve command when validating correct SDK version.
						 * Otherwise the CLI will spawn the build command if there is a
						 * SDK mismatch.
						 *
						 * @param projectDir
						 */
						callback: (projectDir: string) => {
							if (projectDir === '') {
								// default tocurrent directory
								projectDir = buildConfig.options['project-dir'].default;
							}

							projectDir = path.resolve(projectDir);

							// load the tiapp.xml
							if (fs.existsSync(path.join(projectDir, 'tiapp.xml'))) {
								let tiapp;
								try {
									tiapp = cli.tiapp = new tiappxml(
										path.join(projectDir, 'tiapp.xml')
									);
								} catch (ex) {
									logger.error(ex);
									process.exit(1);
								}

								tiapp.properties || (tiapp.properties = {});

								// make sure the tiapp.xml is sane
								ti.validateTiappXml(logger, config, tiapp);

								// check that the Titanium SDK version is correct
								if (!ti.validateCorrectSDK(logger, config, cli, 'serve')) {
									throw new cli.GracefulShutdown();
								}

								cli.argv.type = 'app';
							} else {
								// Not an app dir and serve does not support modules
								return;
							}

							cli.scanHooks(path.join(projectDir, 'hooks'));

							return projectDir;
						}
					}
				}
			});

			// Remove unsupported flags
			delete mergedConfig.flags['build-only'];
			delete mergedConfig.flags.legacy;

			done(mergedConfig);
		});
	};
};

export const validate = (logger: any, config: any, cli: any) => {
	return buildCommand.validate(logger, config, cli);
};

interface RunFn {
	(logger: any, config: any, cli: any): void;
}

export const run = async (
	logger: any,
	config: any,
	cli: any,
	finished: (e?: unknown) => void
) => {
	const projectDir = cli.argv['project-dir'];
	const host = cli.argv['liveview-ip'] || resolveHost();
	const port = cli.argv['liveview-port'] || 8323;
	let force = cli.argv.force;

	const legacyPlatformName =
		cli.argv.platform === 'android' ? 'android' : 'iphone';
	const platform = cli.argv.platform.replace(/^(iphone|ipad)$/i, 'ios');
	const cacheDir = path.join(
		projectDir,
		'build',
		legacyPlatformName,
		'.liveview'
	);
	const dataPath = path.join(cacheDir, '_metadata.json');

	try {
		const buildHash = hash({
			tiapp: cli.tiapp,
			target: cli.argv.target,
			server: {
				host,
				port
			},
			env: {
				DEBUG: process.env.DEBUG
			}
		});
		const data: LiveViewMetadata = {
			hash: buildHash
		};

		if (!force) {
			let prevData;
			try {
				prevData = fs.readJSONSync(dataPath);
			} catch (e) {}
			if (!prevData || prevData.hash !== buildHash) {
				force = true;
			}
		}

		const runBuild = promisify<RunFn>(buildCommand.run);
		if (force) {
			logger.info(`${chalk.green('[LiveView]')} Forcing app rebuild ...`);
			cli.argv.liveview = true;
			await runBuild(logger, config, cli);
			await fs.outputJSON(dataPath, data);
		} else {
			logger.info(`${chalk.green('[LiveView]')} Starting dev server ...`);
			await startServer({
				project: {
					dir: projectDir,
					type: determineProjectType(projectDir),
					platform,
					tiapp: cli.tiapp
				},
				server: {
					host,
					port,
					force
				}
			});
			resetCliHooks(cli, legacyPlatformName);
			const builder = await getBuilderInstance(logger, config, cli, runBuild);
			const runHook = (name: string) => {
				return new Promise<void>((resolve, reject) => {
					cli.emit(name, builder, (e: Error) => {
						if (e) {
							return reject(e);
						}
						resolve();
					});
				});
			};
			if (platform === 'android') {
				// emit fake pre-compile hook to prepare Android emulators or device
				// for app launch
				await runHook('build.pre.compile');
			}
			// emit fake post-compile hook to run previously built app.
			await runHook('build.post.compile');
		}
	} catch (e) {
		console.error(e);
		return finished(e);
	}

	finished();
};

function determineProjectType(projectDir: string): ProjectType {
	const pkgPath = path.join(projectDir, 'package.json');
	if (fs.existsSync(pkgPath)) {
		const pkg = fs.readJsonSync(pkgPath);
		const hasWebpackPlugin = Object.keys(pkg.dependencies || {})
			.concat(Object.keys(pkg.devDependencies || {}))
			.some((dep: string) => dep.startsWith('@titanium-sdk/webpack-plugin'));
		if (hasWebpackPlugin) {
			return 'webpack';
		}
	}
	if (fs.existsSync(path.join(projectDir, 'app'))) {
		return 'alloy';
	} else {
		return 'classic';
	}
}

/**
 * Utility function to get an initialized builder instance.
 *
 * The platform specific build commands do not export the used `Builder` class
 * so we cannot create one directly. This function hijacks the `run` function that
 * a build command exports and then utilizes the `build.pre.construct` hook to
 * get an instace of the builder class. The build will then be stopped by throwing
 * an error from the hook.
 *
 * Since the `run` function itself has an error handler which calls `process.exit`,
 * we need to be a little hacky and temporarily replace that with a no-op.
 *
 * @param logger Logger instance
 * @param config Titanium config
 * @param cli Titanium CLI instance
 * @param runBuild Promisified build command `run` function
 */
async function getBuilderInstance(
	logger: any,
	config: any,
	cli: any,
	runBuild: RunFn
) {
	const restoreProcess = stubMethods(process, ['exit']);
	const restoreLogger = stubMethods(logger, ['info', 'error', 'log.end']);
	let builder: any;
	cli.on('build.pre.construct', (_builder: any, done: (e?: Error) => void) => {
		builder = _builder;
		// Throw error to exit the build command early. We cannot use
		// `done(new Error())` because Android will ignore it
		throw new Error('Stop');
	});
	try {
		await runBuild(logger, config, cli);
	} finally {
		restoreLogger();
		restoreProcess();
	}
	if (!builder) {
		throw new Error('Failed to get Builder instance');
	}
	builder.initialize();
	return builder;
}

/**
 * Stubs all given `methods` on the `target` with no-ops.
 *
 * @param target Target object
 * @param methods List of methods to stub
 * @returns Function that restores all original methods on `target`.
 */
function stubMethods(target: any, methods: string[]): () => void {
	// eslint-disable-next-line @typescript-eslint/ban-types
	const originalMethods: Record<string, Function> = {};
	for (const key of methods) {
		const original = get(target, key);
		originalMethods[key] = original;
		set(target, key, NOOP);
	}

	return () => {
		Object.keys(originalMethods).forEach((key) => {
			const original = originalMethods[key];
			set(target, key, original);
		});
	};
}

/**
 * Resets all previously registered hooks and then loads the required hooks
 * for installing and launching an app from the platform folder inside the
 * current SDK.
 *
 * @param cli Titanium CLI instance
 */
function resetCliHooks(cli: any, platform: string) {
	cli.hooks = {
		scannedPaths: {},
		pre: {},
		post: {},
		ids: {},
		loadedFilenames: [],
		incompatibleFilenames: [],
		erroredFilenames: [],
		errors: {}
	};

	cli.scanHooks(path.join(cli.sdk.path, platform, 'cli/hooks'));
}
