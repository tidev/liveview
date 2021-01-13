import { Platform } from "@liveview/shared-utils";
import path from 'path';

import { Workspace, WorkspaceOptions } from '@liveview/server';
import Client from '../../src/client';

jest.mock('../../src/client');
const ClientMock = Client as jest.MockedClass<typeof Client>;
const platform: Platform = 'ios';
const socket: any = {};
const device: any = {
  platform
};

const projectPath = path.resolve(__dirname, '..', 'fixtures', 'classic');
const options: WorkspaceOptions = {
  name: 'test',
  path: projectPath,
  type: 'classic',
  transpile: false
};
let workspace: Workspace;

describe('Workspace', () => {
  beforeEach(() => {
    workspace = new Workspace(options);
    ClientMock.mockClear();
  });

  afterEach(async (done) => {
    await workspace.close();
    (workspace as any) = null;
    done();
  });

  describe('addClient', () => {
    it('should add client to list', () => {
      const client = new ClientMock(socket, device);
      expect(workspace.clients.has(client)).toBe(false);
      workspace.addClient(client);
      expect(workspace.clients.has(client)).toBe(true);
    });
  });

  describe('removeClient', () => {
    it('should remove client from list', () => {
      const client = new ClientMock(socket, device);
      workspace.addClient(client);
      expect(workspace.clients.has(client)).toBe(true);
      workspace.removeClient(client);
      expect(workspace.clients.has(client)).toBe(false);
    });
  });

  describe('didOptionsChange', () => {
    it('should deep compare options', () => {
      expect(workspace.didOptionsChange(options)).toBe(false);
      const result = workspace.didOptionsChange({
        name: 'test',
        path: projectPath,
        type: 'classic',
        transpile: true
      });
      expect(result).toBe(true);
    });
  });

  describe('sendUpdateManifest', () => {
    it('should record build result and notify clients', () => {
      const client = new ClientMock(socket, device);
      workspace.addClient(client);
      const changes = ['app.js'];
      const removals: string[] = [];
      const manifest = {
        platform,
        changes,
        removals
      };
      workspace.sendUpdateManifest(manifest);
      expect(ClientMock.prototype.sendUpdateManifest).toHaveBeenCalledWith(manifest);
      ClientMock.prototype.sendUpdateManifest.mockClear();
    });
  });
});
