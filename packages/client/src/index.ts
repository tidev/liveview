import io, { Socket } from 'titanium-socket.io';

interface ServerAddress {
  host: string,
  port: number
}

interface ClientOptions extends ServerAddress {
  workspace: string
}

interface TransferInfo {
  from: string
  to: string
}

interface UpdateManifest {
  changes: TransferInfo[],
  removals: string[]
}

export default class Client {
  private baseDir: string;

  private socket: typeof Socket;

  private isReconnecting = false;

  private assetServeEndpoint: string;

  constructor(options: ClientOptions) {
    const { host, port, workspace } = options;
    this.baseDir = Ti.Platform.osname === 'android'
      ? Ti.Filesystem.applicationDataDirectory
      : Ti.Filesystem.applicationSupportDirectory;
    this.assetServeEndpoint = `http://${host}:${port}/workspace/${workspace}/serve`;

    this.socket = io(`http://${host}:${port}/workspace/${workspace}`);

    // Connection lifecycle
    this.socket.on('connect', () => this.sendIdent());
    this.socket.on('error', (e: Error) => console.log(`LiveView client error: ${e.stack}`));
    this.socket.on('reconnecting', () => this.isReconnecting = true);
    this.socket.on('reconnect', () => this.isReconnecting = false);
    this.socket.on('connect_error', (e: Error) => {
      if (this.isReconnecting) {
        return;
      }

      console.log('LiveView failed to connect.');
    });

    // Update manifest
    this.socket.on(
      'manifest',
      async (data: UpdateManifest) => {
        try {
          this.processUpdateManifest(data);
        } catch (e) {
          console.log(`LiveView update failed: ${e}`);
          console.log('');
          console.log('Try again or re-build the app to see all changes.');
        }
      }
    );
  }

  public send(event: string, ...args: any[]): void {
    this.socket.emit(event, ...args);
  }

  private sendIdent(): void {
    console.log('LiveView client connected');
    this.send('ident', {
      identifier: Ti.Platform.id,
      name: Ti.Platform.username
    });
  }

  private async processUpdateManifest(manifest: UpdateManifest): Promise<void> {
    console.log('LiveView received update manifest, loading updated files ...');
    const { changes, removals } = manifest;

    for (const { from, to } of changes) {
      // @todo limit concurrent downloads
      await this.downloadFile(from, to);
    }

    for (const removal of removals) {
      console.log(`Delete ${removal}`);
      const targetFile = Ti.Filesystem.getFile(this.baseDir, removal);
      if (targetFile.exists()) {
        targetFile.deleteFile();
      }
    }

    this.socket.close();
    (Ti.App as any)._restart();
  }

  private async downloadFile(from: string, to: string): Promise<void> {
    console.log(`Download ${from} => ${to}`);

    const targetFile = Ti.Filesystem.getFile(this.baseDir, 'liveview', to);
    return new Promise((resolve, reject) => {
      const client = Ti.Network.createHTTPClient();
      client.open('POST', this.assetServeEndpoint);
      client.setRequestHeader('Content-Type', 'application/json');
      client.onerror = (e: any) => {
        reject(e);
      };
      client.onload = () => {
        targetFile.write(client.responseData);
        resolve();
      };
      client.send(JSON.stringify({
        file: from
      }));
    });
  }
}
