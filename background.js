importScripts(
	'lib/dom-utils.js',
	'lib/storage.js',
	'lib/poster-fetch.js',
	'lib/page-world-actions.js',
	'lib/parsers/playlist.js',
	'lib/bulk-update.js',
	'lib/shares-parse.js',
	'lib/catalog-client.js'
);

const BULK_CAPTCHA_WAIT_MS = 5 * 60 * 1000;
const BULK_CAPTCHA_POLL_MS = 1500;
const BULK_CAPTCHA_CLICK_INTERVAL_MS = 1500;
const BULK_AMBIGUOUS_PAGE_MS = 2500;
const BULK_AMBIGUOUS_POLL_MS = 200;
const BULK_CONTENT_AFTER_CAPTCHA_MS = 8000;
const SHARES_WIDGET_WAIT_MS = 12000;
const BULK_BLOCKED_RETRY_ATTEMPTS = 4;
const BULK_DENIED_RETRY_DELAY_MS = 2500;
const BULK_WATCHDOG_ALARM = 'bulk-watchdog';
const SHARES_WATCHDOG_ALARM = 'shares-watchdog';
const CATALOG_POLL_ALARM = 'catalog-poll';

let bulkHeartbeatTimer = null;
let sharesHeartbeatTimer = null;
let catalogPollInFlight = false;

const PARSER_FILES = [
	'lib/dom-utils.js',
	'lib/sources.js',
	'lib/parsers/playlist.js',
	'lib/parsers/metadata-russian-seriali.js',
	'lib/parsers/metadata-rosserial.js',
	'lib/parsers/metadata.js',
];

function isBlankOrInternalUrl(url) {
	const value = String(url || '');
	return (
		!value ||
		value === 'about:blank' ||
		value.startsWith('chrome://') ||
		value.startsWith('chrome-extension://') ||
		value.startsWith('edge://')
	);
}

function urlsMatchForLoad(actualUrl, expectedUrl) {
	if (!expectedUrl) return !isBlankOrInternalUrl(actualUrl);
	try {
		const actual = new URL(actualUrl);
		const expected = new URL(expectedUrl);
		return actual.origin === expected.origin && actual.pathname === expected.pathname;
	} catch {
		return String(actualUrl || '').startsWith(String(expectedUrl).split('#')[0]);
	}
}

function waitForTabLoad(tabId, timeoutMs = 30000, expectedUrl = '') {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			chrome.tabs.onUpdated.removeListener(listener);
			reject(new Error('Timeout waiting for page load'));
		}, timeoutMs);

		function done() {
			clearTimeout(timer);
			chrome.tabs.onUpdated.removeListener(listener);
			resolve();
		}

		function isReady(tab) {
			if (!tab || tab.status !== 'complete') return false;
			if (expectedUrl) {
				return urlsMatchForLoad(tab.url, expectedUrl);
			}
			return !isBlankOrInternalUrl(tab.url);
		}

		function listener(updatedTabId, changeInfo, tab) {
			if (updatedTabId !== tabId) return;
			if (changeInfo.status === 'complete' || changeInfo.url) {
				chrome.tabs.get(tabId, (fresh) => {
					if (chrome.runtime.lastError) return;
					if (isReady(fresh || tab)) done();
				});
			}
		}

		chrome.tabs.onUpdated.addListener(listener);

		chrome.tabs.get(tabId, (tab) => {
			if (chrome.runtime.lastError) {
				clearTimeout(timer);
				chrome.tabs.onUpdated.removeListener(listener);
				reject(new Error(chrome.runtime.lastError.message));
				return;
			}
			if (isReady(tab)) {
				done();
			}
		});
	});
}

async function navigateWorkerTab(tabId, url, timeoutMs = 45000) {
	await chrome.tabs.update(tabId, { url, active: false });
	// Даём навигации стартовать, иначе waitForTabLoad может поймать старый complete у about:blank
	await new Promise((resolve) => setTimeout(resolve, 100));
	await waitForTabLoad(tabId, timeoutMs, url);
}

async function ensureWorkerTab(currentTabId, url, { active = false } = {}) {
	if (currentTabId) {
		try {
			const existing = await chrome.tabs.get(currentTabId);
			if (existing) {
				await navigateWorkerTab(currentTabId, url);
				return currentTabId;
			}
		} catch {
			// tab was closed
		}
	}

	const tab = await chrome.tabs.create({ url, active });
	try {
		await waitForTabLoad(tab.id, 45000, url);
		return tab.id;
	} catch (error) {
		// The caller cannot clean up a tab whose ID was never returned.
		await chrome.tabs.remove(tab.id).catch(() => {});
		throw error;
	}
}

async function runParserOnTab(tabId, sourceId = 'auto') {
	await chrome.scripting.executeScript({
		target: { tabId },
		files: PARSER_FILES,
	});

	const results = await chrome.scripting.executeScript({
		target: { tabId },
		func: (forcedSourceId) => parseFullMedia(forcedSourceId),
		args: [sourceId],
	});

	const data = results[0]?.result;
	if (!data) {
		throw new Error('Parser returned empty result');
	}
	if (data.error) {
		throw new Error(data.error);
	}
	return data;
}

async function getOrCreateSourceTab({ sourceType, sourceUrl, currentTabId }) {
	if (sourceType === 'current') {
		if (!currentTabId) {
			throw new Error('No active tab found');
		}
		return { tabId: currentTabId, created: false };
	}

	if (!sourceUrl) {
		throw new Error('URL for parsing is required');
	}

	const tab = await chrome.tabs.create({ url: sourceUrl, active: false });
	try {
		await waitForTabLoad(tab.id);
		return { tabId: tab.id, created: true };
	} catch (error) {
		// handleFullParse receives the tab ID only after this promise resolves.
		await chrome.tabs.remove(tab.id).catch(() => {});
		throw error;
	}
}

async function handleFullParse({ sourceType, sourceUrl, adminUrl, currentTabId, sourceId = 'auto' }) {
	const targetAdminUrl = adminUrl || (await getDefaultAdminUrl());
	if (!targetAdminUrl) {
		throw new Error('Admin URL not configured. Open extension settings.');
	}

	const { tabId, created } = await getOrCreateSourceTab({
		sourceType,
		sourceUrl,
		currentTabId,
	});

	try {
		const parsedData = await runParserOnTab(tabId, sourceId);
		const enrichedData = await enrichWithPosterImage(parsedData);

		if (!enrichedData.title && !enrichedData.playlist?.length) {
			throw new Error('No data found on page. Check page structure.');
		}

		await saveParsedData(enrichedData, targetAdminUrl);

		if (sourceUrl) {
			await saveSettings({ lastParseUrl: sourceUrl });
		}

		const adminTab = await chrome.tabs.create({ url: targetAdminUrl, active: true });

		if (created) {
			await chrome.tabs.remove(tabId).catch(() => {});
		}

		return {
			success: true,
			adminTabId: adminTab.id,
			title: enrichedData.title,
		};
	} catch (error) {
		if (created) {
			await chrome.tabs.remove(tabId).catch(() => {});
		}
		throw error;
	}
}

