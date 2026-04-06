---
description: "The Tauri v2 pivot resolved firmware, debugger, and multi-platform blockers that browser sandboxing made impossible"
type: decision
source: "docs/MASTER_BACKLOG.md (ADR 0007/0008)"
confidence: proven
topics: ["[[architecture-decisions]]", "[[competitive-landscape]]"]
related_components: []
---

# The native desktop pivot unblocked three C5 programs that browser sandboxing made impossible

Three of the backlog's highest-complexity items (C5) -- firmware simulation (BL-0631/0635), hardware debugger integration (BL-0632), and multi-platform board support (BL-0613/0614/0633) -- were all blocked by the same root cause: browser security sandboxing prevents direct access to USB ports, local toolchains, and process spawning. ADR 0007 and ADR 0008 resolved all three simultaneously by pivoting to a pure-local native desktop application via Tauri v2.

The impact was immediate and structural. Native process spawning replaced browser-sandbox workarounds for firmware compilation. Direct USB/serial access eliminated WebUSB constraints for hardware debugging. Local filesystem access enabled broad platform support (Arduino, ESP-IDF, STM32, RP2040, nRF52) by running native toolchains directly. The entire "Blocked / Waiting On" section of the backlog was cleared for firmware-related items.

The strategic insight is that ProtoPulse tried to be a browser-based tool first and hit a hard capability ceiling. The EDA tools it competes with (KiCad, Arduino IDE, PlatformIO) are all desktop applications for exactly this reason. The pivot was not a retreat from web technology -- React, Vite, Express all remain -- but an acknowledgment that hardware tools need hardware access.

---

Relevant Notes:
- [[express-5-chosen-because-spa-tools-dont-need-ssr]] -- backend survived the pivot unchanged
- [[breadboard-plus-ai-plus-free-is-the-maker-bundle]] -- desktop doesn't change the value prop

Topics:
- [[architecture-decisions]]
- [[competitive-landscape]]
