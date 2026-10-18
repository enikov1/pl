(function () {
	const PAGE_SOURCE = 'vde-catalog';
	const EXT_SOURCE = 'vde-extension';

	window.addEventListener('message', (event) => {
		if (event.source !== window) return;
		const data = event.data;
		if (!data || data.source !== PAGE_SOURCE) return;

		if (data.type === 'ping') {
			window.postMessage({ source: EXT_SOURCE, type: 'pong', requestId: data.requestId }, '*');
			return;
		}

		if (data.type === 'full_parse') {
			chrome.runtime.sendMessage(
				{
					type: 'CATALOG_IMMEDIATE_FULL_PARSE',
					payload: {
						linkId: data.linkId,
						url: data.url,
						sourceId: data.sourceId || 'auto',
					},
				},
				(response) => {
					const error = chrome.runtime.lastError;
					window.postMessage(
						{
							source: EXT_SOURCE,
							type: 'full_parse_result',
							requestId: data.requestId,
							ok: !error && Boolean(response?.success),
							title: response?.title || '',
							error: error?.message || response?.error || '',
						},
						'*'
					);
				}
			);
			return;
		}

		if (data.type === 'stop_crawl') {
			chrome.runtime.sendMessage(
				{
					type: 'CATALOG_STOP_CRAWL',
					payload: { runId: data.runId },
				},
				(response) => {
					const error = chrome.runtime.lastError;
					window.postMessage(
						{
							source: EXT_SOURCE,
							type: 'stop_crawl_result',
							requestId: data.requestId,
							ok: !error && Boolean(response?.success),
							error: error?.message || response?.error || '',
						},
						'*'
					);
				}
			);
		}
	});

	window.postMessage({ source: EXT_SOURCE, type: 'ready' }, '*');
})();
