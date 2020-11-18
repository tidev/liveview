declare module 'appcd-dispatcher' {
  export interface DispatcherContext {
    startTime: Date
    status: number
    request: any
    response: any
  }

  class Dispatcher {
    register(path: string, handler: (ctx: DispatcherContext) => void): void;
  }

  export default Dispatcher;
}
