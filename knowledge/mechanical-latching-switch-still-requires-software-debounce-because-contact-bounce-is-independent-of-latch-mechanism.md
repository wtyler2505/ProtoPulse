---
description: "The self-locking mechanism resolves WHICH button is active but does not prevent contact bounce DURING the transition — each pole still bounces for 10-50ms when latching, requiring software debounce to avoid reading intermediate states during mode changes"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[toneluck-6-way-self-locking-push-button-switch-18-pin]]"
---

# Mechanical latching switch still requires software debounce because contact bounce is independent of latch mechanism

A common misconception: "self-locking switches don't need debouncing because the latch makes it clean."

**What the latch mechanism does:**
- Guarantees only one button is mechanically engaged after the transition completes
- Releases the previous button when a new one locks

**What the latch mechanism does NOT do:**
- Prevent the contact from bouncing during the press event
- Ensure a clean LOW/HIGH transition on the GPIO pin
- Eliminate the 10-50ms of noise when the contact first makes

**During a button press event (zoomed to microseconds):**
1. t=0ms: User presses button 3
2. t=0-5ms: Button 3's contact bounces (rapid make-break-make)
3. t=2-10ms: Previous button (say, button 1) releases (also bounces)
4. t=10-50ms: Both contacts settle — button 3 latched, button 1 released

During the transition window, software reading the pins might see:
- Both buttons active momentarily (old + new contacts both closed mid-bounce)
- No buttons active momentarily (both contacts open mid-bounce)
- Rapid toggling on the transitioning pins

**The fix:**
```cpp
// Simple debounce: read twice with delay
int mode = readSwitchState();
delay(50);
int modeConfirm = readSwitchState();
if (mode == modeConfirm) {
  // Valid, stable mode transition
  currentMode = mode;
}
```

The hardware mutual exclusion still holds — after debounce settling, exactly one pole is active. But the instantaneous reading during transition is unreliable.

---

Topics:
- [[input-devices]]

Related:
- [[self-locking-radio-button-switch-provides-hardware-mutual-exclusion-eliminating-software-mode-conflict-logic]]
- [[mechanical-encoder-contact-bounce-requires-interrupt-driven-debounce-not-polling]]
- [[membrane-keypad-has-no-built-in-debouncing-requiring-software-scan-timing]]
