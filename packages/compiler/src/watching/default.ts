import { Platform } from '@liveview/shared-utils';

import { Watching, WatchOptions } from './index';
import { Compiler } from '../compiler';
import { Watcher } from '../watcher/watcher';

/**
 * Default watching behavior for classic and webpack projects.
 *
 * Watches for changes in  Resources` and `i18n` and compiles changed files.
 * Compilation of files happens according to the configured compiler rules.
 */
export class DefaultWatching implements Watching {
  protected platform: Platform

  protected watcher: Watcher | null = null

  protected startTime?: number

  protected running = false

  protected closed = false

  protected compiler: Compiler

  protected directories: string[] = []

  constructor(compiler: Compiler, options: WatchOptions) {
    const {
      directories,
      platform
    } = options;
    this.directories = directories;
    this.compiler = compiler;
    this.platform = platform;
  }

  public watch(): void {
    if (this.closed) {
      return;
    }

    const oldWatcher = this.watcher;

    this.watcher = new Watcher(this.directories);
    this.watcher.once('aggregated', (changes, removals) => this.doCompile(changes, removals));
    this.watcher.watch({ startTime: this.startTime });

    if (oldWatcher) {
      oldWatcher.close();
    }
  }

  public async close(): Promise<void> {
    this.closed = true;
    if (this.watcher) {
      await this.watcher.close();
    }
  }

  private async doCompile(changes: Set<string>, removals: Set<string>) {
    console.log('LIVEVIEW doCompile');
    this.running = true;

    this.compiler.modifiedFiles = changes;
    this.compiler.removedFiles = removals;

    // save start time so the watcher can detect changes made during the compile
    this.startTime = Date.now();
    this.watcher?.pause();
    try {
      await this.compiler.compile();
      await this.compiler.emitAssets();
      this.done();
    } catch (e) {
      this.done(e);
    }
  }

  protected done(error?: Error) {
    this.running = false;

    if (error) {
      // log error?
      // return; ?
    }

    process.nextTick(() => {
      if (!this.closed) {
        this.watch();
      }
    });

    /*
    const changes = new Set<string>();
    for (const [_, asset] of this.compiler.assets) {
      changes.add(asset.targetPath);
    }
    const removals = this.compiler.removedFiles;
    this.emit('done', {
      platform: this.platform,
      hash: hash({
        startTime: this.startTime,
        changes: Array.from(changes),
        removals: Array.from(removals)
      }),
      changes,
      removals
    });
    */
  }
}
