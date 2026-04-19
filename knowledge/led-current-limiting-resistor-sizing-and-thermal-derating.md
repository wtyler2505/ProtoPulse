---
_schema:
  entity_type: "knowledge-note"
  applies_to: "knowledge/*.md"
description: "LED current-limiting resistor is R = (V_source − V_f) / I_f — the source voltage minus the LED's forward voltage drop, divided by the target current; first-pass math ignores thermal derating, MCU GPIO current budget, and the LED's Vf vs temperature drift, all of which matter for a 20,000-hour-lifetime design"
type: concept
confidence: proven
topics:
  - "[[moc-electronics-math]]"
  - "[[eda-fundamentals]]"
  - "[[passives]]"
---

# led current limiting resistor sizing and thermal derating

**[beginner]** An LED in series with a resistor, driven from a voltage source, needs the resistor sized so that the LED current is safe. The formula is **R = (V_source − V_f) / I_f**, where V_f is the LED's forward voltage drop (color-dependent — see below) and I_f is the current you want. Calculator card example: a red LED (V_f ≈ 2.0 V) on a 5 V supply at 20 mA target current needs R = (5 − 2) / 0.020 = 150 Ω. Picking the next-larger standard value (150 Ω or 180 Ω) is safer than going down. Typical V_f by color: red/yellow ~2.0 V, green ~2.2 V, blue/white ~3.2 V. Typical I_f: indicator LEDs 10–20 mA, high-brightness 30+ mA (data-sheet-specified).

The resistor exists because the LED is **non-ohmic** — its V–I curve is nearly vertical above V_f. Without a limiter, current would rise exponentially until either the supply collapsed or the LED burned out. The resistor absorbs whatever voltage is left after the LED takes its fixed V_f, and Ohm's Law across the resistor gives you a current-setting dial.

**[intermediate]** The formula drops out of Kirchhoff's Voltage Law around the loop. Going around V_source → resistor → LED → ground, the voltages must sum to zero: V_source = V_R + V_f. Rearranging: V_R = V_source − V_f. Ohm's Law on the resistor: I_R = V_R / R. Since the circuit is series, I_R = I_LED = I_f, the LED current you want to set. Combining: R = (V_source − V_f) / I_f.

The trickiness is that **V_f is not a constant**. It depends on:

- **Color**, because the LED die's bandgap determines photon energy and forward voltage. Red GaAsP has V_f ≈ 1.8 V, yellow ≈ 2.0 V, green ≈ 2.1 V for traditional GaP or ≈ 3.0 V for InGaN green, blue/white InGaN ≈ 3.2 V. IR is lower (~1.2 V); UV is higher (~3.5 V).
- **Current**, because the V–I curve is not perfectly vertical. V_f rises slightly (maybe 100–200 mV) from 1 mA to 50 mA.
- **Temperature**, because bandgap shrinks with heat. V_f drops roughly 2 mV per °C — a 40 °C rise means V_f drops 80 mV, and since R is fixed, the current through the LED *increases* (a larger fraction of V_source falls across the resistor). This is a positive feedback that can run away in high-power LEDs.
- **Part-to-part variation**, typically ±10% of V_f at rated current even within one reel.

The practical consequence: the calculated R from the datasheet "typical V_f" is correct in room-temperature benchtest. In-circuit, LEDs get warm, V_f drifts, and current creeps up. For indicator LEDs at 10–20 mA this is irrelevant (the thermal feedback is tiny). For high-brightness or high-power LEDs (> 100 mA), resistor-based limiting is inadequate and a constant-current driver IC is required.

**[expert]** Four issues that matter for real designs:

First, **MCU GPIO current budget**. Arduino Uno's ATmega328P specs 40 mA absolute max per pin, 20 mA recommended. ESP32 is ~40 mA. RP2040 (Pico) is 12 mA at its default drive strength, configurable up to 16 mA. Running an LED at 20 mA from a Pico pin exceeds recommended current. The fix is either (a) drive only one LED, using a series resistor sized to the GPIO's own budget (Pico: 10 mA LED, R = (3.3 − 2.0) / 0.010 = 130 Ω → 150 Ω standard); (b) drive through a transistor switch; or (c) use a dedicated LED driver IC. See [[pico-12ma-per-pin-50ma-total-is-strictest-gpio-budget-among-maker-mcus]] and [[330-ohm-resistor-is-the-safe-universal-default-for-any-led-color-at-5v]] for the conservative default.

Second, **resistor power dissipation**. P_R = (V_source − V_f) · I_f = V_R · I_f. For 5 V, red LED, 20 mA: P_R = 3 V × 0.020 A = 60 mW — fits easily in a 1/8 W (125 mW) or 1/4 W (250 mW) resistor. For 12 V input: P_R = 10 V × 0.020 A = 200 mW — right at the edge of a 1/4 W part; use 1/2 W or switch to a current-limiting driver. Resistors rated by 1/4 W at 25 °C ambient derate linearly to zero at 70 °C; an enclosure at 50 °C ambient means the 1/4 W part is effectively rated ~150 mW. This is the **thermal derating** the title mentions — the resistor's nameplate wattage is an idealized number and real continuous operation at elevated temperature needs headroom.

Third, **supply voltage tolerance**. A "5 V" USB supply is specified at 5 V ± 0.25 V in practice; a benchtop lab supply can be set precisely. The resistor sized for 5.0 V nominal will pass slightly less current at 4.75 V and slightly more at 5.25 V — about ±8% variation. For indicator LEDs, invisible. For brightness-matched arrays where all LEDs must look identical, use current mirrors or constant-current drivers rather than trying to match resistor tolerances.

Fourth, **the "parallel LEDs with one resistor" anti-pattern**. Wiring two LEDs in parallel with one series resistor seems to save a part, but V_f mismatch means one LED hogs most of the current, gets hotter (lowering its V_f further), hogs even more current, and eventually fails — taking down the whole string. The fix is one resistor per LED (which costs more parts), or a constant-current driver that monitors each branch, or wiring LEDs in series (all share the same current by KCL) with one resistor sized to the series chain's total V_f.

A final note: LEDs and blue/white LEDs specifically can be impossible at 3.3 V supply because V_f ≈ 3.2 V leaves only 100 mV for the resistor, which at even 10 mA needs R = 10 Ω — and tolerance on V_f easily eats the entire headroom. [[blue-and-white-leds-are-marginal-at-3v3-because-forward-voltage-nearly-equals-supply-voltage]] is the note that documents this trap. The calculator card should flag inputs where V_source − V_f < 200 mV as unreliable.

---

Relevant Notes:
- [[ohms-law-v-equals-i-times-r-derivation]] — parent identity; LED sizing is KVL around a non-ohmic element
- [[330-ohm-resistor-is-the-safe-universal-default-for-any-led-color-at-5v]] — concrete 5 V application of this formula
- [[blue-and-white-leds-are-marginal-at-3v3-because-forward-voltage-nearly-equals-supply-voltage]] — the 3.3 V trap for high-V_f colors
- [[pico-12ma-per-pin-50ma-total-is-strictest-gpio-budget-among-maker-mcus]] — GPIO budget constraint
- [[3v3-gpio-driving-a-bjt-base-loses-21-percent-of-supply-voltage-to-vbe-leaving-less-headroom-for-the-base-resistor]] — related KVL trap for transistor bases

Topics:
- [[moc-electronics-math]]
- [[eda-fundamentals]]
- [[passives]]
