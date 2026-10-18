const API = '';
const STORAGE_KEY = 'vde.catalog.ui';

let selectedSiteId = null;
let sitesCache = [];
let unprocessedCache = [];
let unprocessedSort = 'last_crawl_at';
let unprocessedOrder = 'desc';
let unprocessedPage = 1;
let unprocessedTotal = 0;
let unprocessedPages = 1;
const UNPROCESSED_PAGE_SIZE = 50;
let currentView = 'sites';
let watchCrawl = false;
let pollTimer = null;
let countdownTimer = null;
let detailNextCrawlAt = null;
let detailScheduleEnabled = false;
let lastLinksSignature = '';
let linksPage = 1;
let linksSort = 'url_path_id';
let linksOrder = 'desc';
let linksTotal = 0;
let linksPages = 1;
let linksQuery = '';
let linksSearchTimer = null;
let siteDetailTab = 'overview';
const LINKS_PAGE_SIZE = 50;

const STATUS_LABELS = {
	never: 'Ещё не обходили',
	success: 'Успешно',
	fail: 'Ошибка',
	running: 'В обходе',
};

const REASON_LABELS = {
	title: 'Нет названия на странице',
	news_not_found: 'Новость не найдена на russerialov',
	captcha: 'Капча / проверка «Я не робот»',
	other: 'Другая ошибка',
};

const SOURCE_LABELS = {
	'russian-seriali': 'russian-seriali.net',
	rosserial: 'rosserial.mobi / .be',
};

async function api(path, options = {}) {
	const res = await fetch(API + path, {
		headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
		...options,
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok || data.ok === false) {
		throw new Error(data.error || `Ошибка сервера ${res.status}`);
	}
	return data;
}

function toast(message, type = 'info') {
	const el = document.getElementById('toast');
	el.textContent = message;
	el.className = 'toast ' + (type === 'error' ? 'error' : type === 'success' ? 'success' : '');
	clearTimeout(toast._t);
	toast._t = setTimeout(() => el.classList.add('hidden'), 4000);
}

function escapeHtml(str) {
	return String(str || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function formatTime(ts) {
	if (!ts) return 'ещё не было';
	try {
		return new Date(ts).toLocaleString('ru-RU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		return '—';
	}
}

function pluralLinks(n) {
	const abs = Math.abs(n) % 100;
	const last = abs % 10;
	if (abs > 10 && abs < 20) return n + ' ссылок';
	if (last === 1) return n + ' ссылка';
	if (last >= 2 && last <= 4) return n + ' ссылки';
	return n + ' ссылок';
}

function statusBadge(status) {
	const value = String(status || 'never');
	const cls =
		value === 'success'
			? 'badge-success'
			: value === 'fail'
				? 'badge-fail'
				: value === 'running'
					? 'badge-running'
					: 'badge-never';
	const label = STATUS_LABELS[value] || value;
	return `<span class="badge ${cls}" title="${escapeHtml(value)}">${escapeHtml(label)}</span>`;
}

function reasonLabel(reason) {
	const key = String(reason || 'other');
	return REASON_LABELS[key] || key;
}

function saveUiState() {
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				view: currentView,
				selectedSiteId,
				linksPage,
				linksSort,
				linksOrder,
				linksQuery,
				siteDetailTab,
				unprocessedSort,
				unprocessedOrder,
				unprocessedPage,
			})
		);
	} catch {
		// ignore
	}
}

function loadUiState() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function isActiveRun(run) {
	return run && ['pending', 'claimed', 'running', 'stopping'].includes(run.status);
}

function crawlStatusLabel(status) {
	const map = {
		pending: 'В очереди — ждёт расширение',
		claimed: 'Забран расширением',
		running: 'Идёт обход прямо сейчас',
		stopping: 'Останавливается…',
	};
	return map[status] || status;
}

function setWatchCrawl(enabled) {
	const next = Boolean(enabled);
	if (watchCrawl === next) return;
	watchCrawl = next;
	restartPoller();
}

function getPollIntervalMs() {
	return watchCrawl ? 2000 : 12000;
}

function restartPoller() {
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
	pollTimer = setInterval(() => {
		pollUi().catch(() => {});
	}, getPollIntervalMs());
}

function setView(view) {
	currentView = view;
	document.getElementById('navSites').classList.toggle('active', view === 'sites');
	document.getElementById('navUnprocessed').classList.toggle('active', view === 'unprocessed');
	document.getElementById('sitesSidePanel').classList.toggle('hidden', view === 'unprocessed');

	const showDetail = view === 'sites' && selectedSiteId;
	document.getElementById('viewEmpty').classList.toggle('hidden', view !== 'sites' || showDetail);
	document.getElementById('siteDetail').classList.toggle('hidden', !showDetail);
	document.getElementById('viewUnprocessed').classList.toggle('hidden', view !== 'unprocessed');
	saveUiState();
}

function formatDuration(ms) {
	if (!ms || ms < 0) return '—';
	const totalSec = Math.floor(ms / 1000);
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	if (h > 0) return `${h} ч ${m} мин`;
	if (m > 0) return `${m} мин ${s} с`;
	return `${s} с`;
}

