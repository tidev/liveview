import fs from 'fs-extra';
import path from 'path';
import os from 'os';

import { WorkspaceWatcher } from '@liveview/server/watcher';

const tmpDir = path.join(os.tmpdir(), 'watcher.spec');

let watcher: WorkspaceWatcher;

afterEach(async () => {
  await watcher.close();
});

test('emit aggregated changes', async (done) => {
  await fs.emptyDir(tmpDir);
  await fs.writeFile(path.join(tmpDir, 'c.txt'), 'c');
  watcher = new WorkspaceWatcher(tmpDir, { aggregateTimeout: 500 });
  watcher.on('aggregated', async (changes, removals) => {
    expect(changes.size).toBe(2);
    expect(removals.size).toBe(1);
    done();
  });
  await fs.writeFile(path.join(tmpDir, 'a.txt'), 'a');
  await fs.writeFile(path.join(tmpDir, 'b.txt'), 'b');
  await fs.remove(path.join(tmpDir, 'c.txt'));
});
