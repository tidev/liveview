import xmlParser from 'fast-xml-parser';
import fs from 'fs-extra';
import path from 'path';

import { TransferInfo } from "../index";
import { AbstractTransformer, TransformerOptions } from "./base";

interface Translations {
  [key: string]: string
}

interface I18nDict {
  [key: string]: Translations
}

const localePattern = /i18n[\\/](.+)[\\/]strings\.xml$/;

/**
 * Transformer for the localization files under the project's `i18n` directory.
 */
export class I18nTransformer extends AbstractTransformer {
  private lang: I18nDict = {}

  constructor(options: TransformerOptions) {
    super(options);
  }

  async transform(changes: string[], removals?: string[]): Promise<TransferInfo[]> {
    const files: TransferInfo[] = [];
    if (removals) {
      for (const file of removals) {
        const langCode = this.getLanguageCode(file);
        if (langCode) {
          delete this.lang[langCode];
        }
      }
    }

    for (const file of changes) {
      const translations: Translations = {};
      const langCode = this.getLanguageCode(file);
      if (langCode) {
        const content  = await fs.readFile(file, 'utf-8');
        const result = xmlParser.parse(content, {
          ignoreAttributes: false
        });
        if (!result.resources) {
          continue;
        }
        let stringNodes = result.resources.string || [];
        if (!Array.isArray(stringNodes)) {
          stringNodes = [stringNodes];
        }
        for (const node of stringNodes) {
          const key = node['@_name'];
          const value = node['#text'];
          translations[key] = value;
        }
        this.lang[langCode] = translations;
      }
    }

    const outputFile = path.join(this.intermediateBuildDir, '__i18n__.json');
    await fs.writeJson(outputFile, this.lang);

    files.push({
      from: path.relative(this.workspacePath, outputFile),
      to: '__i18n__.json'
    });

    return files;
  }

  private getLanguageCode(file: string): string | null {
    const match = file.match(localePattern);
    if (!match) {
      return null;
    }

    return match[1];
  }
}
