/**
 * CoachLearnMoreCard — expandable "Why?" learning card for coach warnings.
 *
 * Content is keyed by trap ID (from heuristic-trap-inference, coach-plan
 * suggestions, preflight checks, and board-audit issues).  Each card has
 * three sections:
 *   - What could happen (consequence)
 *   - How to fix (actionable remedy)
 *   - Beginner tip (simplified explanation for first-timers)
 *
 * Pure UI component — no side effects beyond local expand/collapse state.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, HelpCircle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Content types
// ---------------------------------------------------------------------------

export interface LearnMoreContent {
  whatCouldHappen: string;
  howToFix: string;
  beginnerTip: string;
}

// ---------------------------------------------------------------------------
// Static content map — keyed by trap / suggestion / check ID
// ---------------------------------------------------------------------------

const LEARN_MORE_MAP: Record<string, LearnMoreContent> = {
  // -- ESP32 heuristic traps --
  'esp32-flash-gpio': {
    whatCouldHappen:
      'The ESP32 uses GPIO 6-11 internally to communicate with its SPI flash chip. If you wire anything to these pins, the module will crash immediately on boot or corrupt its own firmware, bricking it until you reflash.',
    howToFix:
      'Simply avoid GPIO 6 through 11 entirely. Choose any other available GPIO for your external connections. The ESP32 has plenty of other pins available.',
    beginnerTip:
      'Think of these pins as "reserved parking" — the ESP32 needs them for its own memory. Connecting anything else there causes a traffic jam that freezes everything.',
  },
  'esp32-adc2-wifi': {
    whatCouldHappen:
      'Your analog sensor readings will return garbage values (often zero or max) whenever WiFi is transmitting. This is intermittent and extremely confusing to debug because it works fine when WiFi is off.',
    howToFix:
      'Move your analog sensors to ADC1 channels (GPIO 32-39). These are independent of the WiFi radio and always available. If you must use ADC2, disable WiFi during readings.',
    beginnerTip:
      'The WiFi radio and ADC2 share the same hardware — like two people trying to use one phone at the same time. Use the other set of analog pins (ADC1) and both can work independently.',
  },
  'esp32-gpio12-strapping': {
    whatCouldHappen:
      'If GPIO12 is HIGH when the ESP32 boots, it selects 1.8V flash voltage instead of the standard 3.3V. The flash chip cannot operate at 1.8V, so the module immediately browns out and enters a crash loop.',
    howToFix:
      'Add a 10k pull-down resistor from GPIO12 to GND to ensure it reads LOW at boot. If using GPIO12 for output, make sure your circuit does not pull it HIGH during the power-on sequence.',
    beginnerTip:
      'GPIO12 is like a light switch that the ESP32 checks at startup to decide how much power to give its memory chip. If the switch is in the wrong position, the chip gets confused and refuses to start.',
  },
  'esp32-gpio0-boot': {
    whatCouldHappen:
      'If GPIO0 is LOW when the ESP32 resets, it enters firmware download mode instead of running your program. Your project will appear to "do nothing" after power cycling even though the code is fine.',
    howToFix:
      'Ensure GPIO0 floats HIGH during normal boot (it has an internal pull-up). If driving GPIO0 externally, use a resistor divider or disconnect your circuit during boot/reset.',
    beginnerTip:
      'GPIO0 is the ESP32\'s "mode selector." LOW means "I want new firmware," HIGH means "run my program." If your circuit accidentally holds it LOW, the ESP32 just sits there waiting for code that never comes.',
  },

  // -- AVR / Arduino heuristic traps --
  'avr-5v-logic': {
    whatCouldHappen:
      'A 5V signal from the Arduino directly into a 3.3V device (like an ESP32 or most modern sensors) exceeds its maximum voltage rating. This can permanently damage the 3.3V device, sometimes silently degrading it over time.',
    howToFix:
      'Use a bidirectional level shifter module between the 5V Arduino and any 3.3V device. For one-way signals, a simple voltage divider (two resistors) can step 5V down to 3.3V.',
    beginnerTip:
      'Imagine pouring water from a big bucket (5V) into a small cup (3.3V) — it overflows and makes a mess. A level shifter is like a funnel that controls the flow so nothing spills.',
  },
  'avr-serial-conflict': {
    whatCouldHappen:
      'Pins D0 and D1 are shared between USB serial and your external device. You will get garbled data, failed uploads, or mysterious resets because two devices are trying to talk on the same line at the same time.',
    howToFix:
      'Use SoftwareSerial on different pins (e.g., D2/D3) for external serial devices, or disconnect the external device before uploading code. Hardware Serial on D0/D1 is best reserved for USB debugging.',
    beginnerTip:
      'Pins D0 and D1 are like a shared phone line. When you upload code, the computer calls the Arduino on that line. If another device is also on that line, everyone talks over each other.',
  },
  'avr-reset-noise': {
    whatCouldHappen:
      'The RESET pin has only a weak internal pull-up (~30-50k). Long wires act like antennas, and nearby EMI (motors, relays, switching power supplies) can cause voltage dips that trigger unwanted resets mid-operation.',
    howToFix:
      'Add an external 10k pull-up resistor from RESET to VCC. For noisy environments, also add a 100nF capacitor from RESET to GND to filter high-frequency noise spikes.',
    beginnerTip:
      'The RESET pin is like a very sensitive doorbell — even a light breeze (electrical noise) can ring it. A pull-up resistor is like a stronger spring that holds the button up so only a real push triggers it.',
  },

  // -- 3.3V ARM MCU traps --
  'mcu-3v3-logic': {
    whatCouldHappen:
      'Connecting a 5V signal to a 3.3V GPIO pin exceeds the absolute maximum rating. The pin\'s internal protection diodes will try to clamp the voltage, but sustained overdrive will destroy them, eventually killing the pin or the entire chip.',
    howToFix:
      'Use a bidirectional level shifter or a simple resistor voltage divider (e.g., 1k + 2k) to step 5V signals down to 3.3V. Some 3.3V MCUs have 5V-tolerant pins — check the datasheet first.',
    beginnerTip:
      'This chip runs on 3.3V — think of it as a smaller pipe. Forcing 5V through it is like turning the water pressure up too high. Either add a reducer (level shifter) or find out if the pipe can handle it (5V-tolerant pins).',
  },

  // -- Motor driver traps --
  'motor-brake-polarity': {
    whatCouldHappen:
      'With inverted STOP/BRAKE logic, applying what you think is "stop" actually engages dynamic braking (or vice versa). The motor either cannot be stopped in an emergency, or locks up permanently when you only wanted to coast.',
    howToFix:
      'Check the datasheet truth table carefully. Test with the motor disconnected first — measure the driver output pins with a multimeter to confirm which logic level activates STOP vs BRAKE before connecting a motor.',
    beginnerTip:
      'STOP and BRAKE are not the same thing. STOP means "turn off power" (motor coasts to a halt). BRAKE means "short the motor" (motor locks up instantly). Getting these backward is like mixing up the gas and brake pedals.',
  },
  'motor-hall-order': {
    whatCouldHappen:
      'Wrong hall sensor wiring causes the BLDC controller to energize the wrong phase at the wrong time. The motor vibrates violently, makes grinding noises, draws excessive current, or spins backward — potentially overheating the driver.',
    howToFix:
      'Try all 6 permutations of Ha/Hb/Hc wiring empirically. Start at low speed and low current limit. The correct order produces smooth, quiet rotation. Document the working order for your specific motor.',
    beginnerTip:
      'Hall sensors tell the controller where the motor magnets are, like a GPS for the motor. If the GPS directions are scrambled, the controller pushes at the wrong time and the motor fights itself.',
  },
  'motor-back-emf': {
    whatCouldHappen:
      'When a spinning motor is suddenly de-energized, it acts as a generator. The voltage spike (back-EMF) can be several times the supply voltage, exceeding the driver IC\'s maximum rating and destroying it.',
    howToFix:
      'Place flyback diodes (e.g., 1N4007 or Schottky) across the motor terminals, cathode toward the positive supply. Some driver ICs have built-in protection, but external diodes are an inexpensive safety net.',
    beginnerTip:
      'A spinning motor does not stop instantly — it keeps generating electricity for a moment. Without protection diodes, that electricity has nowhere to go and fries the driver chip. Diodes give it a safe escape route.',
  },
  'motor-shoot-through': {
    whatCouldHappen:
      'If both the high-side and low-side transistors in an H-bridge conduct at the same time (even for nanoseconds), the supply is directly shorted to ground. This causes a massive current spike that can destroy the driver or blow a fuse.',
    howToFix:
      'Ensure your PWM signals have a dead-time gap (typically 100ns-1us) between high and low transitions. Most dedicated motor driver ICs handle this internally, but discrete H-bridge designs need explicit dead-time in firmware.',
    beginnerTip:
      'An H-bridge has four switches. Two open the path to the motor, two close it. If all four open at once, electricity takes a shortcut that bypasses the motor entirely — like a short circuit that can melt things.',
  },
  'motor-pwm-frequency': {
    whatCouldHappen:
      'PWM below 20kHz produces audible whine from the motor windings. PWM above the driver\'s rated frequency increases switching losses, heats up the driver, and reduces efficiency. Extreme frequencies can damage the driver.',
    howToFix:
      'Use 20-25kHz for DC brushed motors and 15-30kHz for BLDC. Check your driver\'s datasheet for the maximum PWM frequency. Start at 20kHz and adjust based on noise and temperature.',
    beginnerTip:
      'PWM frequency is how fast the controller flickers the motor power on and off. Too slow and you hear an annoying whine. Too fast and the controller overheats. The sweet spot is usually around 20kHz — just above what humans can hear.',
  },

  // -- Coach plan suggestion IDs --
  'support-decoupler': {
    whatCouldHappen:
      'Without a decoupling capacitor, high-frequency switching noise from the IC travels along the power rail, causing voltage dips and spikes. Other components see unstable power, leading to random glitches, corrupted data, or brownout resets.',
    howToFix:
      'Place a 100nF ceramic capacitor as close as possible to the IC\'s VCC and GND pins. The leads should be short — long wires add inductance that defeats the purpose. One cap per IC is the standard practice.',
    beginnerTip:
      'A decoupling capacitor is like a tiny battery right next to the chip. When the chip suddenly needs a burst of power, the cap provides it instantly instead of making the power rail dip. Every IC needs one.',
  },
  'support-control-pull': {
    whatCouldHappen:
      'Without a pull resistor, a control pin (like RESET or ENABLE) floats at an undefined voltage. Static electricity, nearby wires, or even your hand getting close can cause the pin to randomly trigger, resetting or disabling your IC.',
    howToFix:
      'Add a 10k resistor from the control pin to VCC (pull-up) or GND (pull-down) depending on the pin\'s active level. RESET is typically active-LOW, so pull it HIGH with a 10k to VCC.',
    beginnerTip:
      'A floating pin is like a light switch that is not connected to anything — it flickers randomly. A pull resistor is like putting a rubber band on the switch to hold it in one position until you deliberately flip it.',
  },

  // -- Preflight check IDs --
  'voltage-mismatch': {
    whatCouldHappen:
      'Components on the same power net operating at different voltages will either receive too much voltage (damaging them) or too little (causing unreliable operation). Mixed 3.3V/5V systems are the most common source of this problem.',
    howToFix:
      'Ensure all components on a shared power net agree on voltage. Use separate power nets for 3.3V and 5V domains, with level shifters on signal lines that cross between them.',
    beginnerTip:
      'Different chips need different voltages — like how some devices charge at 5V and others at 12V. Plugging a 5V device into a 12V charger would fry it. Keep each voltage on its own power "lane."',
  },
  'missing-decoupling': {
    whatCouldHappen:
      'ICs without bypass capacitors share power rail noise with every other component. One noisy IC can make the entire circuit unreliable, especially at higher clock speeds or with analog signals.',
    howToFix:
      'Add a 100nF ceramic capacitor between VCC and GND for each IC that is missing one. Place the capacitor as physically close to the IC as possible on the breadboard.',
    beginnerTip:
      'Every chip should have its own tiny "power smoothing" capacitor. Without it, the chip\'s power supply gets bumpy, like a car driving on a potholed road. The capacitor fills in the potholes.',
  },
  'power-budget': {
    whatCouldHappen:
      'Exceeding the power supply\'s current capacity causes voltage to sag. Components misbehave, reset randomly, or fail to start. In severe cases, the power supply overheats or shuts down, and wires can get dangerously hot.',
    howToFix:
      'Add up the current draw of all components (check datasheets for typical and peak values). Ensure your supply provides at least 20% more than the total. Motors and servos are the biggest consumers — consider a separate supply for them.',
    beginnerTip:
      'Your power supply is like a water pipe. If too many faucets are open at once, the pressure drops. Motors and servos are especially "thirsty." Make sure your pipe (supply) is big enough for everything running at once.',
  },
  'adc2-wifi-conflict': {
    whatCouldHappen:
      'ADC2 readings become unavailable or return random values when WiFi is active. Since WiFi often runs in the background, this failure is intermittent and appears as mysterious sensor glitches that are difficult to reproduce.',
    howToFix:
      'Rewire analog sensors from ADC2 pins to ADC1 pins (GPIO 32-39 on ESP32). If all ADC1 channels are used, schedule WiFi activity around ADC2 readings using WiFi.disconnect()/WiFi.begin().',
    beginnerTip:
      'The ESP32\'s WiFi and some analog pins share the same brain. When WiFi is thinking, those analog pins cannot think. Move your sensors to the other set of analog pins that have their own brain.',
  },
  'unconnected-required-pins': {
    whatCouldHappen:
      'An IC without power (VCC) or ground (GND) connections will not function at all — it simply does nothing. Missing these connections is a common breadboard oversight because the chip physically sits in place and looks correct.',
    howToFix:
      'Verify every IC has VCC and GND wired to the appropriate power rails. Check the datasheet pinout — power pins are not always where you expect (e.g., they may be on opposite corners of a DIP package).',
    beginnerTip:
      'Every chip needs two things to wake up: power (VCC) and a return path (GND). It is the most basic connection, but also the easiest to forget on a breadboard because the chip sits in place either way.',
  },
};

/**
 * Look up learning-card content for a given trap / suggestion / check ID.
 * Returns `undefined` when no content is available for the ID.
 */
