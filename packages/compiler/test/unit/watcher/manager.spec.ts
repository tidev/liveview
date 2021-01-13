import { TestHelper } from '@liveview/test-utils';

import { getWatcherManager } from '@/watcher/manager';

const helper = new TestHelper();

describe('getWatcherManager', () => {
  it('should return same watcher for same options', () => {
    const options = { aggregateTimeout: 100, ignored: ['**/node_modules/**'] };
    const m1 = getWatcherManager(options);
    const m2 = getWatcherManager(options);
    expect(m1).toBe(m2);
  });

  it("should create different watchers for different options", () => {
    const o1 = { aggregateTimeout: 100, ignored: ['**/node_modules/**'] };
    const o2 = { aggregateTimeout: 200, ignored: ['**/node_modules/**'] };
    const m1 = getWatcherManager(o1);
    const m2 = getWatcherManager(o2);
    expect(m1).not.toBe(m2);
  });
});

describe('WatcherManager', () => {
  describe('watch', () => {
    it('should create unique watcher instance for each call', () => {
      const options = { aggregateTimeout: 100, ignored: ['**/node_modules/**'] };
      const m = getWatcherManager(options);
      const w1 = m.watch(helper.tmpDir);
      const w2 = m.watch(helper.tmpDir);
      expect(w1).not.toBe(w2);
      w1.close();
      w2.close();
    });
  });
});
