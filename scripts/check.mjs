import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const file = new URL('../dist/chronolens.user.js', import.meta.url);
const source = await readFile(file, 'utf8');
const checks = [
  ['metadata @name', /@name\s+ChronoLens/.test(source)],
  ['metadata @namespace', /@namespace\s+https:\/\/jwcalendar\.com\//.test(source)],
  ['metadata @version', /@version\s+1\.0\.0/.test(source)],
  ['metadata @description', /@description\s+Inspect selected dates/.test(source)],
  ['metadata @license', /@license\s+MIT/.test(source)],
  ['HTTPS match', /@match\s+https:\/\/\*\/\*/.test(source)],
  ['no eval', !/\beval\s*\(/.test(source)],
  ['no new Function', !/new\s+Function\s*\(/.test(source)],
  ['no remote executable dependency', !/@require|@resource|GM_xmlhttpRequest|googletagmanager|google-analytics/i.test(source)],
  ['no dynamic remote code or analytics beacon', !/fetch\s*\(\s*["']https?:|XMLHttpRequest|WebSocket|sendBeacon/i.test(source)],
  ['readable size below 2 MiB', (await stat(file)).size < 2 * 1024 * 1024]
];
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
const tests = spawnSync(process.execPath, ['--test'], { stdio: 'inherit' });
if (tests.status !== 0) process.exitCode = tests.status || 1;