function formatCountdown(targetTs) {
	if (!targetTs) return null;
	const diff = Number(targetTs) - Date.now();
	if (diff <= 0) return 'сейчас / уже пора';
	const totalSec = Math.floor(diff / 1000);
	const d = Math.floor(totalSec / 86400);
	const h = Math.floor((totalSec % 86400) / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	if (d > 0) return `через ${d} д ${h} ч ${m} мин`;
	if (h > 0) return `через ${h} ч ${m} мин ${s} с`;
	if (m > 0) return `через ${m} мин ${s} с`;
	return `через ${s} с`;
}

function crawlTriggerLabel(trigger) {
	return trigger === 'schedule' ? 'по расписанию' : 'вручную';
}

function crawlRunStatusBadge(status) {
	const value = String(status || '');
	if (['pending', 'claimed', 'running', 'stopping'].includes(value)) {
		return `<span class="crawl-run-status run">${escapeHtml(crawlStatusLabel(value))}</span>`;
	}
	if (value === 'completed') {
		return '<span class="crawl-run-status ok">Завершён</span>';
	}
	if (value === 'stopped') {
		return '<span class="crawl-run-status fail">Остановлен</span>';
	}
	return `<span class="crawl-run-status idle">${escapeHtml(value || '—')}</span>`;
}

async function checkHealth() {
	const el = document.getElementById('serverStatus');
	const ipEl = document.getElementById('ipStatus');
	try {
		const data = await api('/api/health');
		const shortDb = String(data.db || '').split(/[/\\]/).slice(-2).join('/');
		el.className = 'status-chip';
		el.textContent = 'Сервер работает · ' + shortDb;
		el.title = data.db || '';

		const parts = [];
		if (data.publicIp) parts.push(data.publicIp);
		if (Array.isArray(data.localIps) && data.localIps.length) {
			const local = data.localIps.filter((ip) => ip !== data.publicIp).slice(0, 2);
			if (local.length) parts.push('лок. ' + local.join(', '));
		}
		if (ipEl) {
			ipEl.textContent = parts.length ? 'IP: ' + parts.join(' · ') : 'IP: не определён';
			ipEl.title = parts.length
				? 'Публичный и локальный IP этого компьютера'
				: 'Не удалось определить IP';
		}
	} catch (error) {
		el.className = 'status-chip error';
		el.textContent = 'Сервер недоступен · ' + error.message;
		if (ipEl) ipEl.textContent = 'IP: —';
	}
}

function updateGlobalCrawlChip() {
	const chip = document.getElementById('crawlLiveChip');
	if (!chip) return;
	const activeSites = sitesCache.filter((site) => isActiveRun(site.last_run));
	const active = activeSites.length > 0;
	chip.classList.toggle('hidden', !active);
	if (!active) return;
	if (activeSites.length === 1) {
		chip.textContent = 'Сейчас идёт обход · ' + (activeSites[0].name || 'сайт');
	} else {
		chip.textContent = 'Сейчас идёт обход · ' + activeSites.length + ' сайта';
	}
}

function renderSites() {
	const container = document.getElementById('sitesList');
	document.getElementById('sitesNavCount').textContent = String(sitesCache.length);

	if (!sitesCache.length) {
		container.innerHTML =
			'<p class="site-item-meta" style="padding:8px 4px">Пока пусто — нажмите «Добавить сайт»</p>';
		return;
	}

	container.innerHTML = sitesCache
		.map((site) => {
			const s = site.stats || {};
			const active = site.id === selectedSiteId ? ' active' : '';
			const sourceName = SOURCE_LABELS[site.source_id] || site.source_id;
			return `
				<button type="button" class="site-item${active}" data-id="${site.id}">
					<div class="site-item-title">
						<span>${escapeHtml(site.name)}</span>
						<span class="site-source">${escapeHtml(sourceName)}</span>
					</div>
					<div class="site-item-meta">
						<strong>${pluralLinks(s.total || 0)}</strong>
						 · успешно <strong>${s.success || 0}</strong>
						 · ошибки <strong>${s.fail || 0}</strong>
						 · в админку <strong>${s.needs_admin || 0}</strong>
						<br>
						${
							isActiveRun(site.last_run)
								? '<span class="schedule-on">● ' +
									escapeHtml(crawlStatusLabel(site.last_run.status)) +
									'</span>'
								: `<span class="${site.schedule_enabled ? 'schedule-on' : 'schedule-off'}">
							${
								site.schedule_enabled
									? 'Автообход каждые ' + site.schedule_interval_hours + ' ч'
									: 'Автообход выключен'
							}
						</span>
						 · следующий: ${formatTime(site.next_crawl_at)}`
						}
					</div>
				</button>
			`;
		})
		.join('');

	container.querySelectorAll('.site-item').forEach((btn) => {
		btn.addEventListener('click', () => openSite(Number(btn.dataset.id)));
	});
}

async function loadSites() {
	const data = await api('/api/sites');
	sitesCache = data.sites || [];
	renderSites();
	updateGlobalCrawlChip();
}

async function openSite(id) {
	selectedSiteId = id;
	lastLinksSignature = '';
	linksPage = 1;
	linksQuery = '';
	syncLinksSearchInput();
	setView('sites');
	renderSites();
	saveUiState();
	await refreshSiteDetail({ syncSettings: true });
}

function linksSignature(payload) {
	const links = payload.links || [];
	return [
		payload.page,
		payload.pages,
		payload.total,
		payload.sort,
		payload.order,
		payload.q || '',
		...links.map(
			(l) =>
				[
					l.id,
					l.status,
					l.last_crawl_at || '',
					l.last_title || '',
					l.last_error || '',
					l.needs_admin ? 1 : 0,
					l.shares_total === null || l.shares_total === undefined ? '' : l.shares_total,
					l.url_path_id === null || l.url_path_id === undefined ? '' : l.url_path_id,
				].join(':')
		),
	].join('|');
}

function syncLinksSearchInput() {
	const input = document.getElementById('linksSearch');
	const clearBtn = document.getElementById('linksSearchClear');
	if (input && input.value !== linksQuery) {
		input.value = linksQuery;
	}
	if (clearBtn) {
		clearBtn.hidden = !linksQuery;
	}
}

async function applyLinksSearch(value, { immediate = false } = {}) {
	const next = String(value || '').trim();
	if (linksSearchTimer) {
		clearTimeout(linksSearchTimer);
		linksSearchTimer = null;
	}

	const run = async () => {
		if (linksQuery === next && !immediate) return;
		linksQuery = next;
		linksPage = 1;
		lastLinksSignature = '';
		saveUiState();
		syncLinksSearchInput();
		if (selectedSiteId) {
			await refreshSiteDetail({ syncSettings: false });
		}
	};

	if (immediate) {
		await run();
		return;
	}

	linksSearchTimer = setTimeout(() => {
		run().catch((error) => toast(error.message, 'error'));
	}, 300);
}

function setSiteDetailTab(tab) {
	const allowed = ['overview', 'history', 'links', 'settings'];
	siteDetailTab = allowed.includes(tab) ? tab : 'overview';
	document.querySelectorAll('[data-site-tab]').forEach((btn) => {
		btn.classList.toggle('active', btn.dataset.siteTab === siteDetailTab);
	});
	document.querySelectorAll('[data-site-tab-panel]').forEach((panel) => {
		panel.classList.toggle('hidden', panel.dataset.siteTabPanel !== siteDetailTab);
	});
	saveUiState();
}

function formatUrlPathId(value) {
	if (value === null || value === undefined || value === '') return '—';
	const num = Number(value);
	return Number.isFinite(num) ? String(num) : '—';
}

function updateSortHeaders() {
	document.querySelectorAll('#linksTable .th-sort').forEach((btn) => {
		const active = btn.dataset.sort === linksSort;
		btn.classList.toggle('active', active);
		const ind = btn.querySelector('.sort-ind');
		if (!ind) return;
		ind.textContent = active ? (linksOrder === 'asc' ? '↑' : '↓') : '';
	});
}

function updateUnprocessedSortHeaders() {
	document.querySelectorAll('#unprocessedTable .th-sort').forEach((btn) => {
		const active = btn.dataset.unprocessedSort === unprocessedSort;
		btn.classList.toggle('active', active);
		const ind = btn.querySelector('.sort-ind');
		if (!ind) return;
		ind.textContent = active ? (unprocessedOrder === 'asc' ? '↑' : '↓') : '';
	});
}

function formatShares(value) {
	if (value === null || value === undefined || value === '') return '—';
	const num = Number(value);
	return Number.isFinite(num) ? String(num) : '—';
}

function renderUnprocessedPagination() {
	const box = document.getElementById('unprocessedPagination');
	const info = document.getElementById('unprocessedPageInfo');
	const prev = document.getElementById('unprocessedPrevBtn');
	const next = document.getElementById('unprocessedNextBtn');

	if (!box) return;

	if (unprocessedTotal <= 0) {
		box.hidden = true;
		return;
	}

	box.hidden = false;
	const from = (unprocessedPage - 1) * UNPROCESSED_PAGE_SIZE + 1;
	const to = Math.min(unprocessedPage * UNPROCESSED_PAGE_SIZE, unprocessedTotal);
	info.textContent = `${from}–${to} из ${unprocessedTotal} · стр. ${unprocessedPage}/${unprocessedPages}`;
	prev.disabled = unprocessedPage <= 1;
	next.disabled = unprocessedPage >= unprocessedPages;
}

function renderLinksPagination() {
	const box = document.getElementById('linksPagination');
	const info = document.getElementById('linksPageInfo');
	const prev = document.getElementById('linksPrevBtn');
	const next = document.getElementById('linksNextBtn');

	if (linksTotal <= 0) {
		box.hidden = true;
		return;
	}

	box.hidden = false;
	const from = linksTotal === 0 ? 0 : (linksPage - 1) * LINKS_PAGE_SIZE + 1;
	const to = Math.min(linksPage * LINKS_PAGE_SIZE, linksTotal);
	const filterNote = linksQuery ? ` · фильтр «${linksQuery}»` : '';
	info.textContent = `${from}–${to} из ${linksTotal}${filterNote} · стр. ${linksPage}/${linksPages}`;
	prev.disabled = linksPage <= 1;
	next.disabled = linksPage >= linksPages;
}

function renderLinksTable(links) {
	const body = document.getElementById('linksTableBody');
	document.getElementById('linksCount').textContent =
		linksTotal > 0 ? `(${linksTotal})` : '(0)';
	updateSortHeaders();
	renderLinksPagination();

	if (!links.length) {
		body.innerHTML = linksQuery
			? `<tr class="empty-row"><td colspan="9">Ничего не найдено по запросу «${escapeHtml(linksQuery)}»</td></tr>`
			: '<tr class="empty-row"><td colspan="9">Ссылок пока нет — добавьте одну или вставьте список выше</td></tr>';
		return;
	}

	body.innerHTML = links
		.map(
			(link) => `
			<tr data-link-id="${link.id}">
				<td class="num-cell">${formatUrlPathId(link.url_path_id)}</td>
				<td class="url-cell"><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.url)}</a></td>
				<td class="num-cell">${formatShares(link.shares_total)}</td>
				<td>${statusBadge(link.status)}</td>
				<td>${formatTime(link.last_crawl_at)}</td>
				<td>${escapeHtml(link.last_title) || '—'}</td>
				<td>${escapeHtml(link.last_error) || '—'}</td>
				<td>${
					link.needs_admin
						? '<span class="badge badge-fail" title="Нужно обработать через полный парсинг">Нужна</span>'
						: '—'
				}</td>
				<td>
					<button type="button" class="btn-icon del-link" data-id="${link.id}" title="Удалить ссылку">✕</button>
				</td>
			</tr>
		`
		)
		.join('');

	body.querySelectorAll('.del-link').forEach((btn) => {
		btn.addEventListener('click', async () => {
			if (!confirm('Удалить эту ссылку из каталога?')) return;
			try {
				await api(`/api/sites/${selectedSiteId}/links/${btn.dataset.id}`, { method: 'DELETE' });
				toast('Ссылка удалена', 'success');
				lastLinksSignature = '';
				await refreshSiteDetail({ syncSettings: false });
				await loadSites();
			} catch (error) {
				toast(error.message, 'error');
			}
		});
	});
}

function renderCrawlStatus(lastRun) {
	const banner = document.getElementById('crawlStatusBanner');
	const startBtn = document.getElementById('crawlNowBtn');
	const stopBtn = document.getElementById('stopCrawlBtn');
	const active = isActiveRun(lastRun);

	startBtn.disabled = active;
	startBtn.title = active
		? 'Нельзя запустить новый обход, пока не закончится текущий'
		: 'Поставить все ссылки сайта в очередь на массовое обновление';

	stopBtn.classList.toggle('hidden', !active);
	banner.classList.toggle('hidden', !active);

	if (!active) return;

	const total = Number(lastRun.total) || 0;
	const success = Number(lastRun.success_count) || 0;
	const fail = Number(lastRun.fail_count) || 0;
	const done = success + fail;
	const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

	banner.classList.toggle('stopping', lastRun.status === 'stopping');
	document.getElementById('crawlStatusTitle').textContent =
		lastRun.status === 'stopping' ? 'Обход останавливается' : 'Обход работает прямо сейчас';
	document.getElementById('crawlStatusMeta').textContent =
		crawlStatusLabel(lastRun.status) +
		(lastRun.trigger === 'schedule' ? ' · по расписанию' : ' · вручную') +
		(lastRun.started_at ? ' · начат ' + formatTime(lastRun.started_at) : '');
	document.getElementById('crawlStatusBar').style.width = percent + '%';
	document.getElementById('crawlStatusCounts').textContent =
		`Обработано ${done} из ${total} · успешно ${success} · ошибки ${fail} · ${percent}%`;
}

function renderSiteMetrics(site, stats) {
	const nextLabel = site.schedule_enabled
		? formatCountdown(site.next_crawl_at) || formatTime(site.next_crawl_at)
		: 'выключен';
	document.getElementById('siteStats').innerHTML = `
		<div class="metric"><span class="metric-label">Всего ссылок</span><span class="metric-value">${stats.total || 0}</span></div>
		<div class="metric"><span class="metric-label">Успешно</span><span class="metric-value">${stats.success || 0}</span></div>
		<div class="metric"><span class="metric-label">С ошибкой</span><span class="metric-value">${stats.fail || 0}</span></div>
		<div class="metric"><span class="metric-label">Ещё не обходили</span><span class="metric-value">${stats.never || 0}</span></div>
		<div class="metric"><span class="metric-label">Нужна админка</span><span class="metric-value">${stats.needs_admin || 0}</span></div>
		<div class="metric"><span class="metric-label">Последний обход</span><span class="metric-value sm">${formatTime(site.last_crawl_at)}</span></div>
		<div class="metric"><span class="metric-label">Следующий обход</span><span class="metric-value sm" id="metricNextCrawl">${escapeHtml(nextLabel)}</span></div>
	`;
}

function renderDetailMeta(site, lastRun) {
	const sourceName = SOURCE_LABELS[site.source_id] || site.source_id;
	const parts = [
		'Парсер: ' + sourceName,
		site.base_url || '',
		'последний обход: ' + formatTime(site.last_crawl_at),
	].filter(Boolean);

	let nextHtml = '';
	if (isActiveRun(lastRun)) {
		nextHtml = '';
	} else if (site.schedule_enabled && site.next_crawl_at) {
		const countdown = formatCountdown(site.next_crawl_at) || formatTime(site.next_crawl_at);
		nextHtml = `<span class="next-crawl-chip" id="detailCountdown" title="${escapeHtml(formatTime(site.next_crawl_at))}">Следующий обход: ${escapeHtml(countdown)}</span>`;
	} else {
		nextHtml = '<span class="next-crawl-chip muted">Автообход выключен</span>';
	}

	const liveHtml = isActiveRun(lastRun)
		? `<span class="live-crawl-badge"><span class="live-dot" aria-hidden="true"></span>Сейчас идёт обход</span>`
		: '';

	document.getElementById('detailMeta').innerHTML =
		`<span class="detail-meta-text">${escapeHtml(parts.join(' · '))}</span>` + liveHtml + nextHtml;
}

function renderCrawlRuns(runs) {
	const body = document.getElementById('crawlRunsBody');
	if (!body) return;

	if (!runs || !runs.length) {
		body.innerHTML =
			'<tr class="empty-row"><td colspan="8">Пока нет запусков обхода для этого сайта</td></tr>';
		return;
	}

	body.innerHTML = runs
		.map((run) => {
			const when = run.started_at
				? formatTime(run.started_at)
				: 'ещё не начат';
			const duration =
				run.started_at && run.finished_at
					? formatDuration(run.finished_at - run.started_at)
					: isActiveRun(run)
						? 'идёт…'
						: '—';
			return `
				<tr>
					<td>
						<div>${escapeHtml(when)}</div>
						<div class="muted" style="font-size:12px;margin-top:2px">${escapeHtml(duration)}</div>
					</td>
					<td>${crawlRunStatusBadge(run.status)}</td>
					<td>${escapeHtml(crawlTriggerLabel(run.trigger))}</td>
					<td class="num-cell">${run.total}</td>
					<td class="num-cell">${run.processed}</td>
					<td class="num-cell">${run.success_count}</td>
					<td class="num-cell">${run.fail_count}</td>
					<td class="num-cell">${run.remaining}</td>
				</tr>
			`;
		})
		.join('');
}

function tickCountdowns() {
	const countdown = formatCountdown(detailNextCrawlAt);
	const detailEl = document.getElementById('detailCountdown');
	if (detailEl && detailScheduleEnabled && detailNextCrawlAt) {
		detailEl.textContent = 'Следующий обход: ' + (countdown || formatTime(detailNextCrawlAt));
		detailEl.title = formatTime(detailNextCrawlAt);
	}
	const metricEl = document.getElementById('metricNextCrawl');
	if (metricEl && detailScheduleEnabled) {
		metricEl.textContent = countdown || formatTime(detailNextCrawlAt) || '—';
	}
}

function ensureCountdownTimer() {
	if (countdownTimer) return;
	countdownTimer = setInterval(tickCountdowns, 1000);
}

async function requestExtensionStopCrawl(runId) {
	const connected = await pingExtension(1200);
	if (!connected) return false;

	const id = requestId();
	const wait = waitExtensionMessage('stop_crawl_result', id, 15000);
	window.postMessage(
		{
			source: 'vde-catalog',
			type: 'stop_crawl',
			requestId: id,
			runId,
		},
		'*'
	);
	const result = await wait;
	return Boolean(result?.ok);
}

async function refreshSiteDetail({ syncSettings = false } = {}) {
	if (!selectedSiteId) return;

	const linksQueryUrl =
		`/api/sites/${selectedSiteId}/links` +
		`?page=${linksPage}&limit=${LINKS_PAGE_SIZE}` +
		`&sort=${encodeURIComponent(linksSort)}&order=${encodeURIComponent(linksOrder)}` +
		(linksQuery ? `&q=${encodeURIComponent(linksQuery)}` : '');

	const [siteData, linksData] = await Promise.all([
		api('/api/sites/' + selectedSiteId),
		api(linksQueryUrl),
	]);

	const site = siteData.site;
	const stats = siteData.stats?.links || {};
	const lastRun = siteData.stats?.last_run || null;
	const runs = siteData.stats?.runs || [];
	const links = linksData.links || [];

	linksTotal = Number(linksData.total) || 0;
	linksPages = Math.max(1, Number(linksData.pages) || 1);
	linksPage = Math.min(Math.max(1, Number(linksData.page) || linksPage), linksPages);
	syncLinksSearchInput();

	detailNextCrawlAt = site.next_crawl_at || null;
	detailScheduleEnabled = Boolean(site.schedule_enabled);
	document.getElementById('detailTitle').textContent = site.name;
	renderDetailMeta(site, lastRun);

	if (syncSettings) {
		document.getElementById('siteScheduleEnabled').checked = site.schedule_enabled;
		document.getElementById('siteInterval').value = site.schedule_interval_hours;
		document.getElementById('siteUpdatePlaylist').checked = site.update_playlist;
		document.getElementById('siteCrawlOrder').value =
			site.crawl_order === 'asc' ? 'asc' : 'desc';
		linksSort = 'url_path_id';
		linksOrder = site.crawl_order === 'asc' ? 'asc' : 'desc';
	}

	renderSiteMetrics(site, stats);
	renderCrawlRuns(runs);
	renderCrawlStatus(lastRun);
	ensureCountdownTimer();
	tickCountdowns();

	document.getElementById('metricsLegend').textContent = isActiveRun(lastRun)
		? 'Идёт обход — статусы в таблице обновляются автоматически каждые пару секунд.'
		: '«Нужна админка» — ссылки, которые не обновились автоматически (новость не найдена, капча и т.п.). Их можно взять во вкладке «Необработанные».';

	const signature = linksSignature(linksData);
	if (signature !== lastLinksSignature) {
		lastLinksSignature = signature;
		renderLinksTable(links);
	} else {
		document.getElementById('linksCount').textContent =
			linksTotal > 0 ? `(${linksTotal})` : '(0)';
		renderLinksPagination();
		updateSortHeaders();
	}

	setWatchCrawl(isActiveRun(lastRun));
	updateGlobalCrawlChip();
}

function requestId() {
	return 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function waitExtensionMessage(type, id, timeoutMs = 120000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			window.removeEventListener('message', onMessage);
			reject(new Error('Расширение не ответило вовремя. Перезагрузите расширение и обновите эту страницу.'));
		}, timeoutMs);

		function onMessage(event) {
			if (event.source !== window) return;
			const data = event.data;
			if (!data || data.source !== 'vde-extension') return;
			if (data.type !== type || data.requestId !== id) return;
			clearTimeout(timer);
			window.removeEventListener('message', onMessage);
			resolve(data);
		}

		window.addEventListener('message', onMessage);
	});
}

