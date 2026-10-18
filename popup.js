const PARSER_FILES = [
	'lib/dom-utils.js',
	'lib/parsers/playlist.js',
];

function showStatus(message, type = 'info') {
	const statusDiv = document.getElementById('status');
	statusDiv.className = 'status ' + type;
	statusDiv.textContent = message;
}

function getSourceType() {
	return document.querySelector('input[name="sourceType"]:checked')?.value || 'current';
}

function getSelectedSourceId() {
	return document.getElementById('parseSourceSelect')?.value || 'auto';
}

function toggleUrlInput() {
	const group = document.getElementById('urlInputGroup');
	group.classList.toggle('hidden', getSourceType() !== 'url');
}

function applyDetectedSource(url) {
	const select = document.getElementById('parseSourceSelect');
	if (!select || select.value !== 'auto') return;

	const detected = detectSourceFromUrl(url);
	if (detected) {
		select.value = detected;
	}
}

async function initSourceSelection() {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	if (tab?.url) {
		applyDetectedSource(tab.url);
	}
}

async function loadAdminUrls() {
	const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
	const select = document.getElementById('adminUrlSelect');

	if (!response?.success) {
		select.innerHTML = '<option value="">Ошибка загрузки настроек</option>';
		return;
	}

	const adminUrls = response.settings.adminUrls || [];
	select.innerHTML = '';

	if (adminUrls.length === 0) {
		select.innerHTML = '<option value="">Нет admin URL — откройте настройки</option>';
		return;
	}

	adminUrls.forEach((item) => {
		const option = document.createElement('option');
		option.value = item.url;
		option.textContent = item.name + (item.isDefault ? ' (по умолчанию)' : '');
		if (item.isDefault) option.selected = true;
		select.appendChild(option);
	});

	if (response.settings.lastParseUrl) {
		document.getElementById('parseUrl').value = response.settings.lastParseUrl;
		applyDetectedSource(response.settings.lastParseUrl);
	}
}

document.querySelectorAll('input[name="sourceType"]').forEach((radio) => {
	radio.addEventListener('change', toggleUrlInput);
});

document.getElementById('parseUrl')?.addEventListener('input', (e) => {
	if (getSourceType() === 'url') {
		applyDetectedSource(e.target.value.trim());
	}
});

document.getElementById('parseSourceSelect')?.addEventListener('change', () => {
	// user manually picked source — keep selection
});

document.getElementById('openOptions').addEventListener('click', (e) => {
	e.preventDefault();
	chrome.runtime.openOptionsPage();
});

document.getElementById('openCatalogBtn')?.addEventListener('click', async () => {
	try {
		const result = await chrome.storage.local.get(['catalogServerUrl']);
		const base = (result.catalogServerUrl || 'http://127.0.0.1:3921').replace(/\/$/, '');
		chrome.tabs.create({ url: base + '/' });
	} catch {
		chrome.tabs.create({ url: 'http://127.0.0.1:3921/' });
	}
	window.close();
});

document.getElementById('openBulkBtn')?.addEventListener('click', () => {
	chrome.tabs.create({ url: chrome.runtime.getURL('bulk.html') });
	window.close();
});

document.getElementById('openSharesBtn')?.addEventListener('click', () => {
	chrome.tabs.create({ url: chrome.runtime.getURL('shares.html') });
	window.close();
});

document.getElementById('extractBtn').addEventListener('click', async () => {
	try {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

		await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			files: PARSER_FILES,
		});

		const results = await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: () => JSON.stringify(extractPlaylist(), null, 2),
		});

		const jsonData = results[0]?.result;
		if (!jsonData) {
			throw new Error('No playlist data found');
		}

		await navigator.clipboard.writeText(jsonData);
		showStatus('✓ Плейлист скопирован в буфер обмена!', 'success');

		setTimeout(() => window.close(), 1500);
	} catch (error) {
		showStatus('✗ Ошибка: ' + error.message, 'error');
		console.error('Playlist extract error:', error);
	}
});

document.getElementById('fullParseBtn').addEventListener('click', async () => {
	const btn = document.getElementById('fullParseBtn');
	btn.disabled = true;

	try {
		const sourceType = getSourceType();
		const sourceUrl = document.getElementById('parseUrl').value.trim();
		const adminUrl = document.getElementById('adminUrlSelect').value;
		const sourceId = getSelectedSourceId();

		if (sourceType === 'url' && !sourceUrl) {
			throw new Error('Введите URL для парсинга');
		}
		if (!adminUrl) {
			throw new Error('Выберите admin URL или добавьте в настройках');
		}

		showStatus('Парсинг...', 'info');

		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

		const response = await chrome.runtime.sendMessage({
			type: 'FULL_PARSE',
			payload: {
				sourceType,
				sourceUrl: sourceType === 'url' ? sourceUrl : '',
				adminUrl,
				sourceId,
				currentTabId: tab?.id,
			},
		});

		if (!response?.success) {
			throw new Error(response?.error || 'Unknown error');
		}

		showStatus('✓ Данные сохранены, админка открыта: ' + (response.title || ''), 'success');
		setTimeout(() => window.close(), 2000);
	} catch (error) {
		showStatus('✗ Ошибка: ' + error.message, 'error');
		console.error('Full parse error:', error);
	} finally {
		btn.disabled = false;
	}
});

toggleUrlInput();
initSourceSelection();
loadAdminUrls();
