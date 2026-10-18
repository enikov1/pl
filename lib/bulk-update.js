const BULK_JOB_STORAGE_KEY = 'bulkUpdateJob';

const DEFAULT_BULK_JOB = {
	status: 'idle',
	urls: [],
	currentIndex: 0,
	updatePlaylist: false,
	sourceId: 'russian-seriali',
	delayMs: 300,
	successCount: 0,
	failCount: 0,
	errors: [],
	logs: [],
	notFoundUrls: [],
	waitingCaptcha: false,
	startedAt: null,
	finishedAt: null,
	lastUrl: '',
	lastTitle: '',
	lastApiRequest: '',
	lastApiResponse: '',
	lastApiResult: null,
	lastPlaylistCount: 0,
	lastPlaylistSources: 0,
	catalogRunId: null,
};

const UPDATE_LINK_API =
	'https://russerialov.net/engine/ajax/controller.php';

const UPDATE_LINK_MAX_RETRIES = 3;
const UPDATE_LINK_RETRY_DELAY_MS = 3000;
const UPDATE_LINK_POST_URL_LENGTH = 6000;

function buildUpdateLinkParams({ title, year, sourceUrl, playlist, updatePlaylist }) {
	const params = new URLSearchParams();
	params.set('mod', 'updatelink');
	params.set('title', title || '');
	params.set('year', year || '');
	params.set('russians_parse', sourceUrl || '');

	const apiPlaylist = normalizePlaylistForExport(playlist);
	if (updatePlaylist && apiPlaylist.length > 0) {
		params.set('playlist', JSON.stringify(apiPlaylist));
	}

	return params;
}

function buildUpdateLinkUrl(options) {
	return `${UPDATE_LINK_API}?${buildUpdateLinkParams(options).toString()}`;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryFetchError(error) {
	const message = String(error?.message || error || '').toLowerCase();
	return /failed to fetch|networkerror|network error|timeout|aborted|fetch/i.test(message);
}

function shouldRetryHttpStatus(status) {
	return [408, 429, 500, 502, 503, 504].includes(status);
}

async function sendUpdateLinkRequest({ title, year, sourceUrl, playlist, updatePlaylist }) {
	const getUrl = buildUpdateLinkUrl({ title, year, sourceUrl, playlist, updatePlaylist });
	const postBody = buildUpdateLinkParams({ title, year, sourceUrl, playlist, updatePlaylist });
	const usePostFirst = getUrl.length > UPDATE_LINK_POST_URL_LENGTH;

	let lastError = null;

	for (let attempt = 1; attempt <= UPDATE_LINK_MAX_RETRIES; attempt++) {
		const usePost = usePostFirst || attempt > 1;
		const requestLabel = usePost ? `${UPDATE_LINK_API} (POST)` : getUrl;

		try {
			const response = await fetch(usePost ? UPDATE_LINK_API : getUrl, {
				method: usePost ? 'POST' : 'GET',
				credentials: 'include',
				headers: usePost ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
				body: usePost ? postBody : undefined,
			});

			const body = await response.text().catch(() => '');
			const apiResult = parseUpdateLinkApiResponse(body);
			const responseBody = formatApiResponseBody(body);

			if (!response.ok) {
				if (shouldRetryHttpStatus(response.status) && attempt < UPDATE_LINK_MAX_RETRIES) {
					await sleep(UPDATE_LINK_RETRY_DELAY_MS * attempt);
					continue;
				}

				const error = new Error(`HTTP ${response.status}: ${responseBody.slice(0, 200)}`);
				error.apiRequest = requestLabel;
				error.apiResponse = responseBody;
				error.apiResult = apiResult;
				error.attempts = attempt;
				throw error;
			}

			if (apiResult && apiResult.success === false) {
				const error = new Error(apiResult.message || 'API вернул success: false');
				error.apiRequest = requestLabel;
				error.apiResponse = responseBody;
				error.apiResult = apiResult;
				error.attempts = attempt;
				throw error;
			}

			return {
				requestUrl: requestLabel,
				getUrl,
				responseBody,
				apiResult,
				attempts: attempt,
				method: usePost ? 'POST' : 'GET',
			};
		} catch (error) {
			lastError = error;

			if (shouldRetryFetchError(error) && attempt < UPDATE_LINK_MAX_RETRIES) {
				await sleep(UPDATE_LINK_RETRY_DELAY_MS * attempt);
				continue;
			}

			if (!error.apiRequest) {
				error.apiRequest = requestLabel;
			}
			error.attempts = attempt;
			throw error;
		}
	}

	if (lastError) {
		throw lastError;
	}

	throw new Error('Failed to fetch');
}

function parseUrlList(text) {
	if (!text) return [];

	const seen = new Set();
	const urls = [];

	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		const match = trimmed.match(/https?:\/\/[^\s<>"']+/i);
		const url = (match ? match[0] : trimmed).replace(/[.,;)\]]+$/, '');

		try {
			const parsed = new URL(url);
			if (!/^https?:$/i.test(parsed.protocol)) continue;
			const normalized = parsed.href;
			if (!seen.has(normalized)) {
				seen.add(normalized);
				urls.push(normalized);
			}
		} catch {
			// skip invalid URL
		}
	}

	return urls;
}

