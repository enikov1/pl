const { readFileSync } = require('fs');
const { join } = require('path');
const vm = require('vm');

const root = join(__dirname, '..');
const context = vm.createContext({ console });
vm.runInContext(readFileSync(join(root, 'lib/dom-utils.js'), 'utf8'), context);

const cases = [
	['Сериалы ТВЦ', 'ТВЦ'],
	['ТВЦ', 'ТВЦ'],
	['Домашний', 'Домашний'],
	['ТНТ', 'ТНТ'],
	['РЕН-ТВ', 'РЕН-ТВ'],
	['Россия-1', 'Россия 1'],
	['1 канал', 'Первый канал'],
	['Пятница', 'Пятница'],
	['МУЗ-ТВ', 'МУЗ-ТВ'],
	['ТВ-3', 'ТВ-3'],
	['Суббота', 'Суббота'],
	['20 марта 2025 (Домашний)', 'Домашний'],
	['Сериалы на НТВ', 'НТВ'],
	['Карусель', 'Карусель'],
];

const errors = [];
for (const [input, expected] of cases) {
	const result = context.normalizeTvChannel(input);
	if (result !== expected) {
		errors.push(`${input} → ${result} (expected ${expected})`);
	}
}

if (errors.length) {
	console.error('FAILED:');
	errors.forEach((e) => console.error(' ', e));
	process.exit(1);
}

console.log('OK: TV channel normalization checks passed');
