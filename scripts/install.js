const chalk = require('chalk');
const { spawn } = require('child_process');
const path = require('path');

const addPath = async (name) => {
	return new Promise((resolve, reject) => {
		const child = spawn('ti', [
			'config',
			`paths.${name}`,
			'-a',
			path.resolve(__dirname, '../dist/node', name)
		]);
		child.on('exit', (code) => {
			if (code !== 0) {
				console.error(`Failed to automatically configure LiveView ${name}`);
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
