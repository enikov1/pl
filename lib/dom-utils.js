function capitalizeFirstLetter(string) {
	if (!string) return '';
	return string.charAt(0).toUpperCase() + string.slice(1);
}

function toAbsoluteUrl(url) {
	if (!url) return '';
	if (url.startsWith('http://') || url.startsWith('https://')) return url;
	if (url.startsWith('//')) return window.location.protocol + url;
	return window.location.origin + (url.startsWith('/') ? url : '/' + url);
}

function parseSdLine(label) {
	const lines = document.querySelectorAll('.sd-line');
	for (const line of lines) {
		const spans = line.querySelectorAll(':scope > span');
		const labelSpan = spans[0] || line.querySelector('span');
		if (!labelSpan) continue;

		const spanText = labelSpan.textContent.replace(':', '').trim();
		if (!spanText.toLowerCase().includes(label.toLowerCase())) continue;

		if (spans.length >= 2) {
			return spans[1].textContent.replace(/\s+/g, ' ').trim();
		}

		const clone = line.cloneNode(true);
		const cloneSpan = clone.querySelector('span');
		if (cloneSpan) cloneSpan.remove();
		return clone.textContent.replace(/^:\s*/, '').replace(/\s+/g, ' ').trim();
	}
	return '';
}

function splitCommaList(value) {
	if (!value) return [];
	return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function extractTitleRu(fullTitle) {
	if (!fullTitle) return '';

	const normalized = fullTitle.trim();

	const typeMatch = normalized.match(
		/\s+(?:сериал|фильм|тв[-\s]?шоу|мультфильм|аниме|hd)\b/i
	);
	if (typeMatch && typeMatch.index > 0) {
		return normalized.substring(0, typeMatch.index).trim();
	}

	const markers = [' Сериал', ' Фильм', ' ТВ-Шоу', ' HD'];
	for (const marker of markers) {
		const idx = normalized.indexOf(marker);
		if (idx > 0) return normalized.substring(0, idx).trim();
	}

	const parenYear = normalized.match(/^(.+?)\s*\(\d{4}\)\s*$/);
	if (parenYear) return parenYear[1].trim();

	return normalized;
}

function buildPosterFileName(titleRu, year) {
	const parts = [titleRu, year].filter(Boolean);
	if (parts.length === 0) return 'poster';
	return parts
		.join(' ')
		.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function getExtensionFromMime(mimeType, url) {
	const map = {
		'image/jpeg': 'jpg',
		'image/jpg': 'jpg',
		'image/png': 'png',
		'image/webp': 'webp',
		'image/gif': 'gif',
		'image/bmp': 'bmp',
	};
	if (mimeType && map[mimeType]) return map[mimeType];
	const urlMatch = (url || '').match(/\.(jpe?g|png|webp|gif|bmp)/i);
	return urlMatch ? urlMatch[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

const TV_CHANNEL_ALIASES = {
	'сериалы твц': 'ТВЦ',
	'твц': 'ТВЦ',
	'стс': 'СТС',
	'нтв': 'НТВ',
	'тнт': 'ТНТ',
	'домашний': 'Домашний',
	'военный': 'Военный',
	'пятница': 'Пятница',
	'суббота': 'Суббота',
	'муз-тв': 'МУЗ-ТВ',
	'муз тв': 'МУЗ-ТВ',
	'тв-3': 'ТВ-3',
	'тв 3': 'ТВ-3',
	'рен-тв': 'РЕН-ТВ',
	'рен тв': 'РЕН-ТВ',
	'5 канал': '5 канал',
	'пятый канал': '5 канал',
	'1 канал': 'Первый канал',
	'первый канал': 'Первый канал',
	'первый': 'Первый канал',
	'россия 1': 'Россия 1',
	'россия-1': 'Россия 1',
	'россия1': 'Россия 1',
	'ю': 'Ю',
	'че!': 'ЧЕ!',
	'че': 'ЧЕ!',
};

const KNOWN_TV_CHANNELS = [
	...new Set(Object.values(TV_CHANNEL_ALIASES)),
];

function stripTvChannelPrefixes(text) {
	return text
		.replace(/^(?:сериалы(?:\s+на)?|телеканал|тв[\s-]?канал)\s+/i, '')
		.trim();
}

function lookupTvChannelAlias(text) {
	const key = text.toLowerCase().replace(/\s+/g, ' ').trim();
	return TV_CHANNEL_ALIASES[key] || '';
}

function normalizeTvChannel(raw) {
	if (!raw) return '';

	let text = raw.replace(/\s+/g, ' ').trim();
	if (!text) return '';

	text = stripTvChannelPrefixes(text);

	const directAlias = lookupTvChannelAlias(text);
	if (directAlias) return directAlias;

	const sorted = [...KNOWN_TV_CHANNELS].sort((a, b) => b.length - a.length);
	for (const channel of sorted) {
		const escaped = channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const pattern = escaped.replace(/\s+/g, '\\s+');
		if (new RegExp(pattern, 'i').test(text)) {
			return channel;
		}
	}

	const parenMatch = text.match(/\(([^)]+)\)\s*$/);
	if (parenMatch) {
		const fromParen = normalizeTvChannel(parenMatch[1]);
		if (fromParen) return fromParen;
	}

	const words = text.split(/\s+/);
	for (let i = words.length; i > 0; i--) {
		const tail = words.slice(-i).join(' ');
		const tailAlias = lookupTvChannelAlias(tail);
		if (tailAlias) return tailAlias;
	}

	const lastWord = words[words.length - 1] || '';
	if (/^(стс|твц|нтв|тнт)$/i.test(lastWord)) {
		return lastWord.toUpperCase();
	}

	return text;
}

function extractChannelFromPremiera(premera) {
	if (!premera) return '';
	const parenMatch = premera.match(/\(([^)]+)\)\s*$/);
	return parenMatch ? normalizeTvChannel(parenMatch[1]) : '';
}

function extractEpisodeNumber(title) {
	if (!title) return 0;
	const match = title.match(/(\d+)\s*(?:серия|серии|серий|эпизод)/i);
	return match ? parseInt(match[1], 10) : 0;
}

function extractSeasonNumber(title) {
	if (!title) return 0;
	const match = title.match(/(\d+)\s*сезон/i);
	return match ? parseInt(match[1], 10) : 0;
}

function createJQueryLikeHelper() {
	return function $(selector) {
		return {
			find(subSelector) {
				const elements = document.querySelectorAll(selector);
				let results = [];
				elements.forEach((el) => {
					results = [...results, ...el.querySelectorAll(subSelector)];
				});
				return $(results);
			},
			each(callback) {
				let elements;
				if (typeof selector === 'string') {
					elements = document.querySelectorAll(selector);
				} else if (selector instanceof NodeList || Array.isArray(selector)) {
					elements = selector;
				} else if (selector instanceof HTMLElement) {
					elements = [selector];
				} else {
					elements = [];
				}

				elements.forEach((el, i) =>
					callback(i, {
						element: el,
						text: () => el.textContent || '',
						attr: (attr) => el.getAttribute(attr),
					})
				);
				return this;
			},
			text() {
				if (typeof selector === 'string') {
					const el = document.querySelector(selector);
					return el ? el.textContent : '';
				}
				return '';
			},
			attr(attr) {
				if (typeof selector === 'string') {
					const el = document.querySelector(selector);
					return el ? el.getAttribute(attr) : null;
				}
				return null;
			},
			get length() {
				if (typeof selector === 'string') {
					return document.querySelectorAll(selector).length;
				}
				return selector ? selector.length : 0;
			},
		};
	};
}