const BULK_WORKER_TAB_STORAGE_KEY = 'bulkWorkerTabId';
const SHARES_WORKER_TAB_STORAGE_KEY = 'sharesWorkerTabId';

async function restoreWorkerTabId(kind) {
	const key = kind === 'shares' ? SHARES_WORKER_TAB_STORAGE_KEY : BULK_WORKER_TAB_STORAGE_KEY;
	const stored = await chrome.storage.session.get(key).catch(() => ({}));
	const id = Number(stored[key]);
	if (!Number.isInteger(id) || id <= 0) return null;
	try {
		await chrome.tabs.get(id);
		return id;
	} catch {
		await chrome.storage.session.remove(key).catch(() => {});
		return null;
	}
}

async function rememberWorkerTabId(kind, id) {
	const key = kind === 'shares' ? SHARES_WORKER_TAB_STORAGE_KEY : BULK_WORKER_TAB_STORAGE_KEY;
	if (id) await chrome.storage.session.set({ [key]: id });
	else await chrome.storage.session.remove(key);
}

let bulkWorkerTabId = null;
let bulkProcessing = false;
let bulkStopRequested = false;

let sharesWorkerTabId = null;
let sharesProcessing = false;
let sharesStopRequested = false;

const SOCIAL_SHARES_PARSER_FILES = ['lib/parsers/social-shares.js'];

function createFailedPageState() {
	return {
		ok: false,
		captcha: false,
		blocked: false,
		blockedKind: '',
		hasTitle: false,
		hasContent: false,
		ready: false,
	};
}

async function runCaptchaWorldScript(tabId, runner, world = 'ISOLATED') {
	await chrome.scripting.executeScript({
		target: { tabId },
		files: ['lib/captcha-wait.js'],
		world,
	});

	const [result] = await chrome.scripting.executeScript({
		target: { tabId },
		world,
		func: runner,
	});

	return result?.result;
}

async function quickPageReadyCheck(tabId) {
	try {
		const result = await runCaptchaWorldScript(tabId, () => checkPageParseReady());
		return result || createFailedPageState();
	} catch (error) {
		console.warn('[Bulk] quick ready check failed:', error);
		return createFailedPageState();
	}
}

async function runCaptchaCheck(tabId) {
	try {
		const result = await runCaptchaWorldScript(tabId, () => checkPageParseReady());
		return result || createFailedPageState();
	} catch (error) {
		console.warn('[Bulk] captcha check failed:', error);
		return createFailedPageState();
	}
}

async function runCaptchaClick(tabId) {
	try {
		const tab = await chrome.tabs.get(tabId);
		await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
		await chrome.tabs.update(tabId, { active: true });
		await new Promise((resolve) => setTimeout(resolve, 350));

		const clickResult =
			(await runCaptchaWorldScript(
				tabId,
				() => {
					if (typeof clickRobotChallengeButton !== 'function') {
						return { clicked: false, reason: 'handler-missing' };
					}
					return clickRobotChallengeButton();
				},
				'MAIN'
			)) || { clicked: false };

		if (!clickResult.clicked) {
			const [fallback] = await chrome.scripting.executeScript({
				target: { tabId },
				world: 'MAIN',
				func: () => {
					const el = document.createElement('script');
					el.textContent = `(function(){
						function norm(t){return (t||'').replace(/\\s+/g,' ').trim();}
						var nodes = document.querySelectorAll('.block2 [onclick], .block2 div, #content div, div[onclick]');
						for (var i = 0; i < nodes.length; i++) {
							var node = nodes[i];
							if (!/я\\s*не\\s*робот/i.test(norm(node.textContent))) continue;
							if (norm(node.textContent).length > 40) continue;
							var r = node.getBoundingClientRect();
							if (r.width < 20 || r.height < 10) continue;
							try {
								if (typeof node.onclick === 'function') { node.onclick.call(node, new MouseEvent('click', {bubbles:true})); window.__robotClick = {clicked:true, method:'inject-native'}; return; }
								var code = node.getAttribute('onclick');
								if (code) { eval(code); window.__robotClick = {clicked:true, method:'inject-eval'}; return; }
								node.click();
								window.__robotClick = {clicked:true, method:'inject-click'};
								return;
							} catch (e) {
								window.__robotClick = {clicked:false, error: String(e)};
								return;
							}
						}
						window.__robotClick = {clicked:false, reason:'inject-not-found'};
					})();`;
					document.documentElement.appendChild(el);
					el.remove();
					return window.__robotClick || { clicked: false, reason: 'inject-empty' };
				},
			});
			return fallback?.result || clickResult;
		}

		return clickResult;
	} catch (error) {
		console.warn('[Bulk] captcha click failed:', error);
		return { clicked: false, reason: String(error?.message || error) };
	}
}

async function closeBulkWorkerTab() {
	if (!bulkWorkerTabId) return;
	await chrome.tabs.remove(bulkWorkerTabId).catch(() => {});
	bulkWorkerTabId = null;
}

function getCaptchaWorkerContext(kind = 'bulk') {
	if (kind === 'shares') {
		return {
			kind: 'shares',
			logPrefix: '[Shares]',
			isStopRequested: () => sharesStopRequested,
			touchHeartbeat: touchSharesHeartbeat,
			clearWaitingFlag: clearSharesCaptchaWaitingFlag,
			setWaitingFlag: async () => {
				const job = await getSharesJob();
				job.waitingCaptcha = true;
				await saveSharesJob(job);
				notifySharesProgress(job);
			},
		};
	}

	return {
		kind: 'bulk',
		logPrefix: '[Bulk]',
		isStopRequested: () => bulkStopRequested,
		touchHeartbeat: touchBulkHeartbeat,
		clearWaitingFlag: clearCaptchaWaitingFlag,
		setWaitingFlag: async () => {
			const job = await getBulkJob();
			job.waitingCaptcha = true;
			await saveBulkJob(job);
			notifyBulkProgress(job);
		},
	};
}

async function clearCaptchaWaitingFlag() {
	const job = await getBulkJob();
	if (!job.waitingCaptcha) return;
	job.waitingCaptcha = false;
	await saveBulkJob(job);
	notifyBulkProgress(job);
}

function isPageReadyState(state) {
	return Boolean(
		state?.ok !== false &&
			(state?.ready || state?.hasTitle || (!state?.blocked && state?.hasContent))
	);
}