function dedupeUrls(urls) {
	const seen = new Set();
	const result = [];
	for (const url of urls) {
		if (!url || seen.has(url)) continue;
		seen.add(url);
		result.push(url);
	}
	return result;
}

function isSitemapXmlContent(text) {
	const trimmed = String(text || '').trim();
	return (
		/^<\?xml/i.test(trimmed) ||
		/^<urlset[\s>]/i.test(trimmed) ||
		/^<sitemapindex[\s>]/i.test(trimmed)
	);
}

function isSitemapUrl(url) {
	try {
		const parsed = new URL(url);
		return /\.xml(\?.*)?$/i.test(parsed.pathname) || /sitemap/i.test(parsed.pathname);
	} catch {
		return false;
	}
}

function extractLocsFromSitemapXml(xmlText) {
	const locs = [];
	const locRegex = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
	let match;
	while ((match = locRegex.exec(xmlText)) !== null) {
		const loc = match[1].trim();
		if (loc) locs.push(loc);
	}
	return locs;
}

function isSitemapIndexXml(xmlText) {
	return /<sitemapindex[\s>]/i.test(xmlText);
}

async function fetchSitemapXml(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Не удалось загрузить sitemap (${response.status}): ${url}`);
	}
	return response.text();
}

async function expandSitemap(reference, seenSitemaps = new Set()) {
	let xmlText = '';

	if (reference.type === 'content') {
		xmlText = reference.value;
	} else {
		const url = reference.value;
		if (seenSitemaps.has(url)) return [];
		seenSitemaps.add(url);
		xmlText = await fetchSitemapXml(url);
	}

	const locs = extractLocsFromSitemapXml(xmlText);
	if (!isSitemapIndexXml(xmlText)) {
		return locs;
	}

	const pageUrls = [];
	for (const childSitemapUrl of locs) {
		const childUrls = await expandSitemap({ type: 'url', value: childSitemapUrl }, seenSitemaps);
		pageUrls.push(...childUrls);
	}
	return pageUrls;
}

async function resolveUrlList(text) {
	const trimmedAll = String(text || '').trim();
	if (!trimmedAll) return [];

	if (isSitemapXmlContent(trimmedAll)) {
		return dedupeUrls(await expandSitemap({ type: 'content', value: trimmedAll }));
	}

	const seen = new Set();
	const urls = [];

	for (const line of trimmedAll.split(/\r?\n/)) {
		const lineTrimmed = line.trim();
		if (!lineTrimmed) continue;

		if (isSitemapXmlContent(lineTrimmed)) {
			const expanded = await expandSitemap({ type: 'content', value: lineTrimmed });
			for (const url of expanded) {
				if (!seen.has(url)) {
					seen.add(url);
					urls.push(url);
				}
			}
			continue;
		}

		const match = lineTrimmed.match(/https?:\/\/[^\s<>"']+/i);
		const candidate = (match ? match[0] : lineTrimmed).replace(/[.,;)\]]+$/, '');

		if (isSitemapUrl(candidate)) {
			const expanded = await expandSitemap({ type: 'url', value: candidate });
			for (const url of expanded) {
				if (!seen.has(url)) {
					seen.add(url);
					urls.push(url);
				}
			}
			continue;
		}

		try {
			const parsed = new URL(candidate);
			if (!/^https?:$/i.test(parsed.protocol)) continue;
			const normalized = parsed.href;
			if (!seen.has(normalized)) {
				seen.add(normalized);
				urls.push(normalized);
			}
		} catch {
			// skip invalid URL
		}
	}

	return urls;
}

async function getBulkJob() {
	const result = await chrome.storage.local.get(BULK_JOB_STORAGE_KEY);
	return { ...DEFAULT_BULK_JOB, ...(result[BULK_JOB_STORAGE_KEY] || {}) };
}

async function saveBulkJob(job) {
	await chrome.storage.local.set({ [BULK_JOB_STORAGE_KEY]: job });
}

async function clearBulkJob() {
	await chrome.storage.local.set({ [BULK_JOB_STORAGE_KEY]: { ...DEFAULT_BULK_JOB } });
}

function trimErrors(errors, max = 100) {
	if (!Array.isArray(errors)) return [];
	return errors.slice(-max);
}

function trimLogs(logs, max = 500) {
	if (!Array.isArray(logs)) return [];
	return logs.slice(-max);
}

function parseUpdateLinkApiResponse(body) {
	const trimmed = String(body || '').trim();
	if (!trimmed) return null;

	try {
		const data = JSON.parse(trimmed);
		if (!data || typeof data !== 'object') return null;

		if (typeof data.playlist === 'string') {
			try {
				data.playlist_parsed = JSON.parse(data.playlist);
			} catch {
				// keep string playlist as-is
			}
		}

		return data;
	} catch {
		return null;
	}
}

function formatApiResultForDisplay(apiResult) {
	if (!apiResult || typeof apiResult !== 'object') return '';

	const display = { ...apiResult };
	if (display.playlist_parsed) {
		display.playlist = display.playlist_parsed;
		delete display.playlist_parsed;
	} else if (typeof display.playlist === 'string') {
		try {
			display.playlist = JSON.parse(display.playlist);
		} catch {
			// keep string
		}
	}

	return JSON.stringify(display, null, 2);
}

function formatApiResponseBody(body) {
	const parsed = parseUpdateLinkApiResponse(body);
	if (parsed) {
		return formatApiResultForDisplay(parsed);
	}
	return trimText(body, 5000);
}

function appendBulkLog(job, entry) {
	job.logs = trimLogs([...(job.logs || []), entry]);
}

function trimNotFoundUrls(items, max = 5000) {
	if (!Array.isArray(items)) return [];
	return items.slice(-max);
}

function classifyBulkError(message) {
	const text = String(message || '').toLowerCase();
	if (/captcha|робот|человек/.test(text)) return 'captcha';
	if (/title not found/.test(text)) return 'title';
	if (/новость.*заголовк.*год.*не найден/i.test(text)) return 'news_not_found';
	return 'other';
}

function shouldSaveAsNotFound(message) {
	const text = String(message || '').toLowerCase();
	if (/failed to fetch|networkerror|http 5\d\d|http 429|http 408/.test(text)) {
		return false;
	}
	const reason = classifyBulkError(message);
	return reason === 'captcha' || reason === 'title' || reason === 'news_not_found';
}

function appendNotFoundUrl(job, entry) {
	const list = [...(job.notFoundUrls || [])];
	const index = list.findIndex((item) => item.url === entry.url);
	if (index >= 0) {
		list[index] = entry;
	} else {
		list.push(entry);
	}
	job.notFoundUrls = trimNotFoundUrls(list);
}

function getNotFoundUrlsText(job) {
	return (job.notFoundUrls || []).map((item) => item.url).join('\n');
}

function trimText(text, max = 5000) {
	const value = String(text || '');
	if (value.length <= max) return value;
	return value.slice(0, max) + '…';
}
