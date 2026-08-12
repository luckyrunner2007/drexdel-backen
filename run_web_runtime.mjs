// Lightweight runtime harness: loads the exported web bundle in a jsdom DOM
// and reports any errors that would cause a blank screen at runtime.
import fs from 'fs';
import path from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';

const root = process.cwd();
const files = fs.readdirSync(path.join(root, 'dist', '_expo', 'static', 'js', 'web')).filter(f => f.endsWith('.js'));
if (files.length === 0) {
  console.error('No web bundle found in dist/_expo/static/js/web');
  process.exit(2);
}
const bundle = path.join(root, 'dist', '_expo', 'static', 'js', 'web', files[0]);
console.log('Loading bundle:', bundle, 'size=', fs.statSync(bundle).size);

const html = '<!DOCTYPE html><html><body><div id="root"></div></body></html>';
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (err) => console.log('JSDOM_ERROR:', err && err.stack));
virtualConsole.on('console', (msg) => {
  const type = msg.type;
  const text = msg.arguments().map(a => (typeof a === 'string' ? a : (a && a.message ? a.message : String(a))).join(' '));
  if (type === 'error' || type === 'warning' || /error|warn|cannot|uncaught/i.test(text)) {
    console.log('CONSOLE[' + type + ']:', text);
  }
});

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'http://localhost:8080/',
  pretendToBeVisual: true,
  virtualConsole,
});
const { window } = dom;

// Polyfill a few things jsdom lacks that react-native-web expects.
if (!window.ResizeObserver) window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });

window.addEventListener('error', (e) => console.log('WINDOW onerror:', e.message, '|', e.filename, e.lineno + ':' + e.column));
window.addEventListener('unhandledrejection', (e) => console.log('WINDOW unhandledrejection:', e.reason && (e.reason.stack || e.reason)));

const scriptEl = window.document.createElement('script');
scriptEl.textContent = fs.readFileSync(bundle, 'utf8');
// The bundle may reference __DEV__ and other bundler globals; provide safe defaults.
window.__DEV__ = false;
window.process = window.process || {};
window.process.env = window.process.env || { NODE_ENV: 'production' };

const t0 = Date.now();
window.document.body.appendChild(scriptEl); // triggers execution
const timer = setTimeout(() => {
  console.log('--- harness finished (no terminal error) after', Date.now() - t0, 'ms ---');
  // Dump a quick snapshot of what rendered.
  const rootEl = window.document.getElementById('root');
  if (rootEl) {
    console.log('ROOT children count:', rootEl.children.length);
    console.log('ROOT html snippet:', rootEl.innerHTML.slice(0, 300));
  }
  process.exit(0);
}, 10000);

// Safety: exit on process errors
process.on('uncaughtException', (e) => { console.log('PROCESS uncaughtException:', e.message); clearTimeout(timer); process.exit(1); });
process.on('unhandledRejection', (e) => { console.log('PROCESS unhandledRejection:', e && e.stack); });
