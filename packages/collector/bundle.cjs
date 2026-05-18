#!/usr/bin/env node
/**
 * Build script for the collector bundle.
 *
 * Uses esbuild's Node API (rather than CLI invocation) so the script works
 * identically on Unix and Windows — invoking `node_modules/.bin/esbuild` via
 * cmd.exe fails because the bin shim is `.cmd` on Windows, not a plain
 * executable, and the forward-slash path isn't recognised either.
 *
 * Then patches the fdir dependency's `import.meta.url` reference which
 * esbuild leaves as `{}` in CJS output.
 */
'use strict';
const esbuild = require('esbuild');
const { readFileSync, writeFileSync, mkdirSync } = require('fs');

const outfile = 'dist/collector.bundle.cjs';
mkdirSync('dist', { recursive: true });

esbuild.buildSync({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile,
  logLevel: 'info',
});

// fdir uses createRequire(import.meta.url) — esbuild sets import_meta={} in
// CJS output, making .url undefined. Patch it to use the correct file URL.
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
