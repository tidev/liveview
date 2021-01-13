import xmlParser from 'fast-xml-parser';
import { Transform } from './transform';

interface Translations {
  [key: string]: string
}

/**
 * Transform for the localization files under the project's `i18n` directory.
 */
export class I18nTransform implements Transform {
  async apply(file: string, content: string): Promise<string> {
    const translations: Translations = {};

    const result = xmlParser.parse(content, {
      ignoreAttributes: false
    });
    if (!result.resources) {
      return JSON.stringify(translations);
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

    return JSON.stringify(translations);
  }
}
