var Fserver = require('../lib/fserver'),
	path = require('path'),
	join = path.join,
	should = require('should'), // eslint-disable-line no-unused-vars
	FixtureApp = join(__dirname, 'platform');

describe('FServer', function () {

	describe('#start()', function () {

		it('should start TCP and HTTP server', function () {
			Fserver.start({
				projectDir: FixtureApp,
				fport: 9011,
				eport: 9012
			});
		});

		it('should start 2 server instances', function () {

			Fserver.start({
				projectDir: FixtureApp,
				fport: 9021,
				eport: 9022
			});

			Fserver.start({
				projectDir: FixtureApp,
				fport: 9023,
				eport: 9024
			});
		});
	});

	describe('#pids()', function () {
		it('should return an empty Array', function () {
			Fserver.pids().should.be.an.instanceOf(Array);
		});

		before(function () {
			Fserver.start({
				projectDir: FixtureApp
			});

			Fserver.start({
				projectDir: FixtureApp,
				fport: 9033,
				eport: 9034
			});
		});

		it('should return an Array of PIDS', function (done) {
			var pids = Fserver.pids();
			pids.should.be.an.instanceOf(Array);
			done();
		});
	});
});

// The file server loads jsanalyze on the first file request, and node-appc defines a global
// `dump` when it is loaded. Load it here so that mocha's leak check records it before the tests.
require('node-titanium-sdk/lib/jsanalyze');

describe('FServer prefetch manifest', function () {
	const fs = require('fs-extra');
	const os = require('os');
	const http = require('http');
	const crypto = require('crypto');
	const FPORT = 9041;
	const EPORT = 9042;
	let projectDir;

	const md5 = file => crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');

	const get = (uri, platform) => new Promise(function (resolve, reject) {
		http.get({ host: '127.0.0.1', port: FPORT, path: uri, headers: { 'x-platform': platform } }, function (res) {
			let body = '';
			res.setEncoding('utf8');
			res.on('data', chunk => body += chunk);
			res.on('end', () => resolve({ status: res.statusCode, body }));
		}).on('error', reject);
	});

	before(function () {
		projectDir = fs.mkdtempSync(join(os.tmpdir(), 'liveview-manifest-'));
		fs.outputFileSync(join(projectDir, 'tiapp.xml'), '<ti:app xmlns:ti="http://ti.appcelerator.org"/>');
		fs.outputFileSync(join(projectDir, 'Resources', 'app.js'), 'module.exports = "app";');
		fs.outputFileSync(join(projectDir, 'Resources', 'lib', 'util.js'), 'module.exports = "util";');
		fs.outputFileSync(join(projectDir, 'Resources', 'android', 'droid.js'), 'module.exports = "droid";');
		fs.outputFileSync(join(projectDir, 'Resources', 'iphone', 'app.js'), 'module.exports = "app-iphone";');
		fs.outputFileSync(join(projectDir, 'Resources', 'node_modules', 'dep', 'index.js'), 'module.exports = "dep";');
		fs.outputFileSync(join(projectDir, 'Resources', '.hidden.js'), 'module.exports = "hidden";');
		fs.outputFileSync(join(projectDir, 'Resources', 'readme.txt'), 'not a module');

		Fserver.start({
			projectDir: projectDir,
			fport: FPORT,
			eport: EPORT,
			platform: 'android'
		});
	});

	after(function () {
		fs.removeSync(projectDir);
	});

	it('lists every module with a hash of the file that is served for it', async function () {
		const res = await get('/__liveview/manifest', 'android');
		res.status.should.equal(200);
		const manifest = JSON.parse(res.body);
		manifest.signature.should.be.a.String().and.not.be.empty();
		manifest.files.should.have.properties([ 'app', 'lib/util', 'droid', 'dep/index', 'localeStrings' ]);
		manifest.files.should.not.have.properties([ 'android/droid', 'iphone/app', '.hidden', 'readme' ]);
		manifest.files.app.should.equal(md5(join(projectDir, 'Resources', 'app.js')));
		manifest.files['lib/util'].should.equal(md5(join(projectDir, 'Resources', 'lib', 'util.js')));
		manifest.files.droid.should.equal(md5(join(projectDir, 'Resources', 'android', 'droid.js')));
		manifest.files['dep/index'].should.equal(md5(join(projectDir, 'Resources', 'node_modules', 'dep', 'index.js')));
		manifest.files.localeStrings.should.equal('none');
	});

	it('prefers the platform folder of the requesting platform', async function () {
		const manifest = JSON.parse((await get('/__liveview/manifest', 'iphone')).body);
		manifest.files.app.should.equal(md5(join(projectDir, 'Resources', 'iphone', 'app.js')));
		manifest.files.should.not.have.property('droid');
	});

	it('changes the hash when a file changes', async function () {
		const before = JSON.parse((await get('/__liveview/manifest', 'android')).body);
		fs.outputFileSync(join(projectDir, 'Resources', 'lib', 'util.js'), 'module.exports = "util v2";');
		const after = JSON.parse((await get('/__liveview/manifest', 'android')).body);
		after.files['lib/util'].should.not.equal(before.files['lib/util']);
		after.files.app.should.equal(before.files.app);
		after.signature.should.equal(before.signature);
	});

	it('serves the file that the manifest hashed', async function () {
		const res = await get('/lib/util.js', 'android');
		res.status.should.equal(200);
		res.body.should.equal('module.exports = "util v2";');
		(await get('/app.js', 'iphone')).body.should.equal('module.exports = "app-iphone";');
		(await get('/app.js', 'android')).body.should.equal('module.exports = "app";');
	});
});
