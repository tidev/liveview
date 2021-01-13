import io, { Socket } from 'titanium-socket.io';

import http from './http';

interface ServerAddress {
  host: string
  port: number
}

interface ClientOptions extends ServerAddress {
  workspace: string
  hmr: boolean
}

interface UpdateManifest {
  platform: 'ios' | 'android'
  changes: string[]
  removals: string[]
}

const log = (...args: any) => console.debug('[LiveView]', ...args);

export default class Client {
  private baseDir: string

  private socket: typeof Socket

  private isReconnecting = false

  private workspaceBaseUrl: string

  private platformBaseUrl: string

  private hmr: boolean

  private currentManifest?: UpdateManifest;

  constructor(options: ClientOptions) {
    const { host, port, workspace, hmr } = options;
    this.hmr = hmr;
    const platform = Ti.Platform.name.toLowerCase();
    this.baseDir = platform === 'android'
      ? Ti.Filesystem.applicationDataDirectory
      : Ti.Filesystem.applicationSupportDirectory;
    this.baseDir = `${this.baseDir}/liveview`;

    this.workspaceBaseUrl = `http://${host}:${port}/workspace/${workspace}`;
    this.platformBaseUrl = `${this.workspaceBaseUrl}/${platform}`;

    this.socket = io(this.workspaceBaseUrl);

    // Socket connection lifecycle
    this.socket.on('connect', () => this.sendIdent());
    this.socket.on('error', (e: Error) => console.log(`LiveView client error: ${e.stack}`));
    this.socket.on('reconnecting', () => this.isReconnecting = true);
    this.socket.on('reconnect', () => this.isReconnecting = false);
    this.socket.on('connect_error', (e: Error) => {
      if (this.isReconnecting) {
        return;
      }

      log('Failed to connect.');
    });

    this.socket.on('manifest', (manifest: UpdateManifest) => {
      this.currentManifest = manifest;

      if (!this.hmr) {
        // only try immediate app sync if hot module reloading is disabled
        this.syncApp();
      }
    });
  }

  public send(event: string, ...args: any[]): void {
    this.socket.emit(event, ...args);
  }

  private sendIdent(): void {
    log('Client connected');
    this.send('ident', {
      identifier: Ti.Platform.id,
      name: Ti.Platform.username,
      platform: Ti.Platform.name.toLowerCase()
    });
  }

  public async syncApp(): Promise<void> {
    if (!this.currentManifest) {
      // todo: download complete liveview.zip, extract and restart app
      return;
    }

    try {
      log(this.currentManifest);
      await this.processUpdateManifest(this.currentManifest);
      this.restartApp();
    } catch (e) {
      console.log(e);
      log(`App sync failed:`, e.stack);
      log('');
      log('Try again or re-build the app to see all changes.');
    }
  }

  private async processUpdateManifest(manifest: UpdateManifest): Promise<void> {
    log('Updating app ...');
    const { changes, removals } = manifest;

    for (const file of changes) {
      // @todo limit concurrent downloads
      await this.updateFile(file);
    }

    for (const removal of removals) {
      const targetFile = Ti.Filesystem.getFile(this.baseDir, removal);
      if (targetFile.exists()) {
        targetFile.deleteFile();
      }
    }
  }

  private async updateFile(file: string): Promise<void> {
    const targetFile = Ti.Filesystem.getFile(this.baseDir, file);
    const response = await http.get(`${this.platformBaseUrl}/serve/${file}`, { responseType: 'blob' });
    targetFile.write(response.data);
  }

  private restartApp() {
    this.socket.close();
    (Ti.App as any)._restart();
  }
}
