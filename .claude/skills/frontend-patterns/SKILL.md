---
name: frontend-patterns
description: UI patterns for OmniTrek - Tailwind, cyberpunk theme, component library. Use when editing components/ui/, components/common/, or styling.
version: 1.1.0
auto-trigger-paths:
  - components/ui/**
  - components/common/**
  - "*.css"
  - tailwind*
---

# Frontend Patterns

Cyberpunk green terminal aesthetic with Tailwind CSS.

## Quick Reference

| Aspect | Detail |
|--------|--------|
| UI Components | `components/ui/` |
| Common Components | `components/common/` |
| Theme | Cyberpunk green terminal |
| CSS | Tailwind (CDN) - NO custom CSS files |

## Core Colors

```typescript
primary: '#00ff00'      // Bright green
background: '#0a0a0a'   // Near black
surface: '#1a1a1a'      // Dark gray
text: '#e0e0e0'         // Light gray
error: '#ff4444'        // Red
warning: '#ffaa00'      // Orange
```

## Essential Tailwind Classes

```tsx
// Backgrounds
"bg-black/50 backdrop-blur-sm"
"bg-green-500/20"

// Borders
"border border-green-500/30"
"ring-1 ring-green-500/50"

// Text
"text-green-400 font-mono"
"text-gray-400"

// Glow
"shadow-[0_0_10px_rgba(0,255,0,0.3)]"

// Hover
"hover:bg-green-500/10 hover:text-green-400"
```

## Component Patterns

```tsx
// Card
<div className="bg-black/50 border border-green-500/20 rounded-lg p-4">

// Button (primary)
<button className="px-4 py-2 bg-green-500/20 border border-green-500/50 
  text-green-400 hover:bg-green-500/30 font-mono">

// Input
<input className="bg-black/50 border border-green-500/30 rounded px-3 py-2 
  text-green-400 focus:border-green-400 focus:ring-1 font-mono" />

// Status badge
<span className="px-2 py-0.5 rounded text-xs border bg-green-500/20 
  text-green-400 border-green-500/50">
```

## When to Use

- Creating UI components
- Styling new views
- Building TUI (terminal UI) components
- Maintaining visual consistency

## When NOT to Use

| Situation | Use Instead |
|-----------|-------------|
| State management | `context-state` |
| Navigation | `sidebar-patterns` |
| Type definitions | `type-system` |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Styles not applying | Check class names, use `font-mono` |
| Colors look wrong | Use opacity `/30` not color variants |
| Glow not visible | Increase shadow spread |
| Layout broken | Check `flex`, `grid`, `gap` classes |

## Gotchas

1. **Use Tailwind, not CSS files** - No custom CSS unless absolutely necessary
2. **Font: monospace everywhere** - `font-mono` on all text
3. **Opacity for colors** - Use `green-500/30` not `green-300`
4. **Angular aesthetic** - Avoid `rounded-full` on most elements
5. **Always include focus states** - Accessibility requirement

## Reference Files

| File | Content |
|------|---------|
| `references/01-theme-system.md` | Color palette, Tailwind patterns, components |
| `references/02-tui-components.md` | ASCII sparkline, progress bar, panels |

## Related Skills

- `sidebar-patterns` - Navigation styling
- `type-system` - Component prop types
- `ui-components-view` - Component showcase
