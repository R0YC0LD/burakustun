import { build } from 'esbuild';
import { cpSync, rmSync, mkdirSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });
await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: !process.env.DEV,
  format: 'iife',
  target: ['chrome90'],
  outfile: 'dist/game.js',
  legalComments: 'none',
  logLevel: 'info',
});
