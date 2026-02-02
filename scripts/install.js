const chalk = require('chalk');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const addPath = async (name) => {
	const valuePath = path.resolve(__dirname, '../dist/node', name);
	return new Promise((resolve) => {
		const child = spawn('ti', ['config', `paths.${name}`, '-a', valuePath]);
		child.on('exit', (code) => {
			if (code !== 0) {
				// Fallback: directly update the Titanium config file.
				// This is needed because the `ti config` command does not
				// support all paths keys that the CLI actually reads.
				//
				// FIXME: The Titanium CLI should restore the "commands" key as a valid key
				// to update via it's command "ti config paths.commands -a /path/to/command"
				try {
					const configPath = path.join(
						os.homedir(),
						'.titanium',
						'config.json'
					);
					const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
					if (!config.paths) {
						config.paths = {};
					}
					if (!Array.isArray(config.paths[name])) {
						config.paths[name] = [];
					}
					if (!config.paths[name].includes(valuePath)) {
						config.paths[name].push(valuePath);
					}
					fs.writeFileSync(configPath, JSON.stringify(config, null, '\t'));
				} catch (e) {
					console.error(`Failed to automatically configure LiveView ${name}`);
				}
			}

			resolve();
		});
	});
};

async function install() {
	console.log(
		`\n${chalk.cyan(
			'Automatically integrating LiveView v2 with Titanium CLI ...'
		)}\n`
	);
	await addPath('hooks');
	await addPath('commands');
}

install();
