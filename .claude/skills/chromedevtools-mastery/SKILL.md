---
name: chromedevtools-mastery
description: Complete mastery of Chrome DevTools MCP for browser automation, debugging, and performance analysis. This skill should be used when user mentions browser automation, screenshots, web scraping, form filling, clicking elements, page navigation, performance traces, network debugging, console logs, or any Chrome/browser interaction. Also triggers on "screenshot", "click", "fill form", "navigate", "browser", "webpage", "DOM", "element", "performance trace", "network requests", "console errors", or testing web applications.
version: 1.1.0
allowed-tools: mcp__chrome-devtools__take_snapshot, mcp__chrome-devtools__take_screenshot, mcp__chrome-devtools__click, mcp__chrome-devtools__fill, mcp__chrome-devtools__fill_form, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__new_page, mcp__chrome-devtools__list_pages, mcp__chrome-devtools__select_page, mcp__chrome-devtools__press_key, mcp__chrome-devtools__hover, mcp__chrome-devtools__drag, mcp__chrome-devtools__upload_file, mcp__chrome-devtools__handle_dialog, mcp__chrome-devtools__wait_for, mcp__chrome-devtools__emulate, mcp__chrome-devtools__resize_page, mcp__chrome-devtools__evaluate_script, mcp__chrome-devtools__performance_start_trace, mcp__chrome-devtools__performance_stop_trace, mcp__chrome-devtools__performance_analyze_insight, mcp__chrome-devtools__list_network_requests, mcp__chrome-devtools__get_network_request, mcp__chrome-devtools__list_console_messages, mcp__chrome-devtools__get_console_message
---

# Chrome DevTools MCP Mastery

Complete mastery of Chrome DevTools MCP - the powerful server that gives Claude full control over a live Chrome browser for automation, debugging, and performance analysis.

## Two Browser MCP Servers — Pick the Right One

| Need | Server | Key Tools |
|------|--------|-----------|
| **Data extraction**: DOM snapshot, accessibility tree, network inspection, console messages, performance traces | **Chrome DevTools MCP** (this skill) | `take_snapshot`, `list_network_requests`, `list_console_messages`, `performance_start_trace` |
| **User interaction**: click/type/screenshot, find elements by description, form filling, GIF recording | **Claude-in-Chrome MCP** | `computer`, `find`, `form_input`, `gif_creator` |

Simple rule: Chrome DevTools = DATA EXTRACTION. Claude-in-Chrome = USER INTERACTION.

## When NOT to Use

Do NOT use this skill when:
- **No browser needed** → Pure backend/CLI work, file operations, git
- **Static file reading** → Just need to read local HTML, use Read tool
- **API-only testing** → Use httpie/curl, not browser automation
- **Already have Playwright/Puppeteer** → Those tools have their own patterns

**Always use when:** Any live browser interaction, screenshots, form automation, performance tracing.

## MANDATORY PROTOCOL - READ FIRST

**BEFORE ANY BROWSER INTERACTION - NO EXCEPTIONS:**

```
┌─────────────────────────────────────────────────────────────┐
│  1. ALWAYS take_snapshot FIRST before click/fill/hover     │
│     • "No snapshot found" = YOU FORGOT. Snapshot first.    │
│     • Snapshot gives you UIDs needed for all interactions  │
│                                                            │
│  2. Real-time pages (React/Vue/Angular):                   │
│     • Scroll WILL reset due to re-renders                  │
│     • Use fullPage: true OR resize_page with large height  │
│     • Don't fight re-renders - capture everything at once  │
│                                                            │
│  3. Modals/Dialogs:                                        │
│     • press_key("Escape") FIRST - more reliable            │
│     • If must click: snapshot → get UID → click            │
│                                                            │
│  4. CHECKLIST (EVERY INTERACTION):                         │
│     ☐ take_snapshot called?                                │
│     ☐ Have element UID from snapshot?                      │
│     ☐ Page updating live? → Use fullPage/resize            │
└─────────────────────────────────────────────────────────────┘
```

## Automatic Activation Triggers

Invoke this skill immediately when detecting ANY of:

- **Keywords**: browser, Chrome, webpage, screenshot, DOM, element, click, form, navigate, automation
- **Actions**: "take screenshot", "click button", "fill form", "navigate to", "check console", "debug page"
- **Performance**: "performance trace", "Core Web Vitals", "page speed", "network requests"
- **Testing**: "test webpage", "automate browser", "scrape page", "extract data"

## Quick Reference - User Intent to Tool

