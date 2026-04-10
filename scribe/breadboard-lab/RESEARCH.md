# Research Dossier: Breadboard Lab

## Executive Summary
*   Breadboard Lab combines a physical breadboard view, AI coaching, and free 
    pricing to form a uniquely compelling tool for makers and beginners.
*   It bridges the perception gap for learners by prioritizing visual rendering 
    and physical constraints (e.g., tight pin fits) over raw numeric computation.
*   The "Bench Coach" AI proactively flags layout mistakes, suggests wiring 
    hookups, and warns against dangerous pins before hardware is damaged.
*   Recent major upgrades include an exact-part trust workflow, bench stash 
    management, and coach support plans (rail hookups and bridges).
*   A key ongoing challenge is achieving cross-tool coherence, specifically 
    sharing a single netlist source of truth between schematic and breadboard.

## Key Findings
*   **Finding 1:** Breadboard Lab + AI + Free is the definitive maker bundle. 
    Competitors excel at one domain (e.g., Fritzing has breadboard but no AI; 
    Wokwi has simulation but no schematic), but ProtoPulse uniquely unifies 
    them. (Source: `knowledge/breadboard-plus-ai-plus-free-is-the-maker-bundle.md`)
*   **Finding 2:** Physical constraints are crucial for beginner UX. For 
    example, the ESP32 dev board leaves only 1 free column per side, and the 
    Arduino Mega is too wide for any breadboard. The UI must render these 
    constraints visually. (Sources: `knowledge/esp32-38pin-barely-fits-breadboard-with-one-free-column.md`, `knowledge/mega-2560-too-wide-for-any-breadboard.md`)
*   **Finding 3:** The Bench Coach is critical for catching invisible hardware 
    traps, such as the ESP32's flash-connected GPIOs (6-11) or the inverted 
    STOP/BRAKE logic on BLDC motor controllers. (Sources: `knowledge/esp32-six-flash-gpios-must-never-be-used.md`, `knowledge/bldc-stop-active-low-brake-active-high.md`)
*   **Finding 4:** Epic C in the backlog aims for "One Tool, Zero Context 
    Switching." A C5 complexity item (BL-0571) targets a shared schematic ↔ 
    breadboard netlist to ensure dual-view coherence. (Source: `docs/MASTER_BACKLOG.md`)
*   **Finding 5:** Recent developments delivered exact-part resolution, layout 
    quality scorecards, live board-health audits, and a staging review mode 
    for coach plans. (Source: `CODEX_DONE.md`)

## Technical Context & Constraints
*   **Fritzing Interop:** To support FZPZ import/export, the SVG generator must 
    place connector graphics at exact 9px multiples (0.1 inch spacing at 90 DPI) 
    and match XML connector IDs to avoid "ghost pins."
*   **Non-Standard Footprints:** The layout engine must handle quirks like the 
    Arduino Mega's 160mil gap between pins 7 and 8, breaking uniform 100mil pitch.
*   **AI Context Distinctions:** The Breadboard AI must differentiate between 
    verified exact parts, candidate/heuristic parts, and real stash readiness 
    vs. conceptual intent.

## Raw Notes / Snippets
*   "A Fritzing part (FZPZ file) is a ZIP archive containing one FZP metadata 
    file and multiple SVG graphics files... Pin spacing in Fritzing's breadboard 
    view follows a strict 0.1 inch (2.54mm) grid."
*   "Breadboard AI should always know the difference between: verified exact 
    board behavior, connector-defined but not fully verified behavior, heuristic 
    or generic behavior, real stash readiness versus conceptual design intent."
*   "Board health is most useful when it is: visible from the main workbench, 
    actionable, not just descriptive, tied to affected parts or pins, compatible 
    with selected-part inspection and coach actions."
*   "The need is not 'a better EDA tool.' It is 'a tool where I never have to 
    leave.' The competitive audit validated this: every competitor forces users 
    to leave for the others."