const urlsInput = document.getElementById('urlsInput');
const urlCountHint = document.getElementById('urlCountHint');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const exportLogsJsonBtn = document.getElementById('exportLogsJsonBtn');
const exportLogsTxtBtn = document.getElementById('exportLogsTxtBtn');
const updatePlaylistCheck = document.getElementById('updatePlaylistCheck');
const sourceSelect = document.getElementById('sourceSelect');
const delayInput = document.getElementById('delayInput');
const statusBadge = document.getElementById('statusBadge');
const progressBar = document.getElementById('progressBar');
const statTotal = document.getElementById('statTotal');
const statDone = document.getElementById('statDone');
const statSuccess = document.getElementById('statSuccess');
const statFail = document.getElementById('statFail');
const currentInfo = document.getElementById('currentInfo');
const errorsList = document.getElementById('errorsList');
const lastRequestDetails = document.getElementById('lastRequestDetails');
const lastApiMeta = document.getElementById('lastApiMeta');
const lastApiRequest = document.getElementById('lastApiRequest');
const lastApiResponse = document.getElementById('lastApiResponse');
const logsList = document.getElementById('logsList');
const notFoundUrlsEl = document.getElementById('notFoundUrls');
const notFoundCount = document.getElementById('notFoundCount');
const captchaHint = document.getElementById('captchaHint');
const copyNotFoundBtn = document.getElementById('copyNotFoundBtn');
const addNotFoundBtn = document.getElementById('addNotFoundBtn');
const exportNotFoundBtn = document.getElementById('exportNotFoundBtn');

const STATUS_LABELS = {
	idle: 'ожидание',
	running: 'выполняется',
	completed: 'завершено',
	stopped: 'остановлено',
};

let resolveUrlsTimer = null;
let statusPollTimer = null;
let currentJob = null;
let lastLogsRenderKey = '';
let lastErrorsRenderKey = '';
let lastNotFoundRenderKey = '';
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
		await chrome.runtime.sendMessage({ type: 'BULK_PING' });
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
					setTimeout(
						() => reject(new Error('Таймаут ответа от расширения')),
						timeoutMs
					)
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
		keepAlivePort = chrome.runtime.connect({ name: 'bulk-keepalive' });
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

function needsSitemapResolve(text) {
	const trimmed = String(text || '').trim();
	if (!trimmed) return false;
	if (typeof isSitemapXmlContent === 'function' && isSitemapXmlContent(trimmed)) {
		return true;
	}

	return trimmed.split(/\r?\n/).some((line) => {
		const match = line.trim().match(/https?:\/\/[^\s<>"']+/i);
		const candidate = (match ? match[0] : line.trim()).replace(/[.,;)\]]+$/, '');
		return typeof isSitemapUrl === 'function' && isSitemapUrl(candidate);
	});
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

	if (!needsSitemapResolve(text)) {
		return;
	}

	urlCountHint.textContent = quickCount + ' ' + pluralizeLinks(quickCount) + ' (подсчёт sitemap…)';

	resolveUrlsTimer = setTimeout(async () => {
		try {
			const response = await sendToBackground({
				type: 'BULK_RESOLVE_URLS',
				payload: { urlsText: text },
			});

			if (!response?.success) {
				urlCountHint.textContent = quickCount + ' ' + pluralizeLinks(quickCount);
				return;
			}

			const count = response.urls?.length || 0;
			let hint = count + ' ' + pluralizeLinks(count);
			if (response.sitemapsExpanded) {
				hint += ' (sitemap развёрнут)';
			}
			urlCountHint.textContent = hint;
		} catch {
			urlCountHint.textContent = quickCount + ' ' + pluralizeLinks(quickCount);
		}
	}, 400);
}

function pluralizeLinks(n) {
	const mod10 = n % 10;
	const mod100 = n % 100;
	if (mod10 === 1 && mod100 !== 11) return 'ссылка';
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'ссылки';
	return 'ссылок';
}

