# Express 5 Rollback Procedure

## Current State

- **Express version pinned**: `^5.0.1` (pre-release, first stable Express 5 release)
- **Installed via**: `package.json` → `dependencies.express`
- **Helmet**: `^8.1.0` (compatible with Express 4 and 5)
- **Rate limiter**: `express-rate-limit@^8.2.1` (compatible with Express 4 and 5)
- **Types**: `@types/express@^5.0.0`

## Known Express 5 Pre-Release Risks

1. **Breaking changes between 5.x pre-releases**: The Express 5 API stabilized at 5.0.0 but minor semver bumps may still introduce behavioral changes in middleware ordering or error handling.
2. **Ecosystem compatibility**: Some Express middleware may not yet fully support Express 5. Current middleware (`helmet`, `compression`, `express-rate-limit`) have been verified compatible.
3. **Router API changes**: Express 5 removed several deprecated APIs (`app.del()`, `req.host` without proxy trust, plural `req.acceptsLanguages` became the standard).
4. **Path route syntax**: Express 5 uses a new path-to-regexp version. Patterns like `/:param?` changed — ProtoPulse uses `/{*path}` (Express 5 syntax) instead of `/*` (Express 4 syntax).
5. **Promise rejection handling**: Express 5 automatically catches rejected promises in route handlers. Express 4 required explicit `next(err)` calls or an `asyncHandler` wrapper.
6. **`req.query` is a getter**: In Express 5, `req.query` returns a new parsed object each time. Caching the reference may behave differently.

## Step-by-Step Rollback to Express 4.x

### 1. Update dependencies

```bash
# Downgrade Express and types
npm install express@^4.21.0
npm install --save-dev @types/express@^4.17.21

# Verify other middleware compatibility (should be fine)
npm ls express helmet compression express-rate-limit
```

### 2. Update route path syntax

Express 5 uses `/{*path}` for catch-all routes. Express 4 uses `/*`.

**Files to change:**

- `server/static.ts` line 24: `app.use("/{*path}", ...)` → `app.use("/*", ...)`
- `server/vite.ts` line 34: `app.use("/{*path}", ...)` → `app.use("/*", ...)`

### 3. Restore `asyncHandler` for promise-based routes

Express 5 auto-catches promise rejections. Express 4 does not — unhandled rejections crash the process.

**Verify**: `server/routes.ts` already uses an `asyncHandler` wrapper. Confirm every `async` route handler is wrapped. Search for unwrapped async handlers:

```bash
rg "app\.(get|post|put|patch|delete)\(.*, async" server/ --no-filename
```

Any route using `async` without `asyncHandler` must be wrapped.

### 4. Check `req.query` usage

Express 4 caches `req.query` on first access. Express 5 parses it fresh each time. If any code stores a reference to `req.query` and expects it to remain stable, it will work differently in Express 4 (cached) — this is not a problem for rollback, but note the behavioral difference.

### 5. Verify `req.ip` and `req.hostname` behavior

Express 5 trusts `trust proxy` for `req.ip` by default. Express 4 may behave differently. ProtoPulse sets `app.set("trust proxy", 1)` which works in both versions.

### 6. Run full test suite

```bash
npm run check    # TypeScript — must pass clean
npm test         # All Vitest tests
npm run build    # Production build
npm start        # Smoke test the production server
```

### 7. Test critical paths manually

- [ ] Health endpoint: `GET /api/health`
- [ ] Readiness endpoint: `GET /api/ready`
- [ ] Auth flow: register → login → session validation
- [ ] AI chat streaming: `POST /api/chat/ai/stream`
- [ ] Static file serving in production mode
- [ ] Rate limiting (hit the limit, verify 429 response)
- [ ] CSRF origin check on mutation routes

## Monitoring Checklist for Express Security Advisories

### Sources to Monitor

- [ ] **Express GitHub releases**: https://github.com/expressjs/express/releases — subscribe to release notifications
- [ ] **Express security policy**: https://github.com/expressjs/express/blob/master/SECURITY.md
- [ ] **npm audit**: Run `npm audit` weekly or integrate into CI
- [ ] **Node.js security WG**: https://github.com/nodejs/security-wg — tracks ecosystem vulnerabilities
- [ ] **Snyk/GitHub Dependabot**: Enable automated vulnerability scanning on the repository

### CI Integration

Add to CI pipeline (GitHub Actions or equivalent):

```yaml
- name: Security audit
  run: npm audit --audit-level=high
```

### Express 5 Stability Milestones

- [x] Express 5.0.0 released (first stable)
- [ ] Express 5.1.0+ released (confirms ongoing maintenance)
- [ ] Major middleware ecosystem fully migrated (body-parser, cookie-parser, etc.)
- [ ] Express 4.x enters LTS/maintenance-only mode

### When to Rollback

Trigger rollback if any of these occur:
1. Critical security vulnerability in Express 5 with no patch available within 48 hours
2. Incompatible middleware update that breaks production functionality
3. Express 5 regression causing data loss, auth bypass, or request handling errors
4. Express team announces deprecation of the 5.x line (unlikely but possible for pre-1.0 semver reasons)
