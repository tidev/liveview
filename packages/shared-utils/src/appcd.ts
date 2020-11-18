import AppcdClient, { RequestOptions } from 'appcd-client';
import { EventEmitter } from 'events';

export const appcd = {
  client: new AppcdClient(),
  connected: false,
  connecting: false,
  options: {
    startDaemon: true
  },
  async get<R = any>(path: string): Promise<R> {
    return this.request({ path });
  },
  async post<R = any>(path: string, data = {}): Promise<R> {
    return this.request({ path, data });
  },
  async request<R = any>(options: RequestOptions): Promise<R> {
    await this._ensureConnection();
    return new Promise((resolve, reject) => {
			this.client
				.request(options)
				.once('response', (response: R) => resolve(response))
				.once('error', (e: Error)=> reject(e));
		});
  },
  async subscribe(path: string): Promise<Subscription> {
		return new Promise((resolve, reject) => {
			const subscription = new Subscription(path);
			const request = this.client.request({
        path,
        type: 'subscribe'
      });
			request.on('response', (data: any, response: any) => {
					if (typeof data === 'string') {
            if (data === 'Subscribed') {
              subscription.sid = response.sid;
              return resolve(subscription);
            } else if (data === 'Unsubscribed') {
              return;
            }
					}

					subscription.emit('message', data);
				})
				.once('close', () => {
					subscription.emit('close');
				})
				.once('finish', () => {
          request.removeAllListeners();
					subscription.emit('close');
				})
				.once('error', (e: Error) => {
					if (!subscription.sid) {
						reject(e);
					} else {
						subscription.emit('error', e);
					}
				});
    });
  },
  async close(): Promise<void> {
    this.client.disconnect();
  },
  async _ensureConnection(): Promise<void> {
    if (this.connected) {
      return;
    }
    if (this.connecting) {
      return new Promise((resolve, reject) => {
        const checkConnection = setInterval(() => {
          if (this.connected === true) {
            clearInterval(checkConnection);
            resolve();
          }
          // @todo abort after timeout
        }, 50);
      });
    }
    this.connecting = true;
    this.connected = false;
    return new Promise((resolve, reject) => {
			this.client.connect(this.options)
				.once('connected', () => {
          this.connected = true;
          this.connecting = false;
          resolve();
        })
				.once('error', reject);
		});
  }
};

export class Subscription extends EventEmitter {
  public path: string
  public sid: string | null

	constructor(path: string) {
		super();
		this.path = path;
		this.sid = null;
  }

	async unsubscribe(): Promise<void> {
		if (this.sid === null) {
			return;
		}

		await appcd.request({
      path: this.path,
      type: 'unsubscribe',
			sid: this.sid
		});
		this.sid = null;
	}
}
