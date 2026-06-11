# Playwright Research Notes (Primary Sources)

This skill is based on official Playwright docs only.

## Core Sources

1. Authentication  
   https://playwright.dev/docs/auth

2. Actionability / Auto-waiting / Event interception  
   https://playwright.dev/docs/actionability

3. Best practices (isolation, resilient selectors)  
   https://playwright.dev/docs/best-practices

4. Locators  
   https://playwright.dev/docs/locators

5. Screenshots  
   https://playwright.dev/docs/screenshots

6. Timeouts  
   https://playwright.dev/docs/test-timeouts

7. Retries  
   https://playwright.dev/docs/test-retries

8. Trace viewer / debugging  
   https://playwright.dev/docs/trace-viewer-intro

## 2026-05-23 Full-App Capture Research Refresh

- Context7 target: `/microsoft/playwright`.
- Official web docs checked: screenshots, visual comparisons, page screenshot API, locator screenshot API, locators, actionability, authentication, trace viewer.
- Use `page.screenshot()` for viewport evidence, `fullPage: true` for whole-scroll evidence, and `locator.screenshot()` for element crops.
- Use `animations: "disabled"`, `caret: "hide"`, `scale: "css"`, and screenshot `style` to reduce visual noise and file size.
- Keep role/test-id locators as the primary targeting strategy; Playwright locators re-query the current DOM and auto-wait.
- Keep API-created accounts/projects rather than stale auth state for catalog runs.
- Capture Playwright traces with screenshots/snapshots when a target/viewport fails, so later audit can replay the failure.
- If bundled Chromium is missing, launch installed branded Chrome with `channel: "chrome"` rather than blocking the catalog run.

## Practical Takeaways Applied Here

- Auth must be isolated and reproducible; stale auth storage causes hidden failures.
- Click failures from overlays are expected in complex UIs; actionability checks explain the exact cause.
- Capture pipelines should be deterministic: explicit scenario order + strict naming + manifest.
- Every exhaustive capture workflow needs validation output, not just image files.
- Retry and trace settings should support post-failure forensics.
