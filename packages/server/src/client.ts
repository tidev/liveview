import io from 'socket.io';
import { DeviceInfo } from './index';
import { UpdateManifest } from './workspace';

export default class Client {
	constructor(private socket: io.Socket, public device: DeviceInfo) {

	}

	sendUpdateManifest(manifest: UpdateManifest): void {
		if (manifest.platform !== this.device.platform) {
			return;
		}

		this.socket.emit('manifest', {
			changes: manifest.changes,
			removals: manifest.removals
		});
	}
}
