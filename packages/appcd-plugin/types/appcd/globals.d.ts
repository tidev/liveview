// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="appcd-dispatcher" />

declare const appcd: Appcd.Global;

declare namespace Appcd {
  interface Global {
    register(path: string, dispatcher: Dispatcher)
  }
}
