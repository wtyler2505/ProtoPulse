#!/usr/bin/env bash
# detect-project.sh — Auto-detect project context and output structured JSON
# Usage: ./detect-project.sh [project-directory]
# Output: JSON with project name, stack, domain, key files, competitors, personas

set -euo pipefail

PROJECT_ROOT="${1:-$(pwd)}"
PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"  # Resolve to absolute path

# Helper: check if command exists
has_cmd() { command -v "$1" &>/dev/null; }

# Helper: safely read a file (returns empty if missing)
safe_read() { cat "$1" 2>/dev/null || echo ""; }

# ─── PROJECT NAME ───────────────────────────────────────────────────────────────

detect_name() {
    local name=""

    # Try package.json
    if [[ -f "$PROJECT_ROOT/package.json" ]] && has_cmd jq; then
        name=$(jq -r '.name // empty' "$PROJECT_ROOT/package.json" 2>/dev/null)
    fi

    # Try Cargo.toml
    if [[ -z "$name" && -f "$PROJECT_ROOT/Cargo.toml" ]]; then
        name=$(grep '^name' "$PROJECT_ROOT/Cargo.toml" | head -1 | sed 's/.*= *"\(.*\)"/\1/')
    fi

    # Try pyproject.toml
    if [[ -z "$name" && -f "$PROJECT_ROOT/pyproject.toml" ]]; then
        name=$(grep '^name' "$PROJECT_ROOT/pyproject.toml" | head -1 | sed 's/.*= *"\(.*\)"/\1/')
    fi

    # Try go.mod
    if [[ -z "$name" && -f "$PROJECT_ROOT/go.mod" ]]; then
        name=$(head -1 "$PROJECT_ROOT/go.mod" | awk '{print $2}' | rev | cut -d'/' -f1 | rev)
    fi

    # Fallback to directory name
    if [[ -z "$name" ]]; then
        name=$(basename "$PROJECT_ROOT")
    fi

    echo "$name"
}

# ─── TECH STACK ─────────────────────────────────────────────────────────────────

