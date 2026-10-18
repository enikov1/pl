const SHARE_PLATFORMS = ['vk', 'ok', 'lj', 'telegram', 'wa', 'vi'];

const SHARE_PLATFORM_LABELS = {
	vk: 'ВКонтакте',
	ok: 'OK.ru',
	lj: 'LiveJournal',
	telegram: 'Telegram',
	wa: 'WhatsApp',
	vi: 'Viber',
};

const SHARE_WAIT_POLL_MS = 400;
const SHARE_WAIT_STABLE_READS = 3;

function parseShareCount(text) {
	const value = parseInt(String(text || '').trim(), 10);
	return Number.isFinite(value) && value >= 0 ? value : 0;
}

function extractPageTitle() {
	const h1 =
		document.querySelector('h1[itemprop="name"]') ||
		document.querySelector('.ftitle h1') ||
		document.querySelector('#h1-ttl h1') ||
		document.querySelector('article.full h1') ||
		document.querySelector('h1');
	return h1 ? h1.textContent.trim() : document.title;
}

function findShareBar() {
	return document.querySelector('.uscl-bar') || document.querySelector('.uSocial-Share');
}

function hasShareBarStructure() {
	const bar = findShareBar();
	if (!bar) return false;

	let found = 0;
	for (const platform of SHARE_PLATFORMS) {
		if (bar.querySelector('[data-item="' + platform + '"] .uscl-each-counter, [data-item="' + platform + '"]')) {
			found += 1;
		}
	}

	return found >= 4;
}

function isUsocialScriptPresent() {
	return Boolean(document.querySelector('script[data-script="usocial"], script[src*="usocial"]'));
}

function isUsocialShareInitialized() {
	return (
		window.uSocialShareInit === 'init' ||
		(typeof window.uSocialShare !== 'undefined' && window.uSocialShare !== null)
	);
}

function getShareCounterFingerprint() {
	const bar = findShareBar();
	if (!bar) return '';

	const parts = [];
	for (const platform of SHARE_PLATFORMS) {
		const item = bar.querySelector('[data-item="' + platform + '"]');
		const counter = item?.querySelector('.uscl-each-counter');
		parts.push(platform + ':' + String(counter?.textContent || '').trim());
	}

	return parts.join('|');
}

function isAllZeroFingerprint(fingerprint) {
	if (!fingerprint) return true;
	return fingerprint.split('|').every((part) => /:0$/.test(part) || /:$/.test(part));
}

function waitForSocialSharesReady(maxMs = 20000) {
	return new Promise((resolve) => {
		const startedAt = Date.now();
		let lastFingerprint = '';
		let stableReads = 0;
		let barSeenAt = 0;

		const finish = (payload) => {
			resolve({
				ready: Boolean(payload.ready),
				reason: payload.reason || '',
				fingerprint: getShareCounterFingerprint(),
				usocialReady: isUsocialShareInitialized(),
				usocialScript: isUsocialScriptPresent(),
				waitedMs: Date.now() - startedAt,
			});
		};

		const tick = () => {
			const elapsed = Date.now() - startedAt;

			const hasStructure = hasShareBarStructure();
			const fingerprint = getShareCounterFingerprint();
			const usocialReady = isUsocialShareInitialized();
			const usocialScript = isUsocialScriptPresent();
			const allZero = isAllZeroFingerprint(fingerprint);

			if (hasStructure && !barSeenAt) {
				barSeenAt = Date.now();
			}

			if (hasStructure && fingerprint) {
				if (fingerprint === lastFingerprint) {
					stableReads += 1;
				} else {
					stableReads = 0;
					lastFingerprint = fingerprint;
				}
			} else {
				stableReads = 0;
				lastFingerprint = '';
			}

			const stableEnough = stableReads >= SHARE_WAIT_STABLE_READS;
			const minBarAgeMs = barSeenAt ? Date.now() - barSeenAt : 0;

			if (hasStructure && stableEnough && usocialReady) {
				finish({ ready: true, reason: 'usocial-stable' });
				return;
			}

			if (hasStructure && stableEnough && !allZero) {
				finish({ ready: true, reason: 'counters-stable' });
				return;
			}

			if (hasStructure && stableEnough && allZero && minBarAgeMs >= 2500) {
				finish({ ready: true, reason: 'zero-stable' });
				return;
			}

			if (hasStructure && stableEnough && minBarAgeMs >= 5000 && !usocialScript) {
				finish({ ready: true, reason: 'static-html' });
				return;
			}

			if (elapsed >= maxMs) {
				finish({
					ready: hasStructure,
					reason: hasStructure ? 'timeout-with-bar' : 'timeout-no-bar',
				});
				return;
			}

			setTimeout(tick, SHARE_WAIT_POLL_MS);
		};

		tick();
	});
}

function extractSocialShares() {
	const shares = Object.fromEntries(SHARE_PLATFORMS.map((key) => [key, 0]));
	const bar = findShareBar();

	if (!bar) {
		return {
			title: extractPageTitle(),
			url: location.href,
			shares,
			total: 0,
			error: 'Блок uSocial не найден на странице',
		};
	}

	for (const item of bar.querySelectorAll('[data-item]')) {
		const platform = item.getAttribute('data-item');
		if (!SHARE_PLATFORMS.includes(platform)) continue;

		const counter = item.querySelector('.uscl-each-counter');
		shares[platform] = parseShareCount(counter?.textContent);
	}

	const total = SHARE_PLATFORMS.reduce((sum, key) => sum + shares[key], 0);

	return {
		title: extractPageTitle(),
		url: location.href,
		shares,
		total,
		error: null,
	};
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		SHARE_PLATFORMS,
		SHARE_PLATFORM_LABELS,
		SHARE_WAIT_POLL_MS,
		SHARE_WAIT_STABLE_READS,
		extractSocialShares,
		parseShareCount,
		waitForSocialSharesReady,
		getShareCounterFingerprint,
		isAllZeroFingerprint,
		hasShareBarStructure,
		isUsocialShareInitialized,
	};
}