function isAmbiguousPageState(state) {
	return (
		state?.ok !== false &&
		!state?.blocked &&
		!state?.captcha &&
		!state?.hasTitle &&
		!state?.hasContent
	);
}

function isBlockedState(state) {
	return Boolean(state?.ok !== false && (state?.blocked || state?.captcha));
}

function isDeniedState(state) {
	return state?.blockedKind === 'denied';
}

function shouldAttemptCaptcha(state) {
	return Boolean(state?.ok !== false && (state?.blocked || state?.captcha) && state?.blockedKind !== 'denied');
}

async function resolveCaptchaIfNeeded(tabId, state, kind = 'bulk', targetUrl = '') {
	if (!shouldAttemptCaptcha(state)) return false;
	await waitForCaptchaResolve(tabId, kind, targetUrl);
	return true;
}

async function reloadWorkerTab(tabId, url) {
	await navigateWorkerTab(tabId, url, 45000);
}

async function ensureTabOnTargetUrl(tabId, targetUrl) {
	if (!targetUrl) return;
	const tab = await chrome.tabs.get(tabId).catch(() => null);
	if (!tab) {
		throw new Error('Вкладка воркера закрыта');
	}
	if (isBlankOrInternalUrl(tab.url) || !urlsMatchForLoad(tab.url, targetUrl)) {
		await navigateWorkerTab(tabId, targetUrl);
	}
}

async function waitForParseReady(tabId, kind = 'bulk', targetUrl = '') {
	const ctx = getCaptchaWorkerContext(kind);

	if (ctx.isStopRequested()) {
		throw new Error('Остановлено пользователем');
	}

	if (targetUrl) {
		await ensureTabOnTargetUrl(tabId, targetUrl);
	}

	let state = await runCaptchaCheck(tabId);

	if (state.ok === false) {
		await new Promise((resolve) => setTimeout(resolve, BULK_AMBIGUOUS_POLL_MS));
		state = await runCaptchaCheck(tabId);
	}

	if (isPageReadyState(state)) {
		await ctx.clearWaitingFlag();
		return state;
	}

	if (isDeniedState(state)) {
		return state;
	}

	if (await resolveCaptchaIfNeeded(tabId, state, kind, targetUrl)) {
		return runCaptchaCheck(tabId);
	}

	if (!isAmbiguousPageState(state)) {
		await ctx.clearWaitingFlag();
		return state;
	}

	const deadline = Date.now() + BULK_AMBIGUOUS_PAGE_MS;
	while (Date.now() < deadline) {
		if (ctx.isStopRequested()) {
			throw new Error('Остановлено пользователем');
		}

		await new Promise((resolve) => setTimeout(resolve, BULK_AMBIGUOUS_POLL_MS));
		state = await runCaptchaCheck(tabId);

		if (state.ok === false) continue;

		if (isPageReadyState(state)) {
			await ctx.clearWaitingFlag();
			return state;
		}

		if (isDeniedState(state)) {
			return state;
		}

		if (await resolveCaptchaIfNeeded(tabId, state, kind, targetUrl)) {
			return runCaptchaCheck(tabId);
		}

		if (!isAmbiguousPageState(state)) {
			break;
		}
	}

	await ctx.clearWaitingFlag();
	return state;
}

async function waitForCaptchaResolve(tabId, kind = 'bulk', targetUrl = '') {
	const ctx = getCaptchaWorkerContext(kind);
	const deadline = Date.now() + BULK_CAPTCHA_WAIT_MS;
	let captchaFlagSet = false;
	let lastCaptchaClickAt = 0;

	if (targetUrl) {
		await ensureTabOnTargetUrl(tabId, targetUrl);
	} else {
		const tab = await chrome.tabs.get(tabId).catch(() => null);
		if (tab && isBlankOrInternalUrl(tab.url)) {
			throw new Error('Captcha: вкладка пустая (about:blank)');
		}
	}

	const tab = await chrome.tabs.get(tabId).catch(() => null);
	if (tab?.windowId) {
		await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
	}
	await chrome.tabs.update(tabId, { active: true }).catch(() => {});
	const firstClick = await runCaptchaClick(tabId);
	if (!firstClick.clicked) {
		console.warn(ctx.logPrefix + ' captcha click attempt failed:', firstClick);
	}
	lastCaptchaClickAt = Date.now();
	await new Promise((resolve) => setTimeout(resolve, 1200));
	await waitForTabLoad(tabId, 45000, targetUrl || undefined).catch(() => {});

	while (Date.now() < deadline) {
		if (ctx.isStopRequested()) {
			throw new Error('Остановлено пользователем');
		}

		const current = await chrome.tabs.get(tabId).catch(() => null);
		if (current && isBlankOrInternalUrl(current.url)) {
			if (targetUrl) {
				await navigateWorkerTab(tabId, targetUrl);
				continue;
			}
			throw new Error('Captcha: вкладка ушла в about:blank');
		}

		const state = await runCaptchaCheck(tabId);

		if (state.ok === false) {
			await new Promise((resolve) => setTimeout(resolve, BULK_AMBIGUOUS_POLL_MS));
			continue;
		}

		if (isPageReadyState(state)) {
			await ctx.clearWaitingFlag();
			return;
		}

		if (isDeniedState(state)) {
			await ctx.clearWaitingFlag();
			return;
		}

		if (!isBlockedState(state)) {
			if (isPageReadyState(state)) {
				await ctx.clearWaitingFlag();
				await waitForPageContent(tabId, BULK_CONTENT_AFTER_CAPTCHA_MS, kind, targetUrl);
				return;
			}

			await new Promise((resolve) => setTimeout(resolve, BULK_AMBIGUOUS_POLL_MS));
			continue;
		}

		if (!captchaFlagSet) {
			await ctx.setWaitingFlag();
			captchaFlagSet = true;
		}

		const now = Date.now();
		if (now - lastCaptchaClickAt >= BULK_CAPTCHA_CLICK_INTERVAL_MS) {
			const clickResult = await runCaptchaClick(tabId);
			if (!clickResult.clicked) {
				console.warn(ctx.logPrefix + ' captcha click retry failed:', clickResult);
			}
			lastCaptchaClickAt = now;
			await new Promise((resolve) => setTimeout(resolve, 1200));
			await waitForTabLoad(tabId, 45000, targetUrl || undefined).catch(() => {});
		}

		await ctx.touchHeartbeat().catch(() => {});
		await new Promise((resolve) => setTimeout(resolve, BULK_CAPTCHA_POLL_MS));
	}

	throw new Error('Captcha: не удалось пройти проверку «Я не робот»');
}

