import { Platform, ProjectType, TranspileTargets } from '@liveview/shared-utils';
import { createCompiler, Compiler, WatchOptions } from '@liveview/compiler';
import slugify from '@sindresorhus/slugify';
import { EventEmitter} from 'events';
import isEqual from 'lodash.isequal';
import path from 'path';

import Client from './client';

export interface TranspileOptions {
  enabled: boolean
  targets?: TranspileTargets
}

export interface WorkspaceOptions {
  name: string
  path: string
  type: ProjectType
  transpile: boolean
}

export interface LiveViewOptions {
  platform: Platform
  outputPath: string,
  transpileTargets?: TranspileTargets
}

export interface UpdateManifest {
  platform: Platform
  changes: string[],
  removals: string[]
}

/**
 * A workspace represents a Titanium project inside the LiveView server.
 */
export class Workspace extends EventEmitter {
  /**
   * Worksapce name.
   */
  public readonly name: string

  /**
   * Slugified workspace name.
   */
  public readonly slug: string

  /**
   * Full path to this workspace.
   */
  public readonly path: string

  /**
   * The project type, can be either `classic`, `alloy` or `webpack`.
   */
  public readonly type: ProjectType

  /**
   *
   */
  public readonly transpile: boolean

  /**
   * List of clients currently connected to this workspace.
   */
  public readonly clients: Set<Client> = new Set()

  /**
   * The options used to create this workspace.
   */
  private options: WorkspaceOptions

  private compilers: Map<Platform, Compiler> = new Map()

  constructor(options: WorkspaceOptions) {
    super();

    this.name = options.name;
    this.slug = slugify(this.name);
    this.path = options.path;
    this.type = options.type;
    this.transpile = options.transpile;
    this.options = options;
  }

  async close(): Promise<void> {
    await Promise.all(Array.from(this.compilers.values()).map(c => c.close()));
  }

  public addClient(client: Client): void {
    this.clients.add(client);
  }

  public removeClient(client: Client): void {
    this.clients.delete(client);
  }

  public didOptionsChange(options: WorkspaceOptions): boolean {
    return !isEqual(this.options, options);
  }

  public startLiveView(options: LiveViewOptions): void {
    const compiler = createCompiler({
      projectPath: this.path,
      ...options
    });
    const watchOptions: WatchOptions = {
      directories: [
        path.join(this.path, 'i18n'),
        path.join(this.path, 'Resources')
      ],
      platform: options.platform,
      type: this.type
    };
    compiler.watch(watchOptions);
    compiler.on('afterEmit', (assets) => {
      console.log('afterEmit');
      const changes = [];
      for (const [_, asset] of assets) {
        changes.push(asset.targetPath);
      }
      const removals = Array.from(compiler.removedFiles).map(
        r => path.relative(path.join(this.path, 'Resources'), r)
      );
      this.sendUpdateManifest({
        platform: compiler.platform,
        changes: Array.from(changes),
        removals
      });
    });
    this.compilers.set(options.platform, compiler);
  }

  public sendUpdateManifest(manifest: UpdateManifest): void {
    this.clients.forEach(c => c.sendUpdateManifest(manifest));
  }

  /*
  public startBuild(options: BuildOptions) {
    const build = new Build(this, options);
    build.watch();
    build.on('done', (record: BuildRecord) => this.onNewBuild(record))
    this.builds.set(options.platform, build);
  }

  public addBuildRecord(record: BuildRecord) {
    const platform = record.platform;
    let records = this.records.get(platform);
    if (records === undefined) {
      records = [];
      this.records.set(platform, records);
    }
    records.push(record);
  }

  public onNewBuild(record: BuildRecord): void {
    this.addBuildRecord(record);
    this.clients.forEach(c => c.onNewBuild(record));
  }

  public generateUpdateManifest(platform: Platform, hash?: string): UpdateManifest {
    const changes = new Set<string>();
    const removals = new Set<string>();

    const noUpdate = {
      changes: [],
      removals: []
    };

    const records = this.records.get(platform);
    if (records === undefined) {
      return noUpdate;
    }

    if (records.length === 0) {
      return noUpdate
    }

    let startIndex = 0;
    if (hash) {
      startIndex = records.findIndex(r => r.hash === hash) + 1;
    }
    if (startIndex === records.length) {
      // already at latest changes, no update necessary
      return noUpdate
    }

    for (let i = startIndex; i < records.length; i++) {
      const record = records[i];
      for (const change of record.changes) {
        removals.delete(change);
        changes.add(change);
      }
      for (const removed of record.removals) {
        removals.add(removed);
        changes.delete(removed);
      }
    }

    const latestHash = records[records.length - 1].hash;
    return {
      hash: latestHash,
      changes: Array.from(changes),
      removals: Array.from(removals)
    };
  }
  */
}
