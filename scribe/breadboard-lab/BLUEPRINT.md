# Blueprint: Breadboard Lab Comprehensive Plan

## 1. Objective
*   To systematically document and plan all necessary, potential, and visionary 
    enhancements for ProtoPulse's Breadboard Lab, ensuring it remains the 
    definitive, "zero-context-switching" tool for makers through physical 
    realism, AI coaching, and seamless cross-tool coherence.

## 2. Target Audience
*   Hobbyists, students, indie makers, and educational institutions who rely on 
    visual-first feedback and need an intuitive, physically accurate bench 
    experience augmented by proactive AI safety nets.

## 3. Core Sections (Outline)
*   ### Section 1: Visual Rendering & Physical Realism
    *   **Key Point:** Ensure components look photorealistic and respect strict 
        physical breadboard constraints.
    *   **Supporting Data:** The ESP32 barely fits (leaves 1 free column), the 
        Arduino Mega is too wide to fit at all, and the Mega has a non-standard 
        160mil gap between pins 7 and 8. (Source: `RESEARCH.md`)
    *   **Action Items:** Exact part artwork preferences, bendable leg rendering, 
        and visual collision/spacing rules.
*   ### Section 2: The "Bench Coach" & AI Intelligence
    *   **Key Point:** Proactive AI must prevent beginners from making costly 
        hardware mistakes before money is spent.
    *   **Supporting Data:** Traps like ESP32 flash-connected GPIOs (6-11), 
        ADC2 unavailability with WiFi, and inverted STOP/BRAKE logic on motor 
        controllers must be surfaced. (Source: `RESEARCH.md`)
    *   **Action Items:** Expand layout quality scorecards, rail hookup 
        suggestions, bridge overlays, and exact-part trust gating in AI.
*   ### Section 3: Cross-Tool Coherence (Netlist & Sync)
    *   **Key Point:** Fulfill the "One Tool" promise by ensuring the schematic 
        and breadboard views share a unified source of truth.
    *   **Supporting Data:** Epic C (BL-0571) targets a shared schematic ↔ 
        breadboard netlist to solve UX fragmentation. (Source: `RESEARCH.md`)
    *   **Action Items:** Bidirectional synchronization, unified netlist models, 
        and maintaining user intuition during automated wiring.
*   ### Section 4: Stash Management & Inventory
    *   **Key Point:** Breadboard Lab must accurately reflect real-world part 
        availability.
    *   **Supporting Data:** Recent upgrades introduced stash management and 
        Gemini ER "build from my stash" capabilities. (Source: `RESEARCH.md`)
    *   **Action Items:** Dedicated inventory intake flows, receipt/photo import, 
        and exact stash reconciliation workflows.
*   ### Section 5: Fritzing Interop & Export Quality
    *   **Key Point:** Facilitate part migration and community ecosystem growth.
    *   **Supporting Data:** FZPZ generation requires exact 9px multiples and 
        matched XML connector IDs to prevent "ghost pins." (Source: `RESEARCH.md`)
    *   **Action Items:** Harden SVG generation and validate community-contributed 
        parts against grid standards.
*   ### Section 6: UI/UX Quality of Life
    *   **Key Point:** Provide immediate, tactile feedback during circuit layout.
    *   **Supporting Data:** Features like wire color coding, connected-row 
        highlights on hover, and wire T-junction forking mimic physical 
        breadboarding. (Source: `MASTER_BACKLOG.md`)
    *   **Action Items:** Ensure keyboard accessibility, smooth drag-and-drop, 
        and clear empty-state/starter guidance.

## 4. Special Requirements
*   **Tone:** Highly technical yet accessible; structured as an actionable 
    engineering roadmap.
*   **Keywords:** "Bench Coach", "Physical Realism", "Netlist Coherence", 
    "Gemini ER", "Maker UX".
*   **Call to Action:** "Review priorities and authorize the next implementation 
    tranche."

## 5. Error Handling
*   If `RESEARCH.md` is missing, run `/scribe:research breadboard-lab`.
*   If file operations fail, ensure write permissions in `scribe/breadboard-lab`.

## 6. File Validation
*   Check that `BLUEPRINT.md` adheres to the 80-character line limit.
*   Verify that `RESEARCH.md` insights are accurately reflected.