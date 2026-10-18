const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'catalog.db');

let db;

function getDb() {
	if (!db) {
		throw new Error('Database not initialized');
	}
	return db;
}

function initDb() {
	fs.mkdirSync(DATA_DIR, { recursive: true });
	db = new Database(DB_PATH);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');

	db.exec(`
		CREATE TABLE IF NOT EXISTS sites (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			base_url TEXT NOT NULL DEFAULT '',
			source_id TEXT NOT NULL DEFAULT 'russian-seriali',
			update_playlist INTEGER NOT NULL DEFAULT 0,
			schedule_enabled INTEGER NOT NULL DEFAULT 0,
			schedule_interval_hours INTEGER NOT NULL DEFAULT 24,
			last_crawl_at INTEGER,
			next_crawl_at INTEGER,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE IF NOT EXISTS links (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			site_id INTEGER NOT NULL,
			url TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'never',
			last_crawl_at INTEGER,
			last_title TEXT NOT NULL DEFAULT '',
			last_error TEXT NOT NULL DEFAULT '',
			last_fail_reason TEXT NOT NULL DEFAULT '',
			success_count INTEGER NOT NULL DEFAULT 0,
			fail_count INTEGER NOT NULL DEFAULT 0,
			needs_admin INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL,
			FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
			UNIQUE(site_id, url)
		);

		CREATE TABLE IF NOT EXISTS crawl_runs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			site_id INTEGER NOT NULL,
			started_at INTEGER,
			finished_at INTEGER,
			status TEXT NOT NULL DEFAULT 'pending',
			total INTEGER NOT NULL DEFAULT 0,
			success_count INTEGER NOT NULL DEFAULT 0,
			fail_count INTEGER NOT NULL DEFAULT 0,
			trigger TEXT NOT NULL DEFAULT 'manual',
			FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS pending_actions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			type TEXT NOT NULL,
			payload TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			created_at INTEGER NOT NULL,
			claimed_at INTEGER
		);

		CREATE INDEX IF NOT EXISTS idx_links_site ON links(site_id);
		CREATE INDEX IF NOT EXISTS idx_links_needs_admin ON links(needs_admin);
		CREATE INDEX IF NOT EXISTS idx_sites_next_crawl ON sites(next_crawl_at);
		CREATE INDEX IF NOT EXISTS idx_crawl_runs_status ON crawl_runs(status);
		CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_actions(status);
	`);

	ensureColumn('links', 'shares_total', 'INTEGER');
	ensureColumn('links', 'url_year', 'INTEGER');
	ensureColumn('links', 'url_path_id', 'INTEGER');
	ensureColumn('sites', 'crawl_order', "TEXT NOT NULL DEFAULT 'desc'");
	db.exec(`CREATE INDEX IF NOT EXISTS idx_links_shares_total ON links(shares_total)`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_links_url_year ON links(url_year)`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_links_url_path_id ON links(url_path_id)`);
	db.exec(`CREATE INDEX IF NOT EXISTS idx_links_needs_admin_year ON links(needs_admin, url_year)`);

	const missingYear = getDb()
		.prepare(`SELECT id, url FROM links WHERE url_year IS NULL AND url != ''`)
		.all();
	if (missingYear.length) {
		const updateYear = getDb().prepare(`UPDATE links SET url_year = ? WHERE id = ?`);
		const tx = getDb().transaction((rows) => {
			for (const row of rows) {
				updateYear.run(extractUrlYear(row.url), row.id);
			}
		});
		tx(missingYear);
	}

	const missingPathId = getDb()
		.prepare(`SELECT id, url FROM links WHERE url_path_id IS NULL AND url != ''`)
		.all();
	if (missingPathId.length) {
		const updatePathId = getDb().prepare(`UPDATE links SET url_path_id = ? WHERE id = ?`);
		const tx = getDb().transaction((rows) => {
			for (const row of rows) {
				updatePathId.run(extractUrlPathId(row.url), row.id);
			}
		});
		tx(missingPathId);
	}

	return db;
}

function ensureColumn(table, column, typeSql) {
	const cols = getDb()
		.prepare(`PRAGMA table_info(${table})`)
		.all()
		.map((row) => row.name);
	if (!cols.includes(column)) {
		getDb().exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
	}
}