| User Wants | Tool(s) | Key Parameters |
|------------|---------|----------------|
| Take screenshot | `take_screenshot` | `fullPage`, `uid`, `format` |
| Click something | `take_snapshot` → `click` | `uid`, `dblClick` |
| Fill a form | `take_snapshot` → `fill` or `fill_form` | `uid`, `value` |
| Navigate to URL | `navigate_page` or `new_page` | `url`, `type` |
| Check for errors | `list_console_messages` | `types: ["error"]` |
| Debug network | `list_network_requests` | `resourceTypes` |
| Performance audit | `performance_start_trace` | `reload`, `autoStop` |
| Wait for content | `wait_for` | `text`, `timeout` |
| Run JavaScript | `evaluate_script` | `function`, `args` |
| Handle popup | `handle_dialog` | `action`, `promptText` |
| Simulate slow network | `emulate` | `networkConditions` |

## The Tools - Complete Reference

### Input Automation (8 tools)

#### `click`
Click on element identified by UID from snapshot.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | ✓ | Element UID from take_snapshot |
| `dblClick` | boolean | | Set true for double-click |

**Optimization**: Always get fresh snapshot before clicking on dynamic pages.

#### `hover`
Hover over element to trigger hover states, dropdowns, tooltips.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | ✓ | Element UID from snapshot |

#### `fill`
Type text into input, textarea, or select from dropdown.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | ✓ | Element UID from snapshot |
| `value` | string | ✓ | Text to enter or option to select |

**Note**: For `<select>` elements (combobox), pass the visible text of the option.

#### `fill_form`
Fill multiple form fields in one call - more efficient than multiple `fill` calls.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `elements` | array | ✓ | Array of `{uid, value}` objects |

**Example**:
```json
{"elements": [
  {"uid": "e12", "value": "john@example.com"},
  {"uid": "e14", "value": "password123"}
]}
```

#### `drag`
Drag element from one location to another.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from_uid` | string | ✓ | UID of element to drag |
| `to_uid` | string | ✓ | UID of drop target |

#### `upload_file`
Upload file through file input or file chooser trigger.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | ✓ | File input element UID |
| `filePath` | string | ✓ | Absolute path to file |

#### `press_key`
Press keyboard key or combination.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | ✓ | Key name or combo |

**Common keys**: `Enter`, `Escape`, `Tab`, `Backspace`, `ArrowDown`, `ArrowUp`
**Combos**: `Control+A`, `Control+C`, `Control+V`, `Control+Shift+R`, `Meta+S`

**Use for**: Closing modals (Escape), keyboard shortcuts, form submission (Enter)

#### `handle_dialog`
Handle browser dialogs (alert, confirm, prompt).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | "accept" \| "dismiss" | ✓ | How to handle dialog |
| `promptText` | string | | Text for prompt dialogs |

### Navigation (6 tools)

#### `list_pages`
Get all open browser pages/tabs.

No parameters. Returns list with index, URL, title for each page.

#### `select_page`
Switch to a different page/tab.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pageIdx` | number | ✓ | Page index from list_pages |

#### `close_page`
Close a page/tab by index.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pageIdx` | number | ✓ | Page index to close |

**Note**: Cannot close the last remaining page.

#### `new_page`
Open new page with URL.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | ✓ | URL to load |
| `timeout` | number | | Max wait time (ms) |

#### `navigate_page`
Navigate current page.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | "url" \| "back" \| "forward" \| "reload" | | Navigation type |
| `url` | string | | URL (required if type=url) |
| `ignoreCache` | boolean | | Bypass cache on reload |
| `timeout` | number | | Max wait time (ms) |

#### `wait_for`
Wait for specific text to appear on page.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | ✓ | Text to wait for |
| `timeout` | number | | Max wait time (ms) |

**Use for**: Waiting for async content, page transitions, loading states.

### Emulation (2 tools)

#### `emulate`
Simulate network conditions and CPU throttling.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `networkConditions` | string | | See options below |
| `cpuThrottlingRate` | number | | 1-20 (1=no throttling) |

**Network options**: `"No emulation"`, `"Offline"`, `"Slow 3G"`, `"Fast 3G"`, `"Slow 4G"`, `"Fast 4G"`

#### `resize_page`
Resize viewport dimensions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `width` | number | ✓ | Viewport width in pixels |
| `height` | number | ✓ | Viewport height in pixels |

**Pro tip**: Use large height (e.g., 5000) to capture full page content on real-time updating pages instead of fighting scroll resets.

### Performance (3 tools)

#### `performance_start_trace`
Start recording performance trace for Core Web Vitals and insights.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reload` | boolean | ✓ | Reload page after starting |
| `autoStop` | boolean | ✓ | Auto-stop after 5 seconds |

**Recommended**: `{reload: true, autoStop: true}` for typical audits.

#### `performance_stop_trace`
Stop active trace and get results.

No parameters. Returns trace summary with CWV scores and insight highlights.

#### `performance_analyze_insight`
Get detailed analysis of specific insight from trace.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `insightSetId` | string | ✓ | ID from trace results |
| `insightName` | string | ✓ | Insight name (e.g., "LCPBreakdown") |

