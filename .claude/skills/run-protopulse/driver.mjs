#!/usr/bin/env node
// Playwright stdin-script driver for ProtoPulse web surfaces.
//
// chromium-cli isn't in this container, so this is the adapted Playwright
// REPL the design-sync/run examples point at: pipe one command per line on
// stdin, it drives a headless Chromium against an already-running dev server
// and writes screenshots to disk. Deterministic (no tmux send-keys timing) —
// the SKILL.md code blocks are this script's input verbatim.
//
// Resolves `playwright` from the repo's own node_modules (this file lives
// inside the repo). On a clean machine the browser binary comes from
// `npx playwright install chromium`.
//
// Usage:
//   node <thisfile> --url http://localhost:5174 <<'EOF'
//   wait body
//   ss editor-home
//   errors
//   quit
//   EOF
//
// Commands (one per line; '#' lines and blanks ignored):
//   nav <url>            navigate (alias: goto)
//   wait <selector>      wait for selector visible (CSS or text=...)
//   waitidle             wait for network idle (use sparingly; WS never idles)
//   click <selector>     click first match
//   fill <sel> <value>   fill input via React-safe pipeline (rest of line = value)
//   type <sel> <value>   type char-by-char
//   press <key>          keyboard press (e.g. Enter, Escape)
//   text <selector>      print textContent of first match
//   count <selector>     print match count
//   eval <js>            evaluate in page, print JSON result
//   ss [name]            screenshot full page -> $PP_SHOTS/<name>.png
//   sleep <ms>           hard wait (last resort)
//   errors               print collected console + page errors so far
//   quit                 close and exit (alias: exit)
//
// Exit code: 0 if no uncaught page errors were seen, 1 otherwise.

import { chromium } from 'playwright';

const argv = process.argv.slice(2);
let baseUrl = 'http://localhost:5174';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--url') baseUrl = argv[++i];
}
const SHOTS = process.env.PP_SHOTS || '/tmp/pp-shots';
const DEFAULT_TIMEOUT = Number(process.env.PP_TIMEOUT || 30000);

// Launch args. Default to a LEAN single-process profile: some sandboxes run a
// process-spawn/CPU watchdog that SIGTERMs chromium's normal multi-process tree
// (zygote + gpu + renderer + utility) within seconds. --single-process/--no-zygote
// collapse that. Set PP_WEBGL=1 for the WebGL profile (SwiftShader, mirrors the
// repo's e2e/playwright config) when a surface needs the 3D PCB view to render —
// note WebGL + --single-process can conflict, so the WebGL profile drops it.
const webgl = process.env.PP_WEBGL === '1';
const launchArgs = webgl
  ? ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader',
     '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--no-zygote',
     '--disable-gpu', '--renderer-process-limit=1', '--disable-extensions', '--mute-audio'];
const browser = await chromium.launch({ args: launchArgs });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(DEFAULT_TIMEOUT);

const consoleErrors = [];
const pageErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => pageErrors.push(e.message));

function sel(s) {
  // bare "text=Foo" passes through; otherwise treat as CSS / Playwright selector
  return s;
}

async function run(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const sp = trimmed.indexOf(' ');
  const cmd = (sp === -1 ? trimmed : trimmed.slice(0, sp)).toLowerCase();
  const rest = sp === -1 ? '' : trimmed.slice(sp + 1).trim();

  switch (cmd) {
    case 'nav':
    case 'goto': {
      const url = /^https?:/.test(rest) ? rest : baseUrl + (rest.startsWith('/') ? rest : '/' + rest);
      // Retry on connection-refused: tolerates a dev server still booting, and
      // catches the live window of a flaky/respawning server. PP_NAV_RETRY_MS
      // bounds the total retry budget (default 25s).
      const budget = Number(process.env.PP_NAV_RETRY_MS || 25000);
      const start = Date.now();
      let lastErr;
      for (;;) {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          if (Date.now() - start > budget) break;
          if (!/ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_EMPTY_RESPONSE|Timeout|net::/.test(e.message)) break;
          await page.waitForTimeout(400);
        }
      }
      if (lastErr) throw lastErr;
      console.log(`[nav] ${url} (after ${Date.now() - start}ms)`);
      break;
    }
    case 'wait':
      await page.locator(sel(rest)).first().waitFor({ state: 'visible' });
      console.log(`[wait] ok: ${rest}`);
      break;
    case 'waitidle':
      await page.waitForLoadState('networkidle');
      console.log('[waitidle] ok');
      break;
    case 'click':
      await page.locator(sel(rest)).first().click();
      console.log(`[click] ${rest}`);
      break;
    case 'fill': {
      const fs = rest.indexOf(' ');
      const s = rest.slice(0, fs);
      const v = rest.slice(fs + 1);
      await page.locator(sel(s)).first().fill(v);
      console.log(`[fill] ${s} = ${v}`);
      break;
    }
    case 'type': {
      const ts = rest.indexOf(' ');
      const s = rest.slice(0, ts);
      const v = rest.slice(ts + 1);
      await page.locator(sel(s)).first().pressSequentially(v);
      console.log(`[type] ${s}`);
      break;
    }
    case 'press':
      await page.keyboard.press(rest);
      console.log(`[press] ${rest}`);
      break;
    case 'text': {
      const t = await page.locator(sel(rest)).first().textContent();
      console.log(`[text] ${JSON.stringify(t)}`);
      break;
    }
    case 'count': {
      const n = await page.locator(sel(rest)).count();
      console.log(`[count] ${rest} => ${n}`);
      break;
    }
    case 'eval': {
      const r = await page.evaluate(rest);
      console.log(`[eval] ${JSON.stringify(r)}`);
      break;
    }
    case 'ss': {
      const name = rest || `shot-${Date.now()}`;
      const path = `${SHOTS}/${name}.png`;
      await page.screenshot({ path, fullPage: true });
      console.log(`[ss] ${path}`);
      break;
    }
    case 'sleep':
      await page.waitForTimeout(Number(rest) || 0);
      console.log(`[sleep] ${rest}ms`);
      break;
    case 'errors':
      console.log(`[errors] console=${consoleErrors.length} page=${pageErrors.length}`);
      consoleErrors.forEach((e) => console.log(`  console: ${e}`));
      pageErrors.forEach((e) => console.log(`  pageerror: ${e}`));
      break;
    case 'quit':
    case 'exit':
      throw { __quit: true };
    default:
      console.log(`[?] unknown command: ${cmd}`);
  }
}

// Read all of stdin, run line by line.
const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const lines = Buffer.concat(chunks).toString('utf8').split('\n');

let failed = false;
try {
  for (const line of lines) await run(line);
} catch (e) {
  if (!e || !e.__quit) {
    console.error(`[FATAL] ${e && e.message ? e.message : e}`);
    failed = true;
  }
} finally {
  if (pageErrors.length) {
    console.log(`\n[summary] ${pageErrors.length} uncaught page error(s):`);
    pageErrors.forEach((e) => console.log(`  ${e}`));
  }
  await browser.close();
}
process.exit(failed || pageErrors.length ? 1 : 0);
