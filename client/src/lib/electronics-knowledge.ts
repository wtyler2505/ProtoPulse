/**
 * Electronics Knowledge Base
 *
 * Curated electronics reference library for beginners and intermediates.
 * Provides searchable articles covering fundamental electronics topics
 * from passive components to PCB design and communication protocols.
 *
 * Usage:
 *   const kb = ElectronicsKnowledgeBase.getInstance();
 *   const results = kb.search('resistor voltage divider');
 *   const article = kb.getArticle('resistors');
 *
 * React hook:
 *   const { search, getArticle, getByCategory } = useKnowledgeBase();
 */

import { useCallback, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArticleCategory =
  | 'passive-components'
  | 'active-components'
  | 'power'
  | 'communication'
  | 'pcb'
  | 'techniques';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: ArticleCategory;
  difficulty: DifficultyLevel;
  content: string;
  relatedTopics: string[];
  tags: string[];
}

// ---------------------------------------------------------------------------
// Built-in Articles
// ---------------------------------------------------------------------------

const BUILT_IN_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'resistors',
    title: 'Resistors',
    category: 'passive-components',
    difficulty: 'beginner',
    content: `# Resistors

A resistor limits the flow of electric current. It is the most fundamental passive component.

## Ohm's Law
**V = I x R** — Voltage (V) equals Current (I) times Resistance (R).

## Color Code
Resistors use colored bands to indicate their value:
- **4-band**: 2 digits + multiplier + tolerance
- **5-band**: 3 digits + multiplier + tolerance

## Common Values (E12 series)
10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82 (and their decades)

## Power Rating
Every resistor has a maximum power dissipation: **P = I^2 x R**. Exceeding this causes overheating. Common ratings: 1/8W, 1/4W, 1/2W, 1W.

## Types
- **Carbon film**: Cheap, general purpose
- **Metal film**: Low noise, tighter tolerance (1%)
- **Wirewound**: High power applications
- **SMD**: Surface mount, compact`,
    relatedTopics: ['voltage-dividers', 'pull-up-pull-down', 'capacitors'],
    tags: ['resistance', 'ohm', 'passive', 'color code', 'E12', 'power rating'],
  },
  {
    id: 'capacitors',
    title: 'Capacitors',
    category: 'passive-components',
    difficulty: 'beginner',
    content: `# Capacitors

A capacitor stores electrical energy in an electric field between two conductive plates.

## Key Formula
**Q = C x V** — Charge equals Capacitance times Voltage.

## Behavior
- Blocks DC, passes AC
- Charges/discharges over time (RC time constant: **tau = R x C**)
- Impedance decreases with frequency: **Xc = 1 / (2 * pi * f * C)**

## Common Types
- **Ceramic (MLCC)**: Small, cheap, non-polarized. Use for decoupling and high-frequency.
- **Electrolytic**: High capacitance, polarized. Use for power supply filtering.
- **Tantalum**: Stable, polarized. Compact alternative to electrolytic.
- **Film**: Low loss, non-polarized. Use for audio and timing circuits.

## Reading Values
- Ceramic caps often use a 3-digit code: first two digits + number of zeros in pF (e.g., 104 = 100,000 pF = 100 nF = 0.1 uF)
- Electrolytics are printed directly in uF

## Voltage Rating
Always use a capacitor rated for at least 1.5x your working voltage.`,
    relatedTopics: ['decoupling-capacitors', 'rc-lc-filters', 'resistors'],
    tags: ['capacitance', 'farad', 'passive', 'decoupling', 'filtering', 'charge', 'RC'],
  },
  {
    id: 'inductors',
    title: 'Inductors',
    category: 'passive-components',
    difficulty: 'intermediate',
    content: `# Inductors

An inductor stores energy in a magnetic field when current flows through a coil of wire.

## Key Formula
**V = L x (dI/dt)** — Voltage across an inductor equals inductance times the rate of change of current.

## Behavior
- Opposes changes in current (inertia for electrons)
- Passes DC, blocks AC (opposite of capacitors)
- Impedance increases with frequency: **XL = 2 * pi * f * L**

## Common Uses
- **Switching power supplies**: Energy storage element in buck/boost converters
- **Filters**: Combined with capacitors for LC low-pass, high-pass, and band-pass filters
- **EMI suppression**: Ferrite beads (a type of inductor) block high-frequency noise
- **Transformers**: Two coupled inductors for voltage conversion

## Key Parameters
- **Inductance** (henries): How much energy is stored per amp
- **DC Resistance (DCR)**: Wire resistance, causes heat
- **Saturation current**: Maximum current before inductance drops
- **Self-resonant frequency (SRF)**: Above this, inductor acts like a capacitor`,
    relatedTopics: ['rc-lc-filters', 'capacitors', 'resistors'],
    tags: ['inductance', 'henry', 'passive', 'coil', 'magnetic field', 'EMI', 'transformer'],
  },
  {
    id: 'diodes',
    title: 'Diodes',
    category: 'active-components',
    difficulty: 'beginner',
    content: `# Diodes

A diode allows current to flow in one direction only (anode to cathode).

## Forward Voltage Drop
- **Silicon**: ~0.7V
- **Schottky**: ~0.2-0.4V
- **LED**: ~1.8-3.3V (depends on color)

## Common Types
- **Rectifier**: Converts AC to DC (1N4001 series)
- **Schottky**: Fast switching, low drop (1N5817 series)
- **Zener**: Voltage regulation — conducts in reverse at a specific voltage
- **LED**: Emits light when forward biased
- **TVS**: Transient voltage suppressor for ESD protection

## Key Applications
- **Rectification**: AC to DC conversion (bridge rectifier = 4 diodes)
- **Reverse polarity protection**: Prevents damage from backwards power connection
- **Flyback protection**: Across relay/motor coils to absorb voltage spikes
- **Voltage clamping**: Limit voltage to a safe range`,
    relatedTopics: ['transistors', 'voltage-regulators', 'h-bridges'],
    tags: ['diode', 'LED', 'rectifier', 'Schottky', 'Zener', 'forward voltage', 'active'],
  },
  {
    id: 'transistors',
    title: 'Transistors (BJT)',
    category: 'active-components',
    difficulty: 'intermediate',
    content: `# Transistors (BJT)

A Bipolar Junction Transistor (BJT) is a current-controlled switch/amplifier with three terminals: Base, Collector, Emitter.

## Types
- **NPN** (most common): Current flows from Collector to Emitter when Base current is applied. Common: 2N2222, 2N3904, BC547.
- **PNP**: Current flows from Emitter to Collector. Common: 2N2907, 2N3906, BC557.

## Operating Regions
1. **Cutoff**: No base current, transistor is OFF (switch open)
2. **Saturation**: Maximum base current, transistor is fully ON (switch closed). Vce_sat ~ 0.2V.
3. **Active**: Linear region, used for amplification. Ic = beta x Ib.

## As a Switch (Digital)
To switch a load (LED, relay, motor):
1. Calculate base resistor: **Rb = (Vcontrol - 0.7V) / Ib**
2. Ensure Ib provides enough current: **Ib >= Ic / beta** (use beta/10 for hard saturation)

## Current Gain (beta / hFE)
Typical values: 100-300. Varies with temperature and current. Never rely on exact beta — design for worst case.`,
    relatedTopics: ['mosfets', 'diodes', 'h-bridges', 'pull-up-pull-down'],
    tags: ['BJT', 'NPN', 'PNP', 'transistor', 'switch', 'amplifier', 'base', 'collector', 'emitter', 'active'],
  },
  {
    id: 'mosfets',
    title: 'MOSFETs',
    category: 'active-components',
    difficulty: 'intermediate',
    content: `# MOSFETs

A MOSFET (Metal-Oxide-Semiconductor Field-Effect Transistor) is a voltage-controlled switch. Three terminals: Gate, Drain, Source.

## Types
- **N-channel (NMOS)**: Most common. Turns ON when Vgs > Vth. Placed on the low side (between load and GND).
- **P-channel (PMOS)**: Turns ON when Vgs < -|Vth|. Placed on the high side (between supply and load).

## Key Parameters
- **Vth (threshold voltage)**: Minimum Vgs to turn ON (typically 1-4V, or "logic-level" at 1.5-2.5V)
- **Rds(on)**: Drain-source resistance when fully ON (lower = less heat)
- **Id(max)**: Maximum continuous drain current
- **Vds(max)**: Maximum drain-source voltage

## Logic-Level vs Standard Gate
- **Logic-level MOSFETs**: Fully ON at 3.3V or 5V gate drive (for Arduino/ESP32 projects)
- **Standard gate**: Need 10V+ gate drive (require gate driver circuit)

## Common MOSFETs
- **IRLZ44N**: N-channel, logic-level, 47A, 55V — great for Arduino projects
- **IRF540N**: N-channel, standard gate, 33A, 100V
- **IRF9540N**: P-channel, standard gate

## Gate Protection
MOSFET gates are extremely sensitive to ESD. Add a 10K-100K pull-down resistor and optionally a 12V Zener diode for protection.`,
    relatedTopics: ['transistors', 'h-bridges', 'pwm', 'voltage-regulators'],
    tags: ['MOSFET', 'FET', 'N-channel', 'P-channel', 'gate', 'drain', 'source', 'Rds', 'logic-level', 'active'],
  },
  {
    id: 'voltage-regulators',
    title: 'Voltage Regulators',
    category: 'power',
    difficulty: 'beginner',
    content: `# Voltage Regulators

A voltage regulator maintains a constant output voltage regardless of input voltage variations or load changes.

## Linear Regulators
Convert excess voltage to heat. Simple but inefficient.
- **78xx series**: Fixed positive output (7805 = 5V, 7812 = 12V). Dropout ~2V.
- **LM1117/AMS1117**: Low-dropout (LDO), 1.2V dropout. Common for 3.3V.
- **LM317**: Adjustable output via two resistors. Vout = 1.25 * (1 + R2/R1).

## Switching Regulators
Use inductors to convert voltage efficiently (85-95%+). Generate more noise.
- **Buck**: Steps voltage down (12V to 5V)
- **Boost**: Steps voltage up (3.3V to 5V)
- **Buck-Boost**: Can step up or down

## Choosing Between Them
| Factor | Linear | Switching |
|--------|--------|-----------|
| Efficiency | Low (heat) | High (85-95%) |
| Noise | Very low | Higher (switching noise) |
| Cost | Cheap | More expensive |
| Size | Small | Larger (inductor) |

## Bypass Capacitors
Always add bypass capacitors on input AND output (typically 10uF electrolytic + 100nF ceramic).`,
    relatedTopics: ['decoupling-capacitors', 'capacitors', 'inductors'],
    tags: ['regulator', 'LDO', '7805', 'buck', 'boost', 'power supply', 'voltage', 'linear', 'switching'],
  },
  {
    id: 'voltage-dividers',
    title: 'Voltage Dividers',
    category: 'passive-components',
    difficulty: 'beginner',
    content: `# Voltage Dividers

A voltage divider uses two resistors in series to produce a fraction of the input voltage.

## Formula
**Vout = Vin x R2 / (R1 + R2)**

Where R1 is connected to Vin and R2 is connected to GND. Vout is measured at the junction.

## Common Uses
- **Level shifting**: Convert 5V signals to 3.3V for ESP32/Raspberry Pi
- **ADC input scaling**: Scale higher voltages to the 0-3.3V ADC range
- **Bias circuits**: Set DC operating points for transistor amplifiers
- **Sensor reading**: Measure resistance of a sensor (thermistor, LDR) using a known reference resistor

## Important Caveats
- A voltage divider is NOT a voltage regulator — output voltage drops under load
- Keep the divider current at least 10x the load current for stable output
- For precise level shifting under load, use a dedicated level shifter or buffer

## Example: 5V to 3.3V
Using R1 = 10K and R2 = 20K: Vout = 5 * 20K / (10K + 20K) = 3.33V`,
    relatedTopics: ['resistors', 'adc-dac', 'voltage-regulators'],
    tags: ['voltage divider', 'resistor', 'level shifting', 'scaling', 'ADC'],
  },
  {
    id: 'pull-up-pull-down',
    title: 'Pull-Up & Pull-Down Resistors',
    category: 'passive-components',
    difficulty: 'beginner',
    content: `# Pull-Up & Pull-Down Resistors

Pull-up and pull-down resistors define a default logic level on a pin when no active device is driving it.

## Pull-Up Resistor
- Connects a pin to VCC through a resistor (typically 4.7K-10K)
- Pin reads HIGH by default
- An active-low switch/device pulls the pin LOW when activated
- Used by: I2C bus (required), buttons (active-low), open-drain outputs

## Pull-Down Resistor
- Connects a pin to GND through a resistor (typically 4.7K-10K)
- Pin reads LOW by default
- An active-high switch/device pulls the pin HIGH when activated
- Used by: buttons (active-high), MOSFET gates (prevent floating)

## Why They Matter
Without a pull-up or pull-down, a disconnected digital input "floats" — picking up noise and randomly reading HIGH or LOW. This causes erratic behavior.

## Typical Values
- **I2C**: 4.7K pull-up to 3.3V or 5V (one pair per bus, not per device)
- **Buttons**: 10K pull-up or pull-down
- **MOSFET gates**: 10K-100K pull-down
- **SPI CS lines**: 10K pull-up (keep deselected by default)

## Internal Pull-Ups
Many microcontrollers (Arduino, ESP32) have built-in pull-ups (20K-50K). Enable with \`pinMode(pin, INPUT_PULLUP)\`. Weaker than external resistors.`,
    relatedTopics: ['resistors', 'i2c', 'mosfets', 'transistors'],
    tags: ['pull-up', 'pull-down', 'resistor', 'floating', 'I2C', 'button', 'logic level'],
  },
  {
    id: 'decoupling-capacitors',
    title: 'Decoupling Capacitors',
    category: 'passive-components',
    difficulty: 'beginner',
    content: `# Decoupling Capacitors

Decoupling (bypass) capacitors are placed near IC power pins to provide local energy reserves and filter noise.

## Why They're Essential
When a digital IC switches, it draws sudden bursts of current. The trace inductance between the IC and the power supply causes voltage dips. A local decoupling cap supplies this instantaneous current, keeping the voltage stable.

## Standard Practice
Place these capacitors as close to each IC's VCC pin as possible:
- **100nF (0.1uF) ceramic**: Filters high-frequency noise. One per IC power pin.
- **10uF electrolytic or ceramic**: Provides bulk charge for larger current demands. One per IC or power rail section.

## Placement Rules
1. As close to the IC VCC pin as physically possible
2. Short, wide traces to VCC and GND
3. Connect directly to the IC's GND pin, not a distant ground pour
4. On the same side of the PCB as the IC (avoid vias if possible)

## Common Mistake
Putting a single large capacitor far from the ICs does NOT work as a substitute — the trace inductance defeats the purpose. You need one small cap per IC, placed close.`,
    relatedTopics: ['capacitors', 'pcb-basics', 'voltage-regulators'],
    tags: ['decoupling', 'bypass', 'capacitor', 'noise', 'filtering', 'PCB', 'power'],
  },
  {
    id: 'h-bridges',
    title: 'H-Bridges',
    category: 'active-components',
    difficulty: 'intermediate',
    content: `# H-Bridges

An H-bridge is a circuit that allows you to drive a DC motor in both directions (forward and reverse) by controlling four switches arranged in an "H" pattern.

## How It Works
Four switches (usually MOSFETs or transistors) surround the motor:
- **S1 + S4 ON**: Current flows left-to-right through the motor (forward)
- **S2 + S3 ON**: Current flows right-to-left (reverse)
- **All OFF**: Motor coasts (freewheeling)
- **S1 + S3 ON** or **S2 + S4 ON**: Short circuit — NEVER do this (shoot-through)

## Speed Control
Apply PWM to the enable pin or to the high-side switches. Typical frequencies: 1kHz-20kHz.

## Common H-Bridge ICs
- **L298N**: Dual H-bridge, up to 2A per channel, but high voltage drop (~2V). Good for learning.
- **L293D**: Dual H-bridge with built-in flyback diodes. 600mA per channel.
- **TB6612FNG**: Modern, efficient, low Rds(on). Up to 1.2A continuous.
- **BTS7960**: High-current single H-bridge (43A). For larger motors.

## Flyback Diodes
Always include flyback diodes across the motor terminals to absorb voltage spikes from the motor's inductance when switching off.`,
    relatedTopics: ['mosfets', 'transistors', 'pwm', 'diodes'],
    tags: ['H-bridge', 'motor', 'driver', 'DC motor', 'PWM', 'L298N', 'TB6612', 'direction control'],
  },
  {
    id: 'rc-lc-filters',
    title: 'RC & LC Filters',
    category: 'passive-components',
    difficulty: 'intermediate',
    content: `# RC & LC Filters

Filters selectively pass or block certain frequencies. They are fundamental to power supplies, audio, and signal processing.

## RC Low-Pass Filter
Passes low frequencies, blocks high frequencies.
- **Cutoff frequency**: fc = 1 / (2 * pi * R * C)
- **Roll-off**: -20 dB/decade (gentle slope)
- **Use case**: Smoothing PWM to analog, noise filtering

## RC High-Pass Filter
Passes high frequencies, blocks DC and low frequencies.
- **Cutoff frequency**: fc = 1 / (2 * pi * R * C)
- **Use case**: AC coupling, removing DC offset, audio treble boost

## LC Low-Pass Filter
Uses inductor + capacitor for sharper filtering.
- **Cutoff frequency**: fc = 1 / (2 * pi * sqrt(L * C))
- **Roll-off**: -40 dB/decade (much sharper than RC)
- **Use case**: Power supply output filtering, RF filtering

## LC Band-Pass Filter
Passes a narrow band of frequencies.
- **Center frequency**: f0 = 1 / (2 * pi * sqrt(L * C))
- **Use case**: Radio tuning, frequency selection

## Practical Tips
- For audio filtering, use 1K-100K resistors and nF-uF capacitors
- For power supply filtering, use larger capacitors (10-100uF) and small inductors
- Higher-order filters (multiple stages) give sharper cutoff`,
    relatedTopics: ['resistors', 'capacitors', 'inductors', 'op-amps'],
    tags: ['filter', 'low-pass', 'high-pass', 'band-pass', 'RC', 'LC', 'cutoff frequency', 'roll-off'],
  },
  {
    id: 'op-amps',
    title: 'Operational Amplifiers (Op-Amps)',
    category: 'active-components',
    difficulty: 'intermediate',
    content: `# Operational Amplifiers (Op-Amps)

An op-amp is a high-gain differential amplifier with two inputs (inverting - and non-inverting +) and one output.

## Ideal Op-Amp Rules
1. **Infinite input impedance**: No current flows into the inputs
2. **Zero output impedance**: Can drive any load
3. **Infinite open-loop gain**: Output = A * (V+ - V-)
4. **Virtual short**: In negative feedback, V+ = V- (the op-amp adjusts its output to make this true)

## Common Configurations
### Non-Inverting Amplifier
Gain = 1 + (Rf / Rin). Output is in phase with input.

### Inverting Amplifier
Gain = -(Rf / Rin). Output is inverted. Input impedance = Rin.

### Voltage Follower (Buffer)
Gain = 1. Output follows input exactly. Provides impedance transformation (high Z in, low Z out).

### Summing Amplifier
Vout = -(Rf/R1 * V1 + Rf/R2 * V2 + ...). Adds multiple signals.

### Comparator
No feedback. Output swings to rail when V+ > V- (HIGH) or V+ < V- (LOW). Use a dedicated comparator IC for better performance.

## Common Op-Amps
- **LM741**: Classic, but slow. Educational use.
- **LM358**: Dual, single-supply, common for hobbyists.
- **MCP6002**: Rail-to-rail, low power, great for battery projects.
- **TL072**: Low noise, good for audio.`,
    relatedTopics: ['resistors', 'rc-lc-filters', 'adc-dac', 'voltage-dividers'],
    tags: ['op-amp', 'amplifier', 'gain', 'inverting', 'non-inverting', 'buffer', 'comparator', 'LM358', 'active'],
  },
  {
    id: 'adc-dac',
    title: 'ADC & DAC',
    category: 'active-components',
    difficulty: 'intermediate',
    content: `# ADC & DAC

ADC (Analog-to-Digital Converter) and DAC (Digital-to-Analog Converter) bridge the analog and digital worlds.

## ADC (Analog-to-Digital)
Converts a continuous voltage into a digital number.

### Key Parameters
- **Resolution**: Number of bits (10-bit = 1024 steps, 12-bit = 4096 steps)
- **Reference voltage (Vref)**: Full-scale voltage. Step size = Vref / 2^N
- **Sample rate**: How fast it reads (Arduino: ~10Ksps, ESP32: ~100Ksps)

### Arduino ADC
- 10-bit resolution (0-1023)
- 5V reference (Vref) — each step = 4.88mV
- \`analogRead(pin)\` returns 0-1023

### ESP32 ADC
- 12-bit resolution (0-4095)
- 3.3V reference — each step = 0.81mV
- Non-linear at extremes (0-100mV and above 3.1V). Use attenuation settings.

## DAC (Digital-to-Analog)
Converts a digital number into a voltage.
- ESP32 has built-in 8-bit DAC (pins 25, 26): 256 voltage levels
- For higher resolution, use external DAC (MCP4725 = 12-bit I2C DAC)
- PWM + RC filter is a cheap alternative to a true DAC

## Common External ADCs
- **ADS1115**: 16-bit, 4-channel, I2C. Great for precision measurements.
- **MCP3008**: 10-bit, 8-channel, SPI. Good for multiple sensor readings.`,
    relatedTopics: ['voltage-dividers', 'i2c', 'spi', 'op-amps'],
    tags: ['ADC', 'DAC', 'analog', 'digital', 'conversion', 'resolution', 'sample rate', 'analogRead'],
  },
  {
    id: 'i2c',
    title: 'I2C (Inter-Integrated Circuit)',
    category: 'communication',
    difficulty: 'intermediate',
    content: `# I2C (Inter-Integrated Circuit)

I2C is a two-wire serial communication protocol for connecting multiple devices on a shared bus.

## Wiring
- **SDA** (Serial Data): Bidirectional data line
- **SCL** (Serial Clock): Clock line driven by the master
- Both lines need **pull-up resistors** (typically 4.7K to VCC)
- Multiple devices share the same two wires

## How It Works
1. Master sends START condition
2. Master sends 7-bit device address + R/W bit
3. Addressed slave sends ACK
4. Data bytes are exchanged (MSB first)
5. Master sends STOP condition

## Addressing
- Each device has a unique 7-bit address (some devices have configurable address pins)
- Standard addresses: 0x00-0x77 (some reserved)
- Use an I2C scanner sketch to find connected devices

## Speed Modes
- **Standard**: 100 kHz
- **Fast**: 400 kHz
- **Fast Plus**: 1 MHz

## Common I2C Devices
- **OLED displays** (SSD1306): 0x3C or 0x3D
- **Temperature sensors** (BME280): 0x76 or 0x77
- **EEPROM** (AT24C32): 0x50-0x57
- **DAC** (MCP4725): 0x60 or 0x61
- **ADC** (ADS1115): 0x48-0x4B
- **IMU** (MPU6050): 0x68 or 0x69

## Limitations
- Short distance (typically < 1 meter)
- Slower than SPI
- Bus can lock up if a slave holds SDA low (fix: toggle SCL manually)`,
    relatedTopics: ['spi', 'uart', 'pull-up-pull-down', 'adc-dac'],
    tags: ['I2C', 'IIC', 'TWI', 'SDA', 'SCL', 'address', 'pull-up', 'bus', 'communication', 'serial'],
  },
  {
    id: 'spi',
    title: 'SPI (Serial Peripheral Interface)',
    category: 'communication',
    difficulty: 'intermediate',
    content: `# SPI (Serial Peripheral Interface)

SPI is a fast, full-duplex serial communication protocol using four wires.

## Wiring
- **MOSI** (Master Out Slave In): Data from master to slave
- **MISO** (Master In Slave Out): Data from slave to master
- **SCK** (Serial Clock): Clock driven by master
- **CS/SS** (Chip Select): Active-low select line — one per slave device

## How It Works
1. Master pulls CS LOW to select a slave
2. Master generates clock on SCK
3. Data is simultaneously sent on MOSI and received on MISO
4. Master pulls CS HIGH to deselect

## SPI Modes (Clock Polarity & Phase)
| Mode | CPOL | CPHA | Description |
|------|------|------|-------------|
| 0 | 0 | 0 | Clock idle LOW, data sampled on rising edge |
| 1 | 0 | 1 | Clock idle LOW, data sampled on falling edge |
| 2 | 1 | 0 | Clock idle HIGH, data sampled on falling edge |
| 3 | 1 | 1 | Clock idle HIGH, data sampled on rising edge |

Most devices use Mode 0. Check the datasheet.

## Speed
Typically 1-80 MHz. Much faster than I2C.

## Common SPI Devices
- **SD card modules**: SPI is the simplest interface for SD cards
- **Displays** (ILI9341, ST7789): Fast enough for graphics
- **ADCs** (MCP3008): 8-channel, 10-bit
- **Flash memory** (W25Q): External storage

## SPI vs I2C
| Factor | SPI | I2C |
|--------|-----|-----|
| Speed | Fast (MHz) | Slower (kHz) |
| Wires | 4+ (1 CS per slave) | 2 |
| Duplex | Full | Half |
| Addressing | CS pin selection | 7-bit address |`,
    relatedTopics: ['i2c', 'uart', 'adc-dac'],
    tags: ['SPI', 'MOSI', 'MISO', 'SCK', 'CS', 'full-duplex', 'clock', 'serial', 'communication'],
  },
  {
    id: 'uart',
    title: 'UART (Serial Communication)',
    category: 'communication',
    difficulty: 'beginner',
    content: `# UART (Universal Asynchronous Receiver-Transmitter)

UART is the simplest serial communication protocol — just two wires, no clock signal.

## Wiring
- **TX** (Transmit): Data output
- **RX** (Receive): Data input
- Cross-connect: Device A TX -> Device B RX, and vice versa
- Both devices must share a common GND

## Configuration
Both sides must agree on:
- **Baud rate**: Speed in bits per second. Common: 9600, 115200
- **Data bits**: Usually 8
- **Parity**: None, Even, or Odd (usually None)
- **Stop bits**: 1 or 2 (usually 1)
- Common notation: "8N1" (8 data, No parity, 1 stop)

## Common Uses
- **Serial Monitor**: Arduino/ESP32 debug output via USB
- **GPS modules**: Output NMEA sentences at 9600 baud
- **Bluetooth modules** (HC-05/HC-06): Wireless UART bridge
- **ESP32 <-> Arduino**: Direct communication between boards

## Voltage Levels
- **TTL (5V)**: Arduino Uno, Mega
- **3.3V**: ESP32, Raspberry Pi, most modern chips
- **RS-232**: +/-12V (old computers) — use MAX232 level shifter

## Important Notes
- No clock = no synchronization. Both sides must use the exact same baud rate.
- UART is point-to-point (one-to-one). For multi-device, use I2C or SPI.
- Maximum practical distance: ~15 meters for TTL. Use RS-485 for longer distances.`,
    relatedTopics: ['i2c', 'spi', 'voltage-dividers'],
    tags: ['UART', 'serial', 'TX', 'RX', 'baud rate', 'RS-232', 'communication', 'TTL', '115200', '9600'],
  },
  {
    id: 'pwm',
    title: 'PWM (Pulse Width Modulation)',
    category: 'techniques',
    difficulty: 'beginner',
    content: `# PWM (Pulse Width Modulation)

PWM rapidly switches a digital pin ON and OFF to simulate an analog voltage. The ratio of ON time to total period is the "duty cycle."

## Duty Cycle
- **0%**: Always OFF (0V average)
- **50%**: Half ON, half OFF (half of VCC average)
- **100%**: Always ON (full VCC)
- **Formula**: Duty = (ON time / Period) * 100%

## Arduino PWM
- \`analogWrite(pin, value)\` where value = 0-255
- Default frequency: ~490 Hz (pins 3, 9, 10, 11) or ~980 Hz (pins 5, 6)
- Only specific pins support PWM (marked with ~ on the board)

## ESP32 PWM (LEDC)
- 16 channels, configurable frequency and resolution
- Up to 40 MHz frequency, up to 20-bit resolution
- Any GPIO pin can output PWM

## Common Applications
- **LED dimming**: Control brightness with duty cycle
- **Motor speed control**: Vary average voltage to the motor via H-bridge
- **Servo motors**: Position controlled by pulse width (1ms-2ms within 20ms period)
- **DAC emulation**: PWM + RC low-pass filter creates a smooth analog voltage
- **Buzzer/tone**: Generate audio frequencies

## Choosing Frequency
- **LEDs**: 1kHz+ (avoid visible flicker)
- **Motors**: 20kHz+ (avoid audible whine)
- **Servos**: 50 Hz (fixed, standard for hobby servos)
- **Audio**: Match the desired frequency`,
    relatedTopics: ['h-bridges', 'mosfets', 'rc-lc-filters', 'adc-dac'],
    tags: ['PWM', 'duty cycle', 'analog', 'LED', 'motor', 'servo', 'frequency', 'analogWrite'],
  },
  {
    id: 'pcb-basics',
    title: 'PCB Design Basics',
    category: 'pcb',
    difficulty: 'beginner',
    content: `# PCB Design Basics

A Printed Circuit Board (PCB) mechanically supports and electrically connects components using conductive copper traces on an insulating substrate.

## PCB Layers
- **1-layer**: Simplest, cheapest. Components on top, traces on bottom.
- **2-layer**: Most common for hobbyists. Traces on top and bottom, connected by vias.
- **4+ layer**: Professional designs. Inner layers for power/ground planes. Better signal integrity.

## Key Terminology
- **Trace**: A copper path connecting two points (like a wire)
- **Pad**: Copper area where a component pin is soldered
- **Via**: A plated hole connecting traces on different layers
- **Silkscreen**: Printed text/symbols on the board for reference
- **Solder mask**: Green (or other color) coating that prevents solder bridges
- **Copper pour/fill**: Large copper area, typically used for ground planes

## Design Rules
- **Trace width**: Wider = more current capacity. 0.25mm for signals, 0.5mm+ for power.
- **Clearance**: Minimum space between traces. Typically 0.2mm for low voltage.
- **Via size**: Hole diameter + annular ring. Typical: 0.3mm hole, 0.6mm pad.
- **Component spacing**: Leave room for soldering. 0.5mm between SMD pads minimum.

## PCB Design Workflow
1. **Schematic capture**: Draw the circuit diagram
2. **Footprint assignment**: Map symbols to physical component packages
3. **Board layout**: Place components and route traces
4. **Design Rule Check (DRC)**: Verify no violations
5. **Generate Gerbers**: Manufacturing files (copper layers, drill, mask, silkscreen)
6. **Order**: Send Gerbers to a fabrication house (JLCPCB, PCBWay, OSH Park)`,
    relatedTopics: ['soldering-tips', 'decoupling-capacitors'],
    tags: ['PCB', 'trace', 'via', 'copper', 'Gerber', 'DRC', 'layout', 'routing', 'fabrication'],
  },
  {
    id: 'soldering-tips',
    title: 'Soldering Tips',
    category: 'techniques',
    difficulty: 'beginner',
    content: `# Soldering Tips

Soldering joins electronic components to a PCB using molten metal (solder). Good solder joints are shiny, smooth, and concave (volcano-shaped).

## Essential Equipment
- **Soldering iron**: Temperature-controlled, 60W+ (Hakko FX-888D, Pinecil, TS100)
- **Solder**: 60/40 or 63/37 tin-lead (easier for beginners), or lead-free SAC305
- **Flux**: Cleans oxidation, helps solder flow. Built into flux-core solder.
- **Solder wick / desoldering pump**: For fixing mistakes
- **Helping hands / PCB holder**: Keeps the board steady

## Temperature Settings
- **Leaded solder**: 315-370C (600-700F)
- **Lead-free solder**: 370-400C (700-750F)
- Start lower, increase if solder doesn't flow within 2-3 seconds

## Through-Hole Soldering Steps
1. Insert component through the PCB holes
2. Flip the board, component held in place
3. Touch the iron tip to BOTH the pad and the component lead simultaneously
4. Feed solder into the junction (not onto the iron tip)
5. Wait 1-2 seconds for solder to flow and wick around the joint
6. Remove solder, then remove iron
7. Clip excess lead

## Common Mistakes
- **Cold joint**: Dull, grainy appearance. Reheat and add flux.
- **Too much solder**: Blob instead of cone. Use solder wick to remove excess.
- **Solder bridge**: Unintended connection between adjacent pads. Use solder wick.
- **Lifted pad**: Too much heat/force. Prevention: don't apply pressure, use correct temperature.
- **Component overheating**: Sensitive components (MOSFETs, ICs) — solder quickly, use a socket if possible.

## SMD Soldering
For surface-mount components, use:
- Fine solder (0.5mm or thinner)
- Flux pen (essential for SMD)
- Fine tip on the iron
- Tweezers to hold components
- Hot air station for QFP/BGA packages`,
    relatedTopics: ['pcb-basics'],
    tags: ['soldering', 'iron', 'solder', 'flux', 'desoldering', 'through-hole', 'SMD', 'PCB', 'joint'],
  },
];

