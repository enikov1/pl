const DEFAULT_ADMIN_URLS = [
	{
		id: 'default',
		name: 'russerialov.net',
		url: 'https://russerialov.net/admi_rs.php?mod=addnews&action=addnews',
		isDefault: true,
	},
];

let adminUrls = [];

function generateId() {
	return 'url_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function showStatus(message, isError = false) {
	const status = document.getElementById('status');
	status.textContent = message;
	status.className = isError ? 'error' : 'success';
}

function renderAdminUrls() {
	const container = document.getElementById('adminUrlsList');
	container.innerHTML = '';

	adminUrls.forEach((item, index) => {
		const row = document.createElement('div');
		row.className = 'admin-row';
		row.innerHTML = `
			<input type="radio" name="defaultAdmin" value="${item.id}" ${item.isDefault ? 'checked' : ''} title="По умолчанию">
			<input type="text" class="name-input" data-index="${index}" value="${escapeHtml(item.name)}" placeholder="Название">
			<input type="url" class="url-input" data-index="${index}" value="${escapeHtml(item.url)}" placeholder="https://site.com/admi.php?mod=addnews&action=addnews">
			<button type="button" class="danger remove-btn" data-index="${index}">✕</button>
		`;
		container.appendChild(row);
	});

	container.querySelectorAll('.name-input').forEach((input) => {
		input.addEventListener('input', (e) => {
			adminUrls[e.target.dataset.index].name = e.target.value;
		});
	});

	container.querySelectorAll('.url-input').forEach((input) => {
		input.addEventListener('input', (e) => {
			adminUrls[e.target.dataset.index].url = e.target.value;
		});
	});

	container.querySelectorAll('.remove-btn').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			const index = parseInt(e.target.dataset.index, 10);
			const wasDefault = adminUrls[index].isDefault;
			adminUrls.splice(index, 1);
			if (wasDefault && adminUrls.length > 0) {
				adminUrls[0].isDefault = true;
			}
			renderAdminUrls();
		});
	});

	container.querySelectorAll('input[name="defaultAdmin"]').forEach((radio) => {
		radio.addEventListener('change', (e) => {
			adminUrls.forEach((item) => {
				item.isDefault = item.id === e.target.value;
			});
		});
	});
}

function escapeHtml(str) {
	return String(str || '')
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

async function loadSettings() {
	const result = await chrome.storage.local.get(['adminUrls', 'catalogServerUrl']);
	adminUrls = result.adminUrls?.length ? result.adminUrls : [...DEFAULT_ADMIN_URLS];
	const catalogInput = document.getElementById('catalogServerUrl');
	if (catalogInput) {
		catalogInput.value = result.catalogServerUrl || 'http://127.0.0.1:3921';
	}
	renderAdminUrls();
}

async function saveSettings() {
	if (adminUrls.length === 0) {
		showStatus('Добавьте хотя бы один admin URL', true);
		return;
	}

	const hasDefault = adminUrls.some((item) => item.isDefault);
	if (!hasDefault) {
		adminUrls[0].isDefault = true;
	}

	for (const item of adminUrls) {
		if (!item.url || !item.url.startsWith('http')) {
			showStatus('Все URL должны начинаться с http:// или https://', true);
			return;
		}
	}

	await chrome.storage.local.set({ adminUrls });
	showStatus('Настройки сохранены');
}

document.getElementById('addUrlBtn').addEventListener('click', () => {
	adminUrls.push({
		id: generateId(),
		name: 'Новый сайт',
		url: '',
		isDefault: adminUrls.length === 0,
	});
	renderAdminUrls();
});

document.getElementById('saveBtn').addEventListener('click', saveSettings);

document.getElementById('saveCatalogBtn')?.addEventListener('click', async () => {
	const url = document.getElementById('catalogServerUrl').value.trim() || 'http://127.0.0.1:3921';
	if (!/^https?:\/\//i.test(url)) {
		showStatus('URL сервера должен начинаться с http:// или https://', true);
		return;
	}
	await chrome.storage.local.set({ catalogServerUrl: url.replace(/\/$/, '') });
	showStatus('URL каталога сохранён');
});

document.getElementById('openCatalogBtn')?.addEventListener('click', async () => {
	const stored = await chrome.storage.local.get(['catalogServerUrl']);
	const base = (stored.catalogServerUrl || 'http://127.0.0.1:3921').replace(/\/$/, '');
	chrome.tabs.create({ url: base + '/' });
});

loadSettings();
