const path = require('path');
const os = require('os');
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { startScheduler } = require('./scheduler');

const HOST = process.env.CATALOG_HOST || '127.0.0.1';
const PORT = Number(process.env.CATALOG_PORT) || 3921;

db.initDb();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let cachedPublicIp = null;
let publicIpFetchedAt = 0;
let publicIpInFlight = null;
const PUBLIC_IP_TTL_MS = 10 * 60 * 1000;

function isPrivateIpv4(ip) {
	const parts = String(ip || '')
		.split('.')
		.map((n) => Number(n));
	if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return false;
	const [a, b] = parts;
	if (a === 10) return true;
	if (a === 192 && b === 168) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	return false;
}

function scoreLocalIp(ip) {
	const parts = String(ip || '')
		.split('.')
		.map((n) => Number(n));
	if (parts.length !== 4) return 0;
	const [a, b, , d] = parts;
	let score = 10;
	if (a === 192 && b === 168 && (parts[2] === 0 || parts[2] === 1)) score += 30;
	else if (a === 192 && b === 168) score += 20;
	else if (a === 10) score += 15;
	else if (a === 172) score += 5;
	if (d === 1) score -= 25;
	if (d === 0 || d === 255) score -= 40;
	return score;
}

function listLocalIpv4() {
	const found = [];
	const nets = os.networkInterfaces();
	for (const name of Object.keys(nets || {})) {
		for (const net of nets[name] || []) {
			const family = net.family === 'IPv4' || net.family === 4;
			if (!family || net.internal) continue;
			const address = net.address;
			if (!address || address.startsWith('169.254.')) continue;
			if (!isPrivateIpv4(address)) continue;
			if (!found.includes(address)) found.push(address);
		}
	}
	return found.sort((a, b) => scoreLocalIp(b) - scoreLocalIp(a));
}

async function fetchPublicIp() {
	const now = Date.now();
	if (cachedPublicIp && now - publicIpFetchedAt < PUBLIC_IP_TTL_MS) {
		return cachedPublicIp;
	}
	if (publicIpInFlight) return publicIpInFlight;

	publicIpInFlight = (async () => {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 3500);
		try {
			const response = await fetch('https://api.ipify.org?format=json', {
				signal: controller.signal,
			});
			if (!response.ok) throw new Error('ipify ' + response.status);
			const data = await response.json();
			const ip = String(data?.ip || '').trim();
			if (ip) {
				cachedPublicIp = ip;
				publicIpFetchedAt = Date.now();
			}
			return cachedPublicIp;
		} catch {
			return cachedPublicIp;
		} finally {
			clearTimeout(timer);
			publicIpInFlight = null;
		}
	})();

	return publicIpInFlight;
}

function sendError(res, error, status = 400) {
	res.status(status).json({ ok: false, error: error.message || String(error) });
}

app.get('/api/health', async (_req, res) => {
	const localIps = listLocalIpv4();
	const publicIp = await fetchPublicIp();
	res.json({
		ok: true,
		db: db.DB_PATH,
		localIps,
		publicIp: publicIp || null,
		hostname: os.hostname(),
	});
});

app.get('/api/sites', (_req, res) => {
	const sites = db.listSites().map((site) => {
		const stats = db.getSiteStats(site.id);
		return {
			...site,
			stats: stats?.links || null,
			last_run: stats?.last_run || null,
		};
	});
	res.json({ ok: true, sites });
});

app.post('/api/sites', (req, res) => {
	try {
		const site = db.createSite(req.body || {});
		res.status(201).json({ ok: true, site });
	} catch (error) {
		sendError(res, error);
	}
});

app.get('/api/sites/:id', (req, res) => {
	const site = db.getSite(Number(req.params.id));
	if (!site) return sendError(res, new Error('Сайт не найден'), 404);
	res.json({ ok: true, site, stats: db.getSiteStats(site.id) });
});

app.patch('/api/sites/:id', (req, res) => {
	try {
		const site = db.updateSite(Number(req.params.id), req.body || {});
		if (!site) return sendError(res, new Error('Сайт не найден'), 404);
		res.json({ ok: true, site });
	} catch (error) {
		sendError(res, error);
	}
});

app.delete('/api/sites/:id', (req, res) => {
	const deleted = db.deleteSite(Number(req.params.id));
	if (!deleted) return sendError(res, new Error('Сайт не найден'), 404);
	res.json({ ok: true });
});

app.get('/api/sites/:id/runs', (req, res) => {
	const siteId = Number(req.params.id);
	if (!db.getSite(siteId)) return sendError(res, new Error('Сайт не найден'), 404);
	const runs = db.listCrawlRuns(siteId, { limit: req.query.limit });
	res.json({ ok: true, runs });
});

app.get('/api/sites/:id/links', (req, res) => {
	const siteId = Number(req.params.id);
	if (!db.getSite(siteId)) return sendError(res, new Error('Сайт не найден'), 404);
	const needsAdmin = req.query.needs_admin;
	const result = db.listLinks(siteId, {
		needs_admin: needsAdmin === '1' || needsAdmin === 'true',
		page: req.query.page,
		limit: req.query.limit,
		sort: req.query.sort,
		order: req.query.order,
		q: req.query.q,
	});
	res.json({ ok: true, ...result });
});

