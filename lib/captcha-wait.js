function normalizeRobotText(text) {
	return (text || '').replace(/\s+/g, ' ').trim();
}

function isRobotButtonText(text) {
	return /я\s*не\s*робот/i.test(normalizeRobotText(text));
}

function checkPageParseReady() {
	function isElementVisible(el) {
		if (!el) return false;
		const style = window.getComputedStyle(el);
		if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
			return false;
		}
		const rect = el.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			return false;
		}
		return el.offsetParent !== null || style.position === 'fixed';
	}

	function hasParseableContent() {
		return !!document.querySelector(
			'.fpage, article.full, .finfo, .fposter, .playlists-items li[data-file], .playlists-lists li, .fdesc, .uscl-bar, .uSocial-Share'
		);
	}

	function findRobotButtons() {
		const btn = findBestRobotButton();
		return btn ? [btn] : [];
	}

	function detectChallengeKind() {
		const bodyText = normalizeRobotText(document.body?.innerText || '');
		const titleText = normalizeRobotText(document.title || '');
		const hasDeniedText =
			/sorry[,.\s]*your request has been denied/i.test(bodyText) ||
			/request has been denied/i.test(bodyText) ||
			/запрос отклон/i.test(bodyText) ||
			/доступ запрещ/i.test(bodyText);
		const hasDeniedTitle = /^\d{1,3}(\.\d{1,3}){3}\s+\d{2}\.\d{2}\.\d{4}/.test(titleText);

		if (hasDeniedText || hasDeniedTitle) {
			return 'denied';
		}

		const hasCaptchaText =
			/подтвердите,\s*что вы человек/i.test(bodyText) || /я\s*не\s*робот/i.test(bodyText);

		if (hasParseableContent()) {
			return null;
		}

		const challengeShell = document.querySelector('.block1 .block2, .block2 > .info');
		if (
			challengeShell &&
			!document.querySelector('.fpage, article.full, .ftitle, .fposter') &&
			bodyText.length > 0 &&
			bodyText.length < 500
		) {
			return 'captcha';
		}

		return null;
	}

	function hasParseableTitle() {
		const h1 = document.querySelector(
			'h1[itemprop="name"], .ftitle h1, #h1-ttl h1, article.full h1, h1'
		);
		if (!h1 || !isElementVisible(h1)) return false;
		const text = (h1.textContent || '').trim();
		return text.length > 0 && !/подтвердите/i.test(text) && !/я не робот/i.test(text);
	}

	const blockedKind = detectChallengeKind();
	const captcha = blockedKind === 'captcha';
	const blocked = Boolean(blockedKind);
	const hasTitle = hasParseableTitle();
	const hasContent = hasParseableContent();

	return {
		ok: true,
		captcha,
		blocked,
		blockedKind: blockedKind || '',
		hasTitle,
		hasContent,
		ready: !blocked && (hasTitle || hasContent),
	};
}

function isClickableRobotElement(el) {
	if (!el || !isRobotButtonText(el.textContent)) return false;
	if (normalizeRobotText(el.textContent).length > 40) return false;

	const style = window.getComputedStyle(el);
	if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
		return false;
	}

	const rect = el.getBoundingClientRect();
	return rect.width >= 20 && rect.height >= 10;
}

function findBestRobotButton() {
	const selectors = [
		'.block2 [onclick]',
		'.block2 #content div',
		'.block2 div',
		'.info div',
		'#content div',
		'div[onclick]',
		'button',
		'a',
	];
	const seen = new Set();
	const candidates = [];

	for (const selector of selectors) {
		for (const el of document.querySelectorAll(selector)) {
			if (seen.has(el) || !isClickableRobotElement(el)) continue;
			seen.add(el);

			const rect = el.getBoundingClientRect();
			const style = window.getComputedStyle(el);
			let score = rect.width * rect.height;
			if (el.hasAttribute('onclick')) score += 100000;
			if (typeof el.onclick === 'function') score += 50000;
			if (style.cursor === 'pointer') score += 10000;

			candidates.push({ el, score });
		}
	}

	candidates.sort((a, b) => b.score - a.score);
	return candidates[0]?.el || null;
}

function tryClickElement(el) {
	try {
		el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
	} catch (_) {
		try {
			el.scrollIntoView(true);
		} catch (_) {}
	}

	const event = new MouseEvent('click', {
		bubbles: true,
		cancelable: true,
		view: window,
		button: 0,
	});

	if (typeof el.onclick === 'function') {
		try {
			el.onclick.call(el, event);
			return 'native-onclick';
		} catch (_) {}
	}

	const onclickAttr = el.getAttribute('onclick');
	if (onclickAttr) {
		try {
			(0, eval)(onclickAttr);
			return 'eval-onclick';
		} catch (_) {}
	}

	const rect = el.getBoundingClientRect();
	const x = rect.left + rect.width / 2;
	const y = rect.top + rect.height / 2;

	for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
		try {
			el.dispatchEvent(
				new MouseEvent(type, {
					bubbles: true,
					cancelable: true,
					view: window,
					button: 0,
					clientX: x,
					clientY: y,
				})
			);
		} catch (_) {}
	}

	try {
		el.click();
		return 'dom-click';
	} catch (_) {}

	return null;
}

function clickRobotChallengeButton() {
	const btn = findBestRobotButton();
	if (!btn) {
		return { clicked: false, reason: 'button-not-found' };
	}

	const method = tryClickElement(btn);
	return { clicked: Boolean(method), method: method || 'none' };
}