async function pingExtension(timeoutMs = 1500) {
	const id = requestId();
	const wait = waitExtensionMessage('pong', id, timeoutMs);
	window.postMessage({ source: 'vde-catalog', type: 'ping', requestId: id }, '*');
	try {
		await wait;
		return true;
	} catch {
		return false;
	}
}

async function runImmediateFullParse(link) {
	const connected = await pingExtension();
	if (!connected) {
		await api('/api/actions/full-parse', {
			method: 'POST',
			body: JSON.stringify({ linkId: link.id }),
		});
		toast(
			'Расширение не на связи с этой страницей. Задача поставлена в очередь — перезагрузите расширение, обновите каталог (F5). Обход подхватится в течение минуты.',
			'error'
		);
		return false;
	}

	const id = requestId();
	const wait = waitExtensionMessage('full_parse_result', id, 180000);
	window.postMessage(
		{
			source: 'vde-catalog',
			type: 'full_parse',
			requestId: id,
			linkId: link.id,
			url: link.url,
			sourceId: link.source_id || 'auto',
		},
		'*'
	);

	toast('Парсинг запущен…', 'info');
	const result = await wait;
	if (!result.ok) {
		throw new Error(result.error || 'Не удалось выполнить парсинг');
	}
	toast('Готово: «' + (result.title || 'без названия') + '». Админка должна открыться.', 'success');
	return true;
}

