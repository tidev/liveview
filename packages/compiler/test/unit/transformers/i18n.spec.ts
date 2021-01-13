import { getTemplatePath } from '@liveview/test-utils';
import fs from 'fs-extra';
import path from 'path';

import { I18nTransform } from '@/transforms/i18n';


test('turn xml files into json', async () => {
  const i18n = new I18nTransform();
  const file = path.join(getTemplatePath('classic'), 'i18n', 'en', 'strings.xml');
  const content = await fs.readFile(file, 'utf-8');
  const transformed = await i18n.apply(file, content);
  expect(transformed).toMatchSnapshot();
});
