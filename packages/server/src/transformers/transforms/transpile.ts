import path from 'path';
import jsanalyze from 'node-titanium-sdk/lib/jsanalyze';

import { AssetTransform } from '../base';

interface TranspileTargets {
  [key: string]: string
}

export default class TranspileTransform implements AssetTransform {
  constructor(private targets: TranspileTargets) {

  }

  apply(file: string): string {
    const filename = path.basename(file);
    const transpiled = jsanalyze.analyzeJsFile(file, {
      filename: filename,
      minify: false,
      transpile: true,
      targets: this.targets,
      sourceMap: false
    });
    return transpiled.contents;
  }
}
