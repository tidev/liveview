import { getTemplatePath } from '@liveview/test-utils';
import fs from 'fs-extra';
import path from 'path';

import { TranspileTransform } from '@/transforms/transpile';

test('transpile javascript code', async () => {
  const transpile = new TranspileTransform({
    targets: {
      ios: '10'
    }
  });
  const file = path.join(getTemplatePath('classic'), 'Resources', 'test.js');
  const content = await fs.readFile(file, 'utf-8');
  const transpileContent = await transpile.apply(file, content);
  expect(transpileContent).toMatchSnapshot();
});
