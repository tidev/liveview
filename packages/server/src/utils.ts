import io from 'socket.io';

export const workspacePattern = /\/workspace\/(.+)$/;

export function getWorkspaceName(nsp: io.Namespace): string | null {
  const match = nsp.name.match(workspacePattern);
  if (!match) {
    return null;
  }
  return match[1];
}
