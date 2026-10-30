// Loads the rules/state core straight out of index.html, so the tested code is the shipped code.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCore() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('core script not found in index.html');
  const sandbox = { module: { exports: {} }, globalThis: {} };
  vm.runInNewContext(m[1], sandbox, { filename: 'index.html#core' });
  return sandbox.module.exports;
}

// localStorage stand-in
function memoryStorage(initial) {
  const data = Object.assign({}, initial || {});
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; },
    dump: () => data,
  };
}

module.exports = { loadCore, memoryStorage };
