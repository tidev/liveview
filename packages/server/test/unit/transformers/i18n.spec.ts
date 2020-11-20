import path from 'path';

import { I18nTransformer } from '@liveview/server/transformers/i18n';

const workspacePath = path.resolve(__dirname, '..', '..', 'fixtures', 'classic');

test('i18n transform', async (done) => {
  const transformer = new I18nTransformer({
    workspacePath,
    basePath: path.join(workspacePath, 'Resources')
  });
  const changes = [];
  changes.push(path.join(workspacePath, 'i18n', 'en', 'strings.xml'));
  const files = await transformer.transform(changes);
  expect(files).toHaveLength(1);
  expect(files[0].from).toBe(path.join('build', 'liveview', 'assets', '__i18n__.json'));
  expect(files[0].to).toBe('__i18n__.json');
  done();
});
