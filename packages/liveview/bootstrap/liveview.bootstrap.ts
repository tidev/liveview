import Client from '@liveview/client';

declare const __PORT__: number;

const host = '__HOST__';
const port = __PORT__;

const client = new Client({
  host,
  port,
  workspace: '__WORKSPACE__'
});
