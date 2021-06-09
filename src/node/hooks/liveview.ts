import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import supportsColor from 'supports-color';

import { determineProjectType, resolveHost } from '../utils';
import { startServer, LiveViewOpions } from '../server';

interface DoneCallback {
	(error?: Error | null, ...args: unknown[]): void;
}

const BOOSTRAP_FILE = '_liveview.bootstrap.js';

export const id = 'liveview-v2';

export function init(logger: any, config: any, cli: any): void {
	let serverOptions: LiveViewOpions;
	let usePreview = false;

	cli.on('build.config', (data: any) => {
		const config = data.result[1];
		const flags = config.flags || (config.flags = {});
		flags.liveview = {
			default: false,
			desc: 'Enable LiveView'
		};

		const options = config.options || (config.options = {});
		options['liveview-host'] = {
			default: null,
			desc: 'Specify which IP addresses the LiveView server should listen on'
		};

		options['liveview-port'] = {
			default: null,
			desc: 'Specify LiveView server port'
		};
	});

	cli.on('build.pre.compile', {
		priority: 1100,
		post: async (builder: any, done: DoneCallback) => {
			if (!cli.argv.liveview) {
				return done();
			}

			const sdkMajorVersion = parseInt(
				cli.sdk.name.substr(0, cli.sdk.name.indexOf('.'))
			);
			if (sdkMajorVersion < 10) {
				return done();
			}
			// Delete liveview flag from argv to disable LiveView shipped with SDK
			delete cli.argv.liveview;
			usePreview = true;

			if (supportsColor.stdout) {
				// Explicitly set `FORCE_COLOR` env to enable colored debug output using
				// chalk inside the app.
				process.env.FORCE_COLOR = supportsColor.stdout.level.toString();
			}

			const projectDir = cli.argv['project-dir'];
			const liveviewDir = path.join(builder.buildDir, '.liveview');
			fs.ensureDirSync(liveviewDir);

			const host = cli.argv['liveview-ip'] || resolveHost();
			const port = cli.argv['liveview-port'] || 8323;
			const force = cli.argv['force'];
			serverOptions = {
				project: {
					dir: projectDir,
					type: determineProjectType(builder),
					platform: cli.argv.platform,
					tiapp: cli.tiapp
				},
				server: {
					host,
					port,
					force
				}
			};

			const templateFile = path.resolve(__dirname, '../liveview.bootstrap.js');
			let bootstrapContent = await fs.readFile(templateFile, 'utf-8');
			bootstrapContent = bootstrapContent
				.replace('__SERVER_HOSTNAME__', JSON.stringify(host))
				.replace('__SERVER_PORT__', JSON.stringify(port));
			const bootstrapPath = path.join(liveviewDir, 'Resources', BOOSTRAP_FILE);
			await fs.outputFile(bootstrapPath, bootstrapContent);

			// prevent deletion of LiveView cache folder under build/<platform>/.liveview
			builder.unmarkBuildDirFiles(liveviewDir);
			// prevent deletion of Vite's dep cache under build/.vite
			builder.unmarkBuildDirFiles(path.join(projectDir, 'build/.vite'));

			cli.on(`build.${cli.argv.platform}.requestResourcesDirPaths`, {
				pre: (data: any) => {
					const paths = data.args[0];
					paths.push(path.join(liveviewDir, 'Resources'));
				}
			});
			if (cli.argv.platform === 'ios') {
				// iOS does not support the above hook yet, manually copy the hook into
				// `Resources` for now.
				await fs.copyFile(
					bootstrapPath,
					path.join(projectDir, 'Resources', BOOSTRAP_FILE)
				);
				// The user might add new Ti APIs while developing with LiveView so let's
				// just preemptively include all Ti module
				builder.includeAllTiModules = true;
			}

			done();
		}
	});

	cli.on('build.pre.build', async (builder: any, done: DoneCallback) => {
		if (usePreview) {
			logger.info(`${chalk.green('[LiveView]')} Starting dev server ...`);
			await startServer(serverOptions);
		}

		done();
	});
}
