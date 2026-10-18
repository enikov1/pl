const { readFileSync } = require('fs');
const { parseHTML } = require('linkedom');
const { join } = require('path');
const vm = require('vm');

const root = join(__dirname, '..');

function loadScript(context, relativePath) {
	vm.runInContext(readFileSync(join(root, relativePath), 'utf8'), context);
}

const html = readFileSync(join(__dirname, 'rosserial-fixture.html'), 'utf8');
const { document, window } = parseHTML(html);

Object.defineProperty(window, 'location', {
	value: {
		origin: 'https://rosserial.mobi',
		href: 'https://rosserial.mobi/507-uchenica-charodeja.html',
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
});

loadScript(context, 'lib/dom-utils.js');
loadScript(context, 'lib/sources.js');
loadScript(context, 'lib/parsers/playlist.js');
loadScript(context, 'lib/parsers/metadata-russian-seriali.js');
loadScript(context, 'lib/parsers/metadata-rosserial.js');
loadScript(context, 'lib/parsers/metadata.js');

const result = context.parseFullMedia('rosserial');
const errors = [];

if (result.sourceId !== 'rosserial') errors.push('sourceId');
if (result.title !== 'Ученица чародея') errors.push('title');
if (result.year !== '2019') errors.push('year');
if (result.countries !== 'Россия') errors.push('countries');
if (result.genres !== 'Мелодрамы') errors.push('genres');
if (result.sum_episode !== '2') errors.push('sum_episode');
if (result.last_episode !== 2 && result.last_episode !== '2') errors.push('last_episode');
if (result.time !== '') errors.push('time');
if (result.directors !== 'Сергей Краснов') errors.push('directors');
if (!result.actors.includes('Городенцева')) errors.push('actors');
if (result.description !== 'Описание фильма для теста.') errors.push('description');
if (result.chanel !== 'ТВЦ') errors.push('chanel');
if (!result.premera.includes('2019')) errors.push('premera');

if (errors.length) {
	console.error('FAILED:', errors.join(', '));
	console.error(JSON.stringify(result, null, 2));
	process.exit(1);
}

console.log('OK: rosserial parser checks passed');