async function ensureWorkerPageReady(tabId, kind = 'bulk', targetUrl = '') {
	if (targetUrl) {
		await ensureTabOnTargetUrl(tabId, targetUrl);
	}

	let state = await waitForParseReady(tabId, kind, targetUrl);

	if (isDeniedState(state)) {
		throw new Error('Сайт временно заблокировал запрос (request denied). Повторите позже.');
	}

	if (shouldAttemptCaptcha(state)) {
		await waitForCaptchaResolve(tabId, kind, targetUrl);
		state = await runCaptchaCheck(tabId);

		if (isDeniedState(state)) {
			throw new Error('Сайт временно заблокировал запрос (request denied). Повторите позже.');
		}

		if (shouldAttemptCaptcha(state)) {
			throw new Error('Captcha: не удалось пройти проверку «Я не робот»');
		}

		await waitForPageContent(tabId, BULK_CONTENT_AFTER_CAPTCHA_MS, kind, targetUrl);
		state = await runCaptchaCheck(tabId);
	}

	if (!isPageReadyState(state)) {
		if (shouldAttemptCaptcha(state)) {
			throw new Error('Captcha: не удалось пройти проверку «Я не робот»');
		}
		if (isDeniedState(state)) {
			throw new Error('Сайт временно заблокировал запрос (request denied). Повторите позже.');
		}
	}

	return state;
}

async function classifySharesParseFailure(tabId, error) {
	const message = String(error?.message || error || '');
	if (/captcha|робот|человек/i.test(message)) {
		return message;
	}

	const state = tabId ? await runCaptchaCheck(tabId).catch(() => null) : null;
	if (state?.blockedKind === 'denied') {
		return 'Сайт временно заблокировал запрос (request denied). Повторите позже.';
	}
	if (shouldAttemptCaptcha(state)) {
		return 'Captcha: не удалось пройти проверку «Я не робот»';
	}

	return message;
}

async function waitForPageContent(tabId, maxMs = BULK_CONTENT_AFTER_CAPTCHA_MS, kind = 'bulk', targetUrl = '') {
	const ctx = getCaptchaWorkerContext(kind);
	const deadline = Date.now() + maxMs;

	while (Date.now() < deadline) {
		if (ctx.isStopRequested()) {
			throw new Error('Остановлено пользователем');
		}

		const current = await chrome.tabs.get(tabId).catch(() => null);
		if (current && isBlankOrInternalUrl(current.url)) {
			if (targetUrl) {
				await navigateWorkerTab(tabId, targetUrl);
				continue;
			}
			return;
		}

		const state = await quickPageReadyCheck(tabId);
		if (isPageReadyState(state)) {
			return;
		}
		if (state.captcha) {
			await waitForCaptchaResolve(tabId, kind, targetUrl);
			return;
		}
		if (state.blocked) {
			return;
		}

		await ctx.touchHeartbeat().catch(() => {});
		await new Promise((resolve) => setTimeout(resolve, BULK_AMBIGUOUS_POLL_MS));
	}
}

async function parseUrlInWorkerTab(url, sourceId) {
	let lastParsed = null;

	for (let attempt = 1; attempt <= BULK_BLOCKED_RETRY_ATTEMPTS; attempt++) {
		if (bulkStopRequested) {
			throw new Error('Остановлено пользователем');
		}

		if (attempt > 1) {
			await new Promise((resolve) =>
				setTimeout(resolve, BULK_DENIED_RETRY_DELAY_MS * attempt)
			);
			if (bulkWorkerTabId) {
				await navigateWorkerTab(bulkWorkerTabId, url);
			}
		}

		try {
			bulkWorkerTabId = bulkWorkerTabId || (await restoreWorkerTabId('bulk'));
			bulkWorkerTabId = await ensureWorkerTab(bulkWorkerTabId, url, { active: false });
			await rememberWorkerTabId('bulk', bulkWorkerTabId);
			await ensureWorkerPageReady(bulkWorkerTabId, 'bulk', url);
		} catch (error) {
			if (attempt >= BULK_BLOCKED_RETRY_ATTEMPTS) {
				throw error;
			}
			continue;
		}

		lastParsed = await runParserOnTab(bulkWorkerTabId, sourceId);
		const title = lastParsed.title || lastParsed.title_ru || '';
		if (title) {
			return lastParsed;
		}

		const state = await runCaptchaCheck(bulkWorkerTabId);
		if (shouldAttemptCaptcha(state) && attempt < BULK_BLOCKED_RETRY_ATTEMPTS) {
			continue;
		}

		break;
	}

	return lastParsed || { title: '', title_ru: '', playlist: [] };
}

async function processBulkUrl(url, job) {
	const parsed = await parseUrlInWorkerTab(url, job.sourceId || 'russian-seriali');

	const title = parsed.title || parsed.title_ru || '';
	const year = String(parsed.year || '').match(/\d{4}/)?.[0] || '';
	const playlist = parsed.playlist || [];
	const playlistStats = countPlaylistItems(normalizePlaylistForExport(playlist));

	if (!title) {
		const state = bulkWorkerTabId ? await runCaptchaCheck(bulkWorkerTabId) : null;
		if (state?.blockedKind === 'denied') {
			throw new Error('Сайт временно заблокировал запрос (request denied). Повторите позже.');
		}
		if (shouldAttemptCaptcha(state)) {
			throw new Error('Captcha: не удалось пройти проверку «Я не робот»');
		}
		throw new Error('Title not found on page');
	}

	const sharesTotal = await tryParseSharesOnBulkTab();

	const requestUrl = buildUpdateLinkUrl({
		title,
		year,
		sourceUrl: url,
		playlist,
		updatePlaylist: job.updatePlaylist,
	});

	try {
		const apiResponse = await sendUpdateLinkRequest({
			title,
			year,
			sourceUrl: url,
			playlist,
			updatePlaylist: job.updatePlaylist,
		});

		return {
			title,
			year,
			playlistCount: playlistStats.episodes,
			playlistSources: playlistStats.sources,
			requestUrl: apiResponse.requestUrl,
			responseBody: apiResponse.responseBody,
			apiResult: apiResponse.apiResult,
			attempts: apiResponse.attempts,
			sharesTotal,
		};
	} catch (error) {
		if (!error.apiRequest) {
			error.apiRequest = requestUrl;
		}
		error.sharesTotal = sharesTotal;
		throw error;
	}
}

function notifyBulkProgress(job) {
	try {
		chrome.runtime.sendMessage({ type: 'BULK_PROGRESS', job }, () => {
			void chrome.runtime.lastError;
		});
	} catch {
		// bulk.html может быть закрыт
	}
}

async function touchBulkHeartbeat() {
	await chrome.storage.local.get(BULK_JOB_STORAGE_KEY).catch(() => {});
}

