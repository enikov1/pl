const { readFileSync } = require('fs');
const { join } = require('path');
const vm = require('vm');

const root = join(__dirname, '..');

async function main() {
	const context = vm.createContext({
		chrome: { storage: { local: { get: async () => ({}), set: async () => {} } } },
		console,
		URL,
		URLSearchParams,
	});
	vm.runInContext(readFileSync(join(root, 'lib/parsers/playlist.js'), 'utf8'), context);
	vm.runInContext(readFileSync(join(root, 'lib/bulk-update.js'), 'utf8'), context);

	const urls = context.parseUrlList(`
https://example.com/a
  https://example.com/b
not-a-url
https://example.com/a
https://test.com/page.html,
`);

	if (urls.length !== 3) {
		console.error('FAILED parseUrlList:', urls);
		process.exit(1);
	}

	const sitemapXml = readFileSync(join(__dirname, 'sitemap-fixture.xml'), 'utf8');

	async function mockFetch(url) {
		if (url === 'https://example.com/sitemap.xml') {
			return {
				ok: true,
				text: async () => sitemapXml,
			};
		}
		throw new Error('unexpected fetch: ' + url);
	}

	const asyncContext = vm.createContext({
		chrome: { storage: { local: { get: async () => ({}), set: async () => {} } } },
		console,
		URL,
		URLSearchParams,
		fetch: mockFetch,
	});

	vm.runInContext(readFileSync(join(root, 'lib/parsers/playlist.js'), 'utf8'), asyncContext);
	vm.runInContext(readFileSync(join(root, 'lib/bulk-update.js'), 'utf8'), asyncContext);

	const resolved = await asyncContext.resolveUrlList(
		'https://example.com/sitemap.xml\nhttps://example.com/extra.html'
	);

	if (resolved.length !== 3) {
		console.error('FAILED resolveUrlList from sitemap:', resolved);
		process.exit(1);
	}

	const fromContent = await asyncContext.resolveUrlList(sitemapXml);
	if (fromContent.length !== 2 || fromContent[0] !== 'https://russian-seriali.net/100-first.html') {
		console.error('FAILED resolveUrlList from XML content:', fromContent);
		process.exit(1);
	}

	const apiUrl = context.buildUpdateLinkUrl({
		title: 'Рыцарь Семи Королевств',
		year: '2025',
		sourceUrl: 'https://russian-seriali.net/3076-test.html',
		updatePlaylist: true,
		playlist: [
			{ file: 'https://vk.com/video_ext.php?oid=-1&id=1', title: '1 серия' },
			{ file: 'https://vk.com/video_ext.php?oid=-1&id=2', title: '2 серия' },
		],
	});

	const nestedUrl = context.buildUpdateLinkUrl({
		title: 'Муж моей мечты',
		year: '2025',
		sourceUrl: 'https://russian-seriali.net/3076-test.html',
		updatePlaylist: true,
		playlist: [
			{
				title: 'Первый источник',
				folder: [
					{ file: 'https://vk.com/a', title: '1-4 Серия' },
					{ file: 'https://vk.com/b', title: '1 Серия' },
					{ file: 'https://vk.com/c', title: '2 Серия' },
					{ file: 'https://vk.com/d', title: '3 Серия' },
					{ file: 'https://vk.com/e', title: '4 Серия' },
				],
			},
			{
				title: 'Второй источник',
				folder: [
					{ file: 'https://smotrim.ru/1', title: '1 Серия' },
					{ file: 'https://smotrim.ru/2', title: '2 Серия' },
				],
			},
		],
	});

	const nestedPlaylist = JSON.parse(new URL(nestedUrl).searchParams.get('playlist'));
	if (nestedPlaylist.length !== 2) {
		console.error('FAILED nested playlist sources:', nestedPlaylist);
		process.exit(1);
	}
	if (nestedPlaylist[0].title !== 'Первый источник' || !nestedPlaylist[0].folder) {
		console.error('FAILED first source structure');
		process.exit(1);
	}
	if (nestedPlaylist[0].folder.length !== 5) {
		console.error('FAILED first source episodes count');
		process.exit(1);
	}
	if (nestedPlaylist[1].title !== 'Второй источник' || nestedPlaylist[1].folder.length !== 2) {
		console.error('FAILED second source structure');
		process.exit(1);
	}

	const protocolUrl = context.buildUpdateLinkUrl({
		title: 'Test',
		year: '2026',
		sourceUrl: 'https://russian-seriali.net/test.html',
		updatePlaylist: true,
		playlist: [
			{
				title: 'Первый источник',
				folder: [{ file: '//ok.ru/videoembed/123', title: '1 Серия' }],
			},
		],
	});
	const protocolPlaylist = JSON.parse(new URL(protocolUrl).searchParams.get('playlist'));
	if (protocolPlaylist[0].folder[0].file !== 'https://ok.ru/videoembed/123') {
		console.error('FAILED protocol-relative file URL');
		process.exit(1);
	}

	const parsed = new URL(apiUrl);
	if (parsed.searchParams.get('mod') !== 'updatelink') {
		console.error('FAILED mod param');
		process.exit(1);
	}

	const playlist = JSON.parse(parsed.searchParams.get('playlist'));
	if (!Array.isArray(playlist) || playlist.length !== 2) {
		console.error('FAILED playlist param');
		process.exit(1);
	}

	const sampleApi = context.parseUpdateLinkApiResponse(
		JSON.stringify({
			success: true,
			message: 'Поля russians_parse и playlist успешно обновлены',
			news_ids: [5143],
			updated_count: 1,
			news_urls: ['https://lordserialsc2026.net/serialy/5143-vne-zakona.html'],
			news_url: 'https://lordserialsc2026.net/serialy/5143-vne-zakona.html',
			title: 'Вне закона',
			year: '2026',
			russians_parse:
				'https://russian-seriali.net/3070-vne-zakona-serial-2026-vse-1-12-serii-podrjad.html',
			playlist: '[{"file":"https://www.ivi.ru/...","title":"Трейлер"}]',
		})
	);

	if (!sampleApi || sampleApi.success !== true || !sampleApi.playlist_parsed) {
		console.error('FAILED parseUpdateLinkApiResponse');
		process.exit(1);
	}

	const formatted = context.formatApiResultForDisplay(sampleApi);
	if (!formatted.includes('news_url') || !formatted.includes('Трейлер')) {
		console.error('FAILED formatApiResultForDisplay');
		process.exit(1);
	}

	const newsNotFoundMsg = 'Новость с указанным заголовком и годом не найдена';
	if (context.classifyBulkError(newsNotFoundMsg) !== 'news_not_found') {
		console.error('FAILED classifyBulkError for news not found');
		process.exit(1);
	}
	if (!context.shouldSaveAsNotFound(newsNotFoundMsg)) {
		console.error('FAILED shouldSaveAsNotFound for news not found');
		process.exit(1);
	}
	if (context.shouldSaveAsNotFound('Failed to fetch')) {
		console.error('FAILED shouldSaveAsNotFound excludes network errors');
		process.exit(1);
	}

	console.log('OK: bulk update URL builder checks passed');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
