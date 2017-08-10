/* globals Emitter */
/**
 * Initialize a new `Process`.
 * @returns {Process}
 * @public
 */
function Process() {
	if (!(this instanceof Process)) {
		return new Process();
	}
	this.title = 'titanium';
	this.version = '';
	this.moduleLoadList = [];
	this.versions = {};
	this.arch = Ti.Platform.architecture;
	this.platform = Ti.Platform.osname;
	this.hardware = ('' + Ti.Platform.model).replace('google_');
}

// inherit from EventEmitter
Object.setPrototypeOf(Process.prototype, Emitter.prototype);