function now() {
	return Date.now();
}

function rowToSite(row) {
	if (!row) return null;
	return {
		id: row.id,
		name: row.name,
		base_url: row.base_url,
		source_id: row.source_id,
		update_playlist: Boolean(row.update_playlist),
		schedule_enabled: Boolean(row.schedule_enabled),
		schedule_interval_hours: row.schedule_interval_hours,
		crawl_order: normalizeCrawlOrder(row.crawl_order),
		last_crawl_at: row.last_crawl_at,
		next_crawl_at: row.next_crawl_at,
		created_at: row.created_at,
	};
}

function extractUrlYear(url) {
	const years = String(url || '').match(/(?:19|20)\d{2}/g);
	if (!years || years.length === 0) return null;
	return Math.max(...years.map((value) => Number(value)));
}

function extractUrlYearLabel(url) {
	const years = String(url || '').match(/(?:19|20)\d{2}/g);
	if (!years || years.length === 0) return '';
	return [...new Set(years)].join('-');
}

function extractUrlPathId(url) {
	try {
		const pathname = new URL(String(url || '')).pathname;
		const match = pathname.match(/\/(\d+)-/);
		if (!match) return null;
		const num = Number(match[1]);
		return Number.isFinite(num) ? num : null;
	} catch {
		const match = String(url || '').match(/\/(\d+)-/);
		if (!match) return null;
		const num = Number(match[1]);
		return Number.isFinite(num) ? num : null;
	}
}

