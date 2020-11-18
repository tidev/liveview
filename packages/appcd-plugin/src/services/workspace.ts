import Dispatcher, { DispatcherContext } from 'appcd-dispatcher';
import { codes, Response } from 'appcd-response';
import path from 'path';
import fs from 'fs';

import { LiveViewServer, WorkspaceOptions } from '@liveview/server';

export default class WorkspaceService extends Dispatcher {
  constructor(private server: LiveViewServer) {
    super();

    this.register('/', ctx => this.addOrUpdateWorksapce(ctx));
    this.register('/list', ctx => this.listWorkspaces(ctx));
    this.register('/:name/serve', ctx => this.serveFile(ctx));
  }

  addOrUpdateWorksapce(ctx: DispatcherContext): void {
    const { data }: { data: WorkspaceOptions } = ctx.request;
    this.server.addWorkspace(data);

    ctx.response = new Response(codes.OK);
  }

  listWorkspaces(ctx: DispatcherContext): void {
    const data: any[] = [];
    this.server.workspaces.forEach(w => {
      data.push({
        name: w.name,
        client: Array.from(w.clients).map(c => ({
          name: c.device.name,
          identifier: c.device.identifier
        }))
      });
    });
    ctx.response = data;
  }

  serveFile(ctx: DispatcherContext): void {
    const { data: { file }, params: { name } } = ctx.request;
    const workspace = this.server.workspaces.get(name);
    if (!workspace) {
      console.log('workspace not found');
      ctx.response = new Response(codes.NOT_FOUND);
      return;
    }

    const sourceFile = path.resolve(workspace.path, file);
    ctx.response = fs.readFileSync(sourceFile).toString('base64');
  }
}
