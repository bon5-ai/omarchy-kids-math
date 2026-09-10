import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
// A classic script works under file://: no server, module fetches, CDN or install hooks.
await build({ entryPoints: ['garden/src/app.js'], bundle: true, minify: true, format: 'iife', target: ['chrome100', 'firefox100'], outfile: 'garden/garden.js', legalComments: 'eof' });
await copyFile('node_modules/three/LICENSE', 'garden/THREE-LICENSE.txt');
console.log('Built offline Math Garden → garden/garden.js');