// ---------------------------------------------------------------------------
// Component type to article mapping for contextual lookup
// ---------------------------------------------------------------------------

const COMPONENT_ARTICLE_MAP: Record<string, string[]> = {
  resistor: ['resistors', 'voltage-dividers', 'pull-up-pull-down'],
  capacitor: ['capacitors', 'decoupling-capacitors', 'rc-lc-filters'],
  inductor: ['inductors', 'rc-lc-filters'],
  diode: ['diodes'],
  led: ['diodes', 'pwm'],
  transistor: ['transistors', 'h-bridges'],
  bjt: ['transistors'],
  mosfet: ['mosfets', 'h-bridges'],
  fet: ['mosfets'],
  'op-amp': ['op-amps'],
  opamp: ['op-amps'],
  amplifier: ['op-amps'],
  regulator: ['voltage-regulators'],
  ldo: ['voltage-regulators'],
  motor: ['h-bridges', 'pwm', 'mosfets'],
  servo: ['pwm'],
  adc: ['adc-dac', 'voltage-dividers'],
  dac: ['adc-dac'],
  sensor: ['adc-dac', 'i2c', 'spi'],
  display: ['spi', 'i2c'],
  oled: ['i2c'],
  arduino: ['uart', 'pwm', 'adc-dac', 'i2c', 'spi'],
  esp32: ['uart', 'pwm', 'adc-dac', 'i2c', 'spi'],
  microcontroller: ['uart', 'pwm', 'adc-dac', 'i2c', 'spi'],
  mcu: ['uart', 'pwm', 'adc-dac', 'i2c', 'spi'],
  pcb: ['pcb-basics', 'soldering-tips', 'decoupling-capacitors'],
  filter: ['rc-lc-filters', 'capacitors', 'inductors'],
  button: ['pull-up-pull-down'],
  switch: ['pull-up-pull-down', 'transistors', 'mosfets'],
  relay: ['transistors', 'diodes'],
  gps: ['uart'],
  bluetooth: ['uart'],
  wifi: ['spi', 'uart'],
};