function startBulkKeepalive() {
	stopBulkKeepalive();
	touchBulkHeartbeat().catch(() => {});
	bulkHeartbeatTimer = setInterval(() => {
		touchBulkHeartbeat().catch(() => {});
	}, 20000);

	try {
		chrome.alarms.create(BULK_WATCHDOG_ALARM, { periodInMinutes: 1 });
	} catch (error) {
		console.warn('[Bulk] alarm create failed:', error);
	}
}

function stopBulkKeepalive() {
	if (bulkHeartbeatTimer) {
		clearInterval(bulkHeartbeatTimer);
		bulkHeartbeatTimer = null;
	}
	chrome.alarms.clear(BULK_WATCHDOG_ALARM).catch(() => {});
}

async function syncBulkKeepalive() {
	const job = await getBulkJob();
	if (job.status === 'running') {
		startBulkKeepalive();
	} else {
		stopBulkKeepalive();
	}
}

async function processBulkQueue() {
	if (bulkProcessing) return;

	const job = await getBulkJob();
	if (job.status !== 'running') return;

	bulkProcessing = true;
	bulkStopRequested = false;
	let finishStatus = 'completed';

	try {
		startBulkKeepalive();

		while (true) {
			const current = await getBulkJob();
			if (current.status !== 'running' || bulkStopRequested) {
				if (current.status === 'running') {
					current.status = 'stopped';
					current.finishedAt = Date.now();
					await saveBulkJob(current);
					notifyBulkProgress(current);
				}
				finishStatus = 'stopped';
				break;
			}

			if (current.currentIndex >= current.urls.length) {
				current.status = 'completed';
				current.finishedAt = Date.now();
				await saveBulkJob(current);
				notifyBulkProgress(current);
				finishStatus = 'completed';
				break;
			}

			const url = current.urls[current.currentIndex];
			current.lastUrl = url;
			current.lastTitle = '';

			if (current.catalogRunId) {
				try {
					const run = await catalogGetJob(current.catalogRunId);
					if (run && (run.status === 'stopping' || run.status === 'stopped')) {
						current.status = 'stopped';
						current.finishedAt = Date.now();
						await saveBulkJob(current);
						notifyBulkProgress(current);
						finishStatus = 'stopped';
						break;
					}
				} catch (error) {
					console.warn('[Catalog] status check failed:', error.message);
				}
			}

			try {
				const result = await processBulkUrl(url, current);
				current.successCount += 1;
				current.waitingCaptcha = false;
				current.notFoundUrls = (current.notFoundUrls || []).filter((item) => item.url !== url);
				current.lastTitle = result.title;
				current.lastApiRequest = result.requestUrl;
				current.lastApiResponse = result.responseBody;
				current.lastApiResult = result.apiResult || null;
				current.lastPlaylistCount = result.playlistCount;
				current.lastPlaylistSources = result.playlistSources || 0;
				appendBulkLog(current, {
					at: Date.now(),
					ok: true,
					sourceUrl: url,
					title: result.title,
					apiRequest: result.requestUrl,
					apiResponse: result.responseBody,
					apiResult: result.apiResult || null,
					attempts: result.attempts || 1,
				});
				await reportCatalogProgressSafe(current.catalogRunId, {
					url,
					ok: true,
					title: result.title,
					shares_total: result.sharesTotal,
				});
			} catch (error) {
				current.failCount += 1;
				current.waitingCaptcha = false;
				current.lastApiRequest = error.apiRequest || current.lastApiRequest || '';
				current.lastApiResponse = error.apiResponse || '';
				current.lastApiResult = error.apiResult || null;
				current.errors = trimErrors([
					...current.errors,
					{
						url,
						error: error.message,
						apiRequest: error.apiRequest || '',
						apiResponse: error.apiResponse || '',
						apiResult: error.apiResult || null,
						at: Date.now(),
					},
				]);
				appendBulkLog(current, {
					at: Date.now(),
					ok: false,
					sourceUrl: url,
					title: current.lastTitle || '',
					error: error.message,
					apiRequest: error.apiRequest || '',
					apiResponse: error.apiResponse || '',
					apiResult: error.apiResult || null,
					attempts: error.attempts || 1,
				});

				if (shouldSaveAsNotFound(error.message)) {
					appendNotFoundUrl(current, {
						url,
						error: error.message,
						reason: classifyBulkError(error.message),
						at: Date.now(),
					});
				}
				await reportCatalogProgressSafe(current.catalogRunId, {
					url,
					ok: false,
					title: current.lastTitle || '',
					error: error.message,
					shares_total: error.sharesTotal,
				});
			}

			current.currentIndex += 1;
			await saveBulkJob(current);
			notifyBulkProgress(current);

			if (current.currentIndex < current.urls.length) {
				await new Promise((resolve) =>
					setTimeout(resolve, Math.max(0, current.delayMs || 0))
				);
			}
		}
	} finally {
		const finishedJob = await getBulkJob().catch(() => null);
		if (finishedJob?.catalogRunId) {
			await finishCatalogJobSafe(
				finishedJob.catalogRunId,
				finishedJob.status === 'stopped' || finishStatus === 'stopped'
					? 'stopped'
					: 'completed'
			);
		}
		bulkProcessing = false;
		stopBulkKeepalive();
		await closeBulkWorkerTab();
	}
}

async function startBulkUpdate({
	urlsText,
	urls: urlsInput,
	updatePlaylist,
	sourceId,
	delayMs,
	catalogRunId = null,
}) {
	const existingJob = await getBulkJob();
	if (bulkProcessing && existingJob.status !== 'running') {
		bulkProcessing = false;
	}

	if (bulkProcessing) {
		throw new Error('Обновление уже выполняется');
	}

	let urls;
	if (Array.isArray(urlsInput) && urlsInput.length > 0) {
		urls = urlsInput.map((u) => String(u || '').trim()).filter(Boolean);
	} else {
		urls = await resolveUrlList(urlsText);
	}

	if (urls.length === 0) {
		throw new Error('Не найдено ни одной ссылки');
	}

	const job = {
		...DEFAULT_BULK_JOB,
		status: 'running',
		urls,
		currentIndex: 0,
		updatePlaylist: Boolean(updatePlaylist),
		sourceId: sourceId || 'russian-seriali',
		delayMs: Number(delayMs) >= 0 ? Number(delayMs) : 300,
		catalogRunId: catalogRunId || null,
		successCount: 0,
		failCount: 0,
		errors: [],
		logs: [],
		notFoundUrls: [],
		waitingCaptcha: false,
		startedAt: Date.now(),
		finishedAt: null,
		lastUrl: '',
		lastTitle: '',
		lastApiRequest: '',
		lastApiResponse: '',
		lastApiResult: null,
		lastPlaylistCount: 0,
		lastPlaylistSources: 0,
	};

	await saveBulkJob(job);
	notifyBulkProgress(job);
	runBulkQueueSafe();

	return { total: urls.length, catalogRunId: job.catalogRunId };
}

