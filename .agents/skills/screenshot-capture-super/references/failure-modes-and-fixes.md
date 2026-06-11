# Failure Modes and Fixes

## 1) Stale or invalid auth session

Symptoms:
- Redirect to login/picker unexpectedly
- API requests return `401`

Fix:
- Create a fresh user and login session during run bootstrap.
- Write session to localStorage before UI navigation.

## 2) UI flow drift (picker/create flow changed)

Symptoms:
- Expected create button/testid missing
- Script times out waiting for workspace panel

Fix:
- Use API project creation, then direct link to `/projects/<id>`.
- Keep UI fallback only as secondary path.

## 3) Pointer interception by overlays

Symptoms:
- `intercepts pointer events` click errors

Fix:
- Attempt normal click first.
- If known non-critical overlay, retry with `force: true`.
- Capture state before/after forced action for audit transparency.

## 4) Conditional controls missing

Symptoms:
- optional toggles not always present (theme, mode controls)

Fix:
- Make optional captures conditional.
- Log as `skipped` in manifest, not hard failure.

## 5) Silent partial capture output

Symptoms:
- folder exists but key states missing

Fix:
- Validate required pattern checklist and fail validation if missing.

