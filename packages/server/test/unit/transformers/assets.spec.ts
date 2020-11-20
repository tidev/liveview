import path from 'path';

import { AssetsTransformer } from '@liveview/server/transformers/assets';

const workspacePath = path.resolve(__dirname, '..', '..', 'fixtures', 'classic');

test('asset transform', async (done) => {
  const transformer = new AssetsTransformer({
    workspacePath,
    basePath: path.join(workspacePath, 'Resources'),
    transpile: {
      enabled: true,
      targets: {
        ios: '10'
      }
    }
  });
  const changes = [];
  changes.push(path.join(workspacePath, 'Resources', 'test.js'));
  const files = await transformer.transform(changes);
  expect(files).toHaveLength(1);
  expect(files[0].from).toBe(path.join('build', 'liveview', 'assets', 'test.js'));
  expect(files[0].to).toBe('test.js');
  done();
});
