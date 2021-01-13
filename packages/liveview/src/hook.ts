import {
  LiveViewServer,
  Workspace,
  WorkspaceOptions,
} from '@liveview/server';
import { appcd, Platform, ProjectType, TranspileTargets } from '@liveview/shared-utils';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

interface DoneCallback {
  (error?: Error | null, ...args: unknown[]): void
}

export const cliVersion = '>=5.0.0';

export function init(logger: any, config: any, cli: any): void {
  const useDaemon = config.liveview && config.liveview.daemon;

  let workspace: Workspace;

  cli.on('build.config', (data: any, done: DoneCallback) => {
    const config = data.result[1];
    const flags = config.flags || (config.flags = {});
		flags.liveview = {
			default: true,
			desc: 'Enable LiveView'
    };

    const options = config.options || (config.options = {});
		options['liveview-ip'] = {
			default: null,
			desc: 'LiveView Server IP address'
		};

		options['liveview-port'] = {
			default: null,
			desc: 'LiveView Server port'
		};

		done(null, data);
  });

	cli.on('build.pre.compile', async (builder: any, done: DoneCallback) => {
    if (!cli.argv.liveview) {
      return done();
    }

    builder.liveView = {
      enabled: true,
      assetsPath: path.join(builder.buildDir, 'liveview', 'assets'),
      files: {}
    };
    await fs.ensureDir(builder.liveView.assetsPath);

    // resolve host and port
    let host;
    let port;
    if (useDaemon) {
      const liveViewConfig = await appcd.get('/appcd/config/liveview');
      host = resolveHost() || '127.0.0.1';
      port = liveViewConfig.port;
    } else {
      host = cli.argv['liveview-ip'] || resolveHost();
      port = cli.argv['liveview-port'] || 8323;
    }

    // start liveview server
    const hmr = false;
    const options: WorkspaceOptions = {
      name: builder.tiapp.name,
      path: builder.projectDir,
      type: determineProjectType(builder),
      transpile: builder.transpile
    };
    if (useDaemon) {
      workspace = await appcd.post('/liveview/latest/workspace', options);
    } else {
      const server = new LiveViewServer({
        host,
        port
      });
      workspace = await server.addWorkspace(options);
      await server.start();
    }

    // write liveview.bootstrap.js
    const templateFile = path.resolve(__dirname, 'liveview.bootstrap.js');
    let bootstrapContent = await fs.readFile(templateFile, 'utf-8');
    bootstrapContent = bootstrapContent
      .replace('__HOST__', host)
      .replace('__PORT__', port)
      .replace('__WORKSPACE__', workspace.slug)
      .replace('__HMR__', Boolean(hmr).toString());
    const bootstrapPath = path.join(builder.liveView.assetsPath, 'liveview.bootstrap.js');
    await fs.writeFile(
      bootstrapPath,
      bootstrapContent
    );
    builder.liveView.files['liveview.bootstrap.js'] = bootstrapPath;

    done();
  });

  cli.on('build.post.compile', async (builder: any, done: DoneCallback) => {
    const platform: Platform = cli.argv.platform;
    let targets: TranspileTargets | undefined;
    if (platform === 'ios') {
      targets = { ios: builder.minIosVersion };
    } else if (platform === 'android') {
      targets = { chrome: builder.chromeVersion };
    }
    workspace.startLiveView({
      platform,
      transpileTargets: targets,
      outputPath: path.join(builder.buildDir, 'liveview', 'assets')
    });
    done();
  });

  const writeBuildManifest = (data: any, done: DoneCallback) => {
    if (cli.argv.liveview) {
      data.args[0].liveview = true;
    }
    return done(null, data);
  };
  cli.on('build.android.writeBuildManifest', writeBuildManifest);
  cli.on('build.ios.writeBuildManifest', writeBuildManifest);
}

function resolveHost() {
	const interfaces = os.networkInterfaces();

	for (const name in interfaces) {
    const inter = interfaces[name];
    if (inter === undefined) {
      continue;
    }
		for (const interfaceInfo of inter) {
			if (interfaceInfo.family === 'IPv4' && !interfaceInfo.internal) {
				return interfaceInfo.address;
			}
		}
	}
}

function determineProjectType(builder: any): ProjectType {
  if (builder.useWebpack) {
    return 'webpack';
  } else if (fs.existsSync(path.join(builder.projectDir, 'app'))) {
    return 'alloy';
  } else {
    return 'classic';
  }
}
