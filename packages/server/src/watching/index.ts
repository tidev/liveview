import { TypedEmitter } from 'tiny-typed-emitter';
import { TransferInfo } from '../index';
import { TranspileOptions } from '../workspace';

export interface WatchingEvents {
  manifest: (changes: TransferInfo[], removals: string[]) => void
  sync: () => void
}

export interface Watching extends TypedEmitter<WatchingEvents> {
  close(): Promise<void>
}

export interface WatchingOptions {
  path: string
  transpile: TranspileOptions
  hmr: boolean
}

export * from './default';
export * from './alloy';