function formatApiUrl(url) {
	if (!url) return '';
	try {
		const parsed = new URL(url);
		const lines = [`${parsed.origin}${parsed.pathname}`];
		for (const [key, value] of parsed.searchParams.entries()) {
			if (key === 'playlist') {
				try {
					const items = JSON.parse(value);
					const stats = countPlaylistItems(items);
					if (stats.sources > 1) {
						lines.push(
							`playlist (${stats.sources} источн., ${stats.episodes} эп.): ${JSON.stringify(items, null, 2)}`
						);
					} else {
						lines.push(`playlist (${stats.episodes} эп.): ${JSON.stringify(items, null, 2)}`);
					}
				} catch {
					lines.push(`playlist: ${value}`);
				}
			} else if (key === 'russians_parse') {
				lines.push(`${key}: ${value}`);
			} else {
				lines.push(`${key}: ${value}`);
			}
		}
		return lines.join('\n');
	} catch {
		return url;
	}
}

function saveDetailsOpenState(container) {
	const state = {};
	if (!container) return state;
	container.querySelectorAll('details').forEach((el) => {
		const id = el.getAttribute('data-details-id');
		if (id) state[id] = el.open;
	});
	return state;
}

function restoreDetailsOpenState(container, state) {
	if (!container || !state) return;
	container.querySelectorAll('details').forEach((el) => {
		const id = el.getAttribute('data-details-id');
		if (id && state[id]) el.open = true;
	});
}

function getLogsRenderKey(logs) {
	if (!logs?.length) return '0';
	const last = logs[logs.length - 1];
	return logs.length + ':' + (last.at || 0) + ':' + (last.ok ? '1' : '0');
}

function getErrorsRenderKey(errors) {
	if (!errors?.length) return '0';
	const last = errors[errors.length - 1];
	return errors.length + ':' + (last.at || 0);
}

function renderLink(label, url) {
	if (!url) return '';
	return (
		'<div class="log-link">' +
		escapeHtml(label) +
		': <a href="' +
		escapeHtml(url) +
		'" target="_blank" rel="noopener">' +
		escapeHtml(url) +
		'</a></div>'
	);
}

function renderLastApiRequest(job) {
	if (!job.lastApiRequest) {
		lastRequestDetails.classList.add('hidden');
		lastApiRequest.textContent = '';
		lastApiResponse.textContent = '';
		lastApiMeta.textContent = '';
		return;
	}

	lastRequestDetails.classList.remove('hidden');
	const meta = [];
	if (job.updatePlaylist) {
		meta.push('playlist: включён');
		meta.push('эпизодов в запросе: ' + (job.lastPlaylistCount || 0));
		if (job.lastPlaylistSources > 1) {
			meta.push('источников: ' + job.lastPlaylistSources);
		}
	} else {
		meta.push('playlist: выключен');
	}
	lastApiMeta.textContent = meta.join(' · ');
	lastApiRequest.textContent = formatApiUrl(job.lastApiRequest);
	lastApiResponse.textContent =
		job.lastApiResponse ||
		(job.lastApiResult ? formatApiResultForDisplay(job.lastApiResult) : '(пустой ответ)');
}

function renderLogs(job, force = false) {
	const logs = job.logs || [];
	const renderKey = getLogsRenderKey(logs);

	if (!force && renderKey === lastLogsRenderKey) {
		return;
	}

	lastLogsRenderKey = renderKey;

	if (!logs.length) {
		logsList.textContent = 'Пока нет записей';
		return;
	}

	const openState = saveDetailsOpenState(logsList);

	logsList.innerHTML = logs
		.slice()
		.reverse()
		.map((item, index) => {
			const api = item.apiResult || {};
			const statusClass = item.ok ? 'ok' : 'fail';
			const statusText = item.ok ? 'успех' : 'ошибка';
			const title = api.title || item.title || item.sourceUrl || '—';
			const message = item.ok
				? (api.message || 'Обновлено') +
					(item.attempts > 1 ? ` (попыток: ${item.attempts})` : '')
				: (item.error || api.message || 'Ошибка') +
					(item.attempts > 1 ? ` (попыток: ${item.attempts})` : '');
			const newsUrl = api.news_url || (api.news_urls && api.news_urls[0]) || '';
			const newsIds = Array.isArray(api.news_ids) ? api.news_ids.join(', ') : '';
			const russiansParse = api.russians_parse || item.sourceUrl || '';
			const logId = 'log-' + (item.at || index);

			let html =
				'<div class="log-item ' +
				statusClass +
				'">' +
				'<div class="log-head">' +
				'<span class="log-title">' +
				escapeHtml(title) +
				'</span>' +
				'<span class="log-meta">' +
				escapeHtml(statusText) +
				'</span>' +
				'</div>' +
				'<div class="log-message">' +
				escapeHtml(message) +
				'</div>';

			if (newsUrl) {
				html += renderLink('news_url', newsUrl);
			}

			if (newsIds) {
				html += '<div class="log-meta">news_id: ' + escapeHtml(newsIds) + '</div>';
			}

			if (russiansParse) {
				html += renderLink('russians_parse', russiansParse);
			}

			if (item.apiResponse || item.apiResult) {
				html +=
					'<details class="error-spoiler" data-details-id="' +
					logId +
					'-response"><summary>Ответ API (JSON)</summary><pre>' +
					escapeHtml(
						item.apiResponse ||
							formatApiResultForDisplay(item.apiResult) ||
							''
					) +
					'</pre></details>';
			}

			if (item.apiRequest) {
				html +=
					'<details class="error-spoiler" data-details-id="' +
					logId +
					'-request"><summary>Запрос к API</summary><pre>' +
					escapeHtml(formatApiUrl(item.apiRequest)) +
					'</pre></details>';
			}

			html += '</div>';
			return html;
		})
		.join('');

	restoreDetailsOpenState(logsList, openState);
}