detect_stack() {
    local stack_parts=()

    if [[ -f "$PROJECT_ROOT/package.json" ]] && has_cmd jq; then
        local deps
        deps=$(jq -r '(.dependencies // {}) + (.devDependencies // {}) | keys[]' "$PROJECT_ROOT/package.json" 2>/dev/null)

        # Frontend frameworks
        echo "$deps" | grep -q '^react$' && {
            local ver
            ver=$(jq -r '.dependencies.react // .devDependencies.react // ""' "$PROJECT_ROOT/package.json" 2>/dev/null | tr -d '^~')
            stack_parts+=("React${ver:+ $ver}")
        }
        echo "$deps" | grep -q '^vue$' && stack_parts+=("Vue")
        echo "$deps" | grep -q '^@angular/core$' && stack_parts+=("Angular")
        echo "$deps" | grep -q '^svelte$' && stack_parts+=("Svelte")
        echo "$deps" | grep -q '^next$' && stack_parts+=("Next.js")
        echo "$deps" | grep -q '^nuxt$' && stack_parts+=("Nuxt")

        # Backend frameworks
        echo "$deps" | grep -q '^express$' && stack_parts+=("Express")
        echo "$deps" | grep -q '^fastify$' && stack_parts+=("Fastify")
        echo "$deps" | grep -q '^hono$' && stack_parts+=("Hono")
        echo "$deps" | grep -q '^koa$' && stack_parts+=("Koa")

        # Databases
        echo "$deps" | grep -q '^drizzle-orm$' && stack_parts+=("Drizzle ORM")
        echo "$deps" | grep -q '^prisma$' && stack_parts+=("Prisma")
        echo "$deps" | grep -q '^mongoose$' && stack_parts+=("MongoDB")
        echo "$deps" | grep -q '^pg$' && stack_parts+=("PostgreSQL")
        echo "$deps" | grep -q '^mysql2$' && stack_parts+=("MySQL")

        # Build tools
        echo "$deps" | grep -q '^vite$' && stack_parts+=("Vite")
        echo "$deps" | grep -q '^webpack$' && stack_parts+=("Webpack")

        # Styling
        echo "$deps" | grep -q '^tailwindcss$' && stack_parts+=("Tailwind")

        # Testing
        echo "$deps" | grep -q '^vitest$' && stack_parts+=("Vitest")
        echo "$deps" | grep -q '^jest$' && stack_parts+=("Jest")

        # AI
        echo "$deps" | grep -q '^@anthropic-ai/sdk$' && stack_parts+=("Anthropic Claude")
        echo "$deps" | grep -q '^openai$' && stack_parts+=("OpenAI")
    fi

    # Rust
    if [[ -f "$PROJECT_ROOT/Cargo.toml" ]]; then
        stack_parts+=("Rust")
        grep -q 'actix-web' "$PROJECT_ROOT/Cargo.toml" && stack_parts+=("Actix")
        grep -q 'axum' "$PROJECT_ROOT/Cargo.toml" && stack_parts+=("Axum")
        grep -q 'tokio' "$PROJECT_ROOT/Cargo.toml" && stack_parts+=("Tokio")
    fi

    # Python
    if [[ -f "$PROJECT_ROOT/pyproject.toml" || -f "$PROJECT_ROOT/requirements.txt" ]]; then
        stack_parts+=("Python")
        local pyfile="${PROJECT_ROOT}/pyproject.toml"
        [[ -f "$PROJECT_ROOT/requirements.txt" ]] && pyfile="$PROJECT_ROOT/requirements.txt"
        grep -qi 'django' "$pyfile" 2>/dev/null && stack_parts+=("Django")
        grep -qi 'fastapi' "$pyfile" 2>/dev/null && stack_parts+=("FastAPI")
        grep -qi 'flask' "$pyfile" 2>/dev/null && stack_parts+=("Flask")
    fi

    # Go
    if [[ -f "$PROJECT_ROOT/go.mod" ]]; then
        stack_parts+=("Go")
        grep -q 'gin-gonic' "$PROJECT_ROOT/go.mod" && stack_parts+=("Gin")
        grep -q 'echo' "$PROJECT_ROOT/go.mod" && stack_parts+=("Echo")
    fi

    # TypeScript detection
    if [[ -f "$PROJECT_ROOT/tsconfig.json" ]]; then
        # Add TypeScript only if not already implied by React/Vue/Angular
        local has_framework=false
        for p in "${stack_parts[@]}"; do
            [[ "$p" =~ ^(React|Vue|Angular|Next|Nuxt|Svelte) ]] && has_framework=true
        done
        $has_framework || stack_parts+=("TypeScript")
    fi

    # Join with " + "
    local IFS=" + "
    echo "${stack_parts[*]:-Unknown}"
}

# ─── DOMAIN DETECTION ───────────────────────────────────────────────────────────

