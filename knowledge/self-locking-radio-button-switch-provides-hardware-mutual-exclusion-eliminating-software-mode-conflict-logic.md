---
description: "A self-locking push button switch assembly mechanically releases the previously-pressed button when a new one is pressed — this hardware mutual exclusion guarantees exactly one mode is active at any time without software state management or conflict resolution"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[toneluck-6-way-self-locking-push-button-switch-18-pin]]"
---

# Self-locking radio-button switch provides hardware mutual exclusion eliminating software mode-conflict logic

The Toneluck 6-way switch mechanically enforces radio-button behavior: pressing button N physically releases button M. The mechanism uses interlocking bars or cams inside the assembly that prevent two buttons from being latched simultaneously.

**What this eliminates from your firmware:**
- No state machine for mode transitions
- No "if modeA && modeB then error" guards
- No race conditions between interrupt-driven button reads
- No debounce-related double-mode activation
- No edge-case where power glitch activates two modes

**What remains your responsibility:**
- Debouncing (the contact still bounces on press)
- Reading which pole is currently active
- Handling the transition logic (what happens when switching modes)
- Pull-up/pull-down resistors on each pole's output pin

The architectural insight: the switch moves mutual exclusion from the software domain (where bugs live) to the mechanical domain (where physics guarantees correctness). This is the same principle as hardware interlocks in safety systems — you cannot rely on software alone for critical mutual exclusion.

**Trade-off:** The mode count is fixed at manufacturing time. A 6-way switch has exactly 6 modes. Adding a 7th requires replacing the physical component. This rigidity is the price of hardware certainty.

---

Topics:
- [[input-devices]]

Related:
- [[radio-button-hardware-switch-trades-fixed-mode-count-for-zero-state-management-versus-encoder-with-unlimited-software-modes]]
- [[mechanical-latching-switch-still-requires-software-debounce-because-contact-bounce-is-independent-of-latch-mechanism]]
- [[rotary-encoder-with-pushbutton-provides-scroll-plus-select-in-one-component]]
