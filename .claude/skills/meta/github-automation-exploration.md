# GitHub Automation with Claude-in-Chrome - Exploration Document

**Created:** 2024-12-19
**Purpose:** Document all GitHub UI elements, navigation patterns, and automation opportunities for creating a comprehensive skill.
**User:** wtyler2505

---

## Table of Contents

1. [Dashboard](#dashboard)
2. [Profile](#profile)
3. [Repositories](#repositories)
4. [Settings](#settings)
5. [Stars & Gists](#stars--gists)
6. [Issues & Pull Requests](#issues--pull-requests)
7. [Notifications](#notifications)
8. [Navigation Patterns](#navigation-patterns)
9. [Claude-in-Chrome Tool Reference](#claude-in-chrome-tool-reference)
10. [Automation Opportunities](#automation-opportunities)

---

## Claude-in-Chrome Tool Reference

### Available Tools
- `mcp__claude-in-chrome__tabs_context_mcp` - Get/create tab context
- `mcp__claude-in-chrome__navigate` - Navigate to URL
- `mcp__claude-in-chrome__computer` - Actions: screenshot, left_click, right_click, type, wait, scroll, key
- `mcp__claude-in-chrome__read_page` - Get accessibility tree with element refs
- `mcp__claude-in-chrome__find` - Natural language element search
- `mcp__claude-in-chrome__form_input` - Fill form fields
- `mcp__claude-in-chrome__get_page_text` - Extract text content

### Key Patterns
- Always call `tabs_context_mcp` first to get tabId
- Use `read_page` to get element refs before clicking
- Click elements using `computer` action="left_click" with ref="ref_XXX"
- Take screenshots with `computer` action="screenshot"

---

## Dashboard

**URL:** https://github.com/

### Structure

The dashboard has 4 main sections:
1. **Header Banner** - Global navigation, search, user controls
2. **Left Sidebar** - Home/Feed nav, Top Repositories list
3. **Main Content** - Copilot AI box, Agent sessions, PRs, Issues
4. **Right Sidebar** - Changelog, Explore content

### Header Navigation (Banner)

| Element | Ref | Purpose |
|---------|-----|---------|
| Hamburger menu | ref_5 | Open global navigation |
| Home | ref_7 | Go to /dashboard |
| Issues | ref_10 | Go to /issues |
| Pull requests | ref_13 | Go to /pulls |
| Dashboard breadcrumb | ref_19 | Go to / |
| Search/jump to | ref_29 | Opens search dialog |
| Command palette | ref_101 | Alternative search |
| Copilot chat | ref_74 | Go to /copilot |
| Agents panel | ref_76 | Open Copilot agents |
| Create new... | ref_78 | Create menu dropdown |
| Your issues | ref_80 | Go to /issues |
| Your PRs | ref_82 | Go to /pulls |
| Repositories | ref_84 | Go to /repos |
| Notifications | ref_86 | Go to /notifications |
| **User Menu** | **ref_88** | **Account dropdown (CRITICAL)** |

### Left Sidebar - Top Repositories

| Repo | Ref |
|------|-----|
| Claude-Code-Development-Kit-i124q | ref_238 |
| hp_laptop_agent | ref_241 |
| OmniTrek-Nexus | ref_244 |
| salvage-parts-system | ref_247 |
| multi-controller-app | ref_250 |
| salvage-dot-sys | ref_253 |
| fetch-mcp-enhancement | ref_256 |
| RoverMissionControl | ref_259 |
| FoEx-AI-Assistant | ref_262 |
| Nexus-Terminal | ref_265 |
| Show more | ref_268 |

### Main Content - Copilot Section

| Element | Ref | Purpose |
|---------|-----|---------|
| Ask anything input | ref_277 | Copilot prompt |
| Add repos/files | ref_279 | Context picker |
| Model selector | ref_281 | Claude Sonnet 4.5 |
| Send button | ref_284 | Submit prompt |
| Task button | ref_292 | Create task |
| Create issue | ref_296 | Issue via Copilot |
| Spark | ref_299 | Spark feature |
| Git | ref_302 | Git commands |
| Pull requests | ref_305 | PR commands |

### Agent Sessions Section

| Element | Ref |
|---------|-----|
| View all sessions | ref_309 |
| Session options | ref_311 |

### Pull Requests Section (Dashboard)

**Open PRs:**
1. hp_laptop_agent#19 - Super-linter removal (ref_361)
2. multi-controller-app#22 - Merge PR#18 (ref_373)  
3. multi-controller-app#13 - Rust Serial (ref_386, Draft)

| Element | Ref |
|---------|-----|
| View all PRs | ref_355 |
| PR options | ref_356 |

### Issues Section (Dashboard)

**Open Issues:**
1. multi-controller-app#21 - GitHub Automation Test (ref_404)
2. multi-controller-app#10 - Profile Management (ref_417)
3. multi-controller-app#6 - Telemetry (ref_431)

| Element | Ref |
|---------|-----|
| View all issues | ref_398 |
| Issue options | ref_399 |

### Actions Available
- Search repositories/code/users via command palette
- Navigate to any repo via sidebar
- View and manage PRs/Issues
- Interact with Copilot
- Access notifications
- Open user menu for profile/settings

---

## Profile

**URL:** https://github.com/wtyler2505

### Profile Page Tabs

| Tab | Ref | URL |
|-----|-----|-----|
| Overview | ref_95 | /wtyler2505 |
| Repositories | ref_99 | /wtyler2505?tab=repositories |
| Projects | ref_103 | /wtyler2505?tab=projects |
| Packages | ref_107 | /wtyler2505?tab=packages |
| Stars | ref_111 | /wtyler2505?tab=stars |

### Profile Details

- **Username:** wtyler2505
- **Bio:** "Just a hobby, but everything electronic is what im passionate about."
- **Avatar change:** ref_260 → https://github.com/account
- **Contributions:** 475 in last year
- **Customize pins:** ref_ac (Customize your pins)

### Pinned Repository

| Repo | Ref | Description |
|------|-----|-------------|
| multi-controller-app | ref_663 | Windows app for Arduino, ESP32, hardware over Serial/TCP/UDP/SSH |
| Language: Rust | Stars: 2 (ref_669) |

### Contribution Activity Year Filter

| Year | Ref |
|------|-----|
| 2025 | ref_1566 |
| 2024 | ref_1568 |
| 2023 | ref_1570 |
| 2022 | ref_1572 |
| 2021 | ref_1574 |
| 2020 | ref_1576 |
| 2019 | ref_1578 |

### Actions Available
- Change avatar
- Customize pinned repos
- View contribution history by year
- Navigate to any tab (repos, projects, packages, stars)

---

## Repositories

**URL:** https://github.com/wtyler2505?tab=repositories

### Repository Count: 74

### Filter/Search Controls

| Element | Ref | Purpose |
|---------|-----|---------|
| Search box | ref_1641 | Find a repository |
| Type filter | ref_1643 | All/Public/Private/Sources/Forks/Archived/Mirrors |
| Language filter | ref_1645 | Filter by programming language |
| Sort | ref_1647 | Sort by name/stars/updated |
| **New repo** | **ref_1648** | Create new repository → /new |

### Sample Repositories (74 total)

| Repo | Type | Language | Stars | Notes |
|------|------|----------|-------|-------|
| Claude-Code-Development-Kit-i124q | Private | Python | 1 | ref_1649, Starred |
| Partsnap-Inventory | Private | TypeScript | - | ref_1654 |
| Nexus-Terminal | Public | TypeScript | - | ref_1658, CLI coders collab |
| parts-creator | Private | JavaScript | - | |
| GL.703.GS | Private | JavaScript | - | |
| OmniTrek-Nexus | Private | TypeScript | 1 | Starred |
| CCM | Private | JavaScript | - | MIT License |
| pdanet-linux | Public | Python | 5 | Starred, PdaNet+ Linux client |
| Linux-Use | Public | Python | 4 | Forked, Computer-USE for Linux |
| developer-roadmap | Public | TypeScript | - | Forked |
| hp_laptop_agent | Public | - | - | |
| multi-controller-app | Public | Rust | 2 | Arduino/ESP32 control |
| salvage-parts-system | Public | - | - | |
| salvage-dot-sys | Public | - | - | |
| fetch-mcp-enhancement | Public | - | - | |
| RoverMissionControl | Public | - | - | |
| FoEx-AI-Assistant | Public | - | - | |

### Repo Card Actions

Each repo card has:
- **Star button** - Toggle star (ref varies)
- **Add to list** - Add repo to list dropdown
- **Activity graph** - Mini contribution chart

### Actions Available
- Search/filter repositories
- Create new repository
- Star/unstar repos
- View repo details

---

## Settings

**URL:** https://github.com/settings/profile

### Settings Sidebar Navigation

**User Settings:**
| Section | Ref | URL |
|---------|-----|-----|
| Public profile | ref_17 | /settings/profile |
| Account | ref_18 | /settings/admin |
| Appearance | ref_19 | /settings/appearance |
| Accessibility | ref_20 | /settings/accessibility |
| Notifications | ref_21 | /settings/notifications |

**Access:**
| Section | Ref | URL |
|---------|-----|-----|
| Billing & licensing | ref_22 | (expandable) |
| Emails | ref_23 | /settings/emails |
| Security | ref_24 | /settings/security |
| Sessions | ref_25 | /settings/sessions |
| SSH and GPG keys | ref_26 | /settings/keys |
| Organizations | ref_27 | /settings/organizations |
| Enterprises | ref_28 | /settings/enterprises |
| Moderation | - | (expandable) |

**Code, planning, and automation:**
| Section | URL |
|---------|-----|
| Repositories | /settings/repositories |
| Codespaces | /settings/codespaces |
| Models (Preview) | /settings/models |
| Packages | /settings/packages |
| Copilot | /settings/copilot (expandable) |
| Pages | /settings/pages |
| Saved replies | /settings/replies |

**Security:**
| Section | URL |
|---------|-----|
| Code security | /settings/security_analysis |

**Integrations:**
| Section | URL |
|---------|-----|
| Applications | /settings/applications |
| Scheduled reminders | /settings/reminders |

**Archives:**
| Section | URL |
|---------|-----|
| Security log | /settings/security-log |
| Sponsorship log | /settings/sponsors-log |

**Developer settings** | /settings/apps

### Profile Form Fields

| Field | Type | Ref |
|-------|------|-----|
| Name | text | ref_29 |
| Public email | combobox | ref_30 |
| Bio | textarea | ref_32 |
| Edit avatar | button | ref_34 |
| Pronouns | combobox | - |
| URL | text | - |
| Social accounts | text x4 | - |
| Company | text | - |
| Location | text | - |
| Display local time | checkbox | - |
| ORCID iD | button | Connect |
| **Update profile** | **button** | **ref_bh** |

### Privacy Options
- Make profile private and hide activity
- Include private contributions on my profile

---

## Stars & Gists

### Stars
**URL:** https://github.com/wtyler2505?tab=stars

**Total Stars:** 592
**Total Lists:** 32

#### Star Lists (Organized Collections)

| List Name | Repos | Ref |
|-----------|-------|-----|
| develop.ME | 75 | ref_25 |
| Model Context Protocol | 34 | ref_26 |
| Claude Code CLI | 124 | ref_27 |
| [CC] Specific Utilities | 11 | ref_28 |
| Productivity | 13 | ref_29 |
| Gemini CLI | 2 | ref_30 |
| develop.ME MCP | 22 | ref_31 |
| develop.ME Obsidian | - | ref_32 |

#### Stars Page Controls
| Element | Ref | Purpose |
|---------|-----|---------|
| Sort | ref_23 | Sort stars |
| Create list | ref_24 | (max reached) |

### Gists
**URL:** https://gist.github.com/mine
(Requires navigation approval)

---

## Notifications

**URL:** https://github.com/notifications

### Notification Sidebar

| Filter | Count | Ref |
|--------|-------|-----|
| Inbox | 3 | ref_15 |
| Saved | - | ref_16 |
| Done | - | ref_17 |

### Quick Filters

| Filter | Count | Ref |
|--------|-------|-----|
| Assigned | 2 | ref_18 |
| Participating | 37 | ref_19 |
| Mentioned | 2 | ref_20 |
| Team mentioned | - | ref_21 |
| Review requested | 2 | ref_22 |
| Customize filters | - | ref_24 |

### Repository Filters

| Repo | Notifications | Ref |
|------|---------------|-----|
| anthropics/claude-code | 3,816 | ref_25 |
| davila7/claude-code-templates | 111 | ref_26 |

### Notification Actions
| Element | Ref | Purpose |
|---------|-----|---------|
| Search | ref_29 | Search notifications |
| Group by | ref_30 | Group by date/repo |
| Select all | ref_34 | Bulk select |
| Individual checkboxes | ref_35+ | Select single |
| Dismiss | ref_31 | Hide notice |
| Get started | ref_33 | Mark as done |

---

## Issues & Pull Requests

### Issues Dashboard
**URL:** https://github.com/issues (redirects to /issues/assigned)

#### Issue Sidebar Filters

| Filter | Ref | URL |
|--------|-----|-----|
| Assigned to me | ref_14 | /issues/assigned |
| Created by me | ref_15 | /issues/created |
| Mentioned | ref_16 | /issues/mentioned |
| Recent activity | ref_17 | /issues/recent |

#### Views Section
| View | Ref | Purpose |
|------|-----|---------|
| Add view | ref_18 | Create custom view |
| Mentioned (saved) | ref_19 | Custom mention filter |

#### Issue Controls

| Element | Ref | Purpose |
|---------|-----|---------|
| Search box | ref_23 | Search Issues combobox |
| Run search | ref_24 | Execute query |

#### Issue List Item Actions
Each issue in the list has:
- **Issue link** (ref_28) - Navigate to issue detail
- **Label filters** - Click label to filter (ref_29-32)
- **Author filter** - Click author name (ref_33)
- **Assignee indicator** (ref_35)

#### Sample Issue
- **Test: GitHub Automation Capabilities** (ref_28)
  - Repo: wtyler2505/multi-controller-app#21
  - Labels: enhancement, help wanted, in-progress, priority:medium
  - Status: Open

---

### Pull Requests Dashboard
**URL:** https://github.com/pulls

#### PR Tab Filters

| Tab | Ref | Query |
|-----|-----|-------|
| Created | ref_14 | author:wtyler2505 |
| Assigned | ref_15 | assignee:wtyler2505 |
| Mentioned | ref_16 | mentions:wtyler2505 |
| Review requests | ref_17 | review-requested:wtyler2505 |

#### PR Stats
- **18 Open** (ref_20) 
- **30 Closed** (ref_21)

#### PR Controls

| Element | Ref | Purpose |
|---------|-----|---------|
| Search box | ref_18 | Search all issues |
| Clear search | ref_19 | Clear button |
| Visibility filter | ref_23 | Public/Private filter |
| Organization filter | ref_25 | Filter by org |
| Sort | ref_27 | Sort PRs |

#### Sample Open PRs

| PR | Repo | Ref | Labels |
|----|------|-----|--------|
| Merge PR #18 from feature/claude-github-app... | multi-controller-app#22 | ref_29 | 7 comments |
| Add usage instructions | salvage-parts-system#16 | ref_36 | codex |
| Remove unused salvageDatabase import | salvage-parts-system#15 | ref_40 | codex |
| Add Vitest setup and basic store tests | salvage-parts-system#14 | ref_44 | codex |
| Unify Supabase part APIs | salvage-parts-system#13 | ref_48 | codex |
| Add MIT license | salvage-parts-system#12 | ref_52 | codex |

#### PR List Item Actions
Each PR card has:
- **Repo link** - Navigate to repository (ref_28, ref_35, etc.)
- **PR title link** - Navigate to PR detail (ref_29, ref_36, etc.)
- **Label filter** - Click label to filter (ref_37, ref_41, etc.)
- **Author link** - Click to filter by author (ref_32, ref_38, etc.)
- **Comment count** - Navigate to PR comments

---

## Notifications

**URL:** https://github.com/notifications

---

## Navigation Patterns

### Global Navigation (Header)

Quick access links always visible in header:
| Action | Ref | URL |
|--------|-----|-----|
| Home/Dashboard | ref_7 | /dashboard |
| Issues | ref_10 | /issues |
| Pull requests | ref_13 | /pulls |
| Copilot | ref_74 | /copilot |
| Repositories | ref_84 | /repos |
| Notifications | ref_86 | /notifications |
| Create new | ref_78 | Opens dropdown |
| Search | ref_29 | Opens command palette |

### User Menu (ref_88 → dialog ref_485)

**CRITICAL:** This is the main navigation hub for account features.

| Option | Ref | URL/Action |
|--------|-----|------------|
| Account switcher | ref_490 | Switch accounts |
| Close menu | ref_492 | Dismiss dialog |
| Set status | ref_496 | Opens status modal |
| **Profile** | **ref_500** | /wtyler2505 |
| **Repositories** | **ref_503** | /wtyler2505?tab=repositories |
| **Stars** | **ref_506** | /wtyler2505?tab=stars |
| **Gists** | **ref_509** | https://gist.github.com/mine |
| Organizations | ref_512 | /settings/organizations |
| Enterprises | ref_515 | /settings/enterprises |
| Sponsors | ref_518 | /sponsors/accounts |
| **Settings** | **ref_522** | /settings/profile |
| Copilot settings | ref_525 | /settings/copilot |
| Feature preview | ref_528 | Opens modal |
| Appearance | ref_531 | /settings/appearance |
| Accessibility | ref_534 | /settings/accessibility |
| Try Enterprise | ref_537 | Enterprise trial |
| Sign out | ref_542 | /logout |

### Keyboard Shortcuts
- `/` or `s` - Focus search
- `g h` - Go to homepage
- `g n` - Go to notifications
- `?` - Show all shortcuts
- `Ctrl+K` or `Cmd+K` - Command palette

---

## Automation Opportunities

### High-Value Automations
(To be identified)

### Common Workflows
(To be identified)

---

## Raw Exploration Notes

### Session 1 - Initial Exploration
(Notes added in real-time below)

