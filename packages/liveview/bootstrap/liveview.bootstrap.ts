import Client from '@liveview/client';

declare const __PORT__: number;

const host = '__HOST__';
const port = __PORT__;

const client = new Client({
  host,
  port,
  workspace: '__WORKSPACE__'
});

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const i18n = require('__i18n__.json');
  global.L = (key: string, hint?: string): string => {
    const lang = i18n[Ti.Locale.currentLanguage];
    if (!lang) {
      return hint || key;
    }
    return lang[key] || hint || key;
  };
} catch (e) {
  // No synced i18n data, do nothing
}
