#!/usr/bin/env node
/**
 * Build script for the collector bundle.
 * Uses esbuild to produce a CJS bundle, then patches the fdir dependency's
 * `import.meta.url` reference which esbuild leaves as `{}` in CJS output.
 */
'use strict';
const { execSync } = require('child_process');
const { readFileSync, writeFileSync } = require('fs');

const outfile = 'dist/collector.bundle.cjs';

execSync(
  `node_modules/.bin/esbuild src/cli.ts --bundle --platform=node --target=node18 --format=cjs --outfile=${outfile}`,
  { stdio: 'inherit' },
);

// fdir uses createRequire(import.meta.url) — esbuild sets import_meta={} in CJS output,
// making .url undefined. Patch it to use the correct file URL.
const content = readFileSync(outfile, 'utf8');
const patched = content.replace(
  'var import_meta = {};',
  'var import_meta = { url: require("url").pathToFileURL(__filename).href };',
);
if (patched === content) {
  console.warn('Warning: import_meta patch pattern not found — bundle may need review.');
} else {
  writeFileSync(outfile, patched);
}