function renderErrors(job, force = false) {
	const errors = job.errors || [];
	const renderKey = getErrorsRenderKey(errors);

	if (!force && renderKey === lastErrorsRenderKey) {
		return;
	}

	lastErrorsRenderKey = renderKey;

	if (!errors.length) {
		errorsList.textContent = 'Нет ошибок';
		return;
	}

	const openState = saveDetailsOpenState(errorsList);

	errorsList.innerHTML = errors
		.slice()
		.reverse()
		.map((item, index) => {
			const errorId = 'error-' + (item.at || index);
			let html =
				'<div class="error-item">' +
				renderLink('url', item.url) +
				'<br>' +
				escapeHtml(item.error);

			if (item.apiRequest) {
				html +=
					'<details class="error-spoiler" data-details-id="' +
					errorId +
					'-request"><summary>Запрос к API</summary>' +
					'<pre>' +
					escapeHtml(formatApiUrl(item.apiRequest)) +
					'</pre>';
				if (item.apiResponse) {
					html +=
						'<pre style="margin-top:6px;">' +
						escapeHtml(item.apiResponse) +
						'</pre>';
				}
				if (item.apiResult) {
					html +=
						'<pre style="margin-top:6px;">' +
						escapeHtml(formatApiResultForDisplay(item.apiResult)) +
						'</pre>';
				}
				html += '</details>';
			}

			html += '</div>';
			return html;
		})
		.join('');

	restoreDetailsOpenState(errorsList, openState);
}

function getNotFoundRenderKey(items) {
	if (!items?.length) return '0';
	const last = items[items.length - 1];
	return items.length + ':' + (last.at || 0) + ':' + (last.url || '');
}

function renderNotFoundUrls(job, force = false) {
	const items = job.notFoundUrls || [];
	const renderKey = getNotFoundRenderKey(items);

	if (!force && renderKey === lastNotFoundRenderKey) {
		captchaHint.classList.toggle('visible', Boolean(job.waitingCaptcha));
		return;
	}

	lastNotFoundRenderKey = renderKey;
	const text = getNotFoundUrlsText(job);
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

	renderLastApiRequest(job);
	configureStatusPolling(job.status);
}

function renderJob(job, options = {}) {
	currentJob = job;
	renderJobStats(job);
	renderNotFoundUrls(job, options.force);
	renderLogs(job, options.force);
	renderErrors(job, options.force);
}