// ---------------------------------------------------------------------------
// ElectronicsKnowledgeBase
// ---------------------------------------------------------------------------

/**
 * Searchable electronics knowledge base with curated articles.
 * Singleton instance. Articles are immutable built-in content.
 */
export class ElectronicsKnowledgeBase {
  private static instance: ElectronicsKnowledgeBase | null = null;

  private articles: KnowledgeArticle[];
  private articleIndex: Map<string, KnowledgeArticle>;

  constructor() {
    this.articles = [...BUILT_IN_ARTICLES];
    this.articleIndex = new Map();
    for (const article of this.articles) {
      this.articleIndex.set(article.id, article);
    }
  }

  /** Get or create the singleton instance. */
  static getInstance(): ElectronicsKnowledgeBase {
    if (!ElectronicsKnowledgeBase.instance) {
      ElectronicsKnowledgeBase.instance = new ElectronicsKnowledgeBase();
    }
    return ElectronicsKnowledgeBase.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    ElectronicsKnowledgeBase.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get an article by ID. Returns null if not found. */
  getArticle(id: string): KnowledgeArticle | null {
    return this.articleIndex.get(id) ?? null;
  }

  /** Get all articles. */
  getAllArticles(): KnowledgeArticle[] {
    return [...this.articles];
  }

  /** Get articles by category. */
  getByCategory(category: ArticleCategory): KnowledgeArticle[] {
    return this.articles.filter((a) => a.category === category);
  }

  /** Get articles by difficulty level. */
  getByDifficulty(level: DifficultyLevel): KnowledgeArticle[] {
    return this.articles.filter((a) => a.difficulty === level);
  }

  /** Get related articles for a given article ID. */
  getRelated(articleId: string): KnowledgeArticle[] {
    const article = this.articleIndex.get(articleId);
    if (!article) {
      return [];
    }
    return article.relatedTopics
      .map((topicId) => this.articleIndex.get(topicId))
      .filter((a): a is KnowledgeArticle => a !== undefined);
  }

  /**
   * Full-text search across titles, content, and tags.
   * Case-insensitive keyword matching. Returns articles ranked by relevance
   * (number of keyword matches).
   */
  search(query: string): KnowledgeArticle[] {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return [];
    }

    const keywords = trimmed
      .toLowerCase()
      .split(/\s+/)
      .filter((k) => k.length > 0);

    if (keywords.length === 0) {
      return [];
    }

    const scored: Array<{ article: KnowledgeArticle; score: number }> = [];

    for (const article of this.articles) {
      let score = 0;
      const titleLower = article.title.toLowerCase();
      const contentLower = article.content.toLowerCase();
      const tagsLower = article.tags.map((t) => t.toLowerCase());
      const categoryLower = article.category.toLowerCase();

      for (const keyword of keywords) {
        // Exact title match (highest weight — title IS the keyword)
        if (titleLower === keyword || titleLower === keyword + 's') {
          score += 20;
        } else if (titleLower.includes(keyword)) {
          // Title contains keyword
          score += 10;
        }
        // Tag match (high weight)
        if (tagsLower.some((tag) => tag.includes(keyword))) {
          score += 5;
        }
        // Category match
        if (categoryLower.includes(keyword)) {
          score += 3;
        }
        // Content match
        if (contentLower.includes(keyword)) {
          score += 1;
        }
      }

      if (score > 0) {
        scored.push({ article, score });
      }
    }

    // Sort by score descending, then by title ascending for stability
    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.article.title.localeCompare(b.article.title);
    });

    return scored.map((s) => s.article);
  }

  /**
   * Contextual lookup: given a component type or label, suggest relevant articles.
   * Matches against the component-article mapping and falls back to search.
   */
  suggestForComponent(componentTypeOrLabel: string): KnowledgeArticle[] {
    const normalized = componentTypeOrLabel.trim().toLowerCase();
    if (normalized.length === 0) {
      return [];
    }

    // Try direct mapping first
    const directMatch = COMPONENT_ARTICLE_MAP[normalized];
    if (directMatch) {
      return directMatch
        .map((id) => this.articleIndex.get(id))
        .filter((a): a is KnowledgeArticle => a !== undefined);
    }

    // Try partial matching against map keys
    const partialMatches: string[] = [];
    for (const key of Object.keys(COMPONENT_ARTICLE_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        for (const articleId of COMPONENT_ARTICLE_MAP[key]) {
          if (!partialMatches.includes(articleId)) {
            partialMatches.push(articleId);
          }
        }
      }
    }

    if (partialMatches.length > 0) {
      return partialMatches
        .map((id) => this.articleIndex.get(id))
        .filter((a): a is KnowledgeArticle => a !== undefined);
    }

    // Fall back to full-text search
    return this.search(normalized);
  }

  /** Get all available categories with article counts. */
  getCategories(): Array<{ category: ArticleCategory; count: number }> {
    const counts = new Map<ArticleCategory, number>();
    for (const article of this.articles) {
      counts.set(article.category, (counts.get(article.category) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([category, count]) => ({ category, count }));
  }

  /** Get total number of articles. */
  getArticleCount(): number {
    return this.articles.length;
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the electronics knowledge base in React components.
 * The knowledge base is static content, so no subscription is needed.
 */
export function useKnowledgeBase(): {
  search: (query: string) => KnowledgeArticle[];
  getArticle: (id: string) => KnowledgeArticle | null;
  getByCategory: (category: ArticleCategory) => KnowledgeArticle[];
  getByDifficulty: (level: DifficultyLevel) => KnowledgeArticle[];
  getRelated: (articleId: string) => KnowledgeArticle[];
  suggestForComponent: (componentTypeOrLabel: string) => KnowledgeArticle[];
  getAllArticles: () => KnowledgeArticle[];
  getCategories: () => Array<{ category: ArticleCategory; count: number }>;
  articleCount: number;
} {
  const kb = useMemo(() => ElectronicsKnowledgeBase.getInstance(), []);

  const search = useCallback(
    (query: string) => {
      return kb.search(query);
    },
    [kb],
  );

  const getArticle = useCallback(
    (id: string) => {
      return kb.getArticle(id);
    },
    [kb],
  );

  const getByCategory = useCallback(
    (category: ArticleCategory) => {
      return kb.getByCategory(category);
    },
    [kb],
  );

  const getByDifficulty = useCallback(
    (level: DifficultyLevel) => {
      return kb.getByDifficulty(level);
    },
    [kb],
  );

  const getRelated = useCallback(
    (articleId: string) => {
      return kb.getRelated(articleId);
    },
    [kb],
  );

  const suggestForComponent = useCallback(
    (componentTypeOrLabel: string) => {
      return kb.suggestForComponent(componentTypeOrLabel);
    },
    [kb],
  );

  const getAllArticles = useCallback(() => {
    return kb.getAllArticles();
  }, [kb]);

  const getCategories = useCallback(() => {
    return kb.getCategories();
  }, [kb]);

  return {
    search,
    getArticle,
    getByCategory,
    getByDifficulty,
    getRelated,
    suggestForComponent,
    getAllArticles,
    getCategories,
    articleCount: kb.getArticleCount(),
  };
}
