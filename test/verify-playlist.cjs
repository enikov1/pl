const { readFileSync } = require('fs');
const { parseHTML } = require('linkedom');
const { join } = require('path');
const vm = require('vm');

const root = join(__dirname, '..');

function loadScript(context, relativePath) {
	vm.runInContext(readFileSync(join(root, relativePath), 'utf8'), context);
}

const html = readFileSync(join(__dirname, 'playlist-same-url.html'), 'utf8');
const { document, window } = parseHTML(html);

const context = vm.createContext({ document, window, console, parseInt, Array, Object, String, JSON, Math });
loadScript(context, 'lib/dom-utils.js');
loadScript(context, 'lib/parsers/playlist.js');

const playlist = context.extractPlaylist();

if (playlist.length !== 8) {
	console.error('FAILED: expected 8 episodes, got', playlist.length);
	console.error(JSON.stringify(playlist, null, 2));
	process.exit(1);
}

console.log('OK: all 8 episodes parsed despite same data-file URL');
