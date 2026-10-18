const PLATFORM_KEYS = ['vk', 'ok', 'lj', 'telegram', 'wa', 'vi'];
const PLATFORM_SHORT = {
	vk: 'VK',
	ok: 'OK',
	lj: 'LJ',
	telegram: 'TG',
	wa: 'WA',
	vi: 'Viber',
};

const urlsInput = document.getElementById('urlsInput');
const urlCountHint = document.getElementById('urlCountHint');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const delayInput = document.getElementById('delayInput');
const statusBadge = document.getElementById('statusBadge');
const progressBar = document.getElementById('progressBar');
const statTotal = document.getElementById('statTotal');
const statDone = document.getElementById('statDone');
const statSuccess = document.getElementById('statSuccess');
const statFail = document.getElementById('statFail');
const currentInfo = document.getElementById('currentInfo');
const captchaHint = document.getElementById('captchaHint');
const summaryBlock = document.getElementById('summaryBlock');
const platformStats = document.getElementById('platformStats');
const distributionStats = document.getElementById('distributionStats');
const topTotalList = document.getElementById('topTotalList');
const topByPlatform = document.getElementById('topByPlatform');
const resultsBody = document.getElementById('resultsBody');
const notFoundUrlsEl = document.getElementById('notFoundUrls');
const notFoundCount = document.getElementById('notFoundCount');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const copyTableBtn = document.getElementById('copyTableBtn');
const copyNotFoundBtn = document.getElementById('copyNotFoundBtn');

const STATUS_LABELS = {
	idle: 'ожидание',
	running: 'выполняется',
	completed: 'завершено',
	stopped: 'остановлено',
};

let resolveUrlsTimer = null;
let statusPollTimer = null;
let currentJob = null;
let keepAlivePort = null;
let keepAlivePingTimer = null;

function isServiceWorkerUnavailableError(error) {
	const message = String(error?.message || error || '');
	return /no sw|receiving end does not exist|extension context invalidated|message port closed|таймаут ответа/i.test(
		message
	);
}

async function wakeServiceWorker() {
	try {
		await chrome.runtime.sendMessage({ type: 'SHARES_PING' });
	} catch {
		try {
			if (chrome.runtime.getPlatformInfo) {
				await chrome.runtime.getPlatformInfo();
			}
		} catch {}
	}
}

async function sendToBackground(message, { timeoutMs = 15000 } = {}) {
	for (let attempt = 0; attempt < 5; attempt++) {
		await wakeServiceWorker();

		try {
			const response = await Promise.race([
				new Promise((resolve, reject) => {
					try {
						chrome.runtime.sendMessage(message, (result) => {
							if (chrome.runtime.lastError) {
								reject(new Error(chrome.runtime.lastError.message));
								return;
							}
							resolve(result);
						});
					} catch (error) {
						reject(error);
					}
				}),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error('Таймаут ответа от расширения')), timeoutMs)
				),
			]);
			return response;
		} catch (error) {
			if (!isServiceWorkerUnavailableError(error)) {
				throw error;
			}
			ensureKeepAliveConnection();
			await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
		}
	}

	throw new Error('Service worker недоступен. Обновите расширение на chrome://extensions');
}

function ensureKeepAliveConnection() {
	if (keepAlivePort) return;

	try {
		keepAlivePort = chrome.runtime.connect({ name: 'shares-keepalive' });
		keepAlivePort.onDisconnect.addListener(() => {
			keepAlivePort = null;
		});
	} catch {
		keepAlivePort = null;
	}
}

function startKeepAlive() {
	stopKeepAlive();
	ensureKeepAliveConnection();
	keepAlivePingTimer = setInterval(() => {
		try {
			keepAlivePort?.postMessage({ type: 'ping' });
		} catch {
			keepAlivePort = null;
			ensureKeepAliveConnection();
		}
	}, 15000);
}

function stopKeepAlive() {
	if (keepAlivePingTimer) {
		clearInterval(keepAlivePingTimer);
		keepAlivePingTimer = null;
	}

	if (keepAlivePort) {
		try {
			keepAlivePort.disconnect();
		} catch {}
		keepAlivePort = null;
	}
}

function parseUrlList(text) {
	const urls = [];
	const seen = new Set();

	for (const line of String(text || '').split(/\r?\n/)) {
		const match = line.trim().match(/https?:\/\/[^\s<>"']+/i);
		if (!match) continue;
		const candidate = match[0].replace(/[.,;)\]]+$/, '');
		if (!seen.has(candidate)) {
			seen.add(candidate);
			urls.push(candidate);
		}
	}

	return urls;
}

