const PARSE_SOURCES = [
	{
		id: 'russian-seriali',
		name: 'russian-seriali.net',
		hosts: ['russian-seriali.net', 'www.russian-seriali.net'],
	},
	{
		id: 'rosserial',
		name: 'rosserial.mobi / rosserial.be',
		hosts: [
			'rosserial.mobi',
			'www.rosserial.mobi',
			'rosserial.be',
			'www.rosserial.be',
		],
	},
];

function normalizeHost(hostname) {
	return (hostname || '').replace(/^www\./i, '').toLowerCase();
}

function detectSourceFromUrl(url) {
	try {
		const host = normalizeHost(new URL(url).hostname);
		for (const source of PARSE_SOURCES) {
			if (source.hosts.some((h) => normalizeHost(h) === host)) {
				return source.id;
			}
		}
	} catch {
		// ignore invalid URL
	}
	return null;
}

function getSourceById(sourceId) {
	return PARSE_SOURCES.find((s) => s.id === sourceId) || null;
}

function resolveSourceId(sourceId, url) {
	if (sourceId && sourceId !== 'auto') {
		return sourceId;
	}
	return detectSourceFromUrl(url) || 'russian-seriali';
}

// For injected page context
function detectSourceFromDocument() {
	return detectSourceFromUrl(window.location.href) || 'russian-seriali';
}
