const SHARES_JOB_STORAGE_KEY = 'sharesParseJob';

const SHARE_PLATFORMS = ['vk', 'ok', 'lj', 'telegram', 'wa', 'vi'];

const SHARE_PLATFORM_LABELS = {
	vk: 'ВКонтакте',
	ok: 'OK.ru',
	lj: 'LiveJournal',
	telegram: 'Telegram',
	wa: 'WhatsApp',
	vi: 'Viber',
};

const DEFAULT_SHARES_JOB = {
	status: 'idle',
	urls: [],
	currentIndex: 0,
	delayMs: 300,
	successCount: 0,
	failCount: 0,
	errors: [],
	results: [],
	notFoundUrls: [],
	waitingCaptcha: false,
	startedAt: null,
	finishedAt: null,
	lastUrl: '',
	lastTitle: '',
	statistics: null,
};

function emptyPlatformTotals() {
	return Object.fromEntries(SHARE_PLATFORMS.map((key) => [key, 0]));
}

function createResultEntry({ url, title, shares, total, error, at }) {
	const safeShares = { ...emptyPlatformTotals(), ...(shares || {}) };
	const computedTotal =
		typeof total === 'number'
			? total
			: SHARE_PLATFORMS.reduce((sum, key) => sum + (safeShares[key] || 0), 0);

	return {
		url: url || '',
		title: title || '',
		shares: safeShares,
		total: computedTotal,
		ok: !error,
		error: error || '',
		at: at || Date.now(),
	};
}

function computeSharesStatistics(results) {
	const items = (results || []).filter((item) => item && item.ok);
	const failed = (results || []).filter((item) => item && !item.ok);

	const platformTotals = emptyPlatformTotals();
	let grandTotal = 0;

	for (const item of items) {
		grandTotal += item.total || 0;
		for (const key of SHARE_PLATFORMS) {
			platformTotals[key] += item.shares?.[key] || 0;
		}
	}

	const processed = items.length;
	const averages = emptyPlatformTotals();
	if (processed > 0) {
		for (const key of SHARE_PLATFORMS) {
			averages[key] = Math.round((platformTotals[key] / processed) * 100) / 100;
		}
	}

	const topByTotal = items
		.slice()
		.sort((a, b) => b.total - a.total || a.title.localeCompare(b.title, 'ru'))
		.slice(0, 20);

	const topByPlatform = {};
	for (const key of SHARE_PLATFORMS) {
		topByPlatform[key] = items
			.slice()
			.sort(
				(a, b) =>
					(b.shares?.[key] || 0) - (a.shares?.[key] || 0) ||
					b.total - a.total
			)
			.slice(0, 10)
			.map((item) => ({
				url: item.url,
				title: item.title,
				count: item.shares?.[key] || 0,
				total: item.total,
			}));
	}

	const distribution = {
		zero: 0,
		low: 0,
		medium: 0,
		high: 0,
	};

	for (const item of items) {
		if (item.total === 0) distribution.zero += 1;
		else if (item.total <= 3) distribution.low += 1;
		else if (item.total <= 10) distribution.medium += 1;
		else distribution.high += 1;
	}

	const dominantPlatform = SHARE_PLATFORMS.slice().sort(
		(a, b) => platformTotals[b] - platformTotals[a]
	)[0];

	return {
		summary: {
			totalUrls: (results || []).length,
			processed,
			failed: failed.length,
			grandTotal,
			averagePerUrl: processed > 0 ? Math.round((grandTotal / processed) * 100) / 100 : 0,
			dominantPlatform,
			dominantPlatformLabel: SHARE_PLATFORM_LABELS[dominantPlatform] || dominantPlatform,
			dominantPlatformCount: platformTotals[dominantPlatform] || 0,
		},
		platformTotals,
		platformAverages: averages,
		platformLabels: { ...SHARE_PLATFORM_LABELS },
		topByTotal: topByTotal.map((item) => ({
			url: item.url,
			title: item.title,
			total: item.total,
			shares: { ...item.shares },
		})),
		topByPlatform,
		distribution,
		generatedAt: Date.now(),
	};
}

function trimSharesResults(results, max = 5000) {
	if (!Array.isArray(results)) return [];
	return results.slice(-max);
}

function trimSharesErrors(errors, max = 100) {
	if (!Array.isArray(errors)) return [];
	return errors.slice(-max);
}

function trimNotFoundUrls(items, max = 5000) {
	if (!Array.isArray(items)) return [];
	return items.slice(-max);
}

function classifySharesError(message) {
	const text = String(message || '').toLowerCase();
	if (/captcha|робот|человек/.test(text)) return 'captcha';
	if (/usocial|блок uSocial|share bar|не успели загрузиться/i.test(text)) return 'no_shares';
	if (/denied|заблокир|отклон/.test(text)) return 'blocked';
	return 'other';
}

function shouldSaveSharesAsNotFound(message) {
	const reason = classifySharesError(message);
	return reason === 'captcha' || reason === 'no_shares' || reason === 'blocked';
}

function appendSharesResult(job, entry) {
	job.results = trimSharesResults([...(job.results || []), entry]);
	job.statistics = computeSharesStatistics(job.results);
}

function appendSharesError(job, entry) {
	job.errors = trimSharesErrors([...(job.errors || []), entry]);
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

async function getSharesJob() {
	const result = await chrome.storage.local.get(SHARES_JOB_STORAGE_KEY);
	return { ...DEFAULT_SHARES_JOB, ...(result[SHARES_JOB_STORAGE_KEY] || {}) };
}

async function saveSharesJob(job) {
	job.statistics = computeSharesStatistics(job.results || []);
	await chrome.storage.local.set({ [SHARES_JOB_STORAGE_KEY]: job });
}

async function clearSharesJob() {
	await chrome.storage.local.set({ [SHARES_JOB_STORAGE_KEY]: { ...DEFAULT_SHARES_JOB } });
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		SHARES_JOB_STORAGE_KEY,
		SHARE_PLATFORMS,
		SHARE_PLATFORM_LABELS,
		DEFAULT_SHARES_JOB,
		createResultEntry,
		computeSharesStatistics,
		classifySharesError,
		shouldSaveSharesAsNotFound,
		appendSharesResult,
		appendSharesError,
		appendNotFoundUrl,
		getNotFoundUrlsText,
		getSharesJob,
		saveSharesJob,
		clearSharesJob,
	};
}