app.post('/api/sites/:id/links', (req, res) => {
	try {
		const link = db.addLink(Number(req.params.id), req.body?.url);
		res.status(201).json({ ok: true, link });
	} catch (error) {
		sendError(res, error);
	}
});

app.post('/api/sites/:id/links/bulk', (req, res) => {
	try {
		const text = req.body?.text ?? req.body?.urlsText ?? '';
		const result = db.addLinksBulk(Number(req.params.id), text);
		res.status(201).json({ ok: true, ...result });
	} catch (error) {
		sendError(res, error);
	}
});

app.delete('/api/sites/:id/links/:linkId', (req, res) => {
	const deleted = db.deleteLink(Number(req.params.id), Number(req.params.linkId));
	if (!deleted) return sendError(res, new Error('Ссылка не найдена'), 404);
	res.json({ ok: true });
});

app.delete('/api/sites/:id/links', (req, res) => {
	if (!db.getSite(Number(req.params.id))) {
		return sendError(res, new Error('Сайт не найден'), 404);
	}
	const deleted = db.clearLinks(Number(req.params.id));
	res.json({ ok: true, deleted });
});

app.patch('/api/sites/:id/links/:linkId', (req, res) => {
	try {
		const link = db.updateLink(Number(req.params.id), Number(req.params.linkId), req.body || {});
		if (!link) return sendError(res, new Error('Ссылка не найдена'), 404);
		res.json({ ok: true, link });
	} catch (error) {
		sendError(res, error);
	}
});

app.get('/api/sites/:id/stats', (req, res) => {
	const stats = db.getSiteStats(Number(req.params.id));
	if (!stats) return sendError(res, new Error('Сайт не найден'), 404);
	res.json({ ok: true, ...stats });
});

app.get('/api/unprocessed', (req, res) => {
	if (req.query.urls === '1' || req.query.urls === 'true') {
		return res.json({ ok: true, urls: db.listUnprocessedUrls(), total: db.countUnprocessed() });
	}
	const result = db.listUnprocessed({
		page: req.query.page,
		limit: req.query.limit,
		sort: req.query.sort,
		order: req.query.order,
	});
	res.json({ ok: true, ...result });
});

app.post('/api/sites/:id/crawl', (req, res) => {
	try {
		const result = db.queueCrawl(Number(req.params.id), 'manual');
		res.json({ ok: true, ...result });
	} catch (error) {
		sendError(res, error);
	}
});

app.post('/api/sites/:id/crawl/stop', (req, res) => {
	try {
		const result = db.stopSiteCrawl(Number(req.params.id));
		res.json({ ok: true, ...result });
	} catch (error) {
		sendError(res, error);
	}
});

app.get('/api/jobs/claim', (_req, res) => {
	try {
		const job = db.claimCrawlJob();
		res.json({ ok: true, job });
	} catch (error) {
		sendError(res, error, 500);
	}
});

app.get('/api/jobs/:runId', (req, res) => {
	const run = db.getCrawlRun(Number(req.params.runId));
	if (!run) return sendError(res, new Error('Прогон не найден'), 404);
	res.json({ ok: true, run });
});

app.post('/api/jobs/:runId/progress', (req, res) => {
	try {
		const result = db.reportCrawlProgress(Number(req.params.runId), {
			url: req.body?.url,
			ok: Boolean(req.body?.ok),
			title: req.body?.title || '',
			error: req.body?.error || '',
			shares_total: req.body?.shares_total,
		});
		res.json({ ok: true, ...result });
	} catch (error) {
		sendError(res, error);
	}
});

app.post('/api/jobs/:runId/finish', (req, res) => {
	try {
		const run = db.finishCrawl(Number(req.params.runId), {
			status: req.body?.status || 'completed',
		});
		res.json({ ok: true, run });
	} catch (error) {
		sendError(res, error);
	}
});

app.post('/api/links/:id/full-parse-done', (req, res) => {
	const link = db.markFullParseDone(Number(req.params.id));
	if (!link) return sendError(res, new Error('Ссылка не найдена'), 404);
	res.json({ ok: true, link });
});

app.post('/api/actions/full-parse', (req, res) => {
	try {
		const linkId = Number(req.body?.linkId);
		if (!linkId) throw new Error('linkId обязателен');
		const action = db.createFullParseAction(linkId);
		res.status(201).json({ ok: true, action });
	} catch (error) {
		sendError(res, error);
	}
});

app.get('/api/actions/claim', (_req, res) => {
	try {
		const action = db.claimPendingAction();
		res.json({ ok: true, action });
	} catch (error) {
		sendError(res, error, 500);
	}
});

app.post('/api/actions/:id/complete', (req, res) => {
	db.completePendingAction(Number(req.params.id), req.body?.status || 'done');
	res.json({ ok: true });
});

app.get('*', (req, res, next) => {
	if (req.path.startsWith('/api/')) return next();
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, HOST, () => {
	console.log(`Catalog server http://${HOST}:${PORT}`);
	console.log(`SQLite: ${db.DB_PATH}`);
	startScheduler();
});
