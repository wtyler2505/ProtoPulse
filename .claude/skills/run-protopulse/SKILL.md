---
name: run-protopulse
description: Build, run, drive, and screenshot the ProtoPulse web app — the shipping browser-based EDA platform (React/Vite client + Express server on one port, 5000, backed by Postgres). Use when asked to start ProtoPulse, run the dev server, boot the app, provision its database, take a screenshot of the app, run its e2e tests, or interact with the running server.
---

**ProtoPulse** (npm package `rest-express`) is the shipping browser EDA platform: a React/Vite client served by an **Express** server on a **single port (5000)** — in dev, Vite runs as Express middleware (one process, `npm run dev`); in production the server serves a prebuilt client from `dist/public`. It requires a **Postgres** database to boot. Drive it by provisioning the DB, starting the server, then running `.claude/skills/run-protopulse/driver.mjs` (a headless-Chromium Playwright script) against `http://127.0.0.1:5000`; screenshots land in `/tmp/pp-shots/`.

All paths below are relative to the repo root. Verified from inside a git worktree; works the same there.

> The new greenfield engine editor (`@protopulse/app`, port 5174) is a **separate** app — use the `run-protopulse-app` skill for that. This skill is the legacy/shipping web app.

## Prerequisites

- **Node 22**, repo deps (npm workspace at root), and a Chromium for Playwright:
  ```bash
  npm ci
  npx playwright install chromium
  ```
- **Postgres** reachable on `localhost:5432`. The app uses `drizzle-orm/node-postgres` + the `pg` driver — any standard Postgres works (not Neon-serverless). This machine already had Postgres 16 running with a `protopulse` role/db (51 tables, schema already pushed).

## Setup

**1. Database.** Create a role + database, then push the schema. The repo's local convention is role/password/db all `protopulse`:

```bash
# as a Postgres superuser (peer auth or psql), one time:
#   CREATE ROLE protopulse LOGIN PASSWORD 'protopulse';
#   CREATE DATABASE protopulse OWNER protopulse;
export DATABASE_URL='postgresql://protopulse:protopulse@localhost:5432/protopulse'
npm run db:push     # drizzle-kit push — creates the schema
```

Verify reachability:
```bash
PGPASSWORD=protopulse psql -h 127.0.0.1 -U protopulse -d protopulse -tAc \
  "select count(*) from information_schema.tables where table_schema='public';"
```

