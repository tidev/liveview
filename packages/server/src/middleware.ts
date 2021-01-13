import Router from '@koa/router';
import { Compiler } from '@liveview/compiler';
import { Platform } from '@liveview/shared-utils';
import send from 'koa-send';

import { Workspace } from './workspace';

interface WorkspaceContext {
  workspace: Workspace
  platform: Platform
  compiler: Compiler
}

export default function workspaceMiddleware(workspaces: Map<string, Workspace>) {
  const router = new Router<any, WorkspaceContext>({
    prefix: '/workspace/:name'
  });

  router
    .param('name', (name, ctx, next) => {
      const workspace = workspaces.get(name);
      if (!workspace) {
        return ctx.status = 404;
      }
      (ctx as any).workspace = workspace;
      return next();
    })
    .param('platform', (platform: string, ctx, next) => {
      const compiler = (ctx as any).workspace.compilers.get(platform as Platform);
      if (compiler === undefined) {
        return ctx.status = 404;
      }
      (ctx as any).compiler = compiler;
      (ctx as any).platform = platform;
      return next();
    })
    .get('/serve/:platform/:file*', async (ctx) => {
      await send(ctx, ctx.params.file, { root: ctx.compiler.outputPath });
    });

  return router.routes();
}
