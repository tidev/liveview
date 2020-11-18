import path from 'path';

import { ClassicSourceTransformer } from '@liveview/server/transformers/classic';

const workspacePath = path.resolve(__dirname, '..', '..', 'fixtures', 'workspace-a');

test('transform', () => {
  const transformer = new ClassicSourceTransformer({
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
  const files = transformer.transform(changes);
  expect(files).toHaveLength(1);
  expect(files[0].from).toBe(path.join('build', 'liveview', 'test.js'));
  expect(files[0].to).toBe('test.js');
});