async function reportCatalogProgressSafe(runId, payload) {
	if (!runId) return;
	try {
		await catalogReportProgress(runId, payload);
	} catch (error) {
		console.warn('[Catalog] progress report failed:', error.message);
	}
}

async function finishCatalogJobSafe(runId, status) {
	if (!runId) return;
	try {
		await catalogFinishJob(runId, status);
	} catch (error) {
		console.warn('[Catalog] finish failed:', error.message);
	}
}

async function handleCatalogFullParseAction(action) {
	const payload = action?.payload || {};
	const url = payload.url;
	const linkId = payload.linkId;
	if (!url) {
		throw new Error('full_parse action без URL');
	}

	const adminUrl = await getDefaultAdminUrl();
	const result = await handleFullParse({
		sourceType: 'url',
		sourceUrl: url,
		adminUrl,
		sourceId: payload.sourceId || 'auto',
		currentTabId: null,
	});

	if (linkId) {
		try {
			await catalogMarkFullParseDone(linkId);
		} catch (error) {
			console.warn('[Catalog] mark full-parse done failed:', error.message);
		}
	}

	return result;
}

async function pollCatalogOnce() {
	if (catalogPollInFlight) return;
	catalogPollInFlight = true;

	try {
		try {
			const action = await catalogClaimAction();
			if (action?.type === 'stop_crawl') {
				try {
					await stopBulkUpdate();
					if (action.payload?.runId) {
						await finishCatalogJobSafe(action.payload.runId, 'stopped');
					}
					await catalogCompleteAction(action.id, 'done');
				} catch (error) {
					console.error('[Catalog] stop_crawl failed:', error);
					await catalogCompleteAction(action.id, 'error').catch(() => {});
				}
			} else if (action?.type === 'full_parse') {
				try {
					await handleCatalogFullParseAction(action);
					await catalogCompleteAction(action.id, 'done');
				} catch (error) {
					console.error('[Catalog] full_parse failed:', error);
					await catalogCompleteAction(action.id, 'error').catch(() => {});
				}
			}
		} catch (error) {
			// сервер выключен — тихо
			if (!/Failed to fetch|NetworkError|Catalog HTTP/i.test(error.message)) {
				console.warn('[Catalog] action claim:', error.message);
			}
		}

		if (bulkProcessing) return;

		const existing = await getBulkJob();
		if (existing.status === 'running') return;

		let job;
		try {
			job = await catalogClaimJob();
		} catch (error) {
			if (!/Failed to fetch|NetworkError|Catalog HTTP/i.test(error.message)) {
				console.warn('[Catalog] job claim:', error.message);
			}
			return;
		}

		if (!job?.urls?.length) return;

		console.log('[Catalog] claimed crawl run', job.runId, 'urls=', job.urls.length);
		try {
			await startBulkUpdate({
				urls: job.urls,
				updatePlaylist: job.updatePlaylist,
				sourceId: job.sourceId || 'russian-seriali',
				delayMs: 300,
				catalogRunId: job.runId,
			});
		} catch (error) {
			console.error('[Catalog] failed to start bulk for run', job.runId, error);
			await finishCatalogJobSafe(job.runId, 'stopped');
		}
	} finally {
		catalogPollInFlight = false;
	}
}

function startCatalogPollAlarm() {
	try {
		chrome.alarms.create(CATALOG_POLL_ALARM, { periodInMinutes: 1 });
	} catch (error) {
		console.warn('[Catalog] alarm create failed:', error);
	}
}

function runBulkQueueSafe() {
	processBulkQueue().catch(async (error) => {
		console.error('[Bulk] queue failed:', error);
		bulkProcessing = false;
		stopBulkKeepalive();

		const job = await getBulkJob().catch(() => null);
		if (job?.status === 'running') {
			job.status = 'stopped';
			job.finishedAt = Date.now();
			job.errors = trimErrors([
				...(job.errors || []),
				{
					url: job.lastUrl || '',
					error: error.message,
					at: Date.now(),
				},
			]);
			await saveBulkJob(job).catch(() => {});
			notifyBulkProgress(job);
		}
		if (job?.catalogRunId) {
			await finishCatalogJobSafe(job.catalogRunId, 'stopped');
		}
	});
}

async function stopBulkUpdate() {
	bulkStopRequested = true;
	const job = await getBulkJob();
	if (job.status === 'running') {
		job.status = 'stopped';
		job.finishedAt = Date.now();
		await saveBulkJob(job);
		notifyBulkProgress(job);
	}
}

async function resumeBulkJobIfNeeded() {
	const job = await getBulkJob();
	if (job.status === 'running' && !bulkProcessing) {
		runBulkQueueSafe();
	} else if (job.status !== 'running' && !bulkProcessing) {
		await closeBulkWorkerTab();
	}
}

async function runSocialSharesParserOnTab(tabId, { waitMs = SHARES_WIDGET_WAIT_MS, soft = false } = {}) {
	await chrome.scripting.executeScript({
		target: { tabId },
		files: SOCIAL_SHARES_PARSER_FILES,
	});

	const [result] = await chrome.scripting.executeScript({
		target: { tabId },
		func: async (timeoutMs) => {
			const waitInfo = await waitForSocialSharesReady(timeoutMs);
			const data = extractSocialShares();
			return { ...data, waitInfo };
		},
		args: [waitMs],
	});

	const payload = result?.result;
	if (!payload) {
		if (soft) return null;
		throw new Error('Shares parser returned empty result');
	}
	if (!payload.waitInfo?.ready) {
		if (soft) {
			const { waitInfo, ...data } = payload;
			return payload.error ? null : { ...data, waitInfo };
		}
		throw new Error('Счётчики uSocial не успели загрузиться');
	}
	if (payload.error) {
		if (soft) return null;
		throw new Error(payload.error);
	}

	const { waitInfo, ...data } = payload;
	return { ...data, waitInfo };
}

async function tryParseSharesOnBulkTab() {
	if (!bulkWorkerTabId) return null;
	try {
		const data = await runSocialSharesParserOnTab(bulkWorkerTabId, {
			waitMs: SHARES_WIDGET_WAIT_MS,
			soft: true,
		});
		if (!data || typeof data.total !== 'number') return null;
		return data.total;
	} catch (error) {
		console.warn('[Bulk] shares parse skipped:', error.message);
		return null;
	}
}

async function closeSharesWorkerTab() {
	if (!sharesWorkerTabId) return;
	await chrome.tabs.remove(sharesWorkerTabId).catch(() => {});
	sharesWorkerTabId = null;
}

