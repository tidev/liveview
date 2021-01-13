import hash from 'hash-sum';

import { DirectoryWatcher, WatcherView } from "./directory";
import { WatchOptions, WatcherOptions } from "./watcher";

const managers = new Map<string, WatcherManager>();

/**
 * Manages directory watcher instances to make sure there is always only one
 * watcher per directory.
 */
export class WatcherManager {
  private directoryWatchers: Map<string, DirectoryWatcher> = new Map()

  constructor(private options: WatcherOptions) {}

  watch(directory: string, options: WatchOptions = {}): WatcherView {
    return this.getDirectoryWatcher(directory).watch(options);
  }

  private getDirectoryWatcher(directory: string): DirectoryWatcher {
    const watcher = this.directoryWatchers.get(directory);
    if (watcher !== undefined) {
      return watcher;
    }

    const newWatcher = new DirectoryWatcher(directory, this.options);
    this.directoryWatchers.set(directory, newWatcher);
    newWatcher.on('closed', () => {
      this.directoryWatchers.delete(directory);
    });
    return newWatcher;
  }
}

export function getWatcherManager(options: WatcherOptions): WatcherManager {
  const optionsHash = hash(options);
  const existingManager = managers.get(optionsHash);
  if (existingManager) {
    return existingManager;
  }
  const newManager = new WatcherManager(options);
  managers.set(optionsHash, newManager);
  return newManager;
}
