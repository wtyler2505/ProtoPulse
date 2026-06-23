# CLI Tools Reference

Complete guide to all 17 CLI tools available for deep focus sessions.

---

## Code Analysis Tools

### scc (Succinct Code Counter)
**Purpose:** Fast, accurate code statistics with complexity metrics.

```bash
# Basic usage - stats for directory
scc components/Dashboard/

# By file breakdown
scc components/Dashboard/ --by-file

# Format as JSON for processing
scc components/Dashboard/ -f json

# Exclude test files
scc components/Dashboard/ --exclude-dir tests

# Compare complexity
scc components/Dashboard/ --sort complexity
```

**Output includes:** Lines, code, comments, blanks, complexity, language breakdown.

### tokei
**Purpose:** Code statistics with language detection.

```bash
# Basic usage
tokei components/Dashboard/

# Compact output
tokei components/Dashboard/ -C

# Exclude patterns
tokei components/Dashboard/ -e "*.test.tsx"

# JSON output
tokei components/Dashboard/ -o json
```

### lizard
**Purpose:** Cyclomatic complexity analysis for finding complex functions.

```bash
# Analyze TypeScript/JavaScript
lizard components/Dashboard/ -l typescript

# Show warnings for complex code
lizard components/Dashboard/ -w

# Set thresholds (flag functions exceeding)
lizard components/Dashboard/ -T nloc=50 -T cyclomatic_complexity=10

# CSV output for reporting
lizard components/Dashboard/ --csv

# Find the most complex functions
lizard components/Dashboard/ -s cyclomatic_complexity

# Exclude test files
lizard components/Dashboard/ -x "*.test.*"
```

**Key metrics:**
- **NLOC:** Lines of code (excluding comments/blanks)
- **CCN:** Cyclomatic complexity (branches + 1)
- **Token count:** Lexical complexity
- **Parameter count:** Function arguments

**Thresholds:**
- CCN > 10: Consider refactoring
- CCN > 15: Definitely refactor
- CCN > 20: High risk, hard to test

---

## Search Tools

### rg (ripgrep)
**Purpose:** Ultra-fast regex search.

```bash
# Basic search
rg "useState" components/Dashboard/

# Case insensitive
rg -i "error" components/

# Show context lines
rg -C 3 "handleClick" components/

# Only TypeScript files
rg -t ts "interface" components/

# Exclude directories
rg "TODO" --glob '!node_modules' --glob '!dist'

# Count matches
rg -c "import" components/

# List files with matches only
rg -l "useEffect" components/

# Invert match (lines NOT matching)
rg -v "^//" components/
```

### fd (find alternative)
**Purpose:** Fast, user-friendly file finding.

```bash
# Find by name pattern
fd "Button" components/

# Find by extension
fd -e tsx components/

# Find directories only
fd -t d "hooks"

# Execute command on each
fd -e tsx -x wc -l {}

# Exclude patterns
fd -E node_modules -E dist "test"

# Hidden files included
fd -H ".env"

# Absolute paths
fd -a "config" .
```

### fzf (Fuzzy Finder)
**Purpose:** Interactive fuzzy search (use in piped context, not interactive).

```bash
# Pipe file list through fzf
fd -e tsx | fzf --filter="Button"

# Preview files
fd -e tsx | fzf --preview="bat --color=always {}"

# Select multiple
fd -e tsx | fzf -m --filter="Modal"
```

### ast-grep
**Purpose:** Structural code search using AST patterns.

```bash
# Find React functional components
ast-grep --pattern 'const $NAME = ($PROPS) => { $$$ }' components/

# Find useState hooks
ast-grep --pattern 'const [$STATE, $SET] = useState($INIT)' --lang tsx components/

# Find useEffect with dependencies
ast-grep --pattern 'useEffect(() => { $$$ }, [$$$])' components/

# Find context consumers
ast-grep --pattern 'useContext($CTX)' components/

# Find async functions
ast-grep --pattern 'async function $NAME($$$) { $$$ }' services/

# Find try-catch blocks
ast-grep --pattern 'try { $$$ } catch ($E) { $$$ }' services/

# Find imports from specific module
ast-grep --pattern 'import { $$$ } from "react"' components/

# Find JSX with specific prop
ast-grep --pattern '<Button onClick={$$$}>$$$</Button>' components/

# Interactive mode with replacements
ast-grep scan --interactive
```

---

## Dependency Analysis

### depcheck
**Purpose:** Find unused dependencies in package.json.

```bash
# Basic check
depcheck

# Ignore specific patterns
depcheck --ignore-patterns=dist

# Skip specific deps
depcheck --ignores="@types/*"

# JSON output
depcheck --json

# Check specific directory
depcheck /path/to/project
```

### madge
**Purpose:** Dependency graph visualization and circular dependency detection.