async function clearSharesCaptchaWaitingFlag() {
	const job = await getSharesJob();
	if (!job.waitingCaptcha) return;
	job.waitingCaptcha = false;
	await saveSharesJob(job);
	notifySharesProgress(job);
}

function notifySharesProgress(job) {
	try {
		chrome.runtime.sendMessage({ type: 'SHARES_PROGRESS', job }, () => {
			void chrome.runtime.lastError;
		});
	} catch {
		// shares.html может быть закрыт
	}
}

async function touchSharesHeartbeat() {
	await chrome.storage.local.get(SHARES_JOB_STORAGE_KEY).catch(() => {});
}

function startSharesKeepalive() {
	stopSharesKeepalive();
	touchSharesHeartbeat().catch(() => {});
	sharesHeartbeatTimer = setInterval(() => {
		touchSharesHeartbeat().catch(() => {});
	}, 20000);

	try {
		chrome.alarms.create(SHARES_WATCHDOG_ALARM, { periodInMinutes: 1 });
	} catch (error) {
		console.warn('[Shares] alarm create failed:', error);
	}
}

function stopSharesKeepalive() {
	if (sharesHeartbeatTimer) {
		clearInterval(sharesHeartbeatTimer);
		sharesHeartbeatTimer = null;
	}
	chrome.alarms.clear(SHARES_WATCHDOG_ALARM).catch(() => {});
}

async function syncSharesKeepalive() {
	const job = await getSharesJob();
	if (job.status === 'running') {
		startSharesKeepalive();
	} else {
		stopSharesKeepalive();
	}
}

async function parseSharesUrlInWorkerTab(url) {
	for (let attempt = 1; attempt <= BULK_BLOCKED_RETRY_ATTEMPTS; attempt++) {
		if (sharesStopRequested) {
			throw new Error('Остановлено пользователем');
		}

		if (attempt > 1) {
			await new Promise((resolve) =>
				setTimeout(resolve, BULK_DENIED_RETRY_DELAY_MS * attempt)
			);
			if (sharesWorkerTabId) {
				await navigateWorkerTab(sharesWorkerTabId, url);
			}
		}

		try {
			sharesWorkerTabId = sharesWorkerTabId || (await restoreWorkerTabId('shares'));
			sharesWorkerTabId = await ensureWorkerTab(sharesWorkerTabId, url, { active: false });
			await rememberWorkerTabId('shares', sharesWorkerTabId);
			await ensureWorkerPageReady(sharesWorkerTabId, 'shares', url);
			return await runSocialSharesParserOnTab(sharesWorkerTabId);
		} catch (error) {
			const message = await classifySharesParseFailure(sharesWorkerTabId, error);
			if (attempt >= BULK_BLOCKED_RETRY_ATTEMPTS) {
				throw new Error(message);
			}
			continue;
		}
	}

	throw new Error('Captcha: не удалось пройти проверку «Я не робот»');
}

async function processSharesUrl(url) {
	try {
		return await parseSharesUrlInWorkerTab(url);
	} catch (error) {
		throw new Error(await classifySharesParseFailure(sharesWorkerTabId, error));
	}
}

async function processSharesQueue() {
	if (sharesProcessing) return;

	const job = await getSharesJob();
	if (job.status !== 'running') return;

	sharesProcessing = true;
	sharesStopRequested = false;

	try {
		startSharesKeepalive();

		while (true) {
			const current = await getSharesJob();
			if (current.status !== 'running' || sharesStopRequested) {
				if (current.status === 'running') {
					current.status = 'stopped';
					current.finishedAt = Date.now();
					await saveSharesJob(current);
					notifySharesProgress(current);
				}
				break;
			}

			if (current.currentIndex >= current.urls.length) {
				current.status = 'completed';
				current.finishedAt = Date.now();
				await saveSharesJob(current);
				notifySharesProgress(current);
				break;
			}

			const url = current.urls[current.currentIndex];
			current.lastUrl = url;
			current.lastTitle = '';

			try {
				const result = await processSharesUrl(url);
				current.successCount += 1;
				current.waitingCaptcha = false;
				current.notFoundUrls = (current.notFoundUrls || []).filter((item) => item.url !== url);
				current.lastTitle = result.title || '';
				appendSharesResult(
					current,
					createResultEntry({
						url,
						title: result.title,
						shares: result.shares,
						total: result.total,
						at: Date.now(),
					})
				);
			} catch (error) {
				current.failCount += 1;
				current.waitingCaptcha = false;
				appendSharesError(current, {
					url,
					error: error.message,
					at: Date.now(),
				});
				appendSharesResult(
					current,
					createResultEntry({
						url,
						title: current.lastTitle || '',
						error: error.message,
						at: Date.now(),
					})
				);

				if (shouldSaveSharesAsNotFound(error.message)) {
					appendNotFoundUrl(current, {
						url,
						error: error.message,
						reason: classifySharesError(error.message),
						at: Date.now(),
					});
				}
			}

			current.currentIndex += 1;
			await saveSharesJob(current);
			notifySharesProgress(current);

			if (current.currentIndex < current.urls.length) {
				await new Promise((resolve) =>
					setTimeout(resolve, Math.max(0, current.delayMs || 0))
				);
			}
		}
	} finally {
		sharesProcessing = false;
		stopSharesKeepalive();
		await closeSharesWorkerTab();
	}
}

async function startSharesParse({ urlsText, delayMs }) {
	const existingJob = await getSharesJob();
	if (sharesProcessing && existingJob.status !== 'running') {
		sharesProcessing = false;
	}

	if (sharesProcessing) {
		throw new Error('Парсинг шаринга уже выполняется');
	}

	const urls = await resolveUrlList(urlsText);
	if (urls.length === 0) {
		throw new Error('Не найдено ни одной ссылки');
	}

	const job = {
		...DEFAULT_SHARES_JOB,
		status: 'running',
		urls,
		currentIndex: 0,
		delayMs: Number(delayMs) >= 0 ? Number(delayMs) : 800,
		successCount: 0,
		failCount: 0,
		errors: [],
		results: [],
		notFoundUrls: [],
		waitingCaptcha: false,
		startedAt: Date.now(),
		finishedAt: null,
		lastUrl: '',
		lastTitle: '',
		statistics: null,
	};

	await saveSharesJob(job);
	notifySharesProgress(job);
	runSharesQueueSafe();

	return { total: urls.length };
}

function runSharesQueueSafe() {
	processSharesQueue().catch(async (error) => {
		console.error('[Shares] queue failed:', error);
		sharesProcessing = false;
		stopSharesKeepalive();

		const job = await getSharesJob().catch(() => null);
		if (job?.status === 'running') {
			job.status = 'stopped';
			job.finishedAt = Date.now();
			appendSharesError(job, {
				url: job.lastUrl || '',
				error: error.message,
				at: Date.now(),
			});
			await saveSharesJob(job).catch(() => {});
			notifySharesProgress(job);
		}
	});
}