function escapeHtml(text) {
	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
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

function buildLogsExportFilename(extension) {
	const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
	return 'bulk-update-log-' + stamp + '.' + extension;
}

function exportLogsAsJson() {
	const logs = currentJob?.logs || [];
	if (!logs.length) {
		alert('Лог пуст — нечего экспортировать');
		return;
	}

	downloadTextFile(
		buildLogsExportFilename('json'),
		JSON.stringify(
			{
				exportedAt: new Date().toISOString(),
				jobStatus: currentJob?.status || 'unknown',
				successCount: currentJob?.successCount || 0,
				failCount: currentJob?.failCount || 0,
				notFoundUrls: currentJob?.notFoundUrls || [],
				logs,
			},
			null,
			2
		),
		'application/json;charset=utf-8'
	);
}

function exportLogsAsTxt() {
	const logs = currentJob?.logs || [];
	if (!logs.length) {
		alert('Лог пуст — нечего экспортировать');
		return;
	}

	const lines = logs.map((item, index) => {
		const api = item.apiResult || {};
		const parts = [
			'#' + (index + 1),
			item.ok ? 'OK' : 'FAIL',
			'at: ' + new Date(item.at || Date.now()).toISOString(),
			'title: ' + (api.title || item.title || ''),
			'message: ' + (item.ok ? api.message || 'Обновлено' : item.error || api.message || ''),
			'russians_parse: ' + (api.russians_parse || item.sourceUrl || ''),
			'news_url: ' + (api.news_url || ''),
			'news_ids: ' + (Array.isArray(api.news_ids) ? api.news_ids.join(', ') : ''),
		];

		if (item.apiRequest) {
			parts.push('request:\n' + formatApiUrl(item.apiRequest));
		}
		if (item.apiResponse) {
			parts.push('response:\n' + item.apiResponse);
		}

		return parts.filter(Boolean).join('\n');
	});

	downloadTextFile(
		buildLogsExportFilename('txt'),
		lines.join('\n\n' + '-'.repeat(60) + '\n\n'),
		'text/plain;charset=utf-8'
	);
}

function exportNotFoundUrls() {
	const items = currentJob?.notFoundUrls || [];
	if (!items.length) {
		alert('Нет необработанных ссылок');
		return;
	}

	downloadTextFile(
		buildLogsExportFilename('not-found.txt'),
		getNotFoundUrlsText(currentJob),
		'text/plain;charset=utf-8'
	);
}

async function copyNotFoundUrls() {
	const text = getNotFoundUrlsText(currentJob);
	if (!text) {
		alert('Нет необработанных ссылок');
		return;
	}
	await navigator.clipboard.writeText(text);
}

function addNotFoundToInput() {
	const text = getNotFoundUrlsText(currentJob);
	if (!text) {
		alert('Нет необработанных ссылок');
		return;
	}

	const current = urlsInput.value.trim();
	urlsInput.value = current ? current + '\n' + text : text;
	updateUrlCount();
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
		const response = await sendToBackground({ type: 'BULK_GET_STATUS' });
		if (response?.success && response.job) {
			renderJob(response.job);
		}
	} catch (error) {
		console.warn('[Bulk UI] status refresh failed:', error);
	}
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
			type: 'BULK_START',
			payload: {
				urlsText,
				updatePlaylist: updatePlaylistCheck.checked,
				sourceId: sourceSelect.value,
				delayMs: Number(delayInput.value) || 0,
			},
		});

		if (!response?.success) {
			throw new Error(response?.error || 'Не удалось запустить');
		}

		lastLogsRenderKey = '';
		lastErrorsRenderKey = '';
		lastNotFoundRenderKey = '';
		await refreshStatus();
	} catch (error) {
		alert('Ошибка: ' + error.message);
		startBtn.disabled = false;
	}
});

stopBtn.addEventListener('click', async () => {
	stopBtn.disabled = true;
	await sendToBackground({ type: 'BULK_STOP' });
	await refreshStatus();
});

clearBtn.addEventListener('click', async () => {
	if (!confirm('Сбросить прогресс и остановить задачу?')) return;
	await sendToBackground({ type: 'BULK_CLEAR' });
	lastLogsRenderKey = '';
	lastErrorsRenderKey = '';
	await refreshStatus();
});

exportLogsJsonBtn.addEventListener('click', exportLogsAsJson);
exportLogsTxtBtn.addEventListener('click', exportLogsAsTxt);
copyNotFoundBtn.addEventListener('click', copyNotFoundUrls);
addNotFoundBtn.addEventListener('click', addNotFoundToInput);
exportNotFoundBtn.addEventListener('click', exportNotFoundUrls);

urlsInput.addEventListener('input', updateUrlCount);

chrome.runtime.onMessage.addListener((message) => {
	if (message.type === 'BULK_PROGRESS' && message.job) {
		renderJob(message.job);
	}
});

chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== 'local' || !changes.bulkUpdateJob) return;
	const job = changes.bulkUpdateJob.newValue;
	if (job) {
		renderJob(job);
	}
});

updateUrlCount();
refreshStatus();