detect_domain() {
    local desc=""
    local deps=""

    # Get description
    if [[ -f "$PROJECT_ROOT/package.json" ]] && has_cmd jq; then
        desc=$(jq -r '.description // ""' "$PROJECT_ROOT/package.json" 2>/dev/null)
        deps=$(jq -r '(.dependencies // {}) | keys[]' "$PROJECT_ROOT/package.json" 2>/dev/null)
    fi

    # Also check CLAUDE.md for domain clues
    if [[ -f "$PROJECT_ROOT/CLAUDE.md" ]]; then
        desc="$desc $(head -20 "$PROJECT_ROOT/CLAUDE.md")"
    fi

    # EDA signals
    if echo "$deps" | grep -q '@xyflow/react' || echo "$desc" | grep -qi 'circuit\|PCB\|schematic\|EDA\|electronics\|netlist'; then
        echo "EDA"; return
    fi

    # Mobile signals
    if echo "$deps" | grep -q 'react-native\|expo' || [[ -f "$PROJECT_ROOT/app.json" && -d "$PROJECT_ROOT/ios" ]]; then
        echo "Mobile"; return
    fi

    # Desktop signals
    if echo "$deps" | grep -q 'electron\|tauri' || [[ -f "$PROJECT_ROOT/tauri.conf.json" ]]; then
        echo "Desktop"; return
    fi

    # CLI signals
    if echo "$deps" | grep -q 'commander\|yargs\|meow\|cac'; then
        echo "CLI"; return
    fi
    if [[ -f "$PROJECT_ROOT/Cargo.toml" ]] && grep -q 'clap' "$PROJECT_ROOT/Cargo.toml" 2>/dev/null; then
        echo "CLI"; return
    fi

    # Data Science signals
    if [[ -f "$PROJECT_ROOT/requirements.txt" ]] && grep -qi 'pandas\|sklearn\|tensorflow\|torch' "$PROJECT_ROOT/requirements.txt" 2>/dev/null; then
        echo "DataScience"; return
    fi

    # Game signals
    if echo "$deps" | grep -q 'three\|pixi\|phaser\|babylon'; then
        echo "Game"; return
    fi

    # DevOps signals
    if [[ -f "$PROJECT_ROOT/main.tf" || -f "$PROJECT_ROOT/ansible.cfg" || -f "$PROJECT_ROOT/pulumi.yaml" ]]; then
        echo "DevOps"; return
    fi

    # Library signals (package with exports but no frontend or bin)
    if [[ -f "$PROJECT_ROOT/package.json" ]] && has_cmd jq; then
        local has_exports has_bin has_frontend
        has_exports=$(jq -r '.exports // .main // empty' "$PROJECT_ROOT/package.json" 2>/dev/null)
        has_bin=$(jq -r '.bin // empty' "$PROJECT_ROOT/package.json" 2>/dev/null)
        has_frontend=$(echo "$deps" | grep -c 'react\|vue\|angular\|svelte' || true)
        if [[ -n "$has_exports" && -z "$has_bin" && "$has_frontend" -eq 0 ]]; then
            echo "Library"; return
        fi
    fi

    # API signals (has backend framework but no frontend)
    if echo "$deps" | grep -q 'express\|fastify\|koa\|hono'; then
        local has_frontend
        has_frontend=$(echo "$deps" | grep -c 'react\|vue\|angular\|svelte' || true)
        if [[ "$has_frontend" -eq 0 ]]; then
            echo "API"; return
        fi
    fi

    # Web App (default for projects with frontend frameworks)
    if echo "$deps" | grep -q 'react\|vue\|angular\|svelte\|next\|nuxt'; then
        echo "WebApp"; return
    fi

    echo "Unknown"
}

# ─── COMPETITOR MAPPING ─────────────────────────────────────────────────────────

get_competitors() {
    local domain="$1"
    case "$domain" in
        EDA)        echo '["KiCad","Altium Designer","EasyEDA","Fritzing","Eagle","OrCAD","Flux.ai"]' ;;
        WebApp)     echo '["Figma","Linear","Notion","Vercel Dashboard"]' ;;
        CLI)        echo '["gh CLI","ripgrep","fzf","jq"]' ;;
        API)        echo '["Stripe API","Twilio","FastAPI docs"]' ;;
        Mobile)     echo '["Apple HIG","Material Design 3"]' ;;
        Library)    echo '["comparable libraries in ecosystem"]' ;;
        Desktop)    echo '["VS Code","Figma Desktop","Obsidian"]' ;;
        DataScience) echo '["Jupyter","Kaggle","Google Colab"]' ;;
        DevOps)     echo '["Terraform Cloud","Pulumi","Ansible Tower"]' ;;
        Game)       echo '["Unity","Godot","Phaser"]' ;;
        *)          echo '["research competitors for this domain"]' ;;
    esac
}

# ─── PERSONA MAPPING ────────────────────────────────────────────────────────────

get_personas() {
    local domain="$1"
    case "$domain" in
        EDA)        echo '["Hobbyist maker","Professional electrical engineer","Hardware startup founder"]' ;;
        WebApp)     echo '["End user (non-technical)","Power user","Administrator"]' ;;
        CLI)        echo '["Casual user","Daily power user","CI/CD pipeline (automated)"]' ;;
        API)        echo '["Frontend developer (consumer)","DevOps engineer","API product manager"]' ;;
        Mobile)     echo '["Casual mobile user","Daily active user","Accessibility-dependent user"]' ;;
        Library)    echo '["Junior developer (first time)","Senior developer (evaluating)","Maintainer/contributor"]' ;;
        Desktop)    echo '["Beginner user","Professional daily user","Plugin/extension developer"]' ;;
        DataScience) echo '["Data scientist","ML engineer","Business analyst"]' ;;
        DevOps)     echo '["Platform engineer","Developer (consumer)","Security/compliance officer"]' ;;
        Game)       echo '["Casual player","Hardcore gamer","Game developer"]' ;;
        *)          echo '["Primary user","Power user","Administrator"]' ;;
    esac
}