async function stopSharesParse() {
	sharesStopRequested = true;
	const job = await getSharesJob();
	if (job.status === 'running') {
		job.status = 'stopped';
		job.finishedAt = Date.now();
		await saveSharesJob(job);
		notifySharesProgress(job);
	}
}

async function resumeSharesJobIfNeeded() {
	const job = await getSharesJob();
	if (job.status === 'running' && !sharesProcessing) {
		runSharesQueueSafe();
	} else if (job.status !== 'running' && !sharesProcessing) {
		await closeSharesWorkerTab();
	}
}

chrome.runtime.onConnect.addListener((port) => {
	if (port.name === 'shares-keepalive') {
		port.onMessage.addListener((message) => {
			if (message?.type === 'ping') {
				port.postMessage({ type: 'pong' });
				resumeSharesJobIfNeeded();
			}
		});
		return;
	}

	if (port.name !== 'bulk-keepalive') return;

	port.onMessage.addListener((message) => {
		if (message?.type === 'ping') {
			port.postMessage({ type: 'pong' });
			resumeBulkJobIfNeeded();
		}
	});
});

chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name === BULK_WATCHDOG_ALARM) {
		touchBulkHeartbeat().finally(() => {
			resumeBulkJobIfNeeded();
		});
		return;
	}

	if (alarm.name === SHARES_WATCHDOG_ALARM) {
		touchSharesHeartbeat().finally(() => {
			resumeSharesJobIfNeeded();
		});
		return;
	}

	if (alarm.name === CATALOG_POLL_ALARM) {
		pollCatalogOnce().catch((error) => {
			console.warn('[Catalog] poll failed:', error.message);
		});
	}
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.type === 'FULL_PARSE') {
		handleFullParse(message.payload)
			.then((result) => sendResponse({ success: true, ...result }))
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	if (message.type === 'CATALOG_IMMEDIATE_FULL_PARSE') {
		(async () => {
			const payload = message.payload || {};
			const url = payload.url;
			const linkId = payload.linkId;
			if (!url) {
				throw new Error('Не указан URL для парсинга');
			}

			const adminUrl = await getDefaultAdminUrl();
			const result = await handleFullParse({
				sourceType: 'url',
				sourceUrl: url,
				adminUrl,
				sourceId: payload.sourceId || 'auto',
				currentTabId: null,
			});

			if (linkId) {
				try {
					await catalogMarkFullParseDone(linkId);
				} catch (error) {
					console.warn('[Catalog] mark full-parse done failed:', error.message);
				}
			}

			return result;
		})()
			.then((result) => sendResponse({ success: true, ...result }))
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	if (message.type === 'CATALOG_STOP_CRAWL') {
		(async () => {
			await stopBulkUpdate();
			const runId = message.payload?.runId;
			if (runId) {
				await finishCatalogJobSafe(runId, 'stopped');
			}
			return { stopped: true };
		})()
			.then((result) => sendResponse({ success: true, ...result }))
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	if (message.type === 'GET_SETTINGS') {
		getSettings()
			.then((settings) => sendResponse({ success: true, settings }))
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	if (message.type === 'FETCH_POSTER') {
		fetchPosterFromUrl(message.posterUrl, message.posterFileName)
			.then((data) =>
				sendResponse({
					success: Boolean(data.posterImageBase64),
					posterImageBase64: data.posterImageBase64,
					posterMimeType: data.posterMimeType,
					posterFileName: data.posterFileName,
					error: data.posterImageBase64 ? undefined : 'Poster download failed',
				})
			)
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	if (message.type === 'RUN_IN_PAGE' && _sender.tab?.id) {
		const actionMap = {
			setCategories: setCategoriesInPage,
			setTokenField: setTokenFieldInPage,
		};
		const pageFn = actionMap[message.action];
		if (!pageFn) {
			sendResponse({ success: false, error: 'Unknown page action: ' + message.action });
			return true;
		}

		chrome.scripting
			.executeScript({
				target: { tabId: _sender.tab.id },
				world: 'MAIN',
				func: pageFn,
				args: message.args || [],
			})
			.then((results) => sendResponse({ success: true, result: results[0]?.result }))
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	if (message.type === 'BULK_START') {
		startBulkUpdate(message.payload)
			.then((result) => sendResponse({ success: true, ...result }))
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	if (message.type === 'BULK_STOP') {
		stopBulkUpdate()
			.then(() => sendResponse({ success: true }))
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	if (message.type === 'BULK_GET_STATUS') {
		getBulkJob()
			.then((job) => sendResponse({ success: true, job }))
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	if (message.type === 'BULK_PING') {
		sendResponse({ success: true, alive: true });
		return true;
	}

	if (message.type === 'BULK_RESOLVE_URLS') {
		resolveUrlList(message.payload?.urlsText || '')
			.then((urls) => {
				const rawCount = parseUrlList(message.payload?.urlsText || '').length;
				sendResponse({
					success: true,
					urls,
					sitemapsExpanded: urls.length !== rawCount,
				});
			})
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	if (message.type === 'BULK_CLEAR') {
		stopBulkUpdate()
			.then(() => clearBulkJob())
			.then(() => sendResponse({ success: true }))
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	if (message.type === 'SHARES_START') {
		startSharesParse(message.payload)
			.then((result) => sendResponse({ success: true, ...result }))
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	if (message.type === 'SHARES_STOP') {
		stopSharesParse()
			.then(() => sendResponse({ success: true }))
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	if (message.type === 'SHARES_GET_STATUS') {
		getSharesJob()
			.then((job) => sendResponse({ success: true, job }))
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	if (message.type === 'SHARES_PING') {
		sendResponse({ success: true, alive: true });
		return true;
	}

	if (message.type === 'SHARES_RESOLVE_URLS') {
		resolveUrlList(message.payload?.urlsText || '')
			.then((urls) => {
				const rawCount = parseUrlList(message.payload?.urlsText || '').length;
				sendResponse({
					success: true,
					urls,
					sitemapsExpanded: urls.length !== rawCount,
				});
			})
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	if (message.type === 'SHARES_CLEAR') {
		stopSharesParse()
			.then(() => clearSharesJob())
			.then(() => sendResponse({ success: true }))
			.catch((error) => sendResponse({ success: false, error: error.message }));
		return true;
	}

	return false;
});

resumeBulkJobIfNeeded();
resumeSharesJobIfNeeded();
startCatalogPollAlarm();
pollCatalogOnce().catch(() => {});