async function loadUnprocessed({ updateTable = true } = {}) {
	const data = await api(
		`/api/unprocessed?page=${unprocessedPage}&limit=${UNPROCESSED_PAGE_SIZE}` +
			`&sort=${encodeURIComponent(unprocessedSort)}&order=${encodeURIComponent(unprocessedOrder)}`
	);
	unprocessedCache = data.links || [];
	unprocessedTotal = Number(data.total) || 0;
	unprocessedPages = Math.max(1, Number(data.pages) || 1);
	unprocessedPage = Math.min(Math.max(1, Number(data.page) || unprocessedPage), unprocessedPages);

	document.getElementById('unprocessedCount').textContent = String(unprocessedTotal);

	if (!updateTable) return;

	const body = document.getElementById('unprocessedBody');
	updateUnprocessedSortHeaders();
	renderUnprocessedPagination();

	if (!unprocessedCache.length) {
		body.innerHTML =
			'<tr class="empty-row"><td colspan="7">Пока пусто — сюда попадут ссылки с ошибками массового обхода</td></tr>';
		return;
	}

	body.innerHTML = unprocessedCache
		.map(
			(link) => `
			<tr data-link-id="${link.id}">
				<td>${escapeHtml(link.site_name || link.site_id)}</td>
				<td class="url-cell"><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.url)}</a></td>
				<td class="num-cell">${escapeHtml(link.url_year_label) || '—'}</td>
				<td class="num-cell">${formatShares(link.shares_total)}</td>
				<td>${escapeHtml(reasonLabel(link.last_fail_reason))}</td>
				<td>${escapeHtml(link.last_error) || '—'}</td>
				<td>
					<div class="row-actions">
						<button type="button" class="btn btn-ghost copy-link" data-url="${escapeHtml(link.url)}" title="Скопировать эту ссылку">Копировать</button>
						<button type="button" class="btn btn-accent full-parse" data-id="${link.id}" title="Сразу спарсить и открыть админку">Парсить сейчас</button>
						<button type="button" class="btn btn-ghost mark-done" data-site="${link.site_id}" data-id="${link.id}" title="Убрать из очереди без удаления ссылки">Готово</button>
						<button type="button" class="btn btn-ghost danger-text del-unprocessed" data-site="${link.site_id}" data-id="${link.id}" title="Удалить ссылку из каталога">Удалить</button>
					</div>
				</td>
			</tr>
		`
		)
		.join('');

	body.querySelectorAll('.copy-link').forEach((btn) => {
		btn.addEventListener('click', async () => {
			try {
				await navigator.clipboard.writeText(btn.dataset.url || '');
				toast('Ссылка скопирована', 'success');
			} catch (error) {
				toast(error.message, 'error');
			}
		});
	});

	body.querySelectorAll('.full-parse').forEach((btn) => {
		btn.addEventListener('click', async () => {
			const link = unprocessedCache.find((item) => item.id === Number(btn.dataset.id));
			if (!link) {
				toast('Ссылка не найдена в списке', 'error');
				return;
			}
			btn.disabled = true;
			try {
				const done = await runImmediateFullParse(link);
				if (done) {
					await loadUnprocessed();
					if (selectedSiteId) await refreshSiteDetail({ syncSettings: false });
					await loadSites();
				}
			} catch (error) {
				toast(error.message, 'error');
			} finally {
				btn.disabled = false;
			}
		});
	});

	body.querySelectorAll('.mark-done').forEach((btn) => {
		btn.addEventListener('click', async () => {
			try {
				await api(`/api/sites/${btn.dataset.site}/links/${btn.dataset.id}`, {
					method: 'PATCH',
					body: JSON.stringify({ needs_admin: false }),
				});
				toast('Убрано из необработанных', 'success');
				await loadUnprocessed();
				if (selectedSiteId) await refreshSiteDetail({ syncSettings: false });
				await loadSites();
			} catch (error) {
				toast(error.message, 'error');
			}
		});
	});

	body.querySelectorAll('.del-unprocessed').forEach((btn) => {
		btn.addEventListener('click', async () => {
			if (!confirm('Удалить эту ссылку из каталога полностью?')) return;
			try {
				await api(`/api/sites/${btn.dataset.site}/links/${btn.dataset.id}`, {
					method: 'DELETE',
				});
				toast('Ссылка удалена', 'success');
				await loadUnprocessed();
				if (selectedSiteId) await refreshSiteDetail({ syncSettings: false });
				await loadSites();
			} catch (error) {
				toast(error.message, 'error');
			}
		});
	});
}

