// ---------------------------------------------------------------------------
// Built-in RAG knowledge base — Electronics reference entries
// ---------------------------------------------------------------------------

export interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
}

export const KNOWLEDGE_CATEGORIES = [
  'microcontroller',
  'sensor',
  'passive',
  'active',
  'power',
  'motor-driver',
  'op-amp',
  'timer',
  'communication',
  'design-practice',
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Entries (20+)
// ---------------------------------------------------------------------------

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: 'kb-atmega328p',
    title: 'ATmega328P Microcontroller',
    category: 'microcontroller',
    content:
      'The ATmega328P is an 8-bit AVR RISC microcontroller with 32KB flash, 2KB SRAM, and 1KB EEPROM. ' +
      'It runs at up to 16MHz (external crystal) or 8MHz (internal oscillator). ' +
      'It has 23 GPIO pins, 6 ADC channels (10-bit), 6 PWM outputs, USART, SPI, and I2C interfaces. ' +
      'Operating voltage is 1.8-5.5V. It is the core of Arduino Uno and Nano boards. ' +
      'Programming via ISP (MOSI/MISO/SCK/RESET) or bootloader over UART (TX/RX on pins PD0/PD1). ' +
      'Common circuit: 16MHz crystal on XTAL1/XTAL2 with 22pF load caps, 100nF decoupling cap on VCC/AVCC, ' +
      '10K pull-up on RESET with optional 100nF cap for noise immunity. ' +
      'ADC reference can be AVCC, internal 1.1V, or external AREF. AVCC must be within 0.3V of VCC.',
    tags: ['atmega328p', 'avr', 'arduino', 'uno', 'nano', 'microcontroller', '8-bit'],
  },
  {
    id: 'kb-esp32',
    title: 'ESP32 Microcontroller',
    category: 'microcontroller',
    content:
      'The ESP32 is a dual-core Xtensa LX6 running at 240MHz with integrated WiFi (802.11 b/g/n) and ' +
      'Bluetooth 4.2/BLE. It has 520KB SRAM, 4MB flash (typical module), 34 GPIO pins, 18 ADC channels ' +
      '(12-bit but nonlinear above 2.5V), 2 DAC channels (8-bit), 16 PWM channels, 3 UART, 2 I2C, 4 SPI. ' +
      'Operating voltage is 3.3V (NOT 5V tolerant). Boot mode pins: GPIO0 must be LOW for download mode, ' +
      'HIGH for normal boot. GPIO2 and GPIO12 (MTDI) also affect boot — avoid pulling GPIO12 HIGH at boot. ' +
      'Strapping pins: GPIO0, GPIO2, GPIO5, GPIO12, GPIO15 — be careful with external pull-ups/downs. ' +
      'Power modes: active (~240mA WiFi TX), modem sleep (~20mA), light sleep (~0.8mA), deep sleep (~10uA). ' +
      'ADC2 cannot be used while WiFi is active. Use ADC1 (GPIO32-39) for analog reads during WiFi.',
    tags: ['esp32', 'wifi', 'bluetooth', 'ble', 'xtensa', 'iot', 'wireless'],
  },
  {
    id: 'kb-ne555',
    title: 'NE555 Timer IC',
    category: 'timer',
    content:
      'The NE555 is a versatile timer IC operating from 4.5-16V. Three modes: ' +
      'Astable (free-running): frequency = 1.44 / ((R1 + 2*R2) * C), duty cycle > 50% unless diode steering used. ' +
      'Monostable (one-shot): pulse width T = 1.1 * R * C, triggered by falling edge on pin 2 (TRIGGER). ' +
      'Bistable (flip-flop): SET on pin 2 (TRIGGER LOW), RESET on pin 4 (RESET LOW). ' +
      'Pin functions: 1=GND, 2=TRIGGER, 3=OUTPUT, 4=RESET (active low, tie to VCC if unused), ' +
      '5=CONTROL (bypass with 10nF to GND), 6=THRESHOLD, 7=DISCHARGE, 8=VCC. ' +
      'Output can source/sink ~200mA. CMOS version (TLC555/LMC555) draws much less current (~100uA vs ~10mA). ' +
      'For precision timing, use 1% resistors and stable capacitors (C0G/NPO ceramic or film).',
    tags: ['ne555', '555', 'timer', 'astable', 'monostable', 'oscillator', 'pulse'],
  },
  {
    id: 'kb-lm7805',
    title: 'LM7805 Voltage Regulator',
    category: 'power',
    content:
      'The LM7805 is a fixed +5V linear voltage regulator in the 78xx family. ' +
      'Input voltage: 7V-35V (min dropout ~2V). Output current: up to 1.5A with adequate heatsinking. ' +
      'Quiescent current: ~5mA. Must have input capacitor (0.33uF minimum, ceramic) close to input pin, ' +
      'and output capacitor (0.1uF minimum, ceramic) close to output pin for stability. ' +
      'Thermal design: power dissipation P = (Vin - 5V) * Iload. Junction-to-ambient thermal resistance ' +
      '~65C/W (TO-220, no heatsink). Max junction temp 150C. Example: 12V input, 500mA load = 3.5W dissipation, ' +
      'needs heatsink rated <28C/W. Thermal shutdown protects the IC but causes output dropout. ' +
      'For higher efficiency at large Vin-Vout differential, consider switching regulators (LM2596, MP1584). ' +
      'Pin order (TO-220 front view): 1=INPUT, 2=GND, 3=OUTPUT.',
    tags: ['lm7805', '7805', 'regulator', 'linear', '5v', 'power-supply', 'voltage'],
  },
  {
    id: 'kb-lm317',
    title: 'LM317 Adjustable Voltage Regulator',
    category: 'power',
    content:
      'The LM317 is an adjustable positive linear voltage regulator with output from 1.25V to 37V. ' +
      'Input-output differential: 3V min to 40V max. Output current up to 1.5A with heatsink. ' +
      'Output voltage formula: Vout = 1.25 * (1 + R2/R1), where R1 = 240 ohms (connected from OUT to ADJ). ' +
      'A 10uF capacitor from ADJ to GND improves ripple rejection by ~20dB. ' +
      'Input cap: 0.1uF close to input. Output cap: 1uF minimum (tantalum recommended). ' +
      'Protection diodes recommended: 1N4002 from output to input (reverse current), 1N4002 from ADJ to output ' +
      '(discharge cap protection). Line regulation: 0.01%/V. Load regulation: 0.1%. ' +
      'Minimum load current: 3.5mA (ensured by R1=240 ohm giving ~5mA through divider).',
    tags: ['lm317', 'regulator', 'adjustable', 'linear', 'power-supply', 'voltage'],
  },
  {
    id: 'kb-2n2222',
    title: '2N2222 NPN Transistor',
    category: 'active',
    content:
      'The 2N2222 is a general-purpose NPN bipolar junction transistor (BJT). ' +
      'Ratings: Vce max = 40V, Ic max = 800mA, Ptot = 625mW (TO-92). hFE (DC current gain) = 100-300 typical. ' +
      'Switching applications: to fully saturate, provide base current Ib >= Ic / 10 (forced beta of 10). ' +
      'Base resistor: Rb = (Vdrive - Vbe) / Ib, where Vbe ~ 0.7V. ' +
      'Example: switching a 100mA relay from 5V logic: Ib = 100mA/10 = 10mA, Rb = (5-0.7)/0.01 = 430 ohms. ' +
      'Always include a flyback diode (1N4148) across inductive loads (relays, motors). ' +
      'For analog amplification: common emitter gain Av = -Rc/Re (with emitter degeneration). ' +
      'Pinout (TO-92 flat side facing you, left to right): Emitter, Base, Collector.',
    tags: ['2n2222', 'npn', 'bjt', 'transistor', 'switching', 'amplifier'],
  },
  {
    id: 'kb-irf540n',
    title: 'IRF540N N-Channel MOSFET',
    category: 'active',
    content:
      'The IRF540N is a logic-level N-channel power MOSFET in TO-220 package. ' +
      'Ratings: Vds = 100V, Id = 33A (at 25C case), Rds(on) = 44 mohm at Vgs = 10V. ' +
      'Gate threshold voltage: 2-4V. Fully enhanced at Vgs = 10V; usable from 5V logic with reduced Rds(on). ' +
      'Gate is voltage-driven (no steady-state current), but gate capacitance (~1700pF) requires gate driver ' +
      'or low-impedance source for fast switching. Add 10-100 ohm gate resistor to limit ringing. ' +
      'Power dissipation: P = Rds(on) * Id^2 (conduction loss) + switching losses at high frequencies. ' +
      'Body diode: integral reverse diode (useful for motor H-bridges). ' +
      'Safe operating area: check SOA graph for pulse applications. Never exceed Vgs +-20V. ' +
      'Pinout (TO-220): Gate, Drain, Source. Tab is connected to Drain.',
    tags: ['irf540n', 'mosfet', 'n-channel', 'power', 'switching', 'transistor'],
  },
  {
    id: 'kb-resistor-basics',
    title: 'Resistor Basics and Color Codes',
    category: 'passive',
    content:
      'Resistors limit current flow. Ohms law: V = I*R, P = I^2*R = V^2/R. ' +
      '4-band color code: Band1=tens, Band2=units, Band3=multiplier, Band4=tolerance. ' +
      'Colors: Black=0, Brown=1, Red=2, Orange=3, Yellow=4, Green=5, Blue=6, Violet=7, Grey=8, White=9. ' +
      'Multiplier: Black=1, Brown=10, Red=100, Orange=1K, Yellow=10K, Green=100K, Blue=1M. ' +
      'Tolerance: Gold=5%, Silver=10%, Brown=1%, Red=2%. ' +
      'Standard series: E12 (10% tolerance) = 10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82. ' +
      'Power rating: 1/4W most common for through-hole, 0402/0603/0805 SMD ratings vary by size. ' +
      'Series: Rtotal = R1 + R2. Parallel: 1/Rtotal = 1/R1 + 1/R2, or Rtotal = R1*R2/(R1+R2). ' +
      'Pull-up/pull-down: 4.7K-10K typical for logic inputs. Current-limiting LED: R = (Vsupply - Vled) / Iled.',
    tags: ['resistor', 'color-code', 'ohms-law', 'passive', 'pull-up', 'series', 'parallel'],
  },
  {
    id: 'kb-capacitor-basics',
    title: 'Capacitor Types and Markings',
    category: 'passive',
    content:
      'Capacitors store charge: Q = C*V, energy E = 0.5*C*V^2. Impedance Xc = 1/(2*pi*f*C). ' +
      'Types: Ceramic (C0G/NPO for precision, X7R for bypass, Y5V cheap but poor tempco), ' +
      'Electrolytic (large values, polarized, ESR matters for power supply filtering), ' +
      'Tantalum (low ESR, polarized, can fail short — use derating), ' +
      'Film (polypropylene/polyester, excellent for timing and audio, non-polarized). ' +
      'Ceramic markings (SMD): 104 = 10*10^4 pF = 100nF = 0.1uF. First two digits are significant figures, ' +
      'third digit is number of zeros in picofarads. 102=1nF, 103=10nF, 104=100nF, 105=1uF. ' +
      'Decoupling: place 100nF ceramic as close as possible to each IC VCC/GND pins. ' +
      'Bulk capacitor: 10uF-100uF electrolytic near power entry for low-frequency noise. ' +
      'Voltage derating: use capacitor rated at least 2x the working voltage for reliability.',
    tags: ['capacitor', 'ceramic', 'electrolytic', 'tantalum', 'decoupling', 'bypass', 'passive'],
  },
  {
    id: 'kb-inductor-basics',
    title: 'Inductor Selection and Design',
    category: 'passive',
    content:
      'Inductors store energy in magnetic fields: E = 0.5*L*I^2. Impedance XL = 2*pi*f*L. ' +
      'Key parameters: inductance (L in henries), DC resistance (DCR — causes losses), ' +
      'saturation current (Isat — above this, inductance drops >20%), rated current (thermal limit). ' +
      'Types: ferrite core (high frequency, low loss), iron powder (higher Isat, moderate frequency), ' +
      'air core (no saturation, used in RF). Shielded inductors reduce EMI. ' +
      'For switching regulators: choose L so ripple current is 20-40% of load current. ' +
      'L = (Vin - Vout) * D / (f * deltaI), where D=duty cycle, f=switching frequency, deltaI=ripple current. ' +
      'Self-resonant frequency (SRF): above this, inductor behaves as capacitor — choose SRF >> operating freq. ' +
      'EMC: ferrite beads (rated in ohms at 100MHz) are special inductors for high-frequency noise filtering.',
    tags: ['inductor', 'ferrite', 'coil', 'saturation', 'switching', 'emi', 'passive'],
  },
  {
    id: 'kb-arduino-uno',
    title: 'Arduino Uno Board Reference',
    category: 'microcontroller',
    content:
      'Arduino Uno R3 is based on ATmega328P with ATmega16U2 USB-to-serial. ' +
      'Digital I/O: 14 pins (D0-D13), 6 provide PWM (D3,D5,D6,D9,D10,D11). ' +
      'Analog inputs: 6 pins (A0-A5), 10-bit ADC (0-1023), can also be used as digital GPIO. ' +
      'Power: USB (5V) or DC jack (7-12V recommended, 6-20V limits). 5V pin max 500mA from USB. ' +
      'Per-pin current limit: 20mA recommended, 40mA absolute max. Total GPIO current: 200mA max. ' +
      'Serial: D0(RX)/D1(TX) shared with USB serial — dont use for other purposes during USB communication. ' +
      'SPI: D11(MOSI), D12(MISO), D13(SCK), D10(SS). I2C: A4(SDA), A5(SCL). ' +
      'Built-in LED on D13. Reset button and auto-reset on serial connection. ' +
      'ICSP header for direct ATmega328P programming. 3.3V output from regulator (50mA max).',
    tags: ['arduino', 'uno', 'board', 'pinout', 'gpio', 'pwm', 'adc'],
  },
  {
    id: 'kb-arduino-mega',
    title: 'Arduino Mega 2560 Board Reference',
    category: 'microcontroller',
    content:
      'Arduino Mega 2560 is based on ATmega2560 with 256KB flash, 8KB SRAM, 4KB EEPROM. ' +
      'Digital I/O: 54 pins, 15 provide PWM. Analog inputs: 16 pins (A0-A15), 10-bit ADC. ' +
      'Power: USB or DC jack (7-12V), same as Uno. Per-pin limit: 20mA, total 200mA. ' +
      '4 hardware UARTs: Serial(D0/D1), Serial1(D18/D19), Serial2(D16/D17), Serial3(D14/D15). ' +
      'SPI: D50(MISO), D51(MOSI), D52(SCK), D53(SS). I2C: D20(SDA), D21(SCL). ' +
      'External interrupts: 6 pins (D2,D3,D18,D19,D20,D21). Timer resources: 6 timers. ' +
      'Ideal for projects needing many I/O pins: LED matrices, multiple sensors, CNC controllers, 3D printers. ' +
      'Pin-compatible with Uno shields on D0-D13 and A0-A5. Form factor is longer (101.52mm x 53.3mm).',
    tags: ['arduino', 'mega', '2560', 'board', 'pinout', 'uart', 'gpio'],
  },
  {
    id: 'kb-l293d',
    title: 'L293D Motor Driver IC',
    category: 'motor-driver',
    content:
      'The L293D is a dual H-bridge motor driver IC with built-in flyback diodes (L293D) or without (L293). ' +
      'Can drive 2 DC motors or 1 stepper motor. Per channel: 600mA continuous, 1.2A peak. ' +
      'Supply: Vcc1 (logic, 5V), Vcc2 (motor supply, 4.5-36V). Logic inputs are TTL compatible. ' +
      'Pin functions: EN1,2 (enable channels 1-2), IN1,IN2 (direction channel 1), IN3,IN4 (direction channel 2), ' +
      'OUT1-OUT4 (motor outputs). Enable LOW = outputs high-impedance (coast). ' +
      'Direction control: IN1=H,IN2=L → forward; IN1=L,IN2=H → reverse; both same = brake. ' +
      'PWM speed control: apply PWM to enable pin (not input pins) for smooth speed control. ' +
      'Voltage drop: ~1.4V per side (saturation), so motor sees Vmotor - 2.8V. ' +
      'Heat dissipation: pins 4,5,12,13 are GND and thermal pad — solder to ground plane for heatsinking.',
    tags: ['l293d', 'h-bridge', 'motor-driver', 'dc-motor', 'stepper', 'pwm'],
  },
  {
    id: 'kb-l298n',
    title: 'L298N Motor Driver Module',
    category: 'motor-driver',
    content:
      'The L298N is a dual full H-bridge driver with 2A per channel (4A peak). ' +
      'Motor supply: 5-46V. Built-in 5V regulator (78M05) when motor supply is 7-12V — can power Arduino. ' +
      'Remove jumper on 5V regulator when motor supply exceeds 12V and provide separate 5V logic power. ' +
      'Direction: IN1/IN2 for motor A, IN3/IN4 for motor B. Same truth table as L293D. ' +
      'Speed control: PWM on ENA (motor A) and ENB (motor B). Jumpers on EN pins = full speed. ' +
      'Voltage drop: ~2V total (higher than L293D due to bipolar transistors). ' +
      'For low-voltage motors (3-6V), the voltage drop is significant — consider MOSFET-based drivers instead. ' +
      'Sense resistors (0.5 ohm) on each channel for current sensing if needed. ' +
      'Common module includes screw terminals and header pins for easy breadboard prototyping.',
    tags: ['l298n', 'h-bridge', 'motor-driver', 'dc-motor', 'stepper', 'module'],
  },
  {
    id: 'kb-lm358',
    title: 'LM358 Dual Op-Amp',
    category: 'op-amp',
    content:
      'The LM358 is a dual general-purpose operational amplifier. Single or dual supply: 3-32V (single), +-1.5 to +-16V (dual). ' +
      'Unity-gain bandwidth: 1MHz. Slew rate: 0.3V/us. Input offset voltage: 2mV typical. ' +
      'Output can swing to within ~1.5V of V+ and down to ground (single supply). ' +
      'Inverting amplifier: Vout = -Vin * (Rf/Rin). Non-inverting: Vout = Vin * (1 + Rf/Rin). ' +
      'Voltage follower (buffer): connect output to inverting input, gain = 1, high input impedance. ' +
      'Comparator use: output goes high when non-inverting > inverting (but dedicated comparators like LM393 are faster). ' +
      'Limitations: crossover distortion near 0V output, low bandwidth, not rail-to-rail output at V+. ' +
      'For audio or precision: consider MCP6002 (rail-to-rail), OPA2134 (audio grade), or AD8628 (precision).',
    tags: ['lm358', 'op-amp', 'amplifier', 'comparator', 'inverting', 'non-inverting', 'buffer'],
  },
  {
    id: 'kb-lm741',
    title: 'LM741 Op-Amp (Classic Reference)',
    category: 'op-amp',
    content:
      'The LM741 is the classic single op-amp, primarily used for educational reference. ' +
      'Dual supply: +-5V to +-18V. Unity-gain bandwidth: 1MHz. Slew rate: 0.5V/us. ' +
      'Input offset voltage: 1-5mV. Input bias current: 80nA typical. ' +
      'Output swing: within ~2V of supply rails. Output current: ~25mA short-circuit protected. ' +
      'Common configurations: inverting amp, non-inverting amp, voltage follower, difference amplifier, ' +
      'summing amplifier, integrator (Rf and Cin), differentiator (Rin and Cf). ' +
      'Frequency compensation: internally compensated (no external capacitor needed). ' +
      'Offset null: pins 1 and 5 with 10K potentiometer to V- for zero adjustment. ' +
      'Modern replacements: TL071 (JFET input, lower noise), NE5532 (audio), OPA2277 (precision). ' +
      'The LM741 is no longer recommended for new designs due to poor specs vs modern alternatives.',
    tags: ['lm741', '741', 'op-amp', 'amplifier', 'classic', 'educational'],
  },
  {
    id: 'kb-power-supply-design',
    title: 'Power Supply Design Best Practices',
    category: 'design-practice',
    content:
      'Linear regulators: simple, low noise, but inefficient when Vin >> Vout. Efficiency = Vout/Vin. ' +
      'Switching regulators: 85-95% efficient, but generate switching noise. Buck (step-down), boost (step-up), ' +
      'buck-boost (both). Use when Vin-Vout > 3V and current > 500mA to avoid excessive heat. ' +
      'Decoupling strategy: 100nF ceramic at every IC VCC pin, 10uF bulk cap at board power entry, ' +
      '1uF near sensitive analog circuits. Place caps as close as possible to IC pins. ' +
      'Ripple calculation: for linear, ripple ≈ Iload / (f * C) where f=rectifier frequency. ' +
      'For switching: output ripple ≈ deltaI * ESR (dominated by capacitor ESR). ' +
      'Ground plane: use solid copper pour for GND, avoid routing signals through ground gaps. ' +
      'Separate analog and digital grounds, connect at a single point near the ADC. ' +
      'Protection: input reverse polarity (P-MOSFET or series Schottky), TVS diode for ESD, ' +
      'fuse or PTC resettable fuse for overcurrent.',
    tags: ['power-supply', 'decoupling', 'linear', 'switching', 'buck', 'boost', 'regulation', 'ground'],
  },
  {
    id: 'kb-led-driving',
    title: 'LED Driving and Current Limiting',
    category: 'design-practice',
    content:
      'LEDs require current limiting — never connect directly to a voltage source without a resistor. ' +
      'Series resistor: R = (Vsupply - Vf) / If. Typical Vf: Red=1.8V, Green=2.2V, Blue/White=3.0-3.4V. ' +
      'Typical If: standard 5mm LED = 20mA, high-brightness = 20mA, SMD indicator = 5-10mA. ' +
      'For multiple LEDs: series connection shares current (same If, voltages add), ' +
      'parallel requires individual resistors per LED (never share a single resistor). ' +
      'GPIO driving: most MCU pins can source 20mA. For more current, use a transistor switch. ' +
      'PWM brightness control: LED brightness is perceived logarithmically — use gamma correction table ' +
      'for smooth dimming (not linear PWM values). ' +
      'High-power LEDs (>1W): use constant-current driver (e.g., LM3414, AL8805), not a resistor. ' +
      'Reverse voltage protection: most LEDs tolerate only 5V reverse — add protection diode if needed.',
    tags: ['led', 'current-limiting', 'resistor', 'pwm', 'brightness', 'driving'],
  },
  {
    id: 'kb-i2c-protocol',
    title: 'I2C Communication Protocol',
    category: 'communication',
    content:
      'I2C (Inter-Integrated Circuit) uses two wires: SDA (data) and SCL (clock), both open-drain with pull-ups. ' +
      'Pull-up resistors: 4.7K for standard mode (100kHz), 2.2K for fast mode (400kHz), 1K for fast-mode+ (1MHz). ' +
      'Addressing: 7-bit (128 addresses, ~112 usable) or 10-bit (rare). Some addresses reserved (0x00 general call). ' +
      'Transaction: START → address byte (7-bit addr + R/W bit) → ACK → data bytes → STOP. ' +
      'Common devices: sensors (BME280=0x76/0x77, MPU6050=0x68/0x69), displays (SSD1306 OLED=0x3C/0x3D), ' +
      'EEPROM (AT24C256=0x50-0x57), RTC (DS3231=0x68), ADC (ADS1115=0x48-0x4B). ' +
      'Bus capacitance limit: 400pF total. Long wires or many devices may need lower pull-ups or bus buffers. ' +
      'Debugging: use logic analyzer on SDA/SCL. Check for address conflicts with I2C scanner sketch. ' +
      'Level shifting: needed between 3.3V and 5V devices — use BSS138 MOSFET level shifter or dedicated IC.',
    tags: ['i2c', 'protocol', 'sda', 'scl', 'pull-up', 'address', 'communication'],
  },
  {
    id: 'kb-spi-protocol',
    title: 'SPI Communication Protocol',
    category: 'communication',
    content:
      'SPI (Serial Peripheral Interface) uses 4 wires: MOSI (master out), MISO (master in), ' +
      'SCK (clock), CS/SS (chip select, active low). Full duplex, no addressing — CS selects device. ' +
      'Clock modes (CPOL, CPHA): Mode 0 (0,0) most common, Mode 3 (1,1) also widely used. ' +
      'Speed: typically 1-50MHz, some devices support up to 80MHz. Much faster than I2C. ' +
      'Multi-device: separate CS pin per device, shared MOSI/MISO/SCK. ' +
      'Common devices: SD cards (Mode 0, max 25MHz in SPI mode), displays (ILI9341 TFT), ' +
      'ADCs (MCP3008), DACs (MCP4921), Flash memory (W25Q series), RF modules (nRF24L01). ' +
      'Wiring: keep traces short at high speeds, add series termination resistors (33-100 ohm) on MOSI/SCK ' +
      'for long runs. CS must be driven LOW before transaction and HIGH after. ' +
      'Daisy chaining: possible with some devices (shift register style) to reduce CS pin count.',
    tags: ['spi', 'protocol', 'mosi', 'miso', 'sck', 'chip-select', 'communication'],
  },
  {
    id: 'kb-uart-serial',
    title: 'UART/Serial Communication',
    category: 'communication',
    content:
      'UART (Universal Asynchronous Receiver/Transmitter) is point-to-point serial communication. ' +
      'Two wires: TX (transmit) and RX (receive), crossed between devices (TX→RX, RX→TX). ' +
      'Common baud rates: 9600, 19200, 38400, 57600, 115200. Both sides must match exactly. ' +
      'Frame format: start bit (LOW) → 8 data bits (LSB first) → optional parity → stop bit(s) (HIGH). ' +
      'Most common: 8N1 (8 data bits, no parity, 1 stop bit). ' +
      'Logic levels: TTL (0V/3.3V or 0V/5V) from MCU, RS-232 (+-3-15V) from PC serial ports. ' +
      'Level conversion: MAX232/MAX3232 for RS-232↔TTL. USB-to-serial: CH340, CP2102, FT232R. ' +
      'Flow control: hardware (RTS/CTS) or software (XON/XOFF). Most hobbyist projects skip flow control. ' +
      'Debugging: use serial monitor (Arduino IDE, PuTTY, minicom). Check baud rate, logic levels, TX/RX crossover. ' +
      'Buffer: MCU UART hardware buffers are small (1-4 bytes typically) — use interrupts or DMA for reliability.',
    tags: ['uart', 'serial', 'rs232', 'ttl', 'baud', 'tx', 'rx', 'communication'],
  },
  {
    id: 'kb-diode-basics',
    title: 'Diode Types and Applications',
    category: 'active',
    content:
      'Diodes allow current flow in one direction. Forward voltage Vf varies by type. ' +
      'Signal diodes (1N4148): Vf=0.7V, fast switching (<4ns), small signal rectification, clamping. ' +
      'Power rectifiers (1N4001-1N4007): Vf=1.0V, current 1A. 1N4007 handles up to 1000V PIV. ' +
      'Schottky diodes (1N5817-1N5819): low Vf=0.3-0.5V, fast, ideal for power supply rectification and protection. ' +
      'Zener diodes: reverse breakdown at specific voltage (3.3V, 5.1V, etc.) for voltage clamping/regulation. ' +
      'TVS diodes: transient voltage suppressors for ESD and surge protection on I/O lines. ' +
      'LEDs: light-emitting diodes (covered in separate entry). ' +
      'Applications: reverse polarity protection (series Schottky or P-MOSFET), flyback/freewheeling diode ' +
      'across inductors/relays, voltage clamping, half/full-bridge rectification, OR-ing power supplies. ' +
      'Reverse recovery time matters in switching circuits — Schottky has no recovery time (majority carrier).',
    tags: ['diode', 'rectifier', 'schottky', 'zener', 'tvs', '1n4148', '1n4007', 'protection'],
  },
  {
    id: 'kb-pcb-design-rules',
    title: 'PCB Design Rules for Beginners',
    category: 'design-practice',
    content:
      'Trace width: use online calculator. For 1oz copper on outer layer: 10mil (0.254mm) handles ~300mA, ' +
      '20mil handles ~800mA, 40mil handles ~1.7A. Power traces wider, signal traces can be thinner (6-8mil min). ' +
      'Clearance: minimum 6mil (0.15mm) for most fabs, 8mil recommended. High voltage needs more clearance. ' +
      'Via size: 0.3mm drill / 0.6mm pad typical. Smaller vias cost more. Avoid vias in pads unless tent/fill. ' +
      'Ground plane: use copper fill on bottom layer (2-layer) or inner layers (4-layer) for solid GND return. ' +
      'Component placement: group by function, minimize trace lengths, place decoupling caps near IC pins. ' +
      'Signal integrity: keep high-speed traces short, use ground plane reference, avoid 90-degree trace bends ' +
      '(use 45-degree or curved), match trace lengths for differential pairs. ' +
      'Design for manufacturing (DFM): check fab capabilities before designing. JLCPCB minimums: ' +
      '6mil trace/space, 0.3mm via drill, 0.8mm board thickness, 4-layer at affordable price. ' +
      'Silkscreen: label all connectors, polarity marks on diodes/caps, version number and date on board.',
    tags: ['pcb', 'design-rules', 'trace', 'via', 'ground-plane', 'dfm', 'clearance', 'manufacturing'],
  },
  {
    id: 'kb-esp8266',
    title: 'ESP8266 WiFi Module',
    category: 'microcontroller',
    content:
      'The ESP8266 is a low-cost WiFi SoC with TCP/IP stack. Runs at 80/160MHz, 80KB data RAM, 4MB flash (typical). ' +
      'WiFi: 802.11 b/g/n, station + soft AP modes, WPA2 support. ' +
      'GPIO: limited compared to ESP32 — 17 GPIO total but many are reserved (boot pins, flash interface). ' +
      'Usable GPIO: GPIO0, 2, 4, 5, 12, 13, 14, 15, 16. GPIO16 is special (can wake from deep sleep). ' +
      'ADC: 1 channel, 10-bit, 0-1V input range (voltage divider needed for higher voltages). ' +
      'Operating voltage: 3.3V only, NOT 5V tolerant. Provide stable 3.3V supply with >=500mA capability. ' +
      'Boot mode: GPIO0=HIGH for normal, GPIO0=LOW for flash download. GPIO15 must be LOW at boot. ' +
      'Popular modules: ESP-01 (2 GPIO only), ESP-12E/F (most GPIO broken out, used on NodeMCU/Wemos D1). ' +
      'Power consumption: ~70mA average WiFi, 170mA peak TX, 20uA deep sleep. Decouple with 100uF + 100nF.',
    tags: ['esp8266', 'wifi', 'nodemcu', 'wemos', 'iot', 'wireless', 'microcontroller'],
  },
];

/**
 * Returns all knowledge entries formatted as documents suitable
 * for the RAG engine's `addDocument()` method.
 */
export function getKnowledgeDocuments(): Array<{
  id: string;
  title: string;
  source: string;
  content: string;
  metadata: Record<string, string>;
}> {
  return KNOWLEDGE_BASE.map((entry) => ({
    id: entry.id,
    title: entry.title,
    source: 'built-in-knowledge',
    content: entry.content,
    metadata: {
      category: entry.category,
      tags: entry.tags.join(','),
    },
  }));
}
