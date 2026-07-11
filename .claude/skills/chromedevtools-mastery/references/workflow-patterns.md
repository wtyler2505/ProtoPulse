# Chrome DevTools MCP Workflow Patterns

## Pattern 1: Login Flow Automation

```
Goal: Automate login to a web application

Steps:
1. navigate_page → URL: login page
2. wait_for → text: "Sign In" or "Login" (ensures page loaded)
3. take_snapshot → get UIDs for username, password, submit
4. fill_form → [{uid: username_uid, value: "user@example.com"}, 
                {uid: password_uid, value: "password"}]
5. take_snapshot → fresh UIDs after fill
6. click → uid: submit button
7. wait_for → text: "Dashboard" or "Welcome" (success indicator)
8. take_screenshot → document successful login
```

## Pattern 2: Multi-Page Data Extraction

```
Goal: Scrape data from paginated results

Steps:
1. navigate_page → URL: first page of results
2. wait_for → text: results indicator
3. take_snapshot
4. evaluate_script → extract data:
   () => {
     return Array.from(document.querySelectorAll('.item'))
       .map(el => ({title: el.querySelector('h2').innerText}))
   }
5. take_snapshot → check for "Next" button
6. IF next exists:
   - click → uid: next button
   - wait_for → new content indicator
   - GOTO step 3
7. ELSE: extraction complete
```

## Pattern 3: E2E Test Recording

```
Goal: Document user flow with screenshots

Steps:
1. navigate_page → starting URL
2. For each step in flow:
   a. wait_for → expected content
   b. take_screenshot → filePath: "step_N.png"
   c. take_snapshot
   d. Perform action (click, fill, etc.)
3. Final take_screenshot → end state
```

## Pattern 4: Performance Baseline

```
Goal: Establish performance baseline for a page

Steps:
1. emulate → networkConditions: "Fast 4G" (consistent conditions)
2. navigate_page → URL: target page
3. performance_start_trace → reload: true, autoStop: true
4. Record metrics:
   - LCP (Largest Contentful Paint)
   - CLS (Cumulative Layout Shift)
   - FID/INP (Interaction timing)
5. performance_analyze_insight → investigate any issues
6. Document baseline values
```

## Pattern 5: Error Investigation

```
Goal: Debug page errors and failed requests

Steps:
1. navigate_page → URL: problematic page
2. list_console_messages → types: ["error", "warn"]
3. For each error:
   - get_console_message → msgid for details
   - Note: stack traces, source files
4. list_network_requests → check for failures
5. Filter: resourceTypes: ["fetch", "xhr"] for API errors
6. get_network_request → reqid for failed request details
7. take_screenshot → capture error state
```

## Pattern 6: Form Validation Testing

```
Goal: Test form validation behavior

Steps:
1. navigate_page → form URL
2. take_snapshot
3. click → submit button (empty form)
4. take_snapshot → capture validation errors
5. take_screenshot → document error state
6. fill → one field with invalid data
7. click → submit
8. take_snapshot → capture specific field error
9. fill_form → all valid data
10. click → submit
11. wait_for → success message
```

## Pattern 7: Modal/Dialog Handling

```
Goal: Interact with modal dialogs

For Custom Modals (HTML/CSS):
1. take_snapshot
2. click → trigger element (button that opens modal)
3. wait_for → modal content text
4. take_snapshot → get modal element UIDs
5. Interact with modal content
6. press_key → "Escape" to close (most reliable)
   OR click → close button UID

For Browser Dialogs (alert/confirm/prompt):
1. Trigger action that shows dialog
2. handle_dialog → action: "accept" or "dismiss"
   - For prompt: include promptText
```

## Pattern 8: Dynamic Content Handling

```
Goal: Work with React/Vue/Angular pages that re-render

Challenge: State changes cause re-renders, losing scroll position and invalidating UIDs

Solutions:

A. Large Viewport (Recommended):
   1. resize_page → width: 1920, height: 5000
   2. take_snapshot → captures entire content
   3. Interact without scroll issues

B. Immediate Action:
   1. take_snapshot
   2. IMMEDIATELY click/fill (no delay)
   3. Re-snapshot if needed

C. Wait for Stability:
   1. wait_for → specific stable content
   2. take_snapshot
   3. Interact quickly

D. Full Page Screenshot:
   1. take_screenshot → fullPage: true
   2. Good for documentation, not interaction
```

## Pattern 9: Network Monitoring

```
Goal: Monitor API calls during user flow

Steps:
1. navigate_page → starting URL
2. Perform user actions...
3. list_network_requests → resourceTypes: ["fetch", "xhr"]
4. For interesting requests:
   - get_network_request → reqid
   - Check: status, timing, response size
5. Filter for failed (4xx, 5xx):
   - Investigate response details
```

## Pattern 10: Responsive Testing

```
Goal: Test page at different viewport sizes

Common Breakpoints:
- Mobile: 375x667 (iPhone)
- Tablet: 768x1024 (iPad)
- Desktop: 1920x1080

Steps:
1. For each breakpoint:
   a. resize_page → width, height
   b. navigate_page → URL (or reload)
   c. wait_for → content
   d. take_screenshot → filePath: "device_name.png"
   e. take_snapshot → verify element visibility
```

## Pattern 11: Authentication State Testing

```
Goal: Test behavior for logged-in vs logged-out users

Steps:
1. Test logged-out state:
   a. Use isolated profile OR clear cookies
   b. navigate_page → protected URL
   c. wait_for → login redirect or access denied
   d. take_screenshot

2. Test logged-in state:
   a. Perform login flow (Pattern 1)
   b. navigate_page → protected URL
   c. wait_for → authorized content
   d. take_screenshot
```

## Pattern 12: Slow Network Simulation

```
Goal: Test app behavior on slow connections

Steps:
1. emulate → networkConditions: "Slow 3G"
2. navigate_page → URL
3. Observe loading states, spinners
4. take_screenshot → loading state
5. wait_for → content loaded
6. take_screenshot → final state
7. list_console_messages → check for timeout errors
8. emulate → networkConditions: "No emulation" (reset)
```

## Anti-Patterns to Avoid

### ❌ Interacting without snapshot
```
BAD: click({uid: "e15"})  # Where did this UID come from?
GOOD: take_snapshot → find UID → click
```

### ❌ Assuming UIDs persist
```
BAD: Store UIDs for reuse across page changes
GOOD: Always take fresh snapshot after any page change
```

### ❌ Fighting scroll on dynamic pages
```
BAD: Repeatedly trying to scroll to element
GOOD: resize_page to large height, capture everything
```

### ❌ Clicking to close modals
```
BAD: click close button (can miss, wrong UID)
GOOD: press_key("Escape") first
```

### ❌ Starting trace without stopping previous
```
BAD: performance_start_trace when one is running
GOOD: Always check/stop existing trace first
```
