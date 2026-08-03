import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
    fs: {
      allow: ['..'],
    },
  },
  build: {
    outDir: '../dist-dashboard',
    emptyOutDir: true,
  },
});
