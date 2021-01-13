import { TestHelper } from '@liveview/test-utils';
import path from 'path';

import { DirectoryWatcher } from "@/watcher/directory";
import { DEFAULT_IGNORES } from '@/watcher/watcher';

const helper = new TestHelper();
const openWatchers = new Set<DirectoryWatcher>();

const createWatcher = (path: string = helper.tmpDir): DirectoryWatcher => {
  const watcher = new DirectoryWatcher(path, { ignored: DEFAULT_IGNORES });
  openWatchers.add(watcher);
  watcher.on('closed', () => {
    openWatchers.delete(watcher);
  });
  return watcher;
};

describe('DirectoryWatcher', () => {
  afterEach(async () => {
    await helper.afterEach();
    await Promise.all(Array.from(openWatchers).map(d => {
      console.log("DirectoryWatcher (" + d.path + ") was not closed.");
      return d.close();
    }));
  });

  it('should detect file creation', async (done) => {
    const d = createWatcher();
    const w = d.watch();
    w.on('change', (file, type) => {
      expect(file).toBe(path.join(helper.tmpDir, 'a'));
      expect(type).toBe('add');
      w.close();
      done();
    });
    await helper.delay();
    helper.writeFile('a');
  });

  it('should detect file change', async (done) => {
    const d = createWatcher();
    helper.writeFile('a');
    await helper.delay();
    const w = d.watch();
    w.on('change', (file, type) => {
      expect(file).toBe(path.join(helper.tmpDir, 'a'));
      expect(type).toBe('change');
      w.close();
      done();
    });
    await helper.delay();
    helper.writeFile('a');
  });

  it("should not detect a file change in initial scan", async (done) => {
    helper.writeFile("a");
    await helper.delay();
    const d = createWatcher();
    const w = d.watch();
    w.on("change", () => {
      throw new Error("should not be detected");
    });
    await helper.delay(500);
    w.close();
    done();
  });

  it("should detect a file change in initial scan with start date", async (done) => {
    const startTime = Date.now();
    await helper.delay();
    helper.writeFile('a');
    await helper.delay();
    const d = createWatcher();
    const w = d.watch({ startTime });
    w.on("change", () => {
      w.close();
      done();
    });
  });

  it('should detect repeated file changes', async (done) => {
    const d = createWatcher();
    helper.writeFile('a');
    await helper.delay();
    const w = d.watch();
    let changes = 0;
    w.on('change', () => changes++);
    for (let i = 0; i < 10; i++) {
      helper.writeFile('a');
      await helper.delay(300);
    }
    expect(changes).toBeGreaterThanOrEqual(10);
    w.close();
    done();
  });

  it("should detect a file removal", async (done) => {
		helper.writeFile("a");
		const d = createWatcher();
		const w = d.watch();
		w.on("remove", () => {
			w.close();
			done();
		});
		await helper.delay();
		helper.remove("a");
	});
});
