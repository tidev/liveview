declare module "appcd-response" {
  class Response {
    constructor(code: codes)
  }

  enum codes {
    OK = 200,
    NOT_FOUND = 404
  }
}
