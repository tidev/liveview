import chokidar, { FSWatcher } from "chokidar";
import { Stats } from "fs-extra";
import { TypedEmitter } from "tiny-typed-emitter";

import { ChangeType } from './index';
import { DirectoryWatcherOptions, WatchOptions } from "./watcher";

interface ClosedEvent {
  closed: () => void;
}

interface WatcherEvents extends ClosedEvent {
  change: (file: string, type: ChangeType) => void
  remove: (file: string) => void
}

/**
 * A filtered view into the directory watcher.
 */
export class WatcherView extends TypedEmitter<WatcherEvents> {
  constructor(
    private directoryWatcher: DirectoryWatcher,
    private startTime?: number
  ) {
    super();
  }

  /**
   *
   * @param mtime
   * @param isInitialScan
   */
  checkStartTime(mtime: number, isInitialScan: boolean): boolean {
    if (this.startTime === undefined) {
      return !isInitialScan;
    }
    return this.startTime <= mtime;
  }

  /**
   * Close this watcher by removing it from its associated directory watcher.
   */
  close(): void {
    this.directoryWatcher.removeWatcher(this);
  }
}

/**
 * The internal directory watcher.
 *
 * This class holds the chokidar watcher and all logic around the actual file
 * watching. There is only one instance of this for each watched directory.
 */
export class DirectoryWatcher extends TypedEmitter<ClosedEvent> {
  public readonly path: string

  private isInitialScan = true

  private startTime: number | undefined = undefined

  /**
   * Chokidar watcher instance
   */
  private watcher: FSWatcher

  private watchers: Set<WatcherView> = new Set()

  private retainCount = 0

  private fileTimes: Map<string, number> = new Map()

  constructor(path: string, options: DirectoryWatcherOptions) {
    super();

    this.path = path;
    this.watcher = chokidar.watch(path, {
      ignored: options.ignored,
      alwaysStat: true
    });
    this.watcher.on('ready', () => {
      this.isInitialScan = false;
    });
    this.watcher.on('add', (file, stats) => this.onChangeEvent(file, 'add', stats!));
    this.watcher.on('change', (file, stats) => this.onChangeEvent(file, 'change', stats!));
    this.watcher.on('unlink', file => this.onRemoveEvent(file));
  }

  /**
   * Creates a new watcher instance that uses this directory watcher as its
   * event source and returns it.
   *
   * If all `Watcher` instances created by this method called their `close()`
   * method, this directory watcher will be closed as well.
   *
   * @param startTime
   */
  public watch({ startTime }: WatchOptions = {}): WatcherView {
    const watcher = new WatcherView(this, startTime);
    this.addWatcher(watcher);
    return watcher;
  }

  private addWatcher(watcher: WatcherView): void {
    this.retainCount++;
    this.watchers.add(watcher);
  }

  /**
   * Removes a watcher from this directory watcher.
   *
   * If no more watchers are associated with this directory watcher, it will
   * automatically close itself as well.
   *
   * @param watcher The wathcer to remove
   */
  public removeWatcher(watcher: WatcherView): void {
    if (--this.retainCount <= 0) {
      this.close();
    }
    this.watchers.delete(watcher);
  }

  public onChangeEvent(file: string, type: ChangeType, stats: Stats): void {
    const mtime = stats.mtime.getTime();
    const oldFileTime = this.fileTimes.get(file);

    this.fileTimes.set(file, mtime);

    if (oldFileTime === undefined) {
      for (const watcher of this.watchers) {
        if (watcher.checkStartTime(mtime, this.isInitialScan))  {
          watcher.emit('change', file, type);
        }
      }
    } else if (!this.isInitialScan) {
      for (const watcher of this.watchers) {
        watcher.emit('change', file, type);
      }
    }
  }

  public onRemoveEvent(file: string): void {
    this.fileTimes.delete(file);
    this.watchers.forEach(w => w.emit('remove', file));
  }

  public async close(): Promise<void> {
    await this.watcher.close();
    this.emit('closed');
  }
}
