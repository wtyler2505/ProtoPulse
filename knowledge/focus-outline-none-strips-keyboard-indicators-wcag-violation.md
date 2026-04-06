---
description: "Multiple core components apply focus:outline-none without focus-visible alternatives — renders the app unusable for keyboard-only navigation"
type: debt-note
source: "conductor/comprehensive-audit.md §25"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["client/src/components/views/OutputView.tsx", "client/src/components/views/procurement/BomToolbar.tsx", "client/src/components/views/procurement/BomTable.tsx"]
---

# focus:outline-none across core components strips keyboard focus indicators violating WCAG AA

Across `OutputView.tsx`, `BomToolbar.tsx`, `BomTable.tsx`, and `CustomRulesDialog.tsx`, input fields and textareas apply the Tailwind class `focus:outline-none` without providing a high-contrast `focus-visible` alternative ring. This completely strips the browser's default focus indicator — a severe WCAG Level AA violation rendering the app unusable for keyboard-only navigation and users with motor disabilities.

Additionally, inline edit fields in `BomTable.tsx` for `partNumber`, `manufacturer`, and `description` are raw `<input>` tags missing `<label>` associations or `aria-label` attributes. The ESLint config entirely omits `eslint-plugin-jsx-a11y`, meaning accessibility issues are never caught in CI.

The viewport `<meta>` tag also sets `maximum-scale=1`, disabling pinch-to-zoom — another critical WCAG violation for users with visual impairments.

---

Relevant Notes:
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] -- accessibility is part of the maker-friendly mission

Topics:
- [[architecture-decisions]]
