---
name: run-protopulse-app
description: Build, run, drive, and screenshot the @protopulse/app engine editor (the new greenfield schematic/PCB editor on Vite, port 5174). Use when asked to start the engine editor, run the new editor, take a screenshot of the schematic/PCB editor, or interact with the running @protopulse/app dev server.
---

The **engine editor** (`@protopulse/app`) is the greenfield schematic/PCB editor in `packages/app/` — a pure Vite + React SPA on port **5174**, no server and no database. Drive it by starting the Vite dev server and then running `.claude/skills/run-protopulse-app/driver.mjs` (a headless-Chromium Playwright script) against it; screenshots land in `/tmp/pp-shots/`.

All paths below are relative to the repo root (the dir containing `packages/`). This skill was verified from inside a git worktree (`.claude/worktrees/<name>/`) — it works the same there.

## Prerequisites

Node 22, the repo deps installed, and a Chromium for Playwright. Deps are an npm workspace at the repo root:

```bash
npm ci                          # or `npm install` — installs all workspaces incl. playwright
npx playwright install chromium # one-time: the browser binary the driver launches
```

On this machine the bundled Chromium was already present (`chromium.launch({args:['--no-sandbox']})` succeeded), and `/usr/bin/google-chrome` exists as a fallback (the driver can use `channel:'chrome'` — see Gotchas). No system `apt-get` packages were needed.

## Build

None required to run — the dev server compiles on the fly. (A production build via `npm run -w @protopulse/app build` exists but is unnecessary for driving the editor, and is very memory-heavy — see Gotchas.)

## Run (agent path)

The dev server is long-lived; the driver is a short-lived script you point at it. Both in **one shell** is the robust pattern here (see Gotchas: this sandbox reaps detached/backgrounded processes across tool calls, and a heavy Vite process can be killed a few seconds after it binds — so launch, wait, drive, and tear down together):

```bash
fuser -k 5174/tcp 2>/dev/null; sleep 1   # free a stale port (NOT pkill — see Gotchas)
NODE_OPTIONS='--max-old-space-size=4096' \
  setsid bash -c "cd '$PWD' && exec npm run -w @protopulse/app dev" \
  >/tmp/pp-app.log 2>&1 </dev/null &
# wait until it actually serves (Vite ready ~2-4s; poll, don't sleep):
for i in $(seq 1 80); do curl -sf -o /dev/null http://127.0.0.1:5174/ && { echo "ready@${i}"; break; }; sleep 0.25; done

# drive it: navigate, let React mount, screenshot, assert it really rendered:
node .claude/skills/run-protopulse-app/driver.mjs --url http://127.0.0.1:5174 <<'DRV'
nav /
sleep 2500
ss editor-home
eval ({title:document.title, rootChildren:(document.querySelector('#root')?.children.length||0), bodyLen:(document.body.innerText||'').length})
errors
quit
DRV

fuser -k 5174/tcp 2>/dev/null            # stop the server
ls -la /tmp/pp-shots/
```

A healthy run prints a title (`ProtoPulse — Schematic Editor`), `rootChildren` ≥ 1, a non-zero `bodyLen`, and `console=0 page=0` from `errors`. The screenshot at `/tmp/pp-shots/editor-home.png` shows the editor: a left PARTS palette (Resistor, Capacitor, Diode, LED, Transistor, IC — real seed parts like ATmega2560, Arduino Uno R3, BME280), the Schematic/PCB toolbar with Select/Wire tools, the canvas grid, an Inspector panel, and a status bar reading `0 ops · ERC: 0 errors, 0 warnings`.

**Driver commands** (one per line on stdin; `#` and blanks ignored): `nav <url|path>`, `wait <selector>` (CSS or `text=…`), `click`, `fill <sel> <value>`, `type`, `press <key>`, `text <sel>`, `count <sel>`, `eval <js>`, `ss [name]` (→ `$PP_SHOTS/<name>.png`, default `/tmp/pp-shots`), `sleep <ms>`, `errors`, `quit`. Env knobs: `PP_SHOTS` (screenshot dir), `PP_TIMEOUT` (per-action ms, default 30000), `PP_NAV_RETRY_MS` (nav retry budget, default 25000), `PP_WEBGL=1` (SwiftShader profile for the 3D PCB view — see Gotchas). Exit code is non-zero if any uncaught page error occurred.

