import type { DesignPattern } from '../types';

export const usbCPower: DesignPattern = {
  id: 'usb-c-power',
  name: 'USB-C Power Delivery',
  category: 'power',
  difficulty: 'advanced',
  description:
    'The essential circuit for receiving power through a USB-C connector — including the mandatory CC resistors that tell the host what power level your device needs. Getting this wrong means no power or, worse, damage to your device.',
  whyItWorks:
    'USB-C uses two Configuration Channel (CC) pins to negotiate power delivery between the host (DFP \u2014 Downstream Facing Port) and device (UFP \u2014 Upstream Facing Port). The device signals its presence and power requirements by connecting 5.1 k\u03A9 resistors from each CC pin to ground. The host detects this pull-down and provides VBUS power. Without these resistors, a USB-C host will not enable VBUS at all \u2014 this is a safety feature to prevent power from being supplied to an unplugged or incorrectly wired connector. For basic 5V power (up to 3A), only the CC resistors are needed. For higher voltages (9V, 15V, 20V up to 100W), a USB PD controller IC handles the digital negotiation over the CC lines.',
  components: [
    {
      name: 'USB-C receptacle',
      type: 'USB-C connector (16-pin or 24-pin)',
      value: 'USB-C 2.0 receptacle (16-pin sufficient for power only)',
      notes: 'For power-only applications, a 16-pin connector is fine. For USB 3.x data, use a 24-pin connector with all signal pairs.',
    },
    {
      name: 'CC1 pull-down resistor',
      type: 'Resistor (1% tolerance)',
      value: '5.1 k\u03A9',
      notes: 'Must be 5.1 k\u03A9 \u00B1 1%. This is non-negotiable — the USB-C spec defines exact resistance ranges. Incorrect values can prevent enumeration or cause overcurrent.',
    },
    {
      name: 'CC2 pull-down resistor',
      type: 'Resistor (1% tolerance)',
      value: '5.1 k\u03A9',
      notes: 'Identical to CC1 resistor. Both CC pins need their own resistor because the connector is reversible — only one CC pin is active depending on cable orientation.',
    },
    {
      name: 'VBUS decoupling capacitor',
      type: 'Ceramic capacitor',
      value: '10 \u00B5F (X5R or X7R, 25V rated)',
      notes: 'Filters VBUS ripple and provides energy for transient loads. Voltage rating must exceed the maximum VBUS voltage you expect (5V standard, 20V for PD).',
    },
    {
      name: 'VBUS protection (optional but recommended)',
      type: 'TVS diode or PMOS reverse polarity protection',
      value: 'SMBJ5.0A (TVS) or SI2301 (PMOS)',
      notes: 'Protects against voltage spikes on VBUS. The TVS clamps transients; the PMOS prevents reverse current if an incorrect cable is used.',
    },
  ],
  connections: [
    {
      from: 'USB-C VBUS pins (A4, B4, A9, B9)',
      to: 'Decoupling capacitor + voltage regulator input',
      description: 'VBUS carries the 5V (or negotiated PD voltage) power. Multiple VBUS pins are tied together inside the connector. Route to your power input with adequate trace width for the expected current.',
    },
    {
      from: 'USB-C CC1 pin (A5)',
      to: '5.1 k\u03A9 resistor to GND',
      description: 'CC1 pull-down resistor signals to the host that a UFP device is connected. This is what triggers VBUS power delivery.',
    },
    {
      from: 'USB-C CC2 pin (B5)',
      to: '5.1 k\u03A9 resistor to GND',
      description: 'CC2 pull-down resistor handles the reverse cable orientation. Both CC resistors are always present; the host detects which one is connected through the active CC line.',
    },
    {
      from: 'USB-C GND pins (A1, B1, A12, B12)',
      to: 'Board ground plane',
      description: 'Multiple ground pins should all connect to the ground plane. The shield/shell should also connect to ground, optionally through a small capacitor for EMI filtering.',
    },
  ],
  tips: [
    'For the rover: if you want to charge/power it via USB-C instead of a barrel jack, this is the circuit you need. The 5.1 k\u03A9 CC resistors are absolutely mandatory.',
    'For 5V/3A (15W) power — the maximum without USB PD negotiation — just the CC resistors and decoupling are enough. No PD controller IC needed.',
    'If you need more than 15W (e.g., 20V for motor power), you need a USB PD controller IC like the STUSB4500 or FUSB302. These handle the PD negotiation protocol.',
    'Always use a 1% tolerance 5.1 k\u03A9 resistor. The USB-C spec allows Rd range of 4.59-5.61 k\u03A9. A 5% resistor at 5.1 k\u03A9 could be 4.845-5.355 k\u03A9, which is within spec but gives less margin.',
    'Route VBUS traces for the expected current: 0.5A needs ~10 mil traces, 3A needs ~50 mil or a copper pour. Undersized traces heat up and drop voltage.',
  ],
  commonMistakes: [
    'Omitting the CC pull-down resistors — without them, a USB-C host will never supply VBUS power. This is the #1 reason "my USB-C board doesn\'t get power" and the most common USB-C design error.',
    'Using a single CC resistor instead of two — USB-C connectors are reversible, so either CC1 or CC2 may be the active line depending on cable orientation. Both need pull-downs.',
    'Confusing DFP and UFP resistor values — hosts (DFP) use pull-UP resistors (Rp) to VCC on CC pins; devices (UFP) use pull-DOWN resistors (Rd) to GND. Using the wrong configuration can cause overcurrent or no power.',
    'Insufficient VBUS trace width — USB-C can deliver up to 3A at 5V (or 5A at 20V with PD). Traces sized for 500 mA USB 2.0 current will overheat.',
  ],
  relatedPatterns: ['voltage-regulator', 'decoupling-network'],
  tags: ['USB-C', 'USB', 'power delivery', 'PD', 'CC pin', '5.1k', 'VBUS', 'DFP', 'UFP', 'connector', 'charging'],
};
