/**
 * Smoke test for parser logic (run: node test/verify-parser.cjs)
 */
const { readFileSync } = require('fs');
const { parseHTML } = require('linkedom');
const { join } = require('path');
const vm = require('vm');

const root = join(__dirname, '..');

function loadScript(context, relativePath) {
	const code = readFileSync(join(root, relativePath), 'utf8');
	vm.runInContext(code, context);
}

const html = readFileSync(join(__dirname, 'fixture.html'), 'utf8');
const { document, window } = parseHTML(html);

Object.defineProperty(window, 'location', {
	value: {
		origin: 'https://russian-seriali.net',
		protocol: 'https:',
		href: 'https://russian-seriali.net/test.html',
	},
});

const context = vm.createContext({
	document,
	window,
	console,
	parseInt,
	parseFloat,
	Array,
	Object,
	String,
	JSON,
	Math,
});

loadScript(context, 'lib/dom-utils.js');
loadScript(context, 'lib/sources.js');
loadScript(context, 'lib/parsers/playlist.js');
loadScript(context, 'lib/parsers/metadata-russian-seriali.js');
loadScript(context, 'lib/parsers/metadata-rosserial.js');
loadScript(context, 'lib/parsers/metadata.js');

const result = context.parseFullMedia('russian-seriali');
const errors = [];

if (result.title !== 'На льду') errors.push('title');
if (result.title_ru !== 'На льду') errors.push('title_ru');
if (result.title_default !== 'На льду') errors.push('title_default');
if (result.posterFileName !== 'На льду 2026') errors.push('posterFileName');
if (!result.poster.includes('1776326999_na_ldu_2026.jpg')) errors.push('poster');
if (result.description !== 'Тестовое описание сериала.') errors.push('description');
if (result.year !== '2026') errors.push('year');
if (result.countries !== 'Россия') errors.push('countries');
if (!result.genres.includes('Детектив')) errors.push('genres');
if (result.sum_episode !== '9') errors.push('sum_episode');
if (result.time !== '52 минуты') errors.push('time');
if (result.directors !== 'Максим Кулагин') errors.push('directors');
if (!result.actors.includes('Пахомова')) errors.push('actors');
if (result.type !== 'serial') errors.push('type');
if (!Array.isArray(result.playlist) || result.playlist.length !== 3) errors.push('playlist length');
if (result.last_episode !== 9) errors.push('last_episode');

if (errors.length) {
	console.error('FAILED:', errors.join(', '));
	console.error(JSON.stringify(result, null, 2));
	process.exit(1);
}

console.log('OK: all parser checks passed');
