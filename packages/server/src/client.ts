import io from 'socket.io';
import { DeviceInfo, TransferInfo } from './index';

export default class Client {
	constructor(private socket: io.Socket, public device: DeviceInfo) {

	}

	sendManifest(changes: TransferInfo[], removals: Set<string>): void {
		this.socket.emit('manifest', {
			changes,
			removals: Array.from(removals)
		});
	}
}
