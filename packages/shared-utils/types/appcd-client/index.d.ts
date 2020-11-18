declare module "appcd-client" {
  export type RequestTypes = 'subscribe' | 'unsubscribe'

  export interface RequestOptions {
    path: string,
    type?: RequestTypes
    data?: any,
    sid?: string
  }

  class Client {
    constructor()
    request(options: RequestOptions): this
  }

  export default Client;
}
