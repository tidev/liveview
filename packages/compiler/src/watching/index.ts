import { Platform, ProjectType } from '@liveview/shared-utils';

export interface Watching {
  watch(): void
  close(): Promise<void>
}

export interface WatchOptions {
  /**
   * List of paths that should be watched.
   */
  directories: string[]

  /**
   * The target platform to watch for.
   */
  platform: Platform

  /**
   * The project type, used to determine the correct watching strategy.
   */
  type: ProjectType
}
