---
description: "Tree views that render all nodes in DOM can rely on browsers to compute aria-level, aria-posinset, and aria-setsize from structure — but the moment virtualization or lazy-loading enters, authors MUST specify all three explicitly on every rendered node or screen readers announce meaningless position data, because browser computation only works for complete DOM trees."
type: claim
audience: [intermediate, expert]
confidence: verified
created: 2026-04-19
topics:
  - "[[a11y]]"
  - "[[wcag]]"
  - "[[architecture-decisions]]"
  - "[[maker-ux]]"
provenance:
  - source: "W3C WAI-ARIA Authoring Practices Guide — Tree View Pattern"
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/treeview/"
  - source: "W3C APG — Navigation Treeview Example"
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/treeview/examples/treeview-navigation/"
  - source: "MDN — ARIA states and properties"
    url: "https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes"
---

# ARIA tree view requires aria-level aria-posinset and aria-setsize when nodes are virtualized

The APG tree view pattern splits cleanly into two implementation styles based on how nodes are rendered. For "all nodes always in DOM" trees, the browser's accessibility-tree computation derives `aria-level`, `aria-posinset`, and `aria-setsize` automatically from the structural nesting and sibling relationships — authors need only set `role="tree"` on the container, `role="treeitem"` on each node, and `aria-expanded` on parent nodes (never on leaf nodes, which would misleadingly mark them as having children). The tree container needs `role="tree"`; its immediate `role="treeitem"` children form level 1, their nested children form level 2, and so on.

The contract flips for **virtualized trees**, where only a windowed subset of nodes is rendered at any time. The APG is explicit: "If the complete set of available nodes is not present in the DOM due to dynamic loading as the user moves focus in or scrolls the tree, each node has aria-level, aria-setsize, and aria-posinset specified." Browser computation cannot infer position information from a partial DOM tree — there is no way for the browser to know that the currently-rendered node is "item 47 of 200 at level 3" if items 1-46 and 48-200 do not exist in the DOM. Without explicit attributes, screen readers announce either nothing ("treeitem") or misleading position ("item 1 of 3" when the rendered slice happens to contain 3 items at this level). The APG further warns that "some browser and assistive technology combinations may not compute or report correct position and level information if it is not explicitly declared" — suggesting that even for fully-rendered trees, explicit attributes are the defensive choice.

`aria-expanded` carries the load-bearing "parent vs leaf" distinction. Parents always have `aria-expanded` (true or false); leaves never do. Setting `aria-expanded="false"` on a leaf misleads screen readers into announcing it as "collapsed, has children" and offering an expand action that fails silently. This is the single most common tree-view bug and the easiest to regress during refactors — copy-pasting a treeitem template that includes `aria-expanded` across all nodes breaks leaves.

Keyboard interaction is richer than most widgets: Up/Down arrow moves focus between visible nodes (skipping collapsed subtrees); Right arrow on a collapsed parent expands it, Right arrow on an expanded parent moves focus to the first child, Right arrow on a leaf does nothing; Left arrow on an expanded parent collapses it, Left arrow on a collapsed parent or leaf moves focus to the parent; Home jumps to the first node, End jumps to the last visible node; typing a printable character moves focus to the next node whose label begins with that character (type-ahead). This is the `roving-tabindex` pattern — only the currently focused treeitem has `tabindex="0"`, all others have `tabindex="-1"`.

For ProtoPulse, the project sidebar (files/folders hierarchy) and the component-library browser (category → subcategory → part nesting) are both candidate tree-view surfaces. Both are likely to exceed 100+ nodes at full expansion, which makes virtualization a near-certain future requirement. This means the first implementation should either (a) use full-DOM rendering and rely on browser computation, accepting the scale limit, or (b) commit upfront to explicit `aria-level`/`aria-posinset`/`aria-setsize` attributes and never omit them. Retrofitting the explicit-attribute path onto a virtualized tree built under the "browser will compute" assumption is painful because every rendering code path must be updated simultaneously — a single missed code path produces "node announces as position 1 of 1" errors that pass visual review.

One anti-pattern specific to EDA tools: a schematic net-list or BOM parts-list is a **listbox**, not a tree, if there is no hierarchy. The treeview role signals "has parent-child nesting" to screen readers, and users who hear "tree" expect arrow-key expansion. Applying `role="tree"` to a flat list wastes that expectation and forces users through the more complex keyboard contract for no benefit. The question "tree or list?" reduces to: does any node have `aria-expanded`? If no, it is a list, not a tree.

---

Source: [[2026-04-19-wcag-aria-patterns-expansion-moc]]

Relevant Notes:
- [[aria-listbox-must-choose-aria-selected-or-aria-checked-never-both-and-selection-follows-focus-is-optional]] — flat-list alternative when no hierarchy exists
- [[aria-rowindex-and-aria-colindex-let-sparse-grids-announce-position-without-rendering-all-cells]] — grid equivalent of the tree's virtualization contract
- [[roving-tabindex-is-more-reliable-than-aria-activedescendant-for-grid-focus-management]] — tree uses roving-tabindex, same as grid

Topics:
- [[a11y]]
- [[wcag]]
- [[architecture-decisions]]
- [[maker-ux]]
