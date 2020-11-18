import { LiveViewServer } from '@liveview/server';

import WorkspaceService from './services/workspace';

interface PluginOptions {
  port?: number
}

interface AppcdConfig {
  liveview: PluginOptions
}

let server: LiveViewServer | null;

export function activate(config: AppcdConfig): void {
  server = new LiveViewServer({
    port: config.liveview.port,
    daemonized: true
  });
  server.start();

  appcd.register('/workspace', new WorkspaceService(server));
}

export async function deactivate(): Promise<void> {
  if (server !== null) {
    await server.stop();
    server = null;
  }
}
