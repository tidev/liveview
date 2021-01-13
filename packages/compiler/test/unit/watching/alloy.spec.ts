import { TestHelper } from '@liveview/test-utils';
import { exec } from 'child_process';
import path from 'path';

import { createCompiler } from '@/index';
import { AlloyWatching } from "@/watching/alloy";

jest.mock('child_process');

const helper = new TestHelper();
let watching: AlloyWatching;

describe('AlloyWatching', () => {
  beforeEach(async (done) => {
    await helper.copyFromTemplate('alloy');
    const compiler = createCompiler({
      projectPath: helper.tmpDir,
      outputPath: path.join(helper.tmpDir, 'build'),
      platform: 'ios'
    });
    watching = new AlloyWatching(compiler, {
      directories: [],
      platform: 'ios',
      type: 'alloy'
    });
    watching.watch();
    await helper.delay();
    done();
  });

  afterEach(async (done) => {
    await watching.close();
    (watching as any) = null;
    await helper.afterEach();
    jest.restoreAllMocks();
    done();
  });

  it('should run selective compile for components', async done => {
    const relativeViewPath = path.join('app', 'views', 'index.xml');
    (exec as unknown as jest.Mock).mockImplementation((cmd, cb) => {
      process.nextTick(cb);
      try {
        expect(cmd).toEqual(expect.stringContaining(`file=${relativeViewPath}`));
        done();
      } catch (e) {
        done.fail(e);
      }
    });
    helper.writeFile(relativeViewPath);
  });
});
