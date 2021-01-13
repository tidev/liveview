declare module "appcd-client" {
  import EventEmitter from 'events';

  export type RequestTypes = 'subscribe' | 'unsubscribe'

  export interface RequestOptions {
    path: string,
    type?: RequestTypes
    data?: any,
    sid?: string
  }

  export interface ClientOptions {
    host?: string
    port?: string
    userAgent?: string
  }

  export interface ConnectOptions {
    startDaemon?: boolean
  }

  class Client {
    constructor(options: ClientOptions = {})
    connect(options: ConnectOptions): EventEmitter
    disconnect(): void
    request(options: RequestOptions): EventEmitter
  }

  export default Client;
}
