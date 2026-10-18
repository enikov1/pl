const { enqueueDueScheduledCrawls } = require('./db');

const INTERVAL_MS = 60 * 1000;

let timer = null;

function tick() {
	try {
		const queued = enqueueDueScheduledCrawls();
		if (queued.length > 0) {
			console.log(
				`[scheduler] queued ${queued.length} crawl(s):`,
				queued.map((q) => `site=${q.siteId} run=${q.runId}`).join(', ')
			);
		}
	} catch (error) {
		console.error('[scheduler] tick failed:', error.message);
	}
}

function startScheduler() {
	if (timer) return;
	tick();
	timer = setInterval(tick, INTERVAL_MS);
	if (typeof timer.unref === 'function') {
		timer.unref();
	}
	console.log('[scheduler] started (every 60s)');
}

function stopScheduler() {
	if (timer) {
		clearInterval(timer);
		timer = null;
	}
}

module.exports = { startScheduler, stopScheduler, tick };
