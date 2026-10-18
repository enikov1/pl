const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parseHTML } = require('linkedom');

function loadScript(filePath, context) {
	const code = fs.readFileSync(filePath, 'utf8');
	vm.runInContext(code, context);
}

const parserContext = vm.createContext({
	module: { exports: {} },
	console,
	parseInt,
	String,
	Object,
	Array,
});
loadScript(path.join(__dirname, '../lib/parsers/social-shares.js'), parserContext);
const { extractSocialShares, isAllZeroFingerprint, waitForSocialSharesReady } =
	parserContext.module.exports;

const sharesContext = vm.createContext({
	module: { exports: {} },
	chrome: null,
	Object,
	Array,
});
loadScript(path.join(__dirname, '../lib/shares-parse.js'), sharesContext);
const { computeSharesStatistics, createResultEntry } = sharesContext.module.exports;

const fixture = `
<div class="uscl-bar">
  <div class="uscl-list">
    <div class="uscl-item"><span data-item="vk"><span class="uscl-each-counter">0</span></span></div>
    <div class="uscl-item"><span data-item="ok"><span class="uscl-each-counter">2</span></span></div>
    <div class="uscl-item"><span data-item="lj"><span class="uscl-each-counter">1</span></span></div>
    <div class="uscl-item"><span data-item="telegram"><span class="uscl-each-counter">1</span></span></div>
    <div class="uscl-item"><span data-item="wa"><span class="uscl-each-counter">0</span></span></div>
    <div class="uscl-item"><span data-item="vi"><span class="uscl-each-counter">1</span></span></div>
  </div>
</div>
<h1 itemprop="name">Королева дорог Сериал 2021</h1>
`;

const { document, window } = parseHTML(fixture);
Object.defineProperty(window, 'location', {
	value: { href: 'https://russian-seriali.net/test.html' },
});
parserContext.document = document;
parserContext.location = window.location;

const parsed = extractSocialShares();
assert.strictEqual(parsed.title, 'Королева дорог Сериал 2021');
assert.strictEqual(parsed.shares.ok, 2);
assert.strictEqual(parsed.shares.lj, 1);
assert.strictEqual(parsed.shares.telegram, 1);
assert.strictEqual(parsed.shares.vi, 1);
assert.strictEqual(parsed.total, 5);
assert.strictEqual(parsed.error, null);

const stats = computeSharesStatistics([
	createResultEntry({
		url: 'https://example.com/a',
		title: 'A',
		shares: { vk: 0, ok: 5, lj: 0, telegram: 0, wa: 0, vi: 0 },
		total: 5,
	}),
	createResultEntry({
		url: 'https://example.com/b',
		title: 'B',
		shares: { vk: 1, ok: 1, lj: 1, telegram: 1, wa: 1, vi: 1 },
		total: 6,
	}),
]);

assert.strictEqual(stats.summary.grandTotal, 11);
assert.strictEqual(stats.summary.processed, 2);
assert.strictEqual(stats.topByTotal[0].url, 'https://example.com/b');
assert.strictEqual(stats.topByPlatform.ok[0].count, 5);
assert.strictEqual(stats.distribution.medium, 2);
assert.strictEqual(isAllZeroFingerprint('vk:0|ok:0|lj:0|telegram:0|wa:0|vi:0'), true);
assert.strictEqual(isAllZeroFingerprint('vk:0|ok:2|lj:0|telegram:0|wa:0|vi:0'), false);

console.log('verify-shares-parser: OK');