export function getLearnMoreContent(trapId: string): LearnMoreContent | undefined {
  return LEARN_MORE_MAP[trapId];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CoachLearnMoreCardProps {
  trapId: string;
  /** 'default' for full-width audit panel cards, 'compact' for inline SVG tooltip use */
  variant?: 'default' | 'compact';
}

export default function CoachLearnMoreCard({ trapId, variant = 'default' }: CoachLearnMoreCardProps) {
  const [expanded, setExpanded] = useState(false);
  const content = getLearnMoreContent(trapId);

  if (!content) {
    return null;
  }

  const isCompact = variant === 'compact';

  return (
    <div data-testid={`coach-learn-more-${trapId}`} className={cn('rounded-md', !isCompact && 'mt-1.5')}>
      <button
        type="button"
        data-testid={`coach-learn-more-trigger-${trapId}`}
        onClick={() => {
          setExpanded((prev) => !prev);
        }}
        className={cn(
          'inline-flex items-center gap-1 text-[10px] font-medium transition-colors',
          'text-cyan-400/70 hover:text-cyan-300',
          isCompact && 'text-[9px]',
        )}
      >
        {expanded ? (
          <ChevronDown className={cn('h-3 w-3 shrink-0', isCompact && 'h-2.5 w-2.5')} />
        ) : (
          <ChevronRight className={cn('h-3 w-3 shrink-0', isCompact && 'h-2.5 w-2.5')} />
        )}
        <HelpCircle className={cn('h-3 w-3 shrink-0', isCompact && 'h-2.5 w-2.5')} />
        Why?
      </button>

      {expanded && (
        <div
          data-testid={`coach-learn-more-body-${trapId}`}
          className={cn(
            'mt-1.5 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-2.5',
            isCompact && 'mt-1 p-2 text-[9px]',
          )}
        >
          <div className="flex flex-col gap-2">
            {/* What could happen */}
            <div>
              <p
                className={cn(
                  'text-[10px] font-semibold text-amber-300/90',
                  isCompact && 'text-[9px]',
                )}
              >
                What could happen
              </p>
              <p
                className={cn(
                  'mt-0.5 text-[10px] leading-relaxed text-muted-foreground',
                  isCompact && 'text-[9px]',
                )}
              >
                {content.whatCouldHappen}
              </p>
            </div>

            {/* How to fix */}
            <div>
              <p
                className={cn(
                  'text-[10px] font-semibold text-green-300/90',
                  isCompact && 'text-[9px]',
                )}
              >
                How to fix
              </p>
              <p
                className={cn(
                  'mt-0.5 text-[10px] leading-relaxed text-muted-foreground',
                  isCompact && 'text-[9px]',
                )}
              >
                {content.howToFix}
              </p>
            </div>

            {/* Beginner tip */}
            <div className={cn('flex items-start gap-1.5 rounded-md bg-amber-500/10 p-2', isCompact && 'p-1.5')}>
              <Lightbulb
                className={cn('mt-0.5 h-3 w-3 shrink-0 text-amber-400', isCompact && 'h-2.5 w-2.5')}
              />
              <div>
                <p
                  className={cn(
                    'text-[10px] font-semibold text-amber-300/90',
                    isCompact && 'text-[9px]',
                  )}
                >
                  Beginner tip
                </p>
                <p
                  className={cn(
                    'mt-0.5 text-[10px] leading-relaxed text-amber-200/70',
                    isCompact && 'text-[9px]',
                  )}
                >
                  {content.beginnerTip}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
