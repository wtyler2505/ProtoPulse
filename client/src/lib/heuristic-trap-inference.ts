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
// Motor / driver traps
// ---------------------------------------------------------------------------

/** Traps specific to BLDC motor controllers. */
function bldcTraps(): InferredTrap[] {
  return [
    {
      id: 'motor-brake-polarity',
      severity: 'critical',
      confidence: 'inferred',
      category: 'safety',
      title: 'STOP/BRAKE polarity inversion',
      detail:
        'Many BLDC controllers use inverted logic: STOP is active-LOW (ground to halt) while BRAKE is active-HIGH (5 V to engage dynamic braking). Swapping these leaves the motor running or permanently braked.',
      trapId: 'motor-brake-polarity',
    },
    {
      id: 'motor-hall-order',
      severity: 'warning',
      confidence: 'inferred',
      category: 'signal',
      title: 'Hall sensor wiring order matters',
      detail:
        'BLDC hall sensors (Ha, Hb, Hc) must be wired in the correct order. Wrong permutations cause the motor to stutter, vibrate, or spin backward. Verify empirically — do not trust wire colors from salvaged motors.',
      trapId: 'motor-hall-order',
    },
  ];
}

/** Traps specific to H-bridge motor drivers. */
function hBridgeTraps(): InferredTrap[] {
  return [
    {
      id: 'motor-back-emf',
      severity: 'warning',
      confidence: 'inferred',
      category: 'safety',
      title: 'Back-EMF protection required',
      detail:
        'When a motor decelerates, it generates back-EMF that can damage the H-bridge driver. Ensure flyback (freewheeling) diodes are present across the motor terminals. Some drivers have built-in protection, but external diodes are safer.',
      trapId: 'motor-back-emf',
    },
    {
      id: 'motor-shoot-through',
      severity: 'warning',
      confidence: 'inferred',
      category: 'safety',
      title: 'Shoot-through dead-zone for complementary PWM',
      detail:
        'H-bridge drivers using complementary PWM on high/low side FETs need a dead-time gap between switching. Without it, both sides conduct simultaneously (shoot-through), causing a short circuit and potential driver failure.',
      trapId: 'motor-shoot-through',
    },
  ];
}

/** PWM frequency advisory — applies to all motor drivers. */
function motorPwmTrap(): InferredTrap {
  return {
    id: 'motor-pwm-frequency',
    severity: 'info',
    confidence: 'inferred',
    category: 'signal',
    title: 'PWM frequency range advisory',
    detail:
      'Motor driver PWM frequency affects audible noise and efficiency. Below 20 kHz you may hear whine. Above the driver\'s rated frequency, switching losses increase. Typical safe range: 20-25 kHz for DC brushed motors, 15-30 kHz for BLDC.',
    trapId: 'motor-pwm-frequency',
  };
}

/**
 * Check whether the title clearly identifies the part as an LED driver.
 *
 * LED driver detection supersedes motor-driver detection when both match —
 * parts like "LED strip motor-PWM driver IC" are NOT motor controllers
 * despite containing "motor" in the description.
 */
function isLedDriver(title: string): boolean {
  const lower = title.toLowerCase();
  // Common LED-driver cue words + known LED-driver MPN patterns.
  return (
    lower.includes(' led ') ||
    lower.startsWith('led ') ||
    lower.endsWith(' led') ||
    lower.includes(' led-') ||
    lower.includes('-led ') ||
    lower.includes('led driver') ||
    lower.includes('led matrix') ||
    lower.includes('led strip') ||
    lower.includes('rgb led') ||
    lower.includes('ws2812') ||
    lower.includes('apa102') ||
    lower.includes('sk6812') ||
    lower.includes('tlc59') ||
    lower.includes('mbi503') ||
    lower.includes('mbi5024') ||
    lower.includes('max7219') ||
    lower.includes('ht16k33')
  );
}

/** Check if the title indicates a motor-related driver (vs LED driver, etc.). */
function isMotorDriver(title: string): boolean {
  // LED drivers SUPERSEDE motor drivers when both might match (audit #257).
  if (isLedDriver(title)) {
    return false;
  }
  const lower = title.toLowerCase();
  return (
    // Motor-family keywords — avoid bare "motor" which over-matches.
    lower.includes('bldc') ||
    lower.includes('brushless') ||
    lower.includes('stepper') ||
    lower.includes('servo') ||
    lower.includes('h-bridge') ||
    lower.includes('h bridge') ||
    lower.includes('dc motor') ||
    lower.includes('motor driver') ||
    lower.includes('motor controller') ||
    lower.includes('motor shield') ||
    // Known motor-driver chip MPNs.
    lower.includes('l298') ||
    lower.includes('l293') ||
    lower.includes('l9110') ||
    lower.includes('tb6612') ||
    lower.includes('drv8') ||
    lower.includes('bts7960') ||
    // Known motor-driver brands / boards.
    lower.includes('riorand') ||
    lower.includes('zs-x11h') ||
    lower.includes('kjl-01')
  );
}

function isBldcDriver(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes('bldc') || lower.includes('riorand');
}

function isHBridgeDriver(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    lower.includes('h-bridge') ||
    lower.includes('h bridge') ||
    lower.includes('l298') ||
    lower.includes('l293') ||
    lower.includes('l9110') ||
    lower.includes('tb6612') ||
    lower.includes('drv8') ||
    lower.includes('bts7960')
  );
}

function motorDriverTraps(title: string): InferredTrap[] {
  const traps: InferredTrap[] = [];

  if (isBldcDriver(title)) {
    traps.push(...bldcTraps());
  }

  if (isHBridgeDriver(title)) {
    traps.push(...hBridgeTraps());
  }

  // All motor drivers get the PWM frequency advisory
  traps.push(motorPwmTrap());

  return traps;
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

  // Motor / driver family
  if (family === 'driver') {
    if (isMotorDriver(title)) {
      return motorDriverTraps(title);
    }
    return [];
  }

  // Unknown MCUs — no heuristic data
  return [];
}
