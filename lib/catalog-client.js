const DEFAULT_CATALOG_SERVER_URL = 'http://127.0.0.1:3921';

async function getCatalogServerUrl() {
	try {
		const { catalogServerUrl } = await chrome.storage.local.get(['catalogServerUrl']);
		const value = String(catalogServerUrl || '').trim();
		return value || DEFAULT_CATALOG_SERVER_URL;
	} catch {
		return DEFAULT_CATALOG_SERVER_URL;
	}
}

async function catalogFetch(path, options = {}) {
	const base = (await getCatalogServerUrl()).replace(/\/$/, '');
	const url = base + path;
	const response = await fetch(url, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...(options.headers || {}),
		},
	});

	let data = null;
	try {
		data = await response.json();
	} catch {
		data = null;
	}

	if (!response.ok || data?.ok === false) {
		const message = data?.error || `Catalog HTTP ${response.status}`;
		const error = new Error(message);
		error.status = response.status;
		throw error;
	}

	return data;
}

async function catalogHealth() {
	return catalogFetch('/api/health');
}

async function catalogClaimJob() {
	const data = await catalogFetch('/api/jobs/claim');
	return data.job || null;
}

async function catalogGetJob(runId) {
	const data = await catalogFetch(`/api/jobs/${runId}`);
	return data.run || null;
}

async function catalogReportProgress(runId, payload) {
	return catalogFetch(`/api/jobs/${runId}/progress`, {
		method: 'POST',
		body: JSON.stringify(payload),
	});
}

async function catalogFinishJob(runId, status = 'completed') {
	return catalogFetch(`/api/jobs/${runId}/finish`, {
		method: 'POST',
		body: JSON.stringify({ status }),
	});
}

async function catalogClaimAction() {
	const data = await catalogFetch('/api/actions/claim');
	return data.action || null;
}

async function catalogCompleteAction(actionId, status = 'done') {
	return catalogFetch(`/api/actions/${actionId}/complete`, {
		method: 'POST',
		body: JSON.stringify({ status }),
	});
}

async function catalogMarkFullParseDone(linkId) {
	return catalogFetch(`/api/links/${linkId}/full-parse-done`, {
		method: 'POST',
		body: '{}',
	});
}

if (typeof globalThis !== 'undefined') {
	globalThis.DEFAULT_CATALOG_SERVER_URL = DEFAULT_CATALOG_SERVER_URL;
	globalThis.getCatalogServerUrl = getCatalogServerUrl;
	globalThis.catalogFetch = catalogFetch;
	globalThis.catalogHealth = catalogHealth;
	globalThis.catalogClaimJob = catalogClaimJob;
	globalThis.catalogGetJob = catalogGetJob;
	globalThis.catalogReportProgress = catalogReportProgress;
	globalThis.catalogFinishJob = catalogFinishJob;
	globalThis.catalogClaimAction = catalogClaimAction;
	globalThis.catalogCompleteAction = catalogCompleteAction;
	globalThis.catalogMarkFullParseDone = catalogMarkFullParseDone;
}
