# QA Audit: Section 1 — Auth & Project Picker

## Summary
- **Tested**: 2026-03-22
- **Status**: FAIL
- **Issues found**: 4 critical, 2 warnings, 1 cosmetic

## Checks Performed
- [x] Auth page visual rendering — correct
- [x] Login form with valid credentials — works, redirects to workspace
- [x] Login form with invalid credentials — shows error (but raw JSON)
- [x] Sign up form renders — correct, has confirm password field
- [x] Session persistence on reload — works (stays logged in)
- [x] Sign out button — works, returns to auth page
- [x] Form disables during submission (loading state) — works
- [ ] Project picker page — **UNREACHABLE**
- [ ] New project creation — cannot test (picker unreachable)
- [ ] Project deletion — cannot test (picker unreachable)
- [ ] Sample project gallery — cannot test (picker unreachable)
- [x] Console errors: **45 errors on every page load**
- [x] Network errors: **15+ failed 404 requests per load**
- [ ] Accessibility: not fully tested yet

## Issues Found

### Critical

**C1: Project Picker is unreachable once a project is loaded**
- **Route**: `/projects` and `/` both redirect to `/projects/2/arduino` (last-visited project from localStorage)
- **Impact**: Users cannot switch projects, create new projects, or access the project gallery
- **Root cause**: Router always redirects to the last-visited project stored in localStorage. No route guard or fallback to project picker.
- **Fix**: The `/projects` route must render `ProjectPickerPage` regardless of localStorage. Only `/` should optionally redirect to last project.
- **Screenshot**: N/A (redirect happens immediately)

**C2: Stale project ID causes 45+ console errors on every page load**
- **Route**: App loads project 2 from localStorage, but project 2 doesn't exist for the logged-in user (ownership mismatch from a different session)
- **Impact**: Every API call to `/api/projects/2/*` returns 404. 15+ network requests fail. 45 console errors logged. No data loads.
- **Root cause**: `lastProjectId` in localStorage persists across sign-out/sign-in cycles. When a different user logs in, the stale project ID is used.
- **Fix**: Clear `lastProjectId` from localStorage on sign-out. Or validate the project exists for the current user before loading, and redirect to project picker if not found.
- **Screenshot**: `screenshots/s1-01-initial-load.jpg`

**C3: Login error displays raw JSON instead of user-friendly message**
- **What happens**: Invalid credentials shows `{"message":"Invalid credentials"}` as red text
- **Expected**: Should show just "Invalid credentials" (extract the `message` field from the JSON response)
- **Root cause**: AuthPage likely renders `error.toString()` or the raw response body without parsing
- **Fix**: Parse the JSON response and extract `error.message` before displaying
- **Screenshot**: `screenshots/s1-03-invalid-login-raw-json.jpg`

**C4: "Back to Projects" sidebar link doesn't work**
- **What happens**: Clicking "Back to Projects" (link to `/projects`) does nothing — stays on current project
- **Expected**: Should navigate to the project picker page
- **Root cause**: Same as C1 — the router intercepts `/projects` and redirects to the stored project
- **Screenshot**: N/A (no visible change)

### Warnings

**W1: Auth form fields persist when switching between Sign In / Sign Up modes**
- **What happens**: Entering "wronguser" + password in Sign In, then clicking "Sign up", the old values remain in the fields
- **Expected**: Fields should clear when switching between Sign In and Sign Up modes
- **Impact**: Confusing UX — user might accidentally submit registration with login credentials
- **Screenshot**: `screenshots/s1-04-signup-stale-fields.jpg`

**W2: Error message persists after clearing form fields**
- **What happens**: After a failed login, the red error text `{"message":"Invalid credentials"}` remains visible even after the user clears the input fields
- **Expected**: Error should clear when user starts editing fields (onChange handler should reset error state)

### Cosmetic

**CO1: Auth page URL doesn't update when accessed from workspace**
- **What happens**: After sign-out, the URL stays at `/projects/2/arduino` instead of changing to `/` or `/auth`
- **Expected**: URL should reflect the current page (auth page)
- **Impact**: Minor — doesn't affect functionality but looks wrong in the address bar

## Screenshots
- `s1-01-initial-load.jpg` — Initial page load with stale project
- `s1-02-auth-page.jpg` — Clean auth page after sign-out
- `s1-03-invalid-login-raw-json.jpg` — Raw JSON error message on invalid login
- `s1-04-signup-stale-fields.jpg` — Stale field values when switching to Sign Up
- `s1-05-post-login.jpg` — Successful login, workspace loaded

## Notes
- The project picker page (`ProjectPickerPage`) exists in the codebase but is currently unreachable once any project is loaded
- Session-based auth via `X-Session-Id` header works correctly
- The `devtest` / `214802` credentials work for login
- Project "DevelopmentTest" (id 2) loads but returns 404s because it belongs to a different user/session
