import { TestHelper } from '@liveview/test-utils';
import path from 'path';

import { Watcher } from '@/watcher';

const helper = new TestHelper();
let watcher: Watcher;

afterEach(async () => {
  await watcher.close();
  await helper.afterEach();
});

describe('Watcher', () => {
  it('should watch a directory', async (done) => {
    helper.writeFile('c');
    await helper.delay();
    let changeEvents = 0;
    let removeEvents = 0;
    watcher = new Watcher([helper.tmpDir], { aggregateTimeout: 500 });
    watcher.on('change', () => changeEvents++);
    watcher.on('remove', () => removeEvents++);
    watcher.on('aggregated', (changes, removals) => {
      expect(Array.from(changes)).toEqual([
        path.join(helper.tmpDir, 'a'),
        path.join(helper.tmpDir, 'b')
      ]);
      expect(Array.from(removals)).toEqual([
        path.join(helper.tmpDir, 'c')
      ]);
      expect(changeEvents).toBeGreaterThan(0);
      expect(removeEvents).toBeGreaterThan(0);
      done();
    });
    watcher.watch();
    await helper.delay();
    helper.writeFile('a');
    helper.writeFile('b');
    helper.remove('c');
  });

  it('should not watch an ignored file in a directory', async (done) => {
    watcher = new Watcher([helper.tmpDir], { ignored: ['**/a'] });
    let changeEvents = 0;
    let aggregatedEvents = 0;
    watcher.on('change', () => changeEvents++);
    watcher.on('aggregated', () => aggregatedEvents++);
    watcher.watch();
    await helper.delay();
    helper.writeFile('a');
    await helper.delay(500);
    expect(changeEvents).toBe(0);
    expect(aggregatedEvents).toBe(0);
    done();
  });
});
