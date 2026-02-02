declare namespace Ti {
	namespace App {
		function _restart(): void;
	}

	interface HTTPClient {
		cache: boolean;
		readyState: number;
		status: number;
		responseText: string;
		open(method: string, url: string, async?: boolean): void;
		send(data?: unknown): void;
		getResponseHeader(name: string): string | null;
	}

	namespace Network {
		function createHTTPClient(): HTTPClient;
	}

	namespace Platform {
		const osname: string;
	}

	namespace Locale {
		const currentLanguage: string;
	}

	namespace UI {
		const hasSession: boolean | undefined;
		function addEventListener(event: string, listener: () => void): void;
	}
}
