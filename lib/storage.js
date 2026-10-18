const DEFAULT_SETTINGS = {
	adminUrls: [
		{
			id: 'default',
			name: 'russerialov.net',
			url: 'https://russerialov.net/admi_rs.php?mod=addnews&action=addnews',
			isDefault: true,
		},
	],
	lastParseUrl: '',
	parsedData: null,
	pendingFill: false,
	targetAdminUrl: '',
	catalogServerUrl: 'http://127.0.0.1:3921',
};

async function getSettings() {
	const result = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
	return { ...DEFAULT_SETTINGS, ...result };
}

async function saveSettings(partial) {
	await chrome.storage.local.set(partial);
}

async function saveParsedData(data, targetAdminUrl) {
	await chrome.storage.local.set({
		parsedData: data,
		pendingFill: true,
		targetAdminUrl,
	});
}

async function clearPendingFill() {
	await chrome.storage.local.set({ pendingFill: false });
}

async function getAdminUrls() {
	const { adminUrls } = await getSettings();
	return adminUrls || [];
}

async function getDefaultAdminUrl() {
	const adminUrls = await getAdminUrls();
	const defaultItem = adminUrls.find((item) => item.isDefault);
	return defaultItem?.url || adminUrls[0]?.url || '';
}
