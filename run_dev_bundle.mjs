// Dev-bundle harness: loads the Metro DEV bundle (http://localhost:8081/index.bundle)
// in a jsdom DOM. The dev entry eagerly imports ALL expo-router routes via
// metroContext (require.context) -> ./upload/create -> expo-image-picker, which on
// SDK52-incompatible versions calls createPermissionHook() from 'expo' (undefined)
// and crashes at module load. This reproduces that exact path and reports success.
// Usage: node run_dev_bundle.mjs <path-to-index.bundle.js>
import fs from 'fs';

const bundlePath = process.argv[2];
if (!bundlePath) { console.error('usage: node run_dev_bundle.mjs <bundle.js>'); process.exit(2); }
const code = fs.readFileSync(bundlePath, 'utf8');

let errored = false;
const failIf = (s) => { if (s) { errored = true; } };

const html = '<!DOCTYPE html><html><body><div id="root"></div></body></html>';
const { JSDOM, VirtualConsole } = await import('jsdom');
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (err) => { errored = true; console.log('JSDOM_ERROR:', err && (err.stack || err)); });
virtualConsole.on('console', (msg) => {
  const type = msg.type;
  const args = msg.arguments();
  const text = args.map(a => typeof a === 'string' ? a : (a && a.message ? a.message : String(a))).join(' ');
  if (type === 'error' || /createPermissionHook|is not a function|Cannot find|Uncaught|undefined/.test(text)) {
    errored = true; console.log('CONSOLE[' + type + ']:', text);
  }
});

const { window } = new JSDOM(html, {
  runScripts: 'dangerously', resources: 'usable', url: 'http://localhost:8080/',
  pretendToBeVisual: true, virtualConsole,
});

if (!window.ResizeObserver) window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
window.addEventListener('error', (e) => { errored = true; console.log('WINDOW onerror:', e.message, '|', e.filename, e.lineno + ':' + e.column); });
window.addEventListener('unhandledrejection', (e) => { errored = true; console.log('WINDOW unhandledrejection:', e.reason && (e.reason.stack || e.reason)); });

// DEV bundle globals
window.__DEV__ = true;
window.process = window.process || { env: { NODE_ENV: 'development' } };
window.process.env = window.process.env || {};
window.process.env.NODE_ENV = 'development';

const script = window.document.createElement('script');
script.textContent = code;
window.document.body.appendChild(script);

setTimeout(() => {
  const root = window.document.getElementById('root');
  if (errored) {
    console.log('RESULT: CRASH — dev bundle failed to load cleanly (createPermissionHook or other error above).');
  } else {
    console.log('RESULT: OK — dev bundle loaded + rendered with NO createPermissionHook crash.');
  }
  if (root) console.log('ROOT children:', root.children.length, '| snippet:', (root.innerHTML || '').slice(0, 180));
  process.exit(errored ? 1 : 0);
}, 14000);

process.on('uncaughtException', (e) => { errored = true; console.log('PROCESS uncaughtException:', e.message); process.exit(1); });
process.on('unhandledRejection', (e) => { errored = true; console.log('PROCESS unhandledRejection:', e && e.stack); });