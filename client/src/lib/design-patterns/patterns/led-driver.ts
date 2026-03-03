import type { DesignPattern } from '../types';

export const ledDriver: DesignPattern = {
  id: 'led-driver',
  name: 'LED Driver',
  category: 'power',
  difficulty: 'beginner',
  description:
    'A current-limiting circuit for LEDs that prevents them from drawing excessive current and burning out. The simplest version is a series resistor; advanced versions use constant-current drivers for consistent brightness.',
  whyItWorks:
    'An LED is a diode — once forward-biased past its threshold voltage (Vf), its resistance drops dramatically and current increases exponentially. Without current limiting, the LED draws destructive current and burns out in milliseconds. A series resistor limits the current by dropping the excess voltage: R = (Vs - Vf) / If, where Vs is the supply voltage, Vf is the LED\'s forward voltage (typically 1.8-3.3V depending on color), and If is the desired forward current (typically 10-20 mA for indicator LEDs). The resistor converts the excess voltage to heat, which is acceptable at low power. For high-power LEDs (1W+), a constant-current driver is preferred because it maintains the exact current regardless of supply voltage variations and LED Vf tolerances.',
  components: [
    {
      name: 'Current-limiting resistor',
      type: 'Resistor',
      value: 'Calculated: R = (Vs - Vf) / If',
      notes: 'For a standard red LED (Vf=2V) at 15 mA from 5V: R = (5-2)/0.015 = 200\u03A9, use nearest standard value 220\u03A9. Power rating must exceed (Vs-Vf)\u00B2/R.',
    },
    {
      name: 'LED',
      type: 'Light-emitting diode',
      value: '3mm or 5mm through-hole, or SMD (0805, etc.)',
      notes: 'Forward voltage varies by color: Red ~2.0V, Green ~2.2V, Blue/White ~3.0-3.3V. Always check the datasheet for Vf and max If.',
    },
  ],
  connections: [
    {
      from: 'Supply voltage (or GPIO pin)',
      to: 'Resistor terminal 1',
      description: 'The resistor can go on either the anode or cathode side of the LED — electrically identical. Convention is before the LED (high side).',
    },
    {
      from: 'Resistor terminal 2',
      to: 'LED anode (+)',
      description: 'The current-limited supply connects to the LED\'s anode (longer lead on through-hole LEDs).',
    },
    {
      from: 'LED cathode (-)',
      to: 'Ground (or GPIO pin for sink mode)',
      description: 'The LED\'s cathode (shorter lead, flat side of the lens) connects to ground. For MCU-controlled LEDs, the GPIO can either source current (anode side) or sink current (cathode side).',
    },
  ],
  tips: [
    'For the rover\'s status LEDs: 5V supply, typical indicator LED at 10-15 mA. Use 330\u03A9 for red LEDs, 220\u03A9 for blue/white LEDs.',
    'Driving LEDs from MCU GPIO pins: most Arduino pins can source/sink 20 mA, ESP32 pins can handle 12 mA. For more LEDs, use a transistor or MOSFET to switch them.',
    'For PWM brightness control: the resistor value should be calculated for the maximum brightness current. PWM reduces the average current proportionally.',
    'Multiple LEDs in series share the same current (more efficient): R = (Vs - Vf1 - Vf2 - ...) / If. Make sure Vs > sum of all Vf values.',
    'WS2812B (NeoPixel) and APA102 LEDs have built-in drivers — they only need a 5V supply and a data line, no external resistors per LED.',
  ],
  commonMistakes: [
    'Connecting an LED directly to a voltage source without a current-limiting resistor — the LED will draw excessive current and fail, possibly damaging the source too.',
    'Using the wrong Vf in the calculation — Vf varies significantly by color (red: 1.8-2.2V, blue: 2.8-3.5V). Using the wrong value gives the wrong resistor and wrong brightness.',
    'Putting LEDs in parallel with a single shared resistor — LEDs have manufacturing variations in Vf, so one LED will hog most of the current. Use one resistor per LED or wire LEDs in series.',
    'Exceeding the GPIO current limit — driving too many LEDs from a single MCU pin without a transistor buffer can damage the microcontroller.',
  ],
  relatedPatterns: ['voltage-divider', 'voltage-regulator', 'h-bridge'],
  tags: ['LED', 'current limiting', 'resistor', 'driver', 'forward voltage', 'brightness', 'indicator', 'NeoPixel', 'GPIO'],
};
