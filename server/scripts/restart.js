const { spawn } = require('child_process');
const path = require('path');
const { killPort, PORT } = require('./stop');

killPort(PORT);

// Give Windows a moment to release the port
setTimeout(() => {
	const child = spawn(process.execPath, [path.join(__dirname, '..', 'index.js')], {
		cwd: path.join(__dirname, '..'),
		stdio: 'inherit',
		env: process.env,
	});

	child.on('exit', (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal);
			return;
		}
		process.exit(code ?? 0);
	});
}, 400);
