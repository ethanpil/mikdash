// The browser for the headless tools (shot.mjs, warmup-check.mjs): any Chromium-based browser, tried in this order —
//   1. CHROME_PATH: the executable of Chrome, Edge or Chromium (an explicit choice: if it does not start, that is the error)
//   2. Playwright channel 'msedge' — Microsoft Edge at its standard install path (the dev machine's browser: the timings
//      in docs/ were measured with it, so it stays first where it is installed)
//   3. Playwright channel 'chrome' — Google Chrome at its standard install path (Windows, macOS, Linux)
//   4. Playwright's own Chromium (`npx playwright install chromium`)
import { existsSync } from 'node:fs';

/** GPU switches: ANGLE on D3D11 on Windows (the backend the HD 4600 numbers are for); elsewhere ANGLE's default backend */
export const GPU_ARGS = [...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []), '--enable-gpu', '--ignore-gpu-blocklist'];

const firstLine = (e) => String(e?.message || e).split('\n').find((l) => l.trim()) || String(e);

/** chromium.launch() with the first browser that starts; returns { browser, label }. Throws one readable error if none does. */
export async function launchBrowser(chromium, opts = {}) {
  const env = process.env.CHROME_PATH;
  if (env) {
    if (!existsSync(env)) throw new Error(`CHROME_PATH=${env}: no such file. Point it at a Chrome, Edge or Chromium executable.`);
    try { return { browser: await chromium.launch({ ...opts, executablePath: env }), label: `CHROME_PATH (${env})` }; }
    catch (e) { throw new Error(`CHROME_PATH=${env} did not start: ${firstLine(e)}`); }
  }
  const tries = [["Edge (channel 'msedge')", { channel: 'msedge' }], ["Chrome (channel 'chrome')", { channel: 'chrome' }],
    ["Playwright's Chromium", {}]];
  const errors = [];
  for (const [label, o] of tries) {
    try { return { browser: await chromium.launch({ ...opts, ...o }), label }; }
    catch (e) { errors.push(`  ${label}: ${firstLine(e)}`); }
  }
  throw new Error(['No Chromium-based browser could be started. Tried:', ...errors,
    'Install Google Chrome or Microsoft Edge, or run "npx playwright install chromium",',
    'or set CHROME_PATH to the executable of Chrome, Edge or Chromium.'].join('\n'));
}
