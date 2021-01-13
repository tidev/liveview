import { TypedEmitter } from 'tiny-typed-emitter';

import { WatcherView } from './directory';
import { ChangeType } from './index';
import { getWatcherManager, WatcherManager } from './manager';

export const DEFAULT_IGNORES = [
  '**/.git',
  '.DS_Store'
];

export interface DirectoryWatcherOptions {
  /**
   * Array of file/path globs to ignore
   */
  ignored: string[]
}

export interface WatcherOptions extends DirectoryWatcherOptions {
  /**
   * Timeout to fire the `aggregated` event when after a change no additional
   * change occoured. Defaults to 200ms.
   */
  aggregateTimeout: number
}

export interface WatchOptions {
  startTime?: number
}

interface WatcherEvents {
  aggregated(changes: Set<string>, removals: Set<string>): void
  change(file: string, type: ChangeType): void
  remove(file: string): void
}

/**
 * A watcher based on chokidar that aggregates fs events.
 *
 * This file watcher implementation is heavily inspired by Watchpack.
 *
 * @see https://github.com/webpack/watchpack
 */
export class Watcher extends TypedEmitter<WatcherEvents> {
  public aggregatedRemovals: Set<string>
  public aggregatedChanges: Set<string>

  private directories: string[]
  private aggregateTimer?: number
  private aggregateTimeout: number
  private paused = false
  private watcherManager: WatcherManager
  private watchers: WatcherView[] = []

  constructor(directories: string[], options: Partial<WatcherOptions> = {}) {
    super();

    const {
      aggregateTimeout = 200,
      ignored = DEFAULT_IGNORES
    } = options;
    this.directories = directories;
    this.aggregateTimeout = aggregateTimeout;
    this.aggregatedChanges = new Set();
    this.aggregatedRemovals = new Set();
    this.watcherManager = getWatcherManager({ aggregateTimeout, ignored });
  }

  public watch(options: WatchOptions = {}): void {
    const setupWatcher = (watcher: WatcherView) => {
      watcher.on('change', (path, type) => this.onChange(path, type));
      watcher.on('remove', path => this.onRemove(path));
    };

    for (const path of this.directories) {
      const watcher = this.watcherManager.watch(path, options);
      setupWatcher(watcher);
      this.watchers.push(watcher);
    }
  }

  /**
   * Closes the internal chokidar watcher and removes all listeners.
   */
  public async close(): Promise<void> {
    if (this.aggregateTimer) {
      clearTimeout(this.aggregateTimer);
    }
    this.aggregatedChanges.clear();
    this.aggregatedRemovals.clear();
    this.removeAllListeners();
    await Promise.all(this.watchers.map(w => w.close()));
  }

  /**
   * Pause emitting events and stop recording changes to the aggergates sets.
   */
  public pause(): void {
    this.paused = true;
    if (this.aggregateTimer) {
      clearTimeout(this.aggregateTimer);
    }
  }

  private onChange(file: string, type: ChangeType) {
    if (this.paused) {
      return;
    }

    this.emit("change", file, type);

    if (this.aggregateTimer) {
      clearTimeout(this.aggregateTimer);
    }
    this.aggregatedRemovals.delete(file);
    this.aggregatedChanges.add(file);
    this.aggregateTimer = setTimeout(() => this.onTimeout(), this.aggregateTimeout);
	}

	private onRemove(file: string) {
    if (this.paused) {
      return;
    }

    this.emit("remove", file);

    if (this.aggregateTimer) {
      clearTimeout(this.aggregateTimer);
    }
    this.aggregatedChanges.delete(file);
    this.aggregatedRemovals.add(file);
    this.aggregateTimer = setTimeout(() => this.onTimeout(), this.aggregateTimeout);
  }

  private onTimeout() {
    this.aggregateTimer = undefined;
    const changes = this.aggregatedChanges;
    const removals = this.aggregatedRemovals;
    this.aggregatedChanges = new Set();
    this.aggregatedRemovals = new Set();
    this.emit('aggregated', changes, removals);
  }
}
