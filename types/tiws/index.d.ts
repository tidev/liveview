declare module 'tiws' {
	interface MessageEvent {
		data: any;
	}

	export default class WebSocket {
		readyState: number;

		constructor(address: string, protocols: string | string[]);

		send(data: string | ArrayBuffer | Blob | ArrayBufferView): void;

		close(): void;

		on(event: 'message', listener: (event: MessageEvent) => void): void;
		on(event: 'error', listener: (error: Error) => void): void;

		off(event: 'message', listener: (event: MessageEvent) => void): void;
		off(event: 'error', listener: (error: Error) => void): void;
	}
}
