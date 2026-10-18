const { readFileSync } = require('fs');
const { parseHTML } = require('linkedom');
const { join } = require('path');
const vm = require('vm');

const root = join(__dirname, '..');

function loadScript(context, relativePath) {
	vm.runInContext(readFileSync(join(root, relativePath), 'utf8'), context);
}

const html = readFileSync(join(__dirname, 'rosserial-be-fixture.html'), 'utf8');
const { document, window } = parseHTML(html);

Object.defineProperty(window, 'location', {
	value: {
		origin: 'https://rosserial.be',
		href: 'https://rosserial.be/13637-gorkij-nektar-serial-2025.html',
	},
});

const context = vm.createContext({
	document,
	window,
	console,
	parseInt,
	Array,
	Object,
	String,
	JSON,
	Math,
	URL,
});

loadScript(context, 'lib/dom-utils.js');
loadScript(context, 'lib/sources.js');
loadScript(context, 'lib/parsers/playlist.js');
loadScript(context, 'lib/parsers/metadata-russian-seriali.js');
loadScript(context, 'lib/parsers/metadata-rosserial.js');
loadScript(context, 'lib/parsers/metadata.js');

const detected = context.detectSourceFromUrl(
	'https://rosserial.be/13637-gorkij-nektar-serial-2025.html'
);
const result = context.parseFullMedia('rosserial');
const errors = [];

if (detected !== 'rosserial') errors.push('detectSourceFromUrl');
if (result.sourceId !== 'rosserial') errors.push('sourceId');
if (result.title !== 'Горький нектар') errors.push('title');
if (result.year !== '2025') errors.push('year');
if (result.countries !== 'Россия') errors.push('countries');
if (result.genres !== 'Мелодрамы, Детектив') errors.push('genres');
if (result.sum_episode !== '4') errors.push('sum_episode');
if (result.age !== '16+') errors.push('age');
if (result.directors !== 'Наталья Титова') errors.push('directors');
if (!result.actors.includes('Ольга Сопова')) errors.push('actors');
if (!result.description.includes('Ирина Тропинина')) errors.push('description');
if (result.chanel !== 'Домашний') errors.push('chanel');
if (!result.premera.includes('20 марта 2025')) errors.push('premera');
if (!result.poster.includes('gorkiy-nektar.jpeg')) errors.push('poster');
if (result.playlist.length !== 4) errors.push('playlist');
if (result.last_episode !== 4) errors.push('last_episode');

if (errors.length) {
	console.error('FAILED:', errors.join(', '));
	console.error(JSON.stringify(result, null, 2));
	process.exit(1);
}

console.log('OK: rosserial.be parser checks passed');
