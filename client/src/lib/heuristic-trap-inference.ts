/**
 * Heuristic Trap Inference Engine — pattern-match unverified parts.
 *
 * When a placed component has no verified board definition, this engine
 * examines its family + title/MPN to infer likely hardware traps at
 * "inferred" confidence level.  Verified boards already surface traps
 * via their pin maps; this is the fallback for everything else.
 *
 * Pure function — no side effects, no React, no DOM.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type TrapSeverity = 'critical' | 'warning' | 'info';
export type TrapCategory = 'power' | 'signal' | 'layout' | 'safety' | 'missing';

export interface InferredTrap {
  /** Unique trap identifier — also used as the `trapId` for learning card lookup. */
  id: string;
  severity: TrapSeverity;
  /** Always 'inferred' — distinguishes from verified-board traps. */
  confidence: 'inferred';
  category: TrapCategory;
  title: string;
  detail: string;
  /** Key for linking to CoachLearnMoreCard content. Same as `id`. */
  trapId: string;
}

export interface InferTrapsInput {
  family: string;
  title: string;
}

// ---------------------------------------------------------------------------
// Pattern matchers
// ---------------------------------------------------------------------------

function titleContains(title: string, ...needles: string[]): boolean {
  const lower = title.toLowerCase();
  return needles.some((n) => lower.includes(n.toLowerCase()));
}

// ---------------------------------------------------------------------------
// ESP32 traps
// ---------------------------------------------------------------------------

function esp32Traps(): InferredTrap[] {
  return [
    {
      id: 'esp32-flash-gpio',
      severity: 'critical',
      confidence: 'inferred',
      category: 'safety',
      title: 'Flash GPIOs (6-11) must not be used',
      detail:
        'GPIO 6 through 11 are hardwired to the internal SPI flash. Any external connection will crash the module or corrupt firmware.',
      trapId: 'esp32-flash-gpio',
    },
    {
      id: 'esp32-adc2-wifi',
      severity: 'warning',
      confidence: 'inferred',
      category: 'signal',
      title: 'ADC2 unavailable when WiFi is active',
      detail:
        'ADC2 channels share hardware with the WiFi radio and are completely locked out during WiFi operation. Use ADC1 channels instead.',
      trapId: 'esp32-adc2-wifi',
    },
    {
      id: 'esp32-gpio12-strapping',
      severity: 'critical',
      confidence: 'inferred',
      category: 'safety',
      title: 'GPIO12 must be LOW at boot',
      detail:
        'GPIO12 is a strapping pin that selects flash voltage. If pulled HIGH at boot the module selects 1.8 V, causing a brownout crash.',
      trapId: 'esp32-gpio12-strapping',
    },
    {
      id: 'esp32-gpio0-boot',
      severity: 'warning',
      confidence: 'inferred',
      category: 'signal',
      title: 'GPIO0 controls boot mode',
      detail:
        'GPIO0 LOW at reset enters download mode. If driving GPIO0 externally, ensure it floats HIGH during normal boot.',
      trapId: 'esp32-gpio0-boot',
    },
  ];
}

// ---------------------------------------------------------------------------
// ATmega / Arduino traps
// ---------------------------------------------------------------------------

function avrTraps(): InferredTrap[] {
  return [
    {
      id: 'avr-5v-logic',
      severity: 'warning',
      confidence: 'inferred',
      category: 'power',
      title: '5 V logic levels — watch mixed-voltage buses',
      detail:
        'ATmega/Arduino boards run at 5 V logic. Connecting directly to 3.3 V devices (ESP32, sensors) without a level shifter can damage the lower-voltage device.',
      trapId: 'avr-5v-logic',
    },
    {
      id: 'avr-serial-conflict',
      severity: 'info',
      confidence: 'inferred',
      category: 'signal',
      title: 'Serial pins (D0/D1) shared with USB',
      detail:
        'Pins D0 (RX) and D1 (TX) are shared with the USB-to-serial converter. Wiring external devices to these pins will conflict with serial upload and monitoring.',
      trapId: 'avr-serial-conflict',
    },
    {
      id: 'avr-reset-noise',
      severity: 'info',
      confidence: 'inferred',
      category: 'signal',
      title: 'Reset pin sensitive to noise',
      detail:
        'The RESET pin is active-low with a weak internal pull-up. Long wires or nearby EMI sources can cause spurious resets. Add a 10 kΩ external pull-up if the reset line is exposed.',
      trapId: 'avr-reset-noise',
    },
  ];
}

// ---------------------------------------------------------------------------
// 3.3 V ARM MCU traps
// ---------------------------------------------------------------------------

function arm3v3Traps(): InferredTrap[] {
  return [
    {
      id: 'mcu-3v3-logic',
      severity: 'warning',
      confidence: 'inferred',
      category: 'power',
      title: '3.3 V logic — not 5 V tolerant',
      detail:
        'This MCU operates at 3.3 V. Connecting 5 V signals directly to GPIO pins will exceed the absolute maximum rating and may permanently damage the chip. Use a level shifter or voltage divider.',
      trapId: 'mcu-3v3-logic',
    },
  ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Infer likely hardware traps for an unverified part based on its
 * family and title/MPN.  Returns an empty array when no heuristic
 * rules match (e.g. passive components, unknown MCUs).
 */
export function inferTraps(input: InferTrapsInput): InferredTrap[] {
  const family = input.family.toLowerCase();
  const title = input.title;

  // Only MCUs and drivers have heuristic traps (drivers handled in Task 3)
  if (family !== 'mcu' && family !== 'microcontroller' && family !== 'driver') {
    return [];
  }

  // ESP32 family
  if (titleContains(title, 'esp32')) {
    return esp32Traps();
  }

  // ATmega / Arduino family
  if (titleContains(title, 'atmega', 'arduino')) {
    return avrTraps();
  }

  // 3.3 V ARM MCUs
  if (titleContains(title, 'rp2040', 'pico', 'stm32', 'nrf', 'samd')) {
    return arm3v3Traps();
  }

  // Motor drivers are handled by Task 3 — return empty for now
  // Unknown MCUs — no heuristic data
  return [];
}