document.getElementById('navSites').addEventListener('click', () => setView('sites'));
document.getElementById('navUnprocessed').addEventListener('click', () => {
	setView('unprocessed');
	loadUnprocessed().catch((e) => toast(e.message, 'error'));
});

document.getElementById('toggleCreateBtn').addEventListener('click', () => {
	document.getElementById('createPanel').classList.toggle('hidden');
});

document.getElementById('createSiteBtn').addEventListener('click', async () => {
	try {
		const created = await api('/api/sites', {
			method: 'POST',
			body: JSON.stringify({
				name: document.getElementById('newSiteName').value,
				base_url: document.getElementById('newSiteBaseUrl').value,
				source_id: document.getElementById('newSiteSource').value,
			}),
		});
		document.getElementById('newSiteName').value = '';
		document.getElementById('newSiteBaseUrl').value = '';
		document.getElementById('createPanel').classList.add('hidden');
		toast('Сайт создан — настройте обход на вкладке «Настройки»', 'success');
		await loadSites();
		if (created.site?.id) {
			await openSite(created.site.id);
			setSiteDetailTab('settings');
		}
	} catch (error) {
		toast(error.message, 'error');
	}
});

document.getElementById('closeDetailBtn').addEventListener('click', () => {
	selectedSiteId = null;
	lastLinksSignature = '';
	setWatchCrawl(false);
	renderSites();
	setView('sites');
	saveUiState();
});