### Alternative: persistent MCP browser (process-reaping sandboxes)

In a sandbox that reaps backgrounded processes across calls (see Gotchas), hold the server in a persistent process tree and drive it with a warm, persistent browser — verified to render this editor cleanly:

1. `desktop-commander start_process`: `cd <repo> && NODE_OPTIONS='--max-old-space-size=4096' npm run -w @protopulse/app dev` — DC keeps it alive across tool calls.
2. `chrome-devtools navigate_page` → `http://127.0.0.1:5174/`, then `evaluate_script` (`document.querySelector('#root').children.length` ≥ 1), `take_screenshot`, `list_console_messages`.
3. `desktop-commander force_terminate <pid>` to stop.

A warm browser navigates instantly, so it loads inside the server's live window where a cold-launched driver may miss it.

## Run (human path)

```bash
npm run -w @protopulse/app dev   # opens Vite on http://localhost:5174 ; Ctrl-C to stop
```

Useless headless — it just blocks and serves. Use the agent path to actually see/drive it.

## Test

```bash
npm run -w @protopulse/app test  # vitest run (package unit tests)
```

## Gotchas

- **Use `127.0.0.1`, not `localhost`.** Playwright's Chromium resolved `localhost` to IPv6 `::1` and got `ERR_CONNECTION_REFUSED` while Vite was on IPv4. `curl` to `127.0.0.1` worked; the driver must be pointed at `http://127.0.0.1:5174`.
- **Never `pkill -f` with a pattern that appears in your own command line.** `pkill -f 'vite --port 5174'` matched the running shell itself and killed it (exit 144, zero output). Always tear down by port (`fuser -k 5174/tcp`) or saved PID.
- **This sandbox reaps processes.** A dev server started in one Bash/tmux/`nohup` call is SIGTERM'd (npm `code 143`) when a *later* tool call runs — and even within one call, a heavy Vite process can be killed a few seconds after it binds (an RSS/activity watchdog). That's why Run launches + drives + tears down in a single shell, and why the driver's `nav` retries: it catches the live window. If a capture comes back blank/refused, just re-run — a fast boot (server serving in ~2s) reliably lets the render complete before any kill. On normal hardware none of this applies; the server stays up indefinitely.
- **Chromium multi-process tree trips the watchdog; the driver runs lean.** The driver defaults to `--single-process --no-zygote --disable-gpu` (low footprint, survives). For surfaces that need WebGL (the 3D PCB view), set `PP_WEBGL=1` — it switches to the SwiftShader profile (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`, mirroring the repo's `e2e/playwright.config.ts`) and drops `--single-process` (which conflicts with WebGL).
- **`#root` fills only after the module graph loads.** Screenshot after a short `sleep` (≈2.5s) or `wait #root > *`. `domcontentloaded` fires before React mounts, so a screenshot taken too early is blank.
- **Production build is memory-heavy.** `vite build` for this app transforms a large module graph; in this sandbox it was SIGTERM'd mid-`transform` even at 8 GB heap. Don't build to run it — use the dev server.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `net::ERR_CONNECTION_REFUSED` on nav | Server not up yet or already reaped. Poll `curl http://127.0.0.1:5174/` first; use `127.0.0.1` not `localhost`; re-run the single-shell Run block. |
| Driver exits 143 with no `[nav]` line | Chromium tree got watchdog-killed. Ensure you're on the default lean profile (don't set `PP_WEBGL` unless needed). |
| Shell exits 144, no output | You used `pkill -f` with the port string in your own command. Use `fuser -k 5174/tcp`. |
| `ss` shows a blank page | Screenshot fired before React mounted — increase the `sleep` before `ss`, or `wait #root > *`. |
| `Executable doesn't exist` at launch | `npx playwright install chromium`, or edit `driver.mjs` to `chromium.launch({channel:'chrome'})` to use `/usr/bin/google-chrome`. |
