import { AbstractTransformer, TransformerOptions } from "./base";
import TranspileTransform from './transforms/transpile';

export class ClassicSourceTransformer extends AbstractTransformer {
  constructor(options: TransformerOptions) {
    super(options);

    if (options.transpile.enabled) {
      this.transforms.set('.js', new TranspileTransform(options.transpile.targets!));
    }
  }
}
