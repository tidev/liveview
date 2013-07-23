
/**
 * Initialize a new `Process`.
 *
 * @api public
 */

function Process() {
  if (!(this instanceof Process)) return new Process();
  this.title = 'titanium';
  this.version = '';
  this.moduleLoadList = [];
  this.versions = {};
  this.arch = Ti.Platform.architecture;
  this.platform = Ti.Platform.name;
  this.hardware = ('' + Ti.Platform.model).replace('google_');
}

// inherit from EventEmitter

Process.prototype.__proto__ = Emitter.prototype;