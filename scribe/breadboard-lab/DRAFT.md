# Breadboard Lab Comprehensive Plan

To systematically document and plan enhancements for ProtoPulse's Breadboard 
Lab, making it the only tool a hobbyist needs from concept to physical build 
through physical realism, AI coaching, and seamless cross-tool coherence.

## Target Audience
Hobbyists, students, indie makers, and educational institutions who rely on 
visual-first feedback and need an intuitive, physically accurate bench 
experience augmented by proactive AI safety nets.

## Section 1: Visual Rendering & Physical Realism
Ensure components look photorealistic and respect strict physical breadboard 
constraints. The ESP32 barely fits (leaves 1 free column), the Arduino Mega 
is too wide to fit at all, and the Mega has a non-standard 160mil gap between 
pins 7 and 8. 

**Action Items:**
*   Exact part artwork preferences: Ensure makers see what they actually have 
    on the bench.
*   Bendable leg rendering: Allow realistic, flexible wiring that mimics the 
    messiness and freedom of real breadboarding.
*   Visual collision and spacing rules: Prevent physically impossible layouts 
    before a single real component is placed.

## Section 2: The "Bench Coach" & AI Intelligence
Proactive AI must prevent beginners from making costly hardware mistakes before 
money is spent. Traps like ESP32 flash-connected GPIOs (6-11), ADC2 
unavailability with WiFi, and inverted STOP/BRAKE logic on motor controllers 
must be surfaced.

**Action Items:**
*   Expand layout quality scorecards: Help beginners evaluate their physical 
    layout before experiencing confusing, hard-to-debug behaviors.
*   Rail hookup suggestions: Automate the tedious, error-prone task of routing 
    power and ground accurately.
*   Bridge overlays: Offer proactive assistance to avoid blown components or 
    short circuits.
*   Exact-part trust gating in AI: Prevent AI from recommending unverified 
    parts, saving the user from hours of frustrating debug work.

## Section 3: Cross-Tool Coherence (Netlist & Sync)
Fulfill the "One Tool" promise by ensuring the schematic and breadboard views 
share a unified source of truth. Context switching kills momentum for makers. 
The need is not 'a better EDA tool,' but 'a tool where I never have to leave.' 
Epic C (BL-0571) targets a shared schematic ↔ breadboard netlist so users never 
lose their creative flow transferring work between views.

**Action Items:**
*   Bidirectional synchronization: Updates in the schematic must instantly 
    reflect on the breadboard, saving users from manual double-entry.
*   Unified netlist models: Guarantee that what you wire is what is simulated, 
    so builders trust the software as much as their physical tools.
*   Maintaining user intuition during automated wiring: Ensure automated layout 
    changes feel like a smart assistant helping, not a confusing override.

## Section 4: Stash Management & Inventory
Breadboard Lab must accurately reflect real-world part availability. Recent 
upgrades introduced stash management and Gemini ER "build from my stash" 
capabilities.

**Action Items:**
*   Dedicated inventory intake flows: Make it effortless for a maker to reflect 
    their physical workbench components in the digital environment.
*   Receipt/photo import: Drastically reduce the friction of logging new parts, 
    so builders spend time creating, not performing data entry.
*   Exact stash reconciliation workflows: Ensure users only plan circuits with 
    parts they actually own, preventing halted builds mid-project.

## Section 5: Fritzing Interop & Export Quality
Facilitate part migration and community ecosystem growth. Since Fritzing is 
largely unmaintained, this interop is crucial for rescuing abandoned community 
parts. FZPZ generation requires exact 9px multiples and matched XML connector 
IDs to prevent "ghost pins."

**Action Items:**
*   Harden SVG generation: Ensure migrated parts render flawlessly so that 
    makers can trust imported components without tedious manual fixes.
*   Validate community-contributed parts against grid standards: Keep the 
    library robust and reliable, ensuring every part snaps to the board cleanly.

## Section 6: UI/UX Quality of Life
Provide immediate, tactile feedback during circuit layout. Features like wire 
color coding, connected-row highlights on hover, and wire T-junction forking 
mimic physical breadboarding.

**Action Items:**
*   Ensure keyboard accessibility: Provide fast, momentum-preserving navigation 
    for users who prefer not to constantly reach for the mouse.
*   Smooth drag-and-drop: Make placing parts feel as natural and satisfying as 
    plugging components into a real breadboard.
*   Clear empty-state/starter guidance: Help beginners overcome the blank 
    canvas anxiety with immediately actionable, confidence-building next steps.

## Next Steps
Review priorities and authorize the next implementation tranche.