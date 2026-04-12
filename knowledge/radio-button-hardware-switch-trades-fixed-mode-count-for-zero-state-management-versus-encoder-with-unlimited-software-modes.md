---
description: "A hardware radio-button switch gives exactly N modes with guaranteed mutual exclusion and zero firmware state management, while a rotary encoder provides unlimited software-defined modes but requires firmware state tracking, display feedback, and introduces mode-conflict bugs"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[toneluck-6-way-self-locking-push-button-switch-18-pin]]"
---

# Radio-button hardware switch trades fixed mode count for zero state management versus encoder with unlimited software modes

Two competing approaches to mode selection in embedded systems:

## Hardware radio-button switch (Toneluck 6-way)

**Advantages:**
- Physics guarantees mutual exclusion — impossible to be in two modes
- Zero state management code — just read which pin is active
- Visible state — you can see which button is depressed
- Survives MCU reset — hardware position unchanged
- No display needed — physical button position IS the feedback

**Disadvantages:**
- Fixed mode count (6 for this switch, forever)
- Adding a mode requires physical hardware change
- Large footprint (18-pin component + mounting space)
- No dynamic mode labeling (labels are printed/stickered)

## Software state via rotary encoder (KY-040)

**Advantages:**
- Unlimited modes (constrained only by firmware and display)
- Dynamically configurable (modes can change at runtime)
- Tiny footprint (3 pins, small knob)
- Modes can be renamed, reordered, added via firmware update

**Disadvantages:**
- Requires state variable in RAM (lost on power cycle without EEPROM save)
- Requires display/indicator to show current mode (user can't see state from knob position)
- Bug surface: mode conflicts, off-by-one, wraparound edge cases
- MCU reset loses mode state (unless saved to persistent storage)

## Decision boundary

Use hardware radio-button when:
- Mode count is fixed and known at design time
- Reliability is critical (safety modes, critical system states)
- No display available for mode indication
- Simplicity of firmware is a priority

Use encoder/software when:
- Mode count may change in future firmware
- Modes are context-dependent or user-configurable
- Display is already present in the system
- Physical space is constrained

---

Topics:
- [[input-devices]]

Related:
- [[self-locking-radio-button-switch-provides-hardware-mutual-exclusion-eliminating-software-mode-conflict-logic]]
- [[rotary-encoder-with-pushbutton-provides-scroll-plus-select-in-one-component]]
- [[incremental-encoder-has-no-position-memory-across-power-cycles-making-it-a-relative-only-input-device]]
