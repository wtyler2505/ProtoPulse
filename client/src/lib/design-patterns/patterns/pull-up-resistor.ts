import type { DesignPattern } from '../types';

export const pullUpResistor: DesignPattern = {
  id: 'pull-up-resistor',
  name: 'Pull-Up Resistor',
  category: 'signal',
  difficulty: 'beginner',
  description:
    'A resistor connecting a signal line to VCC that ensures the line reads HIGH when nothing is actively driving it LOW. Essential for I2C buses, buttons, and open-drain outputs.',
  whyItWorks:
    'Many digital inputs are high-impedance — they cannot determine their own state when disconnected. A floating input picks up stray capacitive coupling and electromagnetic noise, causing unpredictable readings. A pull-up resistor provides a weak but definite path to VCC, so the input reads HIGH by default. When a button is pressed or an open-drain device pulls the line LOW, it easily overpowers the pull-up because the pull-up\'s resistance limits the current to a small value (e.g., 0.33 mA with 10 k\u03A9 at 3.3V). This gives a clean, defined two-state signal: HIGH when idle, LOW when active.',
  components: [
    {
      name: 'Pull-up resistor',
      type: 'Resistor',
      value: '4.7 k\u03A9 (I2C) or 10 k\u03A9 (buttons/general)',
      notes: 'Lower values give faster rise times but waste more current. I2C spec requires specific values based on bus speed and capacitance.',
    },
  ],
  connections: [
    {
      from: 'Resistor terminal 1',
      to: 'VCC (3.3V or 5V)',
      description: 'Connect one end to the logic supply voltage that the receiving device expects as HIGH.',
    },
    {
      from: 'Resistor terminal 2',
      to: 'Signal line (SDA, SCL, button input, etc.)',
      description: 'Connect the other end to the signal line. This is also where the MCU input pin connects.',
    },
    {
      from: 'Button or open-drain output',
      to: 'Signal line to GND (when active)',
      description: 'The active device shorts the signal line to ground when it wants to signal LOW, overpowering the pull-up.',
    },
  ],
  tips: [
    'For the rover\'s I2C sensors: use 4.7 k\u03A9 pull-ups on SDA and SCL, connected to 3.3V if using ESP32. Only one pair of pull-ups per bus — do not add pull-ups at every device.',
    'Many MCUs (including Arduino and ESP32) have internal pull-ups (20-50 k\u03A9). These are fine for buttons but too weak for I2C at 400 kHz.',
    'For buttons: connect button between the input pin and GND, with a 10 k\u03A9 pull-up to VCC. Press reads LOW. This is called "active-low" logic.',
    'On I2C buses longer than 30 cm or with more than 5 devices, you may need lower pull-ups (2.2 k\u03A9) to overcome bus capacitance.',
    'Pull-down resistors work the same way but connect to GND instead — the default state is LOW and the active state is HIGH.',
  ],
  commonMistakes: [
    'Adding pull-ups at every I2C device — only one pair of pull-ups should exist on the entire bus. Multiple pull-ups in parallel reduce the effective resistance and can prevent devices from pulling the line LOW.',
    'Using a pull-up that is too strong (too low resistance) for open-drain devices — the device may not be able to sink enough current to pull the voltage below the LOW threshold.',
    'Mixing 3.3V and 5V pull-ups on the same bus — if SDA is pulled to 5V but the ESP32 is 3.3V-only, you\'ll damage the ESP32. Always pull up to the voltage of the lowest-voltage device.',
    'Forgetting that internal pull-ups are weak — they may work on a breadboard but fail when wire length or bus capacitance increases.',
  ],
  relatedPatterns: ['voltage-divider', 'level-shifter'],
  tags: ['pull-up', 'resistor', 'I2C', 'SDA', 'SCL', 'button', 'open-drain', 'digital input', 'debounce'],
};
