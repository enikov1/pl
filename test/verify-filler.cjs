const { readFileSync } = require('fs');
const { parseHTML } = require('linkedom');
const { join } = require('path');
const vm = require('vm');

const root = join(__dirname, '..');

function loadScript(context, relativePath) {
	vm.runInContext(readFileSync(join(root, relativePath), 'utf8'), context);
}

async function run() {
	const html = readFileSync(join(__dirname, 'admin-fixture.html'), 'utf8');
	const { document, window } = parseHTML(html);

	const context = vm.createContext({
		document,
		window,
		console,
		Event,
		Object,
		Array,
		String,
		parseInt,
		Promise,
		chrome: {
			runtime: {
				sendMessage: async (msg) => {
					if (msg.action === 'setCategories') {
						const values = msg.args[0];
						const select = document.getElementById('category');
						for (const option of select.options) {
							option.selected = values.includes(option.value);
						}
						return { success: true, result: values };
					}
					if (msg.action === 'setTokenField') {
						const [fieldId, tokens] = msg.args;
						const el = document.getElementById(fieldId);
						if (el) el.value = tokens.join(', ');
						return { success: true, result: true };
					}
					return { success: false, error: 'unknown action' };
				},
			},
		},
	});

	loadScript(context, 'lib/dom-utils.js');
	loadScript(context, 'lib/parsers/playlist.js');
	loadScript(context, 'lib/fillers/dle-admin.js');

	const data = {
		title: 'На льду',
		title_ru: 'На льду',
		title_default: 'На льду',
		description: 'Test desc',
		year: '2026',
		countries: 'Россия',
		genres: 'Драма, Детектив',
		actors: 'Actor One',
		directors: 'Director One',
		time: '52 минуты',
		sum_episode: '9',
		last_episode: 9,
		last_season: '',
		playlist: [{ title: '1 Серия', file: 'https://vk.com/1' }],
	};

	const result = await context.fillDleAdminForm(data);

	const categorySelect = document.getElementById('category');
	const selectedCategories = Array.from(categorySelect.options)
		.filter((o) => o.selected)
		.map((o) => o.value);

	const checks = [
		['title', 'На льду'],
		['xf_title_ru', 'На льду'],
		['xf_title_default', 'На льду'],
		['xf_description', 'Test desc'],
		['xf_year', '2026'],
		['xf_sum_episode', '9'],
		['xf_playlist', JSON.stringify(data.playlist)],
	];

	const errors = [];
	if (!selectedCategories.includes('46')) errors.push('category year 2026');
	if (!selectedCategories.includes('25')) errors.push('category genre Детектив');
	if (!selectedCategories.includes('26')) errors.push('category genre Драма');

	for (const [id, expected] of checks) {
		const actual = document.getElementById(id).value;
		if (actual !== expected) errors.push(`${id}: got "${actual}"`);
	}

	if (errors.length) {
		console.error('FAILED:', errors);
		process.exit(1);
	}

	console.log('OK: filler checks passed, filled:', result.filled.length, 'fields');
}

run().catch((error) => {
	console.error(error);
	process.exit(1);
});