**Common insights**: `DocumentLatency`, `LCPBreakdown`, `CLSCulprits`, `RenderBlocking`

### Network (2 tools)

#### `list_network_requests`
List network requests since last navigation.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pageSize` | number | | Max results per page |
| `pageIdx` | number | | Page number (0-based) |
| `resourceTypes` | array | | Filter by type |
| `includePreservedRequests` | boolean | | Include last 3 navigations |

**Resource types**: `document`, `stylesheet`, `image`, `media`, `font`, `script`, `xhr`, `fetch`, `websocket`, `other`

#### `get_network_request`
Get detailed info for specific request.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reqid` | number | | Request ID from list |

### Debugging (5 tools)

#### `take_screenshot`
Capture screenshot of page or element.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | "png" \| "jpeg" \| "webp" | | Default: png |
| `quality` | number | | 0-100 for jpeg/webp |
| `uid` | string | | Element UID for element screenshot |
| `fullPage` | boolean | | Capture full scrollable page |
| `filePath` | string | | Save to file instead of returning |

**Cannot combine**: `uid` and `fullPage` are mutually exclusive.

#### `take_snapshot`
**THE MOST IMPORTANT TOOL** - Get accessibility tree with UIDs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `verbose` | boolean | | Include all a11y info |
| `filePath` | string | | Save to file |

**CRITICAL**: Call this BEFORE any click/fill/hover. UIDs from snapshot are required for all interactions.

#### `list_console_messages`
Get console output from page.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pageSize` | number | | Max results |
| `pageIdx` | number | | Page number |
| `types` | array | | Filter by type |
| `includePreservedMessages` | boolean | | Include last 3 navigations |

**Message types**: `log`, `debug`, `info`, `error`, `warn`, `trace`, `table`, `assert`

#### `get_console_message`
Get specific console message details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `msgid` | number | ✓ | Message ID from list |

#### `evaluate_script`
Execute JavaScript in page context.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `function` | string | ✓ | JS function declaration |
| `args` | array | | Element UIDs as arguments |

**Example without args**:
```javascript
() => { return document.title }
```

**Example with args**:
```javascript
(el) => { return el.innerText }
```
With `args: [{uid: "e15"}]`

## Troubleshooting Decision Tree

```
Error: "No snapshot found"
└── Did you call take_snapshot first?
    ├── No → Call take_snapshot, get UID, then interact
    └── Yes → Is the page dynamic (React/Vue)?
        └── Yes → Page re-rendered. Call take_snapshot again immediately before interaction

Error: "Element not found" / Invalid UID
└── Is the UID from a recent snapshot?
    ├── No → Call take_snapshot again to get fresh UIDs
    └── Yes → Did the page change since snapshot?
        ├── Yes → Take new snapshot
        └── No → Is element inside iframe?
            └── Check if need to select different frame

Scroll keeps resetting
└── Is this a React/Vue/Angular app?
    └── Yes → Use one of:
        ├── resize_page with large height (e.g., 5000)
        ├── take_screenshot with fullPage: true
        └── Work with visible content, don't fight re-renders

Modal won't close by clicking X
└── Try press_key("Escape") first - more reliable than clicking close button

Dialog not responding
└── Check if it's a browser dialog (alert/confirm/prompt)
    └── Yes → Use handle_dialog, not click

Performance trace shows "already running"
└── Call performance_stop_trace first, then start new trace
```

## Common Workflow Patterns

### Pattern 1: Form Automation
```
1. navigate_page to form URL
2. wait_for "Submit" (or form identifier)
3. take_snapshot
4. fill_form with all field UIDs and values
5. take_snapshot (get submit button UID)
6. click submit button
```

### Pattern 2: Debug Page Errors
```
1. navigate_page to URL
2. list_console_messages with types: ["error", "warn"]
3. For each error: get_console_message for details
4. list_network_requests with resourceTypes to check failed requests
```

### Pattern 3: Performance Audit
```
1. navigate_page to URL
2. performance_start_trace with reload: true, autoStop: true
3. Review CWV scores and insight highlights
4. performance_analyze_insight for specific issues
```

### Pattern 4: Screenshot Documentation
```
1. navigate_page to URL
2. wait_for page content
3. For dynamic pages: resize_page with large height
4. take_screenshot with fullPage: true
```

## Configuration Reference

For server configuration options and troubleshooting, see `references/configuration-options.md`.

## Related Skills

- `browser-use-mastery` - Alternative browser automation approaches
- `deep-focus` - Uses Chrome DevTools for comprehensive UI audits
- `ui-screenshot-cataloger` - Systematic screenshot capture workflows

## Changelog

- v1.1.0 (2025-01): Added "When NOT to Use", related skills, changelog
- v1.0.0 (2024-12): Initial Chrome DevTools MCP mastery guide
