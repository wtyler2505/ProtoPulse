---
description: Analyze directory structure and create documentation - architecture, patterns, dependencies, CLAUDE.md
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, mcp__desktop-commander__*, mcp__memory__*, mcp__clear-thought__*
argument-hint: "<directory-path>"
---
# Directory Deep Dive
**Target**: $ARGUMENTS

## Methodology
Based on Thomas Landgraf's hierarchical CLAUDE.md approach: "subdirectory memory files are only loaded when Claude actually accesses files in those directories" - enabling context-efficient, location-specific documentation.

## Instructions
1. **Load Knowledge**:
   - Read: `~/.claude/skills/claude-md-mastery/SKILL.md` (if exists)
   - Reference research: https://thomaslandgraf.substack.com/p/claude-codes-memory-working-with
2. **Target Resolution**:
   | Input | Action |
   |-------|--------|
   | `<path>` | Analyze specific directory |
   | `.` | Current working directory |
   | (empty) | Ask for target |
3. **Phase 1: Structure Discovery**
   ```bash
   # Directory tree (excluding noise)
   tree -I 'node_modules|dist|.git|__pycache__|*.pyc' "$TARGET" -L 3
   # File count and types
   fd -t f . "$TARGET" | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -10
   # Code statistics
   scc "$TARGET" --no-cocomo 2>/dev/null || tokei "$TARGET" 2>/dev/null
   ```
4. **Phase 2: Architecture Analysis**
   Use structured thinking:
   ```
   mcp__clear-thought__clear_thought (operation: sequential_thinking):
   - What is this directory's responsibility?
   - What patterns/layers does it implement?
   - What are the key abstractions?
   - What are the dependencies (internal and external)?
   ```
   **Analyze for:**
   | Aspect | Look For |
   |--------|----------|
   | Purpose | Main entry points, exports, public API |
   | Patterns | MVC, Repository, Factory, Singleton, etc. |
   | Layers | UI, Domain, Data, Infrastructure |
   | Dependencies | Imports from other directories, external packages |
   | Boundaries | What this module should NOT know about |
5. **Phase 3: Code Intelligence**
   ```bash
   # Find entry points
   ast-grep --pattern 'export default $$$' "$TARGET" --lang tsx 2>/dev/null
   ast-grep --pattern 'module.exports = $$$' "$TARGET" --lang js 2>/dev/null
   # Find key abstractions (interfaces, types, classes)
   ast-grep --pattern 'interface $NAME { $$$ }' "$TARGET" --lang tsx 2>/dev/null
   ast-grep --pattern 'class $NAME $$${ $$$ }' "$TARGET" --lang tsx 2>/dev/null
   # Detect patterns
   ast-grep --pattern 'createContext($$$)' "$TARGET" --lang tsx  # React Context
   ast-grep --pattern 'useReducer($$$)' "$TARGET" --lang tsx     # State machines
   ```
6. **Phase 4: Dependency Mapping**
   ```bash
   # Internal imports (what this directory depends on)
   grep -rh "from '\.\." "$TARGET" 2>/dev/null | sort | uniq -c | sort -rn | head -10
   # External imports
   grep -rh "from '" "$TARGET" 2>/dev/null | grep -v "from '\." | sort | uniq -c | sort -rn | head -10
   ```
7. **Phase 5: Generate CLAUDE.md**
   Create a comprehensive CLAUDE.md file inside the target directory:
   ```markdown
   # [Directory Name]
   ## Purpose
   [Detailed explanation of what this directory does and why it exists]

   ## Architecture & Abstractions
   - [Abstraction 1]: [Role and implementation details]
   - [Abstraction 2]: [Role and implementation details]

   ## Key Files
   - [File 1]: [Purpose]
   - [File 2]: [Purpose]

   ## Dependencies
   - **Depends on**: [Internal/external dependencies]
   - **Depended on by**: [Abstractions/components relying on this directory]

   ## Coding Conventions & Gotchas
   - [Convention 1]: [Details]
   - [Gotcha 1]: [Details]
   ```
8. **Phase 6: Update Directory Map**
   Add this directory to the global project map or catalog.

## Output Format
Print the analysis results as structured sections with clear headings and bullet points.