function normalizeCrawlOrder(value) {
	return String(value || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
}

function linkCrawlOrderClause(crawlOrder) {
	const dir = normalizeCrawlOrder(crawlOrder) === 'asc' ? 'ASC' : 'DESC';
	return `url_path_id IS NULL, url_path_id ${dir}, id ${dir}`;
}

function rowToLink(row) {
	if (!row) return null;
	const sharesTotal =
		row.shares_total === null || row.shares_total === undefined
			? null
			: Number(row.shares_total);
	const urlYear =
		row.url_year === null || row.url_year === undefined
			? extractUrlYear(row.url)
			: Number(row.url_year);
	const urlPathId =
		row.url_path_id === null || row.url_path_id === undefined
			? extractUrlPathId(row.url)
			: Number(row.url_path_id);
	return {
		id: row.id,
		site_id: row.site_id,
		url: row.url,
		status: row.status,
		last_crawl_at: row.last_crawl_at,
		last_title: row.last_title,
		last_error: row.last_error,
		last_fail_reason: row.last_fail_reason,
		success_count: row.success_count,
		fail_count: row.fail_count,
		needs_admin: Boolean(row.needs_admin),
		shares_total: Number.isFinite(sharesTotal) ? sharesTotal : null,
		url_year: Number.isFinite(urlYear) ? urlYear : null,
		url_year_label: extractUrlYearLabel(row.url),
		url_path_id: Number.isFinite(urlPathId) ? urlPathId : null,
		created_at: row.created_at,
		site_name: row.site_name || undefined,
		source_id: row.source_id || undefined,
	};
}

function listSites() {
	return getDb()
		.prepare('SELECT * FROM sites ORDER BY id DESC')
		.all()
		.map(rowToSite);
}

function getSite(id) {
	return rowToSite(getDb().prepare('SELECT * FROM sites WHERE id = ?').get(id));
}

function createSite({
	name,
	base_url = '',
	source_id = 'russian-seriali',
	update_playlist = false,
	schedule_enabled = false,
	schedule_interval_hours = 24,
	crawl_order = 'desc',
}) {
	const createdAt = now();
	const interval = Math.max(1, Number(schedule_interval_hours) || 24);
	const nextCrawlAt = schedule_enabled ? createdAt + interval * 3600 * 1000 : null;
	const order = normalizeCrawlOrder(crawl_order);

	const result = getDb()
		.prepare(
			`INSERT INTO sites (
				name, base_url, source_id, update_playlist,
				schedule_enabled, schedule_interval_hours, crawl_order,
				last_crawl_at, next_crawl_at, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
		)
		.run(
			String(name || '').trim() || 'Сайт',
			String(base_url || '').trim(),
			source_id === 'rosserial' ? 'rosserial' : 'russian-seriali',
			update_playlist ? 1 : 0,
			schedule_enabled ? 1 : 0,
			interval,
			order,
			nextCrawlAt,
			createdAt
		);

	return getSite(result.lastInsertRowid);
}

function updateSite(id, patch) {
	const site = getSite(id);
	if (!site) return null;

	const name = patch.name !== undefined ? String(patch.name).trim() || site.name : site.name;
	const base_url = patch.base_url !== undefined ? String(patch.base_url).trim() : site.base_url;
	const source_id =
		patch.source_id !== undefined
			? patch.source_id === 'rosserial'
				? 'rosserial'
				: 'russian-seriali'
			: site.source_id;
	const update_playlist =
		patch.update_playlist !== undefined ? Boolean(patch.update_playlist) : site.update_playlist;
	const schedule_enabled =
		patch.schedule_enabled !== undefined
			? Boolean(patch.schedule_enabled)
			: site.schedule_enabled;
	const schedule_interval_hours =
		patch.schedule_interval_hours !== undefined
			? Math.max(1, Number(patch.schedule_interval_hours) || 24)
			: site.schedule_interval_hours;
	const crawl_order =
		patch.crawl_order !== undefined ? normalizeCrawlOrder(patch.crawl_order) : site.crawl_order;

	let next_crawl_at = site.next_crawl_at;
	if (patch.schedule_enabled !== undefined || patch.schedule_interval_hours !== undefined) {
		if (schedule_enabled) {
			const base = site.last_crawl_at || now();
			next_crawl_at = base + schedule_interval_hours * 3600 * 1000;
			if (next_crawl_at < now()) {
				next_crawl_at = now();
			}
		} else {
			next_crawl_at = null;
		}
	}

	getDb()
		.prepare(
			`UPDATE sites SET
				name = ?, base_url = ?, source_id = ?, update_playlist = ?,
				schedule_enabled = ?, schedule_interval_hours = ?, crawl_order = ?, next_crawl_at = ?
			WHERE id = ?`
		)
		.run(
			name,
			base_url,
			source_id,
			update_playlist ? 1 : 0,
			schedule_enabled ? 1 : 0,
			schedule_interval_hours,
			crawl_order,
			next_crawl_at,
			id
		);

	return getSite(id);
}

function deleteSite(id) {
	const result = getDb().prepare('DELETE FROM sites WHERE id = ?').run(id);
	return result.changes > 0;
}

const LINK_SORT_COLUMNS = {
	id: 'id',
	url_path_id: 'url_path_id',
	url: 'url',
	status: 'status',
	last_crawl_at: 'last_crawl_at',
	last_title: 'last_title',
	last_error: 'last_error',
	needs_admin: 'needs_admin',
	shares_total: 'shares_total',
	created_at: 'created_at',
};

function listLinks(
	siteId,
	{ needs_admin, page = 1, limit = 50, sort = 'id', order = 'desc', q = '' } = {}
) {
	const pageNum = Math.max(1, Number(page) || 1);
	const pageSize = Math.min(200, Math.max(1, Number(limit) || 50));
	const sortCol = LINK_SORT_COLUMNS[sort] || 'id';
	const sortDir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
	const query = String(q || '').trim();

	let where = 'WHERE site_id = ?';
	const params = [siteId];
	if (needs_admin === true || needs_admin === 1 || needs_admin === '1') {
		where += ' AND needs_admin = 1';
	}
	if (query) {
		where += ' AND (url LIKE ? COLLATE NOCASE OR last_title LIKE ? COLLATE NOCASE)';
		const like = '%' + query.replace(/%/g, '\\%').replace(/_/g, '\\_') + '%';
		params.push(like, like);
	}

	const total =
		getDb().prepare(`SELECT COUNT(*) AS c FROM links ${where}`).get(...params).c || 0;
	const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
	const safePage = Math.min(pageNum, pages);
	const offset = (safePage - 1) * pageSize;

	const links = getDb()
		.prepare(
			`SELECT * FROM links ${where}
			 ORDER BY ${
					sortCol === 'shares_total'
						? `shares_total IS NULL, shares_total ${sortDir}, id DESC`
						: sortCol === 'url_path_id'
							? `url_path_id IS NULL, url_path_id ${sortDir}, id ${sortDir}`
							: `${sortCol} ${sortDir}, id DESC`
				}
			 LIMIT ? OFFSET ?`
		)
		.all(...params, pageSize, offset)
		.map(rowToLink);

	return {
		links,
		total,
		page: safePage,
		limit: pageSize,
		pages,
		sort: sortCol,
		order: sortDir.toLowerCase(),
		q: query,
	};
}

function getLink(id) {
	return rowToLink(getDb().prepare('SELECT * FROM links WHERE id = ?').get(id));
}

function getLinkWithSite(id) {
	const row = getDb()
		.prepare(
			`SELECT links.*, sites.name AS site_name, sites.source_id AS source_id
			 FROM links
			 JOIN sites ON sites.id = links.site_id
			 WHERE links.id = ?`
		)
		.get(id);
	return rowToLink(row);
}

function normalizeUrl(url) {
	return String(url || '').trim();
}

function addLink(siteId, url) {
	const normalized = normalizeUrl(url);
	if (!normalized) {
		throw new Error('URL пустой');
	}
	if (!/^https?:\/\//i.test(normalized)) {
		throw new Error('URL должен начинаться с http:// или https://');
	}

	const site = getSite(siteId);
	if (!site) {
		throw new Error('Сайт не найден');
	}

	try {
		const result = getDb()
			.prepare(
				`INSERT INTO links (
					site_id, url, status, last_crawl_at, last_title, last_error,
					last_fail_reason, success_count, fail_count, needs_admin, url_year, url_path_id, created_at
				) VALUES (?, ?, 'never', NULL, '', '', '', 0, 0, 0, ?, ?, ?)`
			)
			.run(siteId, normalized, extractUrlYear(normalized), extractUrlPathId(normalized), now());
		return getLink(result.lastInsertRowid);
	} catch (error) {
		if (String(error.message || '').includes('UNIQUE')) {
			throw new Error('Ссылка уже есть в каталоге сайта');
		}
		throw error;
	}
}

function addLinksBulk(siteId, text) {
	const lines = String(text || '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	const added = [];
	const skipped = [];
	const errors = [];

	const insert = getDb().prepare(
		`INSERT INTO links (
			site_id, url, status, last_crawl_at, last_title, last_error,
			last_fail_reason, success_count, fail_count, needs_admin, url_year, url_path_id, created_at
		) VALUES (?, ?, 'never', NULL, '', '', '', 0, 0, 0, ?, ?, ?)`
	);

	const tx = getDb().transaction((urls) => {
		for (const url of urls) {
			if (!/^https?:\/\//i.test(url)) {
				errors.push({ url, error: 'Неверный URL' });
				continue;
			}
			try {
				const result = insert.run(siteId, url, extractUrlYear(url), extractUrlPathId(url), now());
				added.push(getLink(result.lastInsertRowid));
			} catch (error) {
				if (String(error.message || '').includes('UNIQUE')) {
					skipped.push(url);
				} else {
					errors.push({ url, error: error.message });
				}
			}
		}
	});

	if (!getSite(siteId)) {
		throw new Error('Сайт не найден');
	}

	tx(lines);
	return { added: added.length, skipped: skipped.length, errors, links: added };
}

function deleteLink(siteId, linkId) {
	const result = getDb()
		.prepare('DELETE FROM links WHERE id = ? AND site_id = ?')
		.run(linkId, siteId);
	return result.changes > 0;
}

function clearLinks(siteId) {
	const result = getDb().prepare('DELETE FROM links WHERE site_id = ?').run(siteId);
	return result.changes;
}

function updateLink(siteId, linkId, patch) {
	const link = getLink(linkId);
	if (!link || link.site_id !== Number(siteId)) return null;

	const url = patch.url !== undefined ? normalizeUrl(patch.url) : link.url;
	if (!url || !/^https?:\/\//i.test(url)) {
		throw new Error('Неверный URL');
	}

	const needs_admin =
		patch.needs_admin !== undefined ? (patch.needs_admin ? 1 : 0) : link.needs_admin ? 1 : 0;

	try {
		getDb()
			.prepare(
				'UPDATE links SET url = ?, needs_admin = ?, url_year = ?, url_path_id = ? WHERE id = ? AND site_id = ?'
			)
			.run(url, needs_admin, extractUrlYear(url), extractUrlPathId(url), linkId, siteId);
	} catch (error) {
		if (String(error.message || '').includes('UNIQUE')) {
			throw new Error('Ссылка с таким URL уже есть');
		}
		throw error;
	}

	return getLink(linkId);
}

function rowToCrawlRun(row) {
	if (!row) return null;
	const total = Number(row.total) || 0;
	const success = Number(row.success_count) || 0;
	const fail = Number(row.fail_count) || 0;
	const processed = success + fail;
	const remaining = Math.max(0, total - processed);
	return {
		id: row.id,
		site_id: row.site_id,
		started_at: row.started_at,
		finished_at: row.finished_at,
		status: row.status,
		total,
		success_count: success,
		fail_count: fail,
		processed,
		remaining,
		trigger: row.trigger,
	};
}

function listCrawlRuns(siteId, { limit = 30 } = {}) {
	const max = Math.min(100, Math.max(1, Number(limit) || 30));
	return getDb()
		.prepare(
			`SELECT * FROM crawl_runs
			 WHERE site_id = ?
			 ORDER BY id DESC
			 LIMIT ?`
		)
		.all(siteId, max)
		.map(rowToCrawlRun);
}

function getSiteStats(siteId) {
	const site = getSite(siteId);
	if (!site) return null;

	const counts = getDb()
		.prepare(
			`SELECT
				COUNT(*) AS total,
				SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success,
				SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) AS fail,
				SUM(CASE WHEN status = 'never' THEN 1 ELSE 0 END) AS never,
				SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running,
				SUM(CASE WHEN needs_admin = 1 THEN 1 ELSE 0 END) AS needs_admin
			 FROM links WHERE site_id = ?`
		)
		.get(siteId);

	const runs = listCrawlRuns(siteId, { limit: 40 });
	const lastRun = runs[0] || null;

	return {
		site,
		links: {
			total: counts.total || 0,
			success: counts.success || 0,
			fail: counts.fail || 0,
			never: counts.never || 0,
			running: counts.running || 0,
			needs_admin: counts.needs_admin || 0,
		},
		last_run: lastRun,
		runs,
	};
}

const UNPROCESSED_SORT_COLUMNS = {
	last_crawl_at: 'links.last_crawl_at',
	shares_total: 'links.shares_total',
	url_year: 'links.url_year',
	id: 'links.id',
};

function unprocessedOrderClause(sortCol, sortDir) {
	if (sortCol === 'links.shares_total') {
		return `links.shares_total IS NULL, links.shares_total ${sortDir}, links.id DESC`;
	}
	if (sortCol === 'links.url_year') {
		return `links.url_year IS NULL, links.url_year ${sortDir}, links.id DESC`;
	}
	return `${sortCol} ${sortDir}, links.id DESC`;
}

function countUnprocessed() {
	return getDb().prepare(`SELECT COUNT(*) AS c FROM links WHERE needs_admin = 1`).get().c || 0;
}

function listUnprocessed({ page = 1, limit = 50, sort = 'last_crawl_at', order = 'desc' } = {}) {
	const pageNum = Math.max(1, Number(page) || 1);
	const pageSize = Math.min(200, Math.max(1, Number(limit) || 50));
	const sortCol = UNPROCESSED_SORT_COLUMNS[sort] || UNPROCESSED_SORT_COLUMNS.last_crawl_at;
	const sortDir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

	const total = countUnprocessed();
	const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
	const safePage = Math.min(pageNum, pages);
	const offset = (safePage - 1) * pageSize;

	const links = getDb()
		.prepare(
			`SELECT links.*, sites.name AS site_name, sites.source_id AS source_id
			 FROM links
			 JOIN sites ON sites.id = links.site_id
			 WHERE links.needs_admin = 1
			 ORDER BY ${unprocessedOrderClause(sortCol, sortDir)}
			 LIMIT ? OFFSET ?`
		)
		.all(pageSize, offset)
		.map(rowToLink);

	return {
		links,
		total,
		page: safePage,
		limit: pageSize,
		pages,
		sort: Object.keys(UNPROCESSED_SORT_COLUMNS).find((k) => UNPROCESSED_SORT_COLUMNS[k] === sortCol) || 'last_crawl_at',
		order: sortDir.toLowerCase(),
	};
}

function listUnprocessedUrls() {
	return getDb()
		.prepare(`SELECT url FROM links WHERE needs_admin = 1 ORDER BY last_crawl_at DESC, id DESC`)
		.all()
		.map((row) => row.url);
}

function markFullParseDone(linkId) {
	const result = getDb()
		.prepare(
			`UPDATE links SET needs_admin = 0 WHERE id = ?`
		)
		.run(linkId);
	return result.changes > 0 ? getLink(linkId) : null;
}

function queueCrawl(siteId, trigger = 'manual') {
	const site = getSite(siteId);
	if (!site) {
		throw new Error('Сайт не найден');
	}

	const links = getDb()
		.prepare(
			`SELECT id FROM links WHERE site_id = ? ORDER BY ${linkCrawlOrderClause(site.crawl_order)}`
		)
		.all(siteId);

	if (links.length === 0) {
		throw new Error('Нет ссылок для обхода');
	}

	const existing = getDb()
		.prepare(
			`SELECT id, status FROM crawl_runs
			 WHERE site_id = ? AND status IN ('pending', 'claimed', 'running', 'stopping')
			 LIMIT 1`
		)
		.get(siteId);

	if (existing) {
		throw new Error('Обход этого сайта уже в очереди или выполняется. Дождитесь окончания или остановите его.');
	}

	const result = getDb()
		.prepare(
			`INSERT INTO crawl_runs (
				site_id, started_at, finished_at, status, total,
				success_count, fail_count, trigger
			) VALUES (?, NULL, NULL, 'pending', ?, 0, 0, ?)`
		)
		.run(siteId, links.length, trigger);

	return {
		runId: result.lastInsertRowid,
		siteId,
		total: links.length,
		trigger,
	};
}

function getActiveCrawl(siteId) {
	return (
		getDb()
			.prepare(
				`SELECT * FROM crawl_runs
				 WHERE site_id = ?
				   AND status IN ('pending', 'claimed', 'running', 'stopping')
				 ORDER BY id DESC
				 LIMIT 1`
			)
			.get(siteId) || null
	);
}

function getCrawlRun(runId) {
	return getDb().prepare('SELECT * FROM crawl_runs WHERE id = ?').get(runId) || null;
}

function stopSiteCrawl(siteId) {
	const run = getActiveCrawl(siteId);
	if (!run) {
		throw new Error('Активный обход не найден');
	}

	if (run.status === 'pending') {
		const finished = finishCrawl(run.id, { status: 'stopped' });
		return {
			runId: run.id,
			wasPending: true,
			stopped: true,
			run: finished,
		};
	}

	getDb()
		.prepare(`UPDATE crawl_runs SET status = 'stopping' WHERE id = ?`)
		.run(run.id);

	createPendingAction('stop_crawl', {
		runId: run.id,
		siteId: Number(siteId),
	});

	return {
		runId: run.id,
		wasPending: false,
		stopped: false,
		stopRequested: true,
		run: getCrawlRun(run.id),
	};
}

function claimCrawlJob() {
	const run = getDb()
		.prepare(
			`SELECT crawl_runs.*, sites.source_id, sites.update_playlist, sites.crawl_order, sites.name AS site_name
			 FROM crawl_runs
			 JOIN sites ON sites.id = crawl_runs.site_id
			 WHERE crawl_runs.status = 'pending'
			 ORDER BY crawl_runs.id ASC
			 LIMIT 1`
		)
		.get();

	if (!run) return null;

	const links = getDb()
		.prepare(
			`SELECT id, url FROM links WHERE site_id = ? ORDER BY ${linkCrawlOrderClause(run.crawl_order)}`
		)
		.all(run.site_id);

	if (links.length === 0) {
		getDb()
			.prepare(
				`UPDATE crawl_runs SET status = 'completed', started_at = ?, finished_at = ?, total = 0
				 WHERE id = ?`
			)
			.run(now(), now(), run.id);
		return null;
	}

	const startedAt = now();
	getDb()
		.prepare(
			`UPDATE crawl_runs SET status = 'running', started_at = ?, total = ? WHERE id = ? AND status = 'pending'`
		)
		.run(startedAt, links.length, run.id);

	getDb()
		.prepare(`UPDATE links SET status = 'running' WHERE site_id = ? AND status != 'running'`)
		.run(run.site_id);

	return {
		runId: run.id,
		siteId: run.site_id,
		siteName: run.site_name,
		sourceId: run.source_id,
		updatePlaylist: Boolean(run.update_playlist),
		trigger: run.trigger,
		urls: links.map((l) => l.url),
		linkIds: links.map((l) => l.id),
		total: links.length,
	};
}

function classifyFailReason(message) {
	const text = String(message || '').toLowerCase();
	if (/captcha|робот|человек/.test(text)) return 'captcha';
	if (/title not found/.test(text)) return 'title';
	if (/новость.*заголовк.*год.*не найден/i.test(String(message || ''))) return 'news_not_found';
	return 'other';
}

function shouldMarkNeedsAdmin(reason) {
	return reason === 'captcha' || reason === 'title' || reason === 'news_not_found';
}

function normalizeSharesTotal(value) {
	if (value === null || value === undefined || value === '') return null;
	const num = Number(value);
	if (!Number.isFinite(num) || num < 0) return null;
	return Math.round(num);
}

function reportCrawlProgress(runId, { url, ok, title = '', error = '', shares_total } = {}) {
	const run = getDb().prepare('SELECT * FROM crawl_runs WHERE id = ?').get(runId);
	if (!run) {
		throw new Error('Прогон не найден');
	}

	const link = getDb()
		.prepare('SELECT * FROM links WHERE site_id = ? AND url = ?')
		.get(run.site_id, url);

	if (!link) {
		return { updated: false };
	}

	const at = now();
	const sharesTotal = normalizeSharesTotal(shares_total);
	const nextShares =
		sharesTotal !== null
			? sharesTotal
			: link.shares_total === null || link.shares_total === undefined
				? null
				: Number(link.shares_total);

	if (ok) {
		getDb()
			.prepare(
				`UPDATE links SET
					status = 'success',
					last_crawl_at = ?,
					last_title = ?,
					last_error = '',
					last_fail_reason = '',
					success_count = success_count + 1,
					needs_admin = 0,
					shares_total = ?
				 WHERE id = ?`
			)
			.run(at, String(title || ''), nextShares, link.id);

		getDb()
			.prepare(
				`UPDATE crawl_runs SET success_count = success_count + 1 WHERE id = ?`
			)
			.run(runId);
	} else {
		const reason = classifyFailReason(error);
		const needsAdmin = shouldMarkNeedsAdmin(reason) ? 1 : link.needs_admin ? 1 : 0;
		getDb()
			.prepare(
				`UPDATE links SET
					status = 'fail',
					last_crawl_at = ?,
					last_title = ?,
					last_error = ?,
					last_fail_reason = ?,
					fail_count = fail_count + 1,
					needs_admin = ?,
					shares_total = ?
				 WHERE id = ?`
			)
			.run(at, String(title || ''), String(error || ''), reason, needsAdmin, nextShares, link.id);

		getDb()
			.prepare(`UPDATE crawl_runs SET fail_count = fail_count + 1 WHERE id = ?`)
			.run(runId);
	}

	return { updated: true, linkId: link.id };
}

function finishCrawl(runId, { status = 'completed' } = {}) {
	const run = getDb().prepare('SELECT * FROM crawl_runs WHERE id = ?').get(runId);
	if (!run) {
		throw new Error('Прогон не найден');
	}

	const finishedAt = now();
	const finalStatus = status === 'stopped' ? 'stopped' : 'completed';

	getDb()
		.prepare(
			`UPDATE crawl_runs SET status = ?, finished_at = ? WHERE id = ?`
		)
		.run(finalStatus, finishedAt, runId);

	getDb()
		.prepare(
			`UPDATE links SET status = 'never'
			 WHERE site_id = ? AND status = 'running'`
		)
		.run(run.site_id);

	const site = getSite(run.site_id);
	let nextCrawlAt = null;
	if (site?.schedule_enabled) {
		nextCrawlAt = finishedAt + site.schedule_interval_hours * 3600 * 1000;
	}

	getDb()
		.prepare(
			`UPDATE sites SET last_crawl_at = ?, next_crawl_at = ? WHERE id = ?`
		)
		.run(finishedAt, nextCrawlAt, run.site_id);

	return getDb().prepare('SELECT * FROM crawl_runs WHERE id = ?').get(runId);
}

function enqueueDueScheduledCrawls() {
	const dueSites = getDb()
		.prepare(
			`SELECT id FROM sites
			 WHERE schedule_enabled = 1
			   AND next_crawl_at IS NOT NULL
			   AND next_crawl_at <= ?
			   AND id NOT IN (
			     SELECT site_id FROM crawl_runs
			     WHERE status IN ('pending', 'claimed', 'running', 'stopping')
			   )`
		)
		.all(now());

	const queued = [];
	for (const row of dueSites) {
		const linkCount = getDb()
			.prepare('SELECT COUNT(*) AS c FROM links WHERE site_id = ?')
			.get(row.id).c;
		if (!linkCount) continue;

		try {
			queued.push(queueCrawl(row.id, 'schedule'));
		} catch {
			// already queued or empty
		}
	}
	return queued;
}

function createPendingAction(type, payload) {
	const result = getDb()
		.prepare(
			`INSERT INTO pending_actions (type, payload, status, created_at, claimed_at)
			 VALUES (?, ?, 'pending', ?, NULL)`
		)
		.run(type, JSON.stringify(payload || {}), now());

	return {
		id: result.lastInsertRowid,
		type,
		payload,
		status: 'pending',
	};
}

function claimPendingAction() {
	const staleClaimBefore = now() - 5 * 60 * 1000;
	const row = getDb()
		.prepare(
			`SELECT * FROM pending_actions
			 WHERE status = 'pending'
			    OR (status = 'claimed' AND (claimed_at IS NULL OR claimed_at <= ?))
			 ORDER BY id ASC
			 LIMIT 1`
		)
		.get(staleClaimBefore);

	if (!row) return null;

	const claimedAt = now();
	const claimed = getDb()
		.prepare(
			`UPDATE pending_actions
			 SET status = 'claimed', claimed_at = ?
			 WHERE id = ?
			   AND (status = 'pending'
			        OR (status = 'claimed' AND (claimed_at IS NULL OR claimed_at <= ?)))`
		)
		.run(claimedAt, row.id, staleClaimBefore);
	if (claimed.changes === 0) return null;

	let payload = {};
	try {
		payload = JSON.parse(row.payload || '{}');
	} catch {
		payload = {};
	}

	return {
		id: row.id,
		type: row.type,
		payload,
	};
}

function completePendingAction(id, status = 'done') {
	getDb()
		.prepare(`UPDATE pending_actions SET status = ? WHERE id = ?`)
		.run(status, id);
}

function createFullParseAction(linkId) {
	const link = getLinkWithSite(linkId);
	if (!link) {
		throw new Error('Ссылка не найдена');
	}

	return createPendingAction('full_parse', {
		linkId: link.id,
		url: link.url,
		sourceId: link.source_id || 'auto',
		siteId: link.site_id,
		siteName: link.site_name,
	});
}

module.exports = {
	initDb,
	getDb,
	DB_PATH,
	listSites,
	getSite,
	createSite,
	updateSite,
	deleteSite,
	listLinks,
	getLink,
	getLinkWithSite,
	addLink,
	addLinksBulk,
	deleteLink,
	clearLinks,
	updateLink,
	getSiteStats,
	listCrawlRuns,
	listUnprocessed,
	listUnprocessedUrls,
	countUnprocessed,
	markFullParseDone,
	queueCrawl,
	getActiveCrawl,
	getCrawlRun,
	stopSiteCrawl,
	claimCrawlJob,
	reportCrawlProgress,
	finishCrawl,
	enqueueDueScheduledCrawls,
	createPendingAction,
	claimPendingAction,
	completePendingAction,
	createFullParseAction,
};
