---
description: "APG draws a sharp line between menus (application-only, arrow-key mandated, Tab exits entirely) and navigation (use role=navigation with list of links, Tab cycles through links) — and putting role=menu on a site nav forces desktop-app keyboard semantics onto content that users expect to Tab through, breaking both keyboard users and screen-reader navigation modes."
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
  - source: "W3C WAI-ARIA Authoring Practices Guide — Menu and Menubar Pattern"
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/menubar/"
  - source: "W3C WAI-ARIA Authoring Practices Guide — Menu Button Pattern"
    url: "https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/"
  - source: "MDN — ARIA: menu role"
    url: "https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/menu_role"
  - source: "Radix UI Primitives — DropdownMenu"
    url: "https://www.radix-ui.com/primitives/docs/components/dropdown-menu"
---

# ARIA menu role is for application menus not navigation and importing it breaks web conventions

The APG is unambiguous on when `role="menu"` and `role="menubar"` are appropriate: they model **desktop application menus** — File, Edit, View, Tools — where each item invokes a command or toggles state. They are **not** appropriate for site navigation, which should use `<nav>` (implicit `role="navigation"`) wrapping a list of links. The difference is not decorative; it imposes opposite keyboard contracts. In a menu, arrow keys mandatorily navigate between items, Tab **exits** the menu entirely (it does not cycle through menu items), and type-ahead (single printable character jumps to item whose label begins with that character) is required. In navigation, Tab cycles through each link, arrow keys do nothing special, and type-ahead is not implemented.

Putting `role="menu"` on a site-nav `<ul>` of links — which is a widespread bug in component libraries and design systems — imposes the application-menu keyboard contract on content users expect to Tab-traverse. Screen readers in "application mode" (NVDA browse-mode suppression, VoiceOver interaction mode) then suppress browse-mode shortcuts the user relied on, exactly the failure covered by [[role-application-suppresses-screen-reader-browse-mode-and-should-be-avoided-for-mixed-content]]. The APG provides a dedicated **Disclosure Navigation Menu** example for the dropdown-style site-nav case, which uses plain `<button>` + `<ul>` + `aria-expanded` + links — no `role="menu"` anywhere — and this is the correct pattern for almost every "hamburger menu" and "products dropdown" that teams reach for DropdownMenu to build.

The internal wiring of a true application menu: the container has `role="menu"` or `role="menubar"`; children have `role="menuitem"`, `role="menuitemcheckbox"` (with `aria-checked`), or `role="menuitemradio"` (with `aria-checked` and grouped in a `role="group"`). The menu container has `tabindex="0"` or `-1`, and each item has `tabindex="-1"` — classic roving-tabindex pattern. Up/Down arrow navigates in vertical menus; Left/Right in horizontal menubars; Left/Right at the menubar level opens sibling submenus while Up/Down inside an open submenu navigates its items. Home/End jump to first/last. Enter and Space activate an item. Escape closes the submenu (bubbling to parent menubar). Any printable character moves focus to the next item whose label begins with that character — and this type-ahead behavior is NOT optional for screen reader users, it is required for parity with native desktop menus.

Radix's `DropdownMenu` primitive is a correct implementation of the application-menu pattern — which paradoxically means it is often the WRONG primitive for site navigation. The naming seduces developers: "I need a dropdown nav, DropdownMenu is a dropdown, done." But the component imposes arrow-key-only navigation, Tab-exits-menu, and type-ahead — contracts that confuse users who expect link-list tabbing. The correct ProtoPulse decision for nav surfaces is either (a) use a disclosure pattern via `Collapsible` + a plain `<ul>` of links, or (b) use a menubar-nav only when the UI genuinely models application commands (File → New Project, Edit → Undo, View → Toggle Grid). The BreadboardLab toolbar is a legitimate menubar surface because its items are commands; the top-bar "Projects" / "Docs" / "Pricing" links are a nav surface and should not use DropdownMenu.

A secondary rule from the APG worth internalizing: menus should not contain non-menu content. The spec says menuitem children can be rich (icons, keyboard-shortcut badges, check indicators) but the item itself must be a single actionable entity — not a nested form, not a search input, not a multi-line description block. If the popup needs to contain a search input (the most common failure, seen in "searchable dropdown" patterns), it is a combobox, not a menu, and [[aria-combobox-requires-input-plus-popup-because-the-role-alone-does-not-describe-the-widget]] applies instead. The question "menu or combobox?" reduces to: does the popup contain an editable text input? If yes, combobox. If no, menu (or disclosure, if even simpler).

---

Source: [[2026-04-19-wcag-aria-patterns-expansion-moc]]

Relevant Notes:
- [[role-application-suppresses-screen-reader-browse-mode-and-should-be-avoided-for-mixed-content]] — same over-semanticization failure mode
- [[aria-combobox-requires-input-plus-popup-because-the-role-alone-does-not-describe-the-widget]] — if popup has a text input it is combobox not menu
- [[aria-disclosure-is-button-plus-aria-expanded-and-anything-more-complex-is-a-different-pattern]] — disclosure is correct primitive for site-nav dropdowns

Topics:
- [[a11y]]
- [[wcag]]
- [[architecture-decisions]]
- [[maker-ux]]
