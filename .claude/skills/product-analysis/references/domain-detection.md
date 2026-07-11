# Domain Detection Reference

Single source of truth for domain detection, competitor mapping, persona generation, and domain-specific analysis guidance. Used by both the `/product-analysis` command (for auto-detection) and the Ralph loop template (for phase-specific guidance).

## How Detection Works

Detection is hierarchical — check in this order:
1. **Project description** (CLAUDE.md, README, package.json description) — most reliable
2. **Dependencies** (framework/library names in manifest files) — high confidence
3. **File patterns** (source file extensions, directory names) — medium confidence
4. **Code patterns** (`ast-grep` structural matches) — confirmation signal

If multiple domains match (e.g., a web app that's also an API), pick the more specific one. A "React + Express" project is a **Web Application**, not an "API/Backend" — because the user-facing surface is the web UI.

---

## EDA / Electronic Design Automation

**Detection signals:**
- Dependencies: `@xyflow/react`, `elkjs`, `jszip` (FZPZ support)
- Keywords in description: circuit, PCB, schematic, netlist, EDA, electronics, SPICE, component library
- File patterns: `*schematic*`, `*circuit*`, `*pcb*`, `*bom*`, `*netlist*`
- Code patterns: `ast-grep --pattern 'node.type' --lang typescript` with values like "resistor", "capacitor", "IC"

**Competitors:**
- KiCad (open source, full EDA suite)
- Altium Designer (professional, PCB-focused)
- EasyEDA (browser-based, beginner-friendly)
- Fritzing (hobbyist, breadboard-first)
- Eagle/Fusion 360 Electronics (Autodesk ecosystem)
- OrCAD (enterprise, legacy)
- Flux.ai (AI-assisted, browser-based)
- CircuitMaker (free Altium variant)

**Personas:**
1. **Hobbyist maker** — Arduino/RPi projects, values simplicity and community libraries, low tolerance for complexity
2. **Professional electrical engineer** — Daily user, cares about DRC accuracy, simulation, and manufacturing output (Gerber, BOM)
3. **Hardware startup founder** — Needs collaboration, version control, rapid prototyping, investor-ready documentation

**Research URLs:**
```bash
trafilatura -u "https://www.kicad.org/discover/features/"
trafilatura -u "https://easyeda.com/page/features"
trafilatura -u "https://www.flux.ai/features"
```

**Domain-specific tool commands:**
```bash
# Check for EDA-specific exports
rg 'gerber|kicad|eagle|spice|netlist|bom' src/ -i --stats
# Check component library completeness
ast-grep --pattern 'componentType' --lang typescript
fd -g '*.fzpz' -g '*.kicad_sym' -g '*.lib'
```

**Innovation prompts:**
- AI-powered component suggestion ("you're building X, you probably need Y")
- Real-time collaborative schematic editing (like Figma for circuits)
- Integrated simulation (SPICE in the browser)
- One-click PCB ordering with DFM checks
- Natural language to circuit ("make a 5V regulator with overcurrent protection")

---

## Web Application

**Detection signals:**
- Dependencies: `react`, `vue`, `angular`, `svelte`, `next`, `nuxt`, `remix`, `astro`
- Combined with: `express`, `fastify`, `koa`, `hono` (full-stack), or standalone SPA
- File patterns: `*.tsx`, `*.jsx`, `*.vue`, `*.svelte`, `components/`, `pages/`, `views/`
- Has both `client/` or `src/` AND `server/` or `api/`

**Competitors:**
- Research the specific niche (e.g., project management → Linear, Asana, Jira)
- Generic web app references: Figma (design), Linear (project mgmt), Notion (docs), Vercel Dashboard (developer tools)
- Use project description to identify the specific market category

**Personas:**
1. **End user (non-technical)** — Just wants the tool to work. Judges by speed, clarity, and "does it look trustworthy?"
2. **Power user** — Uses keyboard shortcuts, wants bulk operations, API access, customization
3. **Administrator** — Manages users, permissions, billing. Cares about audit logs and compliance

**Research URLs:**
```bash
# Adapt to specific competitors
trafilatura -u "https://linear.app/features"
trafilatura -u "https://notion.so/product"
```

**Domain-specific tool commands:**
```bash
# Check responsive design
rg 'useMediaQuery|@media|breakpoint|responsive' src/ --stats
# Check dark/light theme support
rg 'theme|dark-mode|color-scheme' src/ --stats
# Check i18n
rg 'useTranslation|i18n|t\(' src/ --stats
```

**Innovation prompts:**
- AI copilot for the specific domain (not just chatbot — embedded assistance)
- Offline-first architecture (PWA, local-first data)
- Real-time collaboration (CRDTs, presence indicators)
- Plugin/extension system for user customization
- Natural language search across all data

---

## CLI Tool

**Detection signals:**
- Dependencies: `commander`, `yargs`, `meow`, `cac`, `citty`, `clap` (Rust), `cobra` (Go), `click`/`typer` (Python)
- File patterns: `bin/`, `cli.ts`, `cli.rs`, `main.go`, `__main__.py`
- Has `"bin"` field in `package.json`
- No frontend/UI dependencies

**Competitors:**
- Research tools in the same space (e.g., file search → ripgrep, fd, find)
- Generic CLI references: gh CLI, ripgrep, fzf, jq, bat, delta
- Check if competing CLIs exist for the same task

**Personas:**
1. **Casual user** — Runs the tool occasionally, relies on `--help`, prefers simple defaults
2. **Daily power user** — Has aliases and config files, uses advanced flags, pipes output to other tools
3. **CI/CD pipeline (automated)** — Non-interactive, needs predictable exit codes, machine-parseable output (JSON/CSV), no TTY dependency

**Research URLs:**
```bash
trafilatura -u "https://clig.dev/"  # Command Line Interface Guidelines
```

**Domain-specific tool commands:**
```bash
# Check help text quality
rg 'description|usage|example' src/ --stats
# Check exit codes
rg 'process\.exit|std::process::exit|os\.Exit|sys\.exit' --stats
# Check JSON output support
rg 'json|JSON|--format' src/ --stats
# Check config file support
fd -g '*.config.*' -g '.rc' -g 'config.toml'
```

**Innovation prompts:**
- Interactive TUI mode (with `ink`, `ratatui`, `bubbletea`)
- Shell completions (bash, zsh, fish) auto-generated
- Progress indicators for long operations
- Plugin system for community extensions
- AI-powered flag suggestions based on context

---

## API / Backend Service

**Detection signals:**
- Dependencies: `express`, `fastify`, `koa`, `hono`, `actix-web`, `axum`, `django`, `fastapi`, `flask`, `gin`, `echo`
- No frontend framework dependencies (no React, Vue, Angular)
- File patterns: `routes/`, `controllers/`, `handlers/`, `middleware/`
- Has OpenAPI/Swagger spec files

**Competitors:**
- Research APIs in the same space
- Generic API references: Stripe API (gold standard), Twilio, SendGrid, Plaid
- Check API documentation quality standards

**Personas:**
1. **Frontend developer (consumer)** — Integrates the API into their app. Cares about documentation, SDKs, error messages, rate limits
2. **DevOps engineer** — Deploys and monitors the service. Cares about health checks, logging, metrics, container support
3. **API product manager** — Designs the API surface. Cares about versioning strategy, deprecation policy, adoption metrics

**Domain-specific tool commands:**
```bash
# Find all API endpoints
ast-grep --pattern 'app.$METHOD($$$)' --lang typescript
rg '(GET|POST|PUT|DELETE|PATCH)\s' src/ --stats
# Check for OpenAPI/Swagger
fd -g 'openapi*' -g 'swagger*' -g '*.yaml' -g '*.json' --max-depth 3
# Check rate limiting
rg 'rate.limit|throttle|429' src/ --stats
# Check authentication
rg 'auth|jwt|bearer|api.key|session' src/ -i --stats
```

**Innovation prompts:**
- Auto-generated SDKs from OpenAPI spec
- Real-time event streaming (webhooks, WebSockets, SSE)
- GraphQL federation or tRPC for type-safe clients
- API versioning with automatic migration guides
- Usage analytics dashboard for API consumers

---

## Mobile App

**Detection signals:**
- Dependencies: `react-native`, `expo`, `@capacitor`, `@ionic`
- File patterns: `*.swift`, `*.kt`, `*.dart`, `android/`, `ios/`, `app.json` (Expo)
- Has `app.json` or `app.config.js` (Expo)
- Has `*.xcodeproj` or `*.xcworkspace` (iOS native)

**Competitors:**
- Research apps in the same category on App Store/Play Store
- Platform guidelines: Apple HIG, Material Design 3
- Check comparable mobile apps

**Personas:**
1. **Casual mobile user** — Downloads, tries for 30 seconds, keeps or deletes. First impression is everything
2. **Daily active user** — Uses the app as part of their routine. Cares about reliability, speed, notifications
3. **Accessibility-dependent user** — Relies on VoiceOver/TalkBack, dynamic type, reduced motion. Non-negotiable requirements

**Domain-specific tool commands:**
```bash
# Check navigation structure
ast-grep --pattern 'createStackNavigator' --lang typescript
ast-grep --pattern 'Screen name=$NAME' --lang tsx
# Check permissions
rg 'Permission|usePermission|camera|location|notification' src/ -i --stats
# Check offline support
rg 'AsyncStorage|SecureStore|SQLite|offline' src/ -i --stats
```

**Innovation prompts:**
- Widget support (iOS/Android home screen widgets)
- Haptic feedback patterns
- Siri Shortcuts / Google Assistant integration
- Watch companion app
- Spatial computing (Vision Pro, if applicable)

---

## Library / Package

**Detection signals:**
- Has `"main"` or `"exports"` in `package.json` but no `"bin"` and no frontend framework
- Has `lib.rs` with `#[no_mangle]` or public API
- File patterns: `src/index.ts`, `src/lib.rs`, `src/__init__.py`
- Has `"types"` or `"typings"` field (TypeScript library)
- Published to npm, crates.io, PyPI

**Competitors:**
- Search npm/crates.io/PyPI for packages solving the same problem
- Top 3-5 comparable libraries in the ecosystem
- Check download counts and GitHub stars for each

**Personas:**
1. **Junior developer (first time)** — Follows the README, copies examples, gets frustrated by missing docs
2. **Senior developer (evaluating)** — Reads source code, checks bundle size, evaluates API design, cares about tree-shaking
3. **Maintainer/contributor** — Wants to fix bugs or add features. Cares about contribution guide, test infrastructure, CI

**Domain-specific tool commands:**
```bash
# Check API surface
ast-grep --pattern 'export function $NAME($$$)' --lang typescript
ast-grep --pattern 'export type $NAME' --lang typescript
# Check bundle size
du -sh dist/ 2>/dev/null
# Check tree-shaking support
rg 'sideEffects' package.json
# Check documentation
fd -g 'README*' -g 'CHANGELOG*' -g 'CONTRIBUTING*' -g 'API.md'
```

**Innovation prompts:**
- Zero-config setup (convention over configuration)
- TypeScript-first with inference (no manual type annotations needed)
- Framework adapters (React hook wrapper, Vue composable, Svelte store)
- Interactive documentation (like Storybook for UI, Swagger for APIs)
- WASM build for cross-platform usage

---

## Desktop Application

**Detection signals:**
- Dependencies: `electron`, `tauri`, `@electron`, `wry`, `gtk`, `qt`
- File patterns: `electron-builder.yml`, `tauri.conf.json`, `src-tauri/`
- Has desktop-specific APIs (file system, system tray, native menus)

**Competitors:**
- VS Code, Figma Desktop, Slack Desktop, Obsidian, comparable desktop tools
- Check if web-based alternatives exist (desktop may be differentiator or legacy)

**Personas:**
1. **Beginner user** — Expects familiar OS patterns (Cmd+S, right-click menus, drag-and-drop)
2. **Professional daily user** — Wants keyboard shortcuts, workspace persistence, multi-monitor support
3. **Plugin/extension developer** — Wants an extension API, marketplace, developer documentation

**Domain-specific tool commands:**
```bash
# Check for native integrations
rg 'dialog|menu|tray|notification|clipboard|file-system' src/ -i --stats
# Check auto-update
rg 'autoUpdater|update' src/ --stats
# Check platform support
fd -g 'electron-builder*' -g 'tauri.conf*'
```

---

## Data Science / ML

**Detection signals:**
- Dependencies: `pandas`, `numpy`, `sklearn`, `tensorflow`, `pytorch`, `jupyter`
- File patterns: `*.ipynb`, `notebooks/`, `models/`, `data/`
- Has `requirements.txt` or `environment.yml` with ML libraries

**Competitors:**
- Jupyter, Kaggle Notebooks, Google Colab, Databricks, comparable platforms
- Check if competing tools exist for the specific ML task

**Personas:**
1. **Data scientist** — Exploratory analysis, rapid iteration, visualization. Values notebook experience
2. **ML engineer** — Production deployment, model serving, monitoring. Values reproducibility and pipeline automation
3. **Business analyst** — Non-code interface, dashboard creation, report generation. Values accessibility

---

## Infrastructure / DevOps

**Detection signals:**
- Dependencies/files: `terraform`, `ansible`, `pulumi`, `cdk`, `helm`
- File patterns: `*.tf`, `*.yml` (Ansible), `Dockerfile`, `docker-compose.yml`, `k8s/`, `.github/workflows/`
- Has infrastructure-specific configuration files

**Competitors:**
- Terraform Cloud, Pulumi, AWS CDK, Ansible Tower, comparable IaC tools
- Check for managed service alternatives

**Personas:**
1. **Platform engineer** — Designs infrastructure patterns. Values modularity, reusability, drift detection
2. **Developer (consumer)** — Uses infrastructure but doesn't manage it. Values self-service, documentation, guardrails
3. **Security/compliance officer** — Audits infrastructure. Values policy enforcement, audit trails, compliance reports

---

## Game / Interactive

**Detection signals:**
- Dependencies: `three`, `pixi`, `phaser`, `babylon`, `p5`, `matter-js`, `cannon-js`
- File patterns: `*.glsl`, `*.shader`, `assets/sprites/`, `assets/models/`
- Has game loop patterns, canvas/WebGL usage

**Competitors:**
- Unity, Godot, Unreal (if full engine), Phaser, comparable web game frameworks
- Check the specific game genre for comparable titles

**Personas:**
1. **Casual player** — Wants immediate fun, intuitive controls, no tutorial
2. **Hardcore gamer** — Wants depth, customization, competitive features, modding support
3. **Game developer (using as engine/framework)** — Wants documentation, asset pipeline, debugging tools
