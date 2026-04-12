---
description: "NEC IR button codes vary between remote manufacturers — hardcoding codes from a tutorial will fail. The correct workflow is: run IRremote receiver example FIRST to discover YOUR remote's codes, THEN hardcode."
type: claim
source: "docs/parts/ir-remote-control-handheld-38khz-nec-protocol.md"
confidence: proven
topics:
  - "[[communication]]"
  - "[[breadboard-intelligence]]"
related_components:
  - "ir-remote-control"
  - "ky-022-ir-receiver"
  - "osepp-irr-01"
---

# NEC IR button codes are manufacturer-specific making code-first debugging impossible without reading your own remote

The NEC IR protocol uses 32-bit codes where the first 16 bits are the device address (manufacturer-specific) and the second 16 bits are the command (button-specific). Different kit remotes from different manufacturers use different device addresses and often different command mappings. There is no universal "button 1 = 0xFF30CF" truth.

**The debugging trap:** A beginner finds an Arduino tutorial that hardcodes button values like `0xFF30CF` for button 1. They copy-paste the code, point their remote at the receiver, and nothing works. They blame their wiring, their receiver module, their library version -- everything except the actual problem: their remote sends different codes than the tutorial's remote.

**The correct workflow:**
1. Wire up the IR receiver
2. Upload the IRremote "ReceiveDump" example sketch
3. Press each button on YOUR remote and note the hex codes in the serial monitor
4. THEN write your application code using those discovered codes
5. Consider storing codes in an array or `#define` block so they're easy to swap if the remote changes

**ProtoPulse implications:**
- The bench coach should enforce this workflow: "Before writing IR control logic, have you mapped your remote's button codes? Run the discovery sketch first."
- The AI should never suggest hardcoded NEC values without the caveat that codes are manufacturer-specific
- The firmware scaffold for IR projects should include a "remote calibration" mode that outputs discovered codes

---

Relevant Notes:
- [[ir-demodulator-output-is-active-low-which-inverts-the-mental-model-of-signal-received-equals-pin-high]] — companion receiver-side debugging trap
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] — exactly the kind of mistake AI should catch before the user wastes hours

Topics:
- [[communication]]
- [[breadboard-intelligence]]
