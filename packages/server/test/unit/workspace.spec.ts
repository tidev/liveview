import fs from 'fs-extra';
import path from 'path';

import { TransferInfo, Workspace, WorkspaceOptions } from '@liveview/server';
import Client from '@liveview/server/client';

jest.mock('@liveview/server/client');
const MockClient = <jest.Mock<Client>>Client;

describe('classic project', () => {
  const projectPath = path.resolve(__dirname, '..', 'fixtures', 'classic');

  afterAll(async () => {
    await fs.remove(path.join(projectPath, 'Resources', 'a.js'));
  });

  test('emit manifest for asset changes', async (done) => {
    const options: WorkspaceOptions = {
      name: 'test',
      path: projectPath,
      type: 'classic',
      transpile: {
        enabled: false
      },
      hmr: false
    };
    const workspace = new Workspace(options);
    const sendManifest = jest.fn((changes: TransferInfo[], removals: Set<string>) => {
      expect(changes).toHaveLength(1);
      expect(removals).toHaveLength(0);
      workspace.close();
      done();
    });
    // @ts-ignore: Required to mock client implementation
    MockClient.mockImplementation(() => {
      return {
        sendManifest
      };
    });
    const client = new MockClient();
    workspace.addClient(client);
    // give the workspace watching a moment to intiialize
    setTimeout(() => {
      fs.writeFileSync(path.join(projectPath, 'Resources', 'a.js'), 'const a = 1;');
    }, 50);
  });
});