**2. Environment.** Boot is gated by `server/env.ts` and `server/auth.ts`. Minimum to boot:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **Yes** | Missing → server `process.exit(1)` ("DATABASE_URL is required"). |
| `API_KEY_ENCRYPTION_KEY` | **Yes** (or skip) | 64-char hex. Or set `UNSAFE_DEV_SKIP_ENCRYPTION=1` for an ephemeral dev key (stored API keys won't persist). |
| `PORT` | No | Defaults to `5000`. |
| `NODE_ENV` | No | `development` (Vite middleware) / `production` (static serve) / `test`. |
| `UNSAFE_DEV_BYPASS_AUTH` | No | `1` lets requests through without an `X-Session-Id` — the simplest way to drive the app without a login flow. Dev only. |
| `GEMINI_API_KEY`, `OPENAI_API_KEY`, … | No | AI features only; the app boots and renders without them. Don't hardcode real keys into this skill. |

## Build

Not needed for the dev path. For production static serve:

```bash
npm run build    # tsx scripts/build.ts: vite builds client → dist/public, esbuild bundles server → dist/index.cjs
```

(On a memory-pinned box — ~7 GB total running a full desktop, ~1-2 GB free, swap near-full, `earlyoom` active — the client `vite build` was SIGTERM'd mid-`transform`; raising the heap made it worse, see Gotchas. On a host with several GB free it completes; the project's CI builds it.)

## Run (agent path)

Single shell — provision env, launch the one Express process, wait for it to serve, drive, tear down. (This sandbox reaps detached processes across tool calls and can kill a heavy process shortly after it binds — see Gotchas.)

```bash
fuser -k 5000/tcp 2>/dev/null; sleep 1        # free a stale port (NOT pkill — see Gotchas)
DATABASE_URL='postgresql://protopulse:protopulse@localhost:5432/protopulse' \
UNSAFE_DEV_SKIP_ENCRYPTION=1 UNSAFE_DEV_BYPASS_AUTH=1 NODE_ENV=development PORT=5000 \
  setsid bash -c "cd '$PWD' && exec npm run dev" >/tmp/pp-legacy.log 2>&1 </dev/null &
  # (no --max-old-space-size: a bigger heap trips earlyoom sooner — see Gotchas)

# wait until it serves (legacy boot is slower than the editor: ~10-30s on a cold Vite cache):
for i in $(seq 1 120); do curl -sf -o /dev/null http://127.0.0.1:5000/ && { echo "ready@poll${i}"; break; }; sleep 0.3; done

node .claude/skills/run-protopulse/driver.mjs --url http://127.0.0.1:5000 <<'DRV'
nav /
wait #root > *
ss legacy-home
eval ({title:document.title, rootChildren:(document.querySelector('#root')?.children.length||0)})
errors
quit
DRV

fuser -k 5000/tcp 2>/dev/null                 # stop the server
ls -la /tmp/pp-shots/
```

A healthy run renders the app shell into `#root` (`rootChildren` ≥ 1) with `console=0 page=0`, and writes `/tmp/pp-shots/legacy-home.png`. The driver's command set and env knobs are identical to the `run-protopulse-app` skill (`nav/wait/click/fill/ss/eval/errors/quit`; `PP_SHOTS`, `PP_TIMEOUT`, `PP_NAV_RETRY_MS`, `PP_WEBGL`).

Server log → `/tmp/pp-legacy.log`; look for `serving on port 5000`.

> **Verified here:** the server boots with the env above (DB connection verified, job executors registered), serves `http://127.0.0.1:5000/` (title `ProtoPulse`), and Chromium connects (`document.readyState: complete`). The **full** client bundle is large; on the memory-pinned host described in Gotchas, `earlyoom` SIGTERM'd the server (~40s in) before its on-demand Vite compile of the module graph finished, leaving `#root` empty (`ERR_EMPTY_RESPONSE`). On a host with several GB free the bundle loads and the app renders — the repo's own `npm run test:e2e` (Playwright, `baseURL: http://localhost:5000`, `webServer: npm run dev`) drives the rendered app headlessly. For a guaranteed-stable render anywhere, use the **production static** path (build once on a host with RAM headroom, then `NODE_ENV=production node dist/index.cjs` with `DATABASE_URL` set) — static serving has no on-demand compile and a low, flat footprint.

### Alternative: persistent MCP browser (process-reaping sandboxes)

Same pattern as `run-protopulse-app`: hold the server with `desktop-commander start_process` (full env line above) and drive with `chrome-devtools navigate_page` / `evaluate_script` / `take_screenshot`. Verified here: DC holds the server, the server boots (DB verified, job executors registered) and serves, and chrome-devtools connects and loads `index.html` (`document.readyState: complete`, title `ProtoPulse`). On this memory-pinned host the large dev client bundle still didn't finish on-demand compilation before `earlyoom` SIGTERM'd the server (~40s in), so `#root` stayed empty — for a rendered shot, use the production-static path or a host with RAM headroom. The combo *does* render the lighter engine editor cleanly, so it's the right in-sandbox driver when the bundle is small enough.

## Run (human path)

```bash
DATABASE_URL='postgresql://protopulse:protopulse@localhost:5432/protopulse' \
UNSAFE_DEV_SKIP_ENCRYPTION=1 npm run dev   # http://localhost:5000 ; Ctrl-C to stop
```

## Test

```bash
npm run check        # tsc typecheck (root)
npm test             # vitest run
npm run test:e2e     # playwright e2e — boots `npm run dev` itself (webServer), baseURL :5000
```

## Gotchas

- **One port, one process.** `npm run dev` (= `tsx server/index.ts`) is the whole app: Express serves the API *and* mounts Vite as middleware in dev. Do **not** also run `dev:client` — that's a separate standalone Vite that isn't how the app is served.
- **`API_KEY_ENCRYPTION_KEY` blocks boot before anything else useful.** The error is explicit and names the escape hatch: `UNSAFE_DEV_SKIP_ENCRYPTION=1`. `DATABASE_URL` missing is a hard `exit(1)` even earlier.
- **Use `127.0.0.1`, not `localhost`** — Playwright's Chromium resolved `localhost` to IPv6 and got `ERR_CONNECTION_REFUSED` while the server was on IPv4.
- **Never `pkill -f` with a pattern in your own command line** (`pkill -f 'tsx server/index.ts'` etc.) — it matches and kills the running shell (exit 144). Tear down by port (`fuser -k 5000/tcp`) or saved PID.
- **`earlyoom` under memory pressure is the killer.** On a memory-pinned host (verified: ~7 GB total, full desktop + Chrome + MCP servers, ~1-2 GB free, swap near-full, `systemctl is-active earlyoom` → `active`), earlyoom SIGTERMs the largest-RSS process — so the Vite-middleware module-graph compile and `vite build` die mid-flight (graceful `code 143`), and the heavy legacy server gets killed ~40s in. Detached servers are also reaped across tool calls. Hence the single-shell launch+drive+teardown and the production-static fallback. **Don't raise `--max-old-space-size` to fight it** — a bigger heap trips earlyoom sooner. None of this happens on a host with several GB free; the project's e2e suite runs the rendered app there.
- **`UNSAFE_DEV_BYPASS_AUTH=1` is the no-login driving path.** Without it, requests need an `X-Session-Id` (there's also `e2e/auth.setup.ts` which mints a real session for the Playwright suite).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `FATAL: DATABASE_URL ... is required` then exit | Export `DATABASE_URL` (see Setup) before launching. |
| `API_KEY_ENCRYPTION_KEY is required` then exit | Set a 64-char hex key, or `UNSAFE_DEV_SKIP_ENCRYPTION=1` for dev. |
| `Could not connect to database after N attempts` | Postgres not running / wrong creds. Verify with the `psql` line in Setup; `pg_lsclusters` to confirm the cluster is online. |
| `Could not find the build directory: .../dist/public` (production) | Run `npm run build` first; production serve needs the prebuilt client. |
| `net::ERR_CONNECTION_REFUSED` on nav | Server not up yet / reaped. Poll `curl http://127.0.0.1:5000/`; use `127.0.0.1`; re-run the single-shell block. |
| Blank `#root` / `ERR_EMPTY_RESPONSE` | `earlyoom` SIGTERM'd the server before the dev module graph finished compiling (memory-pinned host). Free RAM (`free -h` to check), use the production-static path, or run on a host with several GB free. |
| Shell exits 144, no output | `pkill -f` self-matched your command. Use `fuser -k 5000/tcp`. |