document.getElementById('saveSiteBtn').addEventListener('click', async () => {
	if (!selectedSiteId) return;
	try {
		await api('/api/sites/' + selectedSiteId, {
			method: 'PATCH',
			body: JSON.stringify({
				schedule_enabled: document.getElementById('siteScheduleEnabled').checked,
				schedule_interval_hours: Number(document.getElementById('siteInterval').value) || 24,
				update_playlist: document.getElementById('siteUpdatePlaylist').checked,
				crawl_order: document.getElementById('siteCrawlOrder').value,
			}),
		});
		lastLinksSignature = '';
		toast('Настройки сохранены', 'success');
		linksSort = 'url_path_id';
		linksOrder =
			document.getElementById('siteCrawlOrder').value === 'asc' ? 'asc' : 'desc';
		await refreshSiteDetail({ syncSettings: true });
		await loadSites();
	} catch (error) {
		toast(error.message, 'error');
	}
});

document.getElementById('crawlNowBtn').addEventListener('click', async () => {
	if (!selectedSiteId) return;
	if (document.getElementById('crawlNowBtn').disabled) {
		toast('Сначала дождитесь окончания текущего обхода или остановите его', 'error');
		return;
	}
	try {
		const result = await api('/api/sites/' + selectedSiteId + '/crawl', {
			method: 'POST',
			body: '{}',
		});
		setWatchCrawl(true);
		lastLinksSignature = '';
		await refreshSiteDetail({ syncSettings: false });
		toast(
			'Обход поставлен в очередь (№' +
				result.runId +
				'). Статусы обновятся здесь автоматически.',
			'success'
		);
	} catch (error) {
		toast(error.message, 'error');
	}
});