```bash
# Generate dependency graph image
madge --image deps.svg components/Dashboard/

# Find circular dependencies (IMPORTANT!)
madge --circular components/

# List all dependencies of a file
madge components/Dashboard/index.tsx

# Orphan files (not imported anywhere)
madge --orphans components/

# JSON output
madge --json components/Dashboard/

# Only specific extensions
madge --extensions tsx,ts components/

# Exclude patterns
madge --exclude "test|spec" components/
```

---

## Code Quality

### prettier
**Purpose:** Code formatting.

```bash
# Check formatting (don't modify)
prettier --check "components/**/*.{ts,tsx}"

# Format files
prettier --write "components/**/*.{ts,tsx}"

# Check single file
prettier --check components/Dashboard.tsx

# Use specific config
prettier --config .prettierrc --check "src/**"

# List files that need formatting
prettier --list-different "components/**/*.tsx"
```

### eslint
**Purpose:** Code linting and style enforcement.

```bash
# Lint specific files
npm run lint -- components/Dashboard/

# Auto-fix issues
npm run lint -- --fix components/Dashboard/

# Show only errors (no warnings)
npm run lint -- --quiet

# Output as JSON
npm run lint -- -f json components/Dashboard/

# Specific rules only
npm run lint -- --rule 'no-console: error'
```

---

## Git Tools

### git
**Purpose:** Version control and history analysis.

```bash
# Recent commits for area
git log --oneline -20 -- components/Dashboard/

# Who contributed most
git shortlog -sn -- components/Dashboard/

# File change frequency (hotspots)
git log --format=format: --name-only -- components/Dashboard/ | sort | uniq -c | sort -rn | head -20

# Blame for specific file
git blame components/Dashboard/index.tsx

# Diff from N commits ago
git diff HEAD~5 -- components/Dashboard/

# Show when file was last changed
git log -1 --format="%ar" -- components/Dashboard/index.tsx

# Find commits mentioning keyword
git log --grep="dashboard" --oneline

# Files changed in last N commits
git diff --name-only HEAD~10
```

### gh (GitHub CLI)
**Purpose:** GitHub integration.

```bash
# List open PRs
gh pr list

# View PR details
gh pr view 123

# List issues
gh issue list

# Create issue
gh issue create --title "Bug in Dashboard" --body "Description"

# PR checks status
gh pr checks

# View repo
gh repo view
```

### delta
**Purpose:** Beautiful diff viewer.

```bash
# Use with git diff
git diff | delta

# Side-by-side view
git diff | delta --side-by-side

# With line numbers
git diff | delta -n

# Compare files directly
delta file1.tsx file2.tsx
```

---

## Documentation Tools

### tree
**Purpose:** Directory structure visualization.

```bash
# Basic tree
tree components/Dashboard/

# Limit depth
tree -L 2 components/

# Exclude patterns
tree -I 'node_modules|dist|.git' components/

# Show file sizes
tree -h components/Dashboard/

# Directories only
tree -d components/

# Include hidden files
tree -a components/Dashboard/

# Output to file
tree components/ > structure.txt
```

### jq
**Purpose:** JSON processing.

```bash
# Pretty print JSON
cat package.json | jq .

# Extract specific field
cat package.json | jq '.dependencies'

# Filter array
cat tsconfig.json | jq '.compilerOptions.lib[]'

# Get keys
cat package.json | jq 'keys'

# Count array items
cat package.json | jq '.dependencies | length'
```

### yq
**Purpose:** YAML processing (like jq for YAML).

```bash
# Read YAML
yq '.name' config.yaml

# Convert YAML to JSON
yq -o json config.yaml

# Edit in place
yq -i '.version = "2.0.0"' config.yaml

# Merge files
yq '. *= load("override.yaml")' base.yaml
```

### bat
**Purpose:** Cat with syntax highlighting.

```bash
# View file with highlighting
bat components/Dashboard/index.tsx

# Show line numbers
bat -n components/Dashboard/index.tsx

# Show non-printable characters
bat -A components/Dashboard/index.tsx

# Multiple files
bat components/Dashboard/*.tsx

# Specific language
bat --language tsx file.txt

# Plain output (no decorations)
bat -pp components/Dashboard/index.tsx
```

---

## Quick Command Combos

### Find complex components
```bash
lizard components/ -l typescript -T cyclomatic_complexity=10 -s cyclomatic_complexity | head -20
```

### Find unused exports
```bash
ast-grep --pattern 'export const $NAME' components/ > /tmp/exports.txt
# Then check if each is imported elsewhere
```

### Full health check
```bash
echo "=== TYPES ===" && npx tsc --noEmit 2>&1 | tail -5
echo "=== LINT ===" && npm run lint 2>&1 | tail -10
echo "=== UNUSED DEPS ===" && depcheck 2>&1 | head -20
echo "=== CIRCULAR ===" && madge --circular components/
```

### Git hotspots + complexity
```bash
git log --format=format: --name-only -- components/ | sort | uniq -c | sort -rn | head -10 | while read count file; do
  echo "=== $file (changed $count times) ==="
  lizard "$file" -l typescript 2>/dev/null | tail -3
done
```
