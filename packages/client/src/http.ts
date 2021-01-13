export interface Response<T = any> {
  data: T
  status: number
  statusText: string
  headers: { [key: string]: string }
}

export type ResponseType = 'json' | 'blob'

export interface StatusValidator {
  (status: number): boolean
}

export interface RequestConfig {
  responseType?: ResponseType
  headers?: any,
  validateStatus?: StatusValidator
}

export interface HttpClient {
  defaults: RequestConfig
  get<T = any>(url: string, config?: RequestConfig): Promise<Response<T>>
}

const http: HttpClient = {
  defaults: {
    responseType: 'json',
    validateStatus(status: number): boolean {
      return status >= 200 && status < 300;
    }
  },
  async get<T = any>(url: string, config: RequestConfig = {}): Promise<Response<T>> {
    config = Object.assign({}, http.defaults, config);
    return new Promise((resolve, reject) => {
      const client = Ti.Network.createHTTPClient();
      client.open('GET', url);
      if (config?.headers) {
        for (const key in config.headers) {
          const value = config.headers[key];
          client.setRequestHeader(key, value);
        }
      }
      client.onerror = (e: any) => {
        reject(e);
      };
      client.onload = function () {
        let data;
        if (config.responseType === 'json') {
          data = JSON.parse(this.responseData.toString());
        } else {
          data = this.responseData as any;
        }
        const response: Response<T> = {
          data,
          status: this.status,
          statusText: this.statusText,
          headers: this.responseHeaders
        };

        const validateStatus = config.validateStatus;
        if (!validateStatus || validateStatus(response.status)) {
          resolve(response);
        } else {
          reject(new Error(`Request failed with status code ${response.status}`));
        }
      };
      client.send();
    });
  }
};

export default http;
