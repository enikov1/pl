(function () {
	const ADDNEWS_PATTERN = /mod=addnews/i;

	function isAddNewsPage() {
		return ADDNEWS_PATTERN.test(window.location.href);
	}

	async function attemptAutofill() {
		if (!isAddNewsPage()) return;

		const { pendingFill, parsedData, targetAdminUrl } = await chrome.storage.local.get([
			'pendingFill',
			'parsedData',
			'targetAdminUrl',
		]);

		if (!pendingFill || !parsedData) return;

		if (targetAdminUrl) {
			const currentOriginPath = window.location.origin + window.location.pathname;
			const targetOriginPath = (() => {
				try {
					const u = new URL(targetAdminUrl);
					return u.origin + u.pathname;
				} catch {
					return '';
				}
			})();

			if (targetOriginPath && currentOriginPath !== targetOriginPath) {
				return;
			}
		}

		try {
			const result = await tryAutofillDleAdmin(parsedData);
			const cleanedData = { ...parsedData };
			delete cleanedData.posterImageBase64;
			await chrome.storage.local.set({ pendingFill: false, parsedData: cleanedData });
			console.log('[Video Data Extractor] Form filled:', result);
		} catch (error) {
			console.error('[Video Data Extractor] Autofill failed:', error);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', attemptAutofill);
	} else {
		attemptAutofill();
	}

	chrome.storage.onChanged.addListener((changes, area) => {
		if (area === 'local' && changes.pendingFill?.newValue === true) {
			attemptAutofill();
		}
	});
})();
