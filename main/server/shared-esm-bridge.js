// Serves project/shared/*.js (CommonJS, used by the main process & dashboard)
// as real ES modules under /shared/*.mjs, so the overlay (plain browser
// <script type="module">, no bundler) can `import` the exact same functions
// instead of maintaining hand-copied "Keep in sync with shared/..." mirrors.
//
// Only files with NO Node-builtin dependencies (fs, crypto, path, ...) may be
// exposed here — see ALLOWED_MODULES below. The transform is intentionally
// simple (string surgery, not a real parser) because shared/*.js consistently
// follows two patterns:
//   const { A, B } = require('./x');   ->  import { A, B } from './x.mjs';
//   module.exports = { A, B, ... };    ->  export { A, B, ... };

const fs = require('fs');
const path = require('path');
const express = require('express');

const SHARED_DIR = path.join(__dirname, '..', '..', 'shared');

// Allow-list: only browser-safe shared modules (no Node builtins) are
// reachable via /shared. Add a file here only after confirming it doesn't
// require() a Node builtin (fs, crypto, path, os, ...).
const ALLOWED_MODULES = new Set([
  'image-url',
  'decoration-config',
  'layout-config',
  'slot-bubble-config',
  'customize-config',
  'slot-style-config',
  'animation-config',
  'role-style-config',
]);

function findMatchingBrace(src, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error('Unbalanced braces while converting module.exports');
}

function cjsToEsm(source, filename) {
  let out = source.replace(
    /const\s*\{([^}]*)\}\s*=\s*require\((['"])(\.\/[^'"]+)\2\);?/g,
    (match, names, _quote, specifier) => {
      if (!ALLOWED_MODULES.has(specifier.replace('./', ''))) {
        throw new Error(`${filename} requires non-browser-safe module '${specifier}'`);
      }
      return `import {${names}} from '${specifier}.mjs';`;
    },
  );

  const exportsIdx = out.lastIndexOf('module.exports');
  if (exportsIdx === -1) {
    throw new Error(`${filename} has no module.exports to convert`);
  }
  const braceStart = out.indexOf('{', exportsIdx);
  const braceEnd = findMatchingBrace(out, braceStart);
  const exportedNames = out.slice(braceStart + 1, braceEnd);
  out = `${out.slice(0, exportsIdx)}export {${exportedNames}};\n`;

  return out;
}

/** @returns {import('express').Router} */
function createSharedEsmRouter() {
  const router = express.Router();

  router.get('/:name.mjs', (req, res) => {
    const { name } = req.params;
    if (!ALLOWED_MODULES.has(name)) {
      res.status(404).send(`// unknown or non-browser-safe shared module: ${name}`);
      return;
    }
    const filePath = path.join(SHARED_DIR, `${name}.js`);
    try {
      const source = fs.readFileSync(filePath, 'utf-8');
      const esm = cjsToEsm(source, `${name}.js`);
      res.type('application/javascript').send(esm);
    } catch (err) {
      res.status(500).type('application/javascript')
        .send(`// failed to convert ${name}.js: ${String(err && err.message)}`);
    }
  });

  return router;
}

module.exports = { createSharedEsmRouter };