document.getElementById('stopCrawlBtn').addEventListener('click', async () => {
	if (!selectedSiteId) return;
	if (!confirm('Остановить текущий обход?')) return;

	const btn = document.getElementById('stopCrawlBtn');
	btn.disabled = true;
	try {
		const result = await api('/api/sites/' + selectedSiteId + '/crawl/stop', {
			method: 'POST',
			body: '{}',
		});

		if (result.stopRequested && result.runId) {
			try {
				await requestExtensionStopCrawl(result.runId);
			} catch {
				// очередь stop_crawl подхватит расширение
			}
		}

		setWatchCrawl(true);
		lastLinksSignature = '';
		await refreshSiteDetail({ syncSettings: false });
		toast(
			result.wasPending ? 'Обход снят с очереди' : 'Остановка обхода запрошена',
			'success'
		);
	} catch (error) {
		toast(error.message, 'error');
	} finally {
		btn.disabled = false;
	}
});

document.getElementById('deleteSiteBtn').addEventListener('click', async () => {
	if (!selectedSiteId) return;
	if (!confirm('Удалить сайт и все его ссылки безвозвратно?')) return;
	try {
		await api('/api/sites/' + selectedSiteId, { method: 'DELETE' });
		selectedSiteId = null;
		lastLinksSignature = '';
		setWatchCrawl(false);
		toast('Сайт удалён', 'success');
		await loadSites();
		await loadUnprocessed();
		setView('sites');
		saveUiState();
	} catch (error) {
		toast(error.message, 'error');
	}
});

document.getElementById('addOneBtn').addEventListener('click', async () => {
	if (!selectedSiteId) return;
	try {
		await api('/api/sites/' + selectedSiteId + '/links', {
			method: 'POST',
			body: JSON.stringify({ url: document.getElementById('singleUrl').value }),
		});
		document.getElementById('singleUrl').value = '';
		toast('Ссылка добавлена', 'success');
		lastLinksSignature = '';
		setSiteDetailTab('links');
		await refreshSiteDetail({ syncSettings: false });
		await loadSites();
	} catch (error) {
		toast(error.message, 'error');
	}
});

document.getElementById('addBulkBtn').addEventListener('click', async () => {
	if (!selectedSiteId) return;
	try {
		const result = await api('/api/sites/' + selectedSiteId + '/links/bulk', {
			method: 'POST',
			body: JSON.stringify({ text: document.getElementById('bulkUrls').value }),
		});
		document.getElementById('bulkUrls').value = '';
		toast(
			'Добавлено: ' + result.added + (result.skipped ? ', пропущено дублей: ' + result.skipped : ''),
			'success'
		);
		lastLinksSignature = '';
		setSiteDetailTab('links');
		await refreshSiteDetail({ syncSettings: false });
		await loadSites();
	} catch (error) {
		toast(error.message, 'error');
	}
});

document.getElementById('clearLinksBtn').addEventListener('click', async () => {
	if (!selectedSiteId) return;
	if (!confirm('Удалить ВСЕ ссылки этого сайта?')) return;
	try {
		await api('/api/sites/' + selectedSiteId + '/links', { method: 'DELETE' });
		toast('Все ссылки удалены', 'success');
		lastLinksSignature = '';
		await refreshSiteDetail({ syncSettings: false });
		await loadSites();
		await loadUnprocessed();
	} catch (error) {
		toast(error.message, 'error');
	}
});

document.getElementById('refreshUnprocessedBtn').addEventListener('click', () => {
	loadUnprocessed().catch((e) => toast(e.message, 'error'));
});

document.getElementById('copyUnprocessedBtn').addEventListener('click', async () => {
	try {
		const data = await api('/api/unprocessed?urls=1');
		const urls = data.urls || [];
		if (!urls.length) {
			toast('Список пуст', 'error');
			return;
		}
		await navigator.clipboard.writeText(urls.join('\n'));
		toast('Скопировано ссылок: ' + urls.length, 'success');
	} catch (error) {
		toast(error.message, 'error');
	}
});

