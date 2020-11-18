import { WorkspaceType } from '../workspace';
import {
  NoopTransformer,
  SourceTransformer,
  TransformerOptions
} from './base';
import { ClassicSourceTransformer } from './classic';

export { SourceTransformer } from './base';

const ctorMap = {
  'classic': ClassicSourceTransformer,
  'alloy': NoopTransformer,
  'webpack': NoopTransformer
};

export function createTransformer(type: WorkspaceType, options: TransformerOptions): SourceTransformer {
  const Transformer = ctorMap[type];
  return new Transformer(options);
}