# ─── KEY FILES ──────────────────────────────────────────────────────────────────

detect_key_files() {
    local files=()

    # Check CLAUDE.md for key files table
    if [[ -f "$PROJECT_ROOT/CLAUDE.md" ]]; then
        # Extract file paths mentioned in CLAUDE.md (common patterns)
        local claude_files
        claude_files=$(grep -oP '`[a-zA-Z][a-zA-Z0-9_/.-]+\.[a-z]{1,4}`' "$PROJECT_ROOT/CLAUDE.md" 2>/dev/null | tr -d '`' | head -10)
        while IFS= read -r f; do
            [[ -n "$f" && -f "$PROJECT_ROOT/$f" ]] && files+=("$f")
        done <<< "$claude_files"
    fi

    # If CLAUDE.md didn't give us enough, detect common entry points
    if [[ ${#files[@]} -lt 3 ]]; then
        for f in \
            "src/index.ts" "src/main.ts" "src/app.ts" "src/index.tsx" "src/main.tsx" "src/App.tsx" \
            "server/index.ts" "server/routes.ts" "server/app.ts" \
            "client/src/main.tsx" "client/src/App.tsx" \
            "shared/schema.ts" "shared/types.ts" \
            "lib.rs" "src/lib.rs" "src/main.rs" \
            "main.go" "cmd/main.go" \
            "app/main.py" "src/main.py" \
            "package.json" "tsconfig.json" "Cargo.toml" "pyproject.toml" "go.mod"; do
            [[ -f "$PROJECT_ROOT/$f" ]] && files+=("$f")
        done
    fi

    # Deduplicate and limit
    printf '%s\n' "${files[@]}" | sort -u | head -10 | jq -R . | jq -s .
}

# ─── BASELINE METRICS ──────────────────────────────────────────────────────────

detect_baseline() {
    local loc=0 file_count=0 languages=""

    if has_cmd scc; then
        local scc_out
        scc_out=$(scc "$PROJECT_ROOT" --no-cocomo --format json 2>/dev/null || echo "[]")
        loc=$(echo "$scc_out" | jq '[.[].Code] | add // 0' 2>/dev/null || echo 0)
        file_count=$(echo "$scc_out" | jq '[.[].Count] | add // 0' 2>/dev/null || echo 0)
        languages=$(echo "$scc_out" | jq -r '[.[] | select(.Code > 100) | .Name] | join(", ")' 2>/dev/null || echo "")
    elif has_cmd tokei; then
        loc=$(tokei "$PROJECT_ROOT" --output json 2>/dev/null | jq '.Total.code // 0' 2>/dev/null || echo 0)
    fi

    jq -n \
        --argjson loc "$loc" \
        --argjson files "$file_count" \
        --arg languages "$languages" \
        '{loc: $loc, files: $files, languages: $languages}'
}

# ─── MAIN OUTPUT ────────────────────────────────────────────────────────────────

NAME=$(detect_name)
STACK=$(detect_stack)
DOMAIN=$(detect_domain)
KEY_FILES=$(detect_key_files)
COMPETITORS=$(get_competitors "$DOMAIN")
PERSONAS=$(get_personas "$DOMAIN")
BASELINE=$(detect_baseline)
DATE=$(date +%Y-%m-%d)

jq -n \
    --arg name "$NAME" \
    --arg stack "$STACK" \
    --arg domain "$DOMAIN" \
    --arg root "$PROJECT_ROOT" \
    --argjson key_files "$KEY_FILES" \
    --argjson competitors "$COMPETITORS" \
    --argjson personas "$PERSONAS" \
    --arg date "$DATE" \
    --argjson baseline "$BASELINE" \
    '{
        project_name: $name,
        tech_stack: $stack,
        domain: $domain,
        project_root: $root,
        key_files: $key_files,
        competitors: $competitors,
        personas: $personas,
        date: $date,
        baseline: $baseline
    }'
