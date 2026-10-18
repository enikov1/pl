const { execSync } = require('child_process');

const PORT = Number(process.env.CATALOG_PORT) || 3921;

function killPort(port) {
	if (process.platform === 'win32') {
		let out = '';
		try {
			out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
		} catch {
			return [];
		}

		const pids = new Set();
		for (const line of out.split(/\r?\n/)) {
			if (!/LISTENING/i.test(line)) continue;
			const parts = line.trim().split(/\s+/);
			const pid = parts[parts.length - 1];
			if (pid && /^\d+$/.test(pid) && pid !== '0') {
				pids.add(pid);
			}
		}

		for (const pid of pids) {
			try {
				execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
				console.log(`[stop] killed PID ${pid} (port ${port})`);
			} catch {
				// already gone
			}
		}
		return [...pids];
	}

	try {
		const out = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();
		const pids = out.split(/\s+/).filter(Boolean);
		for (const pid of pids) {
			try {
				execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
				console.log(`[stop] killed PID ${pid} (port ${port})`);
			} catch {
				// already gone
			}
		}
		return pids;
	} catch {
		return [];
	}
}

const killed = killPort(PORT);
if (killed.length === 0) {
	console.log(`[stop] nothing listening on port ${PORT}`);
} else {
	console.log(`[stop] done`);
}

module.exports = { killPort, PORT };