function pluralizeLinks(n) {
	const mod10 = n % 10;
	const mod100 = n % 100;
	if (mod10 === 1 && mod100 !== 11) return 'ссылка';
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'ссылки';
	return 'ссылок';
}

function updateUrlCount() {
	clearTimeout(resolveUrlsTimer);

	const text = urlsInput.value.trim();
	if (!text) {
		urlCountHint.textContent = '0 ссылок';
		return;
	}

	const quickCount = parseUrlList(text).length;
	urlCountHint.textContent = quickCount + ' ' + pluralizeLinks(quickCount);

	resolveUrlsTimer = setTimeout(async () => {
		try {
			const response = await sendToBackground({
				type: 'SHARES_RESOLVE_URLS',
				payload: { urlsText: text },
			});

			if (!response?.success) return;

			const count = response.urls?.length || 0;
			let hint = count + ' ' + pluralizeLinks(count);
			if (response.sitemapsExpanded) {
				hint += ' (sitemap развёрнут)';
			}
			urlCountHint.textContent = hint;
		} catch {}
	}, 400);
}

function escapeHtml(text) {
	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function renderSummary(stats) {
	if (!stats?.summary) {
		summaryBlock.innerHTML =
			'<p class="lead">Запустите парсинг, чтобы увидеть статистику</p>';
		return;
	}

	const s = stats.summary;
	summaryBlock.innerHTML =
		'<p class="lead">Всего шарингов: <strong>' +
		s.grandTotal +
		'</strong> · Среднее на страницу: <strong>' +
		s.averagePerUrl +
		'</strong></p>' +
		'<p class="detail">Обработано ' +
		s.processed +
		' из ' +
		s.totalUrls +
		' ссылок' +
		(s.failed ? ' · ошибок: ' + s.failed : '') +
		' · Лидер среди соцсетей: <strong>' +
		escapeHtml(s.dominantPlatformLabel) +
		'</strong> (' +
		s.dominantPlatformCount +
		' шар.)</p>';
}

function renderPlatformStats(stats) {
	if (!stats?.platformTotals) {
		platformStats.innerHTML = '';
		return;
	}

	platformStats.innerHTML = PLATFORM_KEYS.map((key) => {
		const total = stats.platformTotals[key] || 0;
		const avg = stats.platformAverages?.[key] || 0;
		const label = stats.platformLabels?.[key] || key;
		return (
			'<div class="platform-card">' +
			'<div class="name">' +
			escapeHtml(label) +
			'</div>' +
			'<div class="count">' +
			total +
			'</div>' +
			'<div class="avg">среднее: ' +
			avg +
			'</div></div>'
		);
	}).join('');
}

function renderDistribution(stats) {
	const dist = stats?.distribution;
	if (!dist) {
		distributionStats.innerHTML = '';
		return;
	}

	const items = [
		{ key: 'zero', label: '0 шарингов', value: dist.zero },
		{ key: 'low', label: '1–3', value: dist.low },
		{ key: 'medium', label: '4–10', value: dist.medium },
		{ key: 'high', label: '11+', value: dist.high },
	];

	distributionStats.innerHTML = items
		.map(
			(item) =>
				'<div class="dist-item"><div class="value">' +
				item.value +
				'</div><div class="label">' +
				escapeHtml(item.label) +
				'</div></div>'
		)
		.join('');
}

function renderTopTotal(stats) {
	const top = stats?.topByTotal || [];
	if (!top.length) {
		topTotalList.innerHTML = '<li class="meta">Нет данных</li>';
		return;
	}

	topTotalList.innerHTML = top
		.map((item, index) => {
			const shares = PLATFORM_KEYS.map(
				(key) => PLATFORM_SHORT[key] + ': ' + (item.shares?.[key] || 0)
			).join(', ');
			return (
				'<li><strong>' +
				(index + 1) +
				'. ' +
				escapeHtml(item.title || 'Без названия') +
				'</strong> — <span class="total-col">' +
				item.total +
				' шар.</span><br>' +
				'<span class="meta">' +
				escapeHtml(shares) +
				'</span><br>' +
				'<a href="' +
				escapeHtml(item.url) +
				'" target="_blank" rel="noopener">' +
				escapeHtml(item.url) +
				'</a></li>'
			);
		})
		.join('');
}

function renderTopByPlatform(stats) {
	const data = stats?.topByPlatform;
	if (!data) {
		topByPlatform.innerHTML = '<p class="hint">Нет данных</p>';
		return;
	}

	topByPlatform.innerHTML = PLATFORM_KEYS.map((key) => {
		const items = data[key] || [];
		const label = stats.platformLabels?.[key] || key;
		if (!items.length) {
			return (
				'<div style="margin-bottom:14px;"><strong>' +
				escapeHtml(label) +
				'</strong><p class="hint">Нет данных</p></div>'
			);
		}

		const list = items
			.map(
				(item, index) =>
					'<li><strong>' +
					(index + 1) +
					'. ' +
					escapeHtml(item.title || 'Без названия') +
					'</strong> — ' +
					item.count +
					' шар. (всего: ' +
					item.total +
					')<br><a href="' +
					escapeHtml(item.url) +
					'" target="_blank" rel="noopener">' +
					escapeHtml(item.url) +
					'</a></li>'
			)
			.join('');

		return (
			'<div style="margin-bottom:16px;"><strong>' +
			escapeHtml(label) +
			'</strong><ol class="top-list">' +
			list +
			'</ol></div>'
		);
	}).join('');
}

function getSortedResults(results) {
	return (results || [])
		.filter((item) => item && item.ok)
		.slice()
		.sort((a, b) => b.total - a.total || (a.title || '').localeCompare(b.title || '', 'ru'));
}

function renderResultsTable(job) {
	const okItems = getSortedResults(job.results);
	const failItems = (job.results || []).filter((item) => item && !item.ok);

	if (!okItems.length && !failItems.length) {
		resultsBody.innerHTML =
			'<tr><td colspan="10" style="text-align:center;color:#888;">Нет результатов</td></tr>';
		return;
	}

	let html = '';
	let index = 1;

	for (const item of okItems) {
		html +=
			'<tr class="ok">' +
			'<td>' +
			index++ +
			'</td>' +
			'<td>' +
			escapeHtml(item.title || '—') +
			'</td>' +
			'<td><a href="' +
			escapeHtml(item.url) +
			'" target="_blank" rel="noopener">' +
			escapeHtml(item.url) +
			'</a></td>';

		for (const key of PLATFORM_KEYS) {
			html += '<td class="num">' + (item.shares?.[key] || 0) + '</td>';
		}

		html += '<td class="num total-col">' + (item.total || 0) + '</td></tr>';
	}

	for (const item of failItems) {
		html +=
			'<tr class="fail">' +
			'<td>—</td>' +
			'<td colspan="2">' +
			escapeHtml(item.title || item.error || 'Ошибка') +
			'<br><a href="' +
			escapeHtml(item.url) +
			'" target="_blank" rel="noopener">' +
			escapeHtml(item.url) +
			'</a></td>' +
			'<td colspan="7" style="color:#c62828;">' +
			escapeHtml(item.error || 'Ошибка') +
			'</td></tr>';
	}

	resultsBody.innerHTML = html;
}

function renderNotFound(job) {
	const items = job.notFoundUrls || [];
	const text = typeof getNotFoundUrlsText === 'function' ? getNotFoundUrlsText(job) : '';
	notFoundUrlsEl.value = text;
	notFoundCount.textContent = '(' + items.length + ')';
	captchaHint.classList.toggle('visible', Boolean(job.waitingCaptcha));
}

function renderJobStats(job) {
	const total = job.urls?.length || 0;
	const done = job.currentIndex || 0;
	const percent = total > 0 ? Math.round((done / total) * 100) : 0;

	statusBadge.textContent = STATUS_LABELS[job.status] || job.status;
	statusBadge.className = 'status-badge status-' + (job.status || 'idle');

	progressBar.style.width = percent + '%';
	progressBar.textContent = percent + '%';

	statTotal.textContent = total;
	statDone.textContent = done;
	statSuccess.textContent = job.successCount || 0;
	statFail.textContent = job.failCount || 0;

	const isRunning = job.status === 'running';
	startBtn.disabled = isRunning;
	stopBtn.disabled = !isRunning;

	if (job.waitingCaptcha && job.lastUrl) {
		currentInfo.textContent = 'Ожидание «Я не робот»: ' + job.lastUrl;
	} else if (job.lastTitle || job.lastUrl) {
		const parts = [];
		if (job.lastTitle) parts.push('«' + job.lastTitle + '»');
		if (job.lastUrl) parts.push(job.lastUrl);
		currentInfo.textContent = parts.join(' — ');
	} else {
		currentInfo.textContent = '';
	}

	configureStatusPolling(job.status);
}

function renderStatistics(job) {
	const stats = job.statistics || computeSharesStatistics(job.results || []);
	renderSummary(stats);
	renderPlatformStats(stats);
	renderDistribution(stats);
	renderTopTotal(stats);
	renderTopByPlatform(stats);
}

function renderJob(job) {
	currentJob = job;
	renderJobStats(job);
	renderNotFound(job);
	renderStatistics(job);
	renderResultsTable(job);
}

function configureStatusPolling(status) {
	if (statusPollTimer) {
		clearInterval(statusPollTimer);
		statusPollTimer = null;
	}

	if (status === 'running') {
		startKeepAlive();
		statusPollTimer = setInterval(refreshStatus, 3000);
	} else {
		stopKeepAlive();
	}
}

async function refreshStatus() {
	try {
		const response = await sendToBackground({ type: 'SHARES_GET_STATUS' });
		if (response?.success && response.job) {
			renderJob(response.job);
		}
	} catch (error) {
		console.warn('[Shares UI] status refresh failed:', error);
	}
}

function buildExportFilename(extension) {
	const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
	return 'shares-stats-' + stamp + '.' + extension;
}

function downloadTextFile(filename, content, mimeType) {
	const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

function exportJson() {
	const results = currentJob?.results || [];
	if (!results.length) {
		alert('Нет данных для экспорта');
		return;
	}

	const stats = currentJob?.statistics || computeSharesStatistics(results);
	downloadTextFile(
		buildExportFilename('json'),
		JSON.stringify(
			{
				exportedAt: new Date().toISOString(),
				jobStatus: currentJob?.status || 'unknown',
				statistics: stats,
				results,
				notFoundUrls: currentJob?.notFoundUrls || [],
			},
			null,
			2
		),
		'application/json;charset=utf-8'
	);
}

function buildTsvRows(results) {
	const header = ['title', 'url', ...PLATFORM_KEYS, 'total', 'ok', 'error'];
	const rows = [header.join('\t')];

	for (const item of results || []) {
		rows.push(
			[
				item.title || '',
				item.url || '',
				...PLATFORM_KEYS.map((key) => item.shares?.[key] || 0),
				item.total || 0,
				item.ok ? '1' : '0',
				item.error || '',
			]
				.map((value) => String(value).replace(/\t/g, ' '))
				.join('\t')
		);
	}

	return rows.join('\n');
}

function exportCsv() {
	const results = currentJob?.results || [];
	if (!results.length) {
		alert('Нет данных для экспорта');
		return;
	}

	const header = ['title', 'url', ...PLATFORM_KEYS, 'total', 'ok', 'error'];
	const lines = [header.join(',')];

	for (const item of results) {
		const row = [
			item.title || '',
			item.url || '',
			...PLATFORM_KEYS.map((key) => item.shares?.[key] || 0),
			item.total || 0,
			item.ok ? '1' : '0',
			item.error || '',
		].map((value) => '"' + String(value).replace(/"/g, '""') + '"');
		lines.push(row.join(','));
	}

	downloadTextFile(buildExportFilename('csv'), lines.join('\n'), 'text/csv;charset=utf-8');
}

async function copyTableTsv() {
	const text = buildTsvRows(currentJob?.results || []);
	if (!text || text.split('\n').length <= 1) {
		alert('Нет данных для копирования');
		return;
	}
	await navigator.clipboard.writeText(text);
}

async function copyNotFoundUrls() {
	const text = notFoundUrlsEl.value.trim();
	if (!text) {
		alert('Нет необработанных ссылок');
		return;
	}
	await navigator.clipboard.writeText(text);
}

startBtn.addEventListener('click', async () => {
	const urlsText = urlsInput.value.trim();
	if (!urlsText) {
		alert('Вставьте список ссылок');
		return;
	}

	startBtn.disabled = true;

	try {
		const response = await sendToBackground({
			type: 'SHARES_START',
			payload: {
				urlsText,
				delayMs: Number(delayInput.value) || 0,
			},
		});

		if (!response?.success) {
			throw new Error(response?.error || 'Не удалось запустить');
		}

		await refreshStatus();
	} catch (error) {
		alert('Ошибка: ' + error.message);
		startBtn.disabled = false;
	}
});

stopBtn.addEventListener('click', async () => {
	stopBtn.disabled = true;
	await sendToBackground({ type: 'SHARES_STOP' });
	await refreshStatus();
});

clearBtn.addEventListener('click', async () => {
	if (!confirm('Сбросить прогресс и остановить задачу?')) return;
	await sendToBackground({ type: 'SHARES_CLEAR' });
	await refreshStatus();
});

exportJsonBtn.addEventListener('click', exportJson);
exportCsvBtn.addEventListener('click', exportCsv);
copyTableBtn.addEventListener('click', copyTableTsv);
copyNotFoundBtn.addEventListener('click', copyNotFoundUrls);
urlsInput.addEventListener('input', updateUrlCount);

chrome.runtime.onMessage.addListener((message) => {
	if (message.type === 'SHARES_PROGRESS' && message.job) {
		renderJob(message.job);
	}
});

chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== 'local' || !changes.sharesParseJob) return;
	const job = changes.sharesParseJob.newValue;
	if (job) {
		renderJob(job);
	}
});

updateUrlCount();
refreshStatus();
