import fs from 'fs-extra';
import path from 'path';
import os from 'os';

import { Watcher } from '@liveview/server/watcher';

const tmpDir = path.join(os.tmpdir(), 'watcher.spec');

let watcher: Watcher;

beforeAll(async () => {
  await fs.emptyDir(tmpDir);
});

afterAll(async () => {
  await fs.remove(tmpDir);
});

afterEach(async () => {
  await watcher.close();
  await fs.emptyDir(tmpDir);
});

test('emit aggregated changes', async (done) => {
  await fs.writeFile(path.join(tmpDir, 'c.txt'), 'c');
  watcher = new Watcher(tmpDir, { aggregateTimeout: 500 });
  watcher.on('aggregated', async (changes, removals) => {
    expect(changes.size).toBe(2);
    expect(removals.size).toBe(1);
    done();
  });
  watcher.on('ready', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'a');
    fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'b');
    fs.removeSync(path.join(tmpDir, 'c.txt'));
  });
});