async function pollUi() {
	await checkHealth().catch(() => {});
	await loadSites().catch(() => {});
	if (currentView === 'unprocessed') {
		await loadUnprocessed().catch(() => {});
	} else {
		await loadUnprocessed({ updateTable: false }).catch(() => {});
	}

	const anyActive = sitesCache.some((site) => isActiveRun(site.last_run));
	if (anyActive) {
		setWatchCrawl(true);
	}

	if (selectedSiteId && currentView === 'sites') {
		await refreshSiteDetail({ syncSettings: false }).catch(() => {});
	} else if (!anyActive) {
		setWatchCrawl(false);
	}
}

async function boot() {
	const saved = loadUiState();
	if (saved?.linksSort) linksSort = saved.linksSort;
	if (saved?.linksOrder === 'asc' || saved?.linksOrder === 'desc') linksOrder = saved.linksOrder;
	if (saved?.linksSort === 'id') {
		linksSort = 'url_path_id';
		linksOrder = 'desc';
	}
	if (saved?.siteDetailTab) siteDetailTab = saved.siteDetailTab;
	if (saved?.linksPage) linksPage = Math.max(1, Number(saved.linksPage) || 1);
	if (typeof saved?.linksQuery === 'string') linksQuery = saved.linksQuery;
	if (saved?.unprocessedSort === 'url_year' || saved?.unprocessedSort === 'shares_total') {
		unprocessedSort = saved.unprocessedSort;
	}
	if (saved?.unprocessedOrder === 'asc' || saved?.unprocessedOrder === 'desc') {
		unprocessedOrder = saved.unprocessedOrder;
	}
	if (saved?.unprocessedPage) unprocessedPage = Math.max(1, Number(saved.unprocessedPage) || 1);

	await checkHealth();
	await loadSites();
	await loadUnprocessed();

	if (saved?.view === 'unprocessed') {
		setView('unprocessed');
	} else if (saved?.selectedSiteId && sitesCache.some((s) => s.id === saved.selectedSiteId)) {
		selectedSiteId = saved.selectedSiteId;
		syncLinksSearchInput();
		setView('sites');
		renderSites();
		await refreshSiteDetail({ syncSettings: true });
	} else {
		selectedSiteId = null;
		setView('sites');
	}

	const anyActive = sitesCache.some((site) => isActiveRun(site.last_run));
	if (anyActive) setWatchCrawl(true);
	setSiteDetailTab(siteDetailTab);
	restartPoller();
}

document.querySelectorAll('[data-site-tab]').forEach((btn) => {
	btn.addEventListener('click', () => {
		setSiteDetailTab(btn.dataset.siteTab);
	});
});

document.querySelectorAll('#linksTable .th-sort').forEach((btn) => {
	btn.addEventListener('click', async () => {
		const sort = btn.dataset.sort;
		if (!sort || !selectedSiteId) return;
		if (linksSort === sort) {
			linksOrder = linksOrder === 'asc' ? 'desc' : 'asc';
		} else {
			linksSort = sort;
			linksOrder =
				sort === 'url_path_id'
					? 'desc'
					: sort === 'url' || sort === 'last_title'
						? 'asc'
						: 'desc';
		}
		linksPage = 1;
		lastLinksSignature = '';
		saveUiState();
		await refreshSiteDetail({ syncSettings: false });
	});
});

document.querySelectorAll('#unprocessedTable .th-sort').forEach((btn) => {
	btn.addEventListener('click', () => {
		const sort = btn.dataset.unprocessedSort;
		if (!sort) return;
		if (unprocessedSort === sort) {
			unprocessedOrder = unprocessedOrder === 'asc' ? 'desc' : 'asc';
		} else {
			unprocessedSort = sort;
			unprocessedOrder = 'desc';
		}
		unprocessedPage = 1;
		saveUiState();
		loadUnprocessed().catch((error) => toast(error.message, 'error'));
	});
});

document.getElementById('unprocessedPrevBtn')?.addEventListener('click', () => {
	if (unprocessedPage <= 1) return;
	unprocessedPage -= 1;
	saveUiState();
	loadUnprocessed().catch((error) => toast(error.message, 'error'));
});

document.getElementById('unprocessedNextBtn')?.addEventListener('click', () => {
	if (unprocessedPage >= unprocessedPages) return;
	unprocessedPage += 1;
	saveUiState();
	loadUnprocessed().catch((error) => toast(error.message, 'error'));
});

document.getElementById('linksPrevBtn').addEventListener('click', async () => {
	if (linksPage <= 1 || !selectedSiteId) return;
	linksPage -= 1;
	lastLinksSignature = '';
	saveUiState();
	await refreshSiteDetail({ syncSettings: false });
});

document.getElementById('linksNextBtn').addEventListener('click', async () => {
	if (linksPage >= linksPages || !selectedSiteId) return;
	linksPage += 1;
	lastLinksSignature = '';
	saveUiState();
	await refreshSiteDetail({ syncSettings: false });
});

document.getElementById('linksSearch')?.addEventListener('input', (e) => {
	applyLinksSearch(e.target.value).catch((error) => toast(error.message, 'error'));
});

document.getElementById('linksSearch')?.addEventListener('keydown', (e) => {
	if (e.key === 'Enter') {
		e.preventDefault();
		applyLinksSearch(e.target.value, { immediate: true }).catch((error) =>
			toast(error.message, 'error')
		);
	}
});

document.getElementById('linksSearchClear')?.addEventListener('click', () => {
	applyLinksSearch('', { immediate: true }).catch((error) => toast(error.message, 'error'));
});

boot().catch((error) => toast(error.message, 'error'));
