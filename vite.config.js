import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// shared/*.js is plain CommonJS (module.exports = {...}) because it's also
// require()'d by the main process. Vite doesn't rewrite CommonJS module.exports
// into ESM for source files outside node_modules, so importing it as-is from a
// component would fail at runtime ("module is not defined" in the browser).
// This plugin does the same tiny CJS -> ESM string transform used for the
// overlay bridge (see main/server/shared-esm-bridge.js) for any shared/*.js
// file the dashboard actually imports, so both consumers read the exact same
// source of truth without needing a hand-copied UI-side mirror.
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

function cjsSharedToEsm(source, id) {
  let out = source.replace(
    /const\s*\{([^}]*)\}\s*=\s*require\((['"])(\.\/[^'"]+)\2\);?/g,
    (match, names, _quote, specifier) => `import {${names}} from '${specifier}.js';`,
  );
  const exportsIdx = out.lastIndexOf('module.exports');
  if (exportsIdx === -1) return null; // not a module.exports-style file, leave untouched
  const braceStart = out.indexOf('{', exportsIdx);
  const braceEnd = findMatchingBrace(out, braceStart);
  const exportedNames = out.slice(braceStart + 1, braceEnd);
  out = `${out.slice(0, exportsIdx)}export {${exportedNames}};\n`;
  return out;
}

function sharedCjsToEsmPlugin() {
  return {
    name: 'shared-cjs-to-esm',
    transform(code, id) {
      if (!/[\\/]shared[\\/][\w-]+\.js$/.test(id.split('?')[0])) return null;
      return cjsSharedToEsm(code, id);
    },
  };
}

export default defineConfig({
  root: 'renderer-dashboard',
  base: './',
  plugins: [sharedCjsToEsmPlugin(), react()],
  server: {
    port: 5173,
    strictPort: true,
    // renderer-dashboard imports a few constants straight from ../shared
    // (the single source of truth also used by the main process) instead of
    // keeping hand-copied option lists in sync — that lives outside the
    // Vite root, so it needs to be explicitly allowed.
    fs: {
      allow: ['..'],
    },
  },
  build: {
    outDir: '../dist-dashboard',
    emptyOutDir: true,
  },
});
