// ──────────────────────────────────────────────────────────────────
// BL-0455 — AR Overlay for Real-Board Pin Mapping
// ──────────────────────────────────────────────────────────────────
// Manages board layouts (Uno/Nano/Mega/ESP32/NodeMCU/ESP8266/RPi Pico),
// pin overlay projection via perspective transform from 4 calibration
// corners, net/pin highlighting, and pin-type coloring.
// Singleton + subscribe pattern for useSyncExternalStore integration.
// ──────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────

type Listener = () => void;

export type PinType =
  | 'digital'
  | 'analog'
  | 'pwm'
  | 'power'
  | 'ground'
  | 'communication'
  | 'interrupt'
  | 'special';

export interface PinDefinition {
  readonly id: string;
  readonly label: string;
  readonly type: PinType;
  /** Alternate functions (e.g. SPI MOSI, I2C SDA). */
  readonly altFunctions: readonly string[];
  /** Normalized position on board [0..1] x [0..1]. */
  readonly normalizedPosition: { readonly x: number; readonly y: number };
  /** Physical pin number on the IC package (optional). */
  readonly physicalPin?: number;
  /** GPIO number (e.g. ESP32 GPIO2). */
  readonly gpio?: number;
}

export interface BoardLayout {
  readonly id: string;
  readonly name: string;
  readonly manufacturer: string;
  readonly formFactor: { readonly widthMm: number; readonly heightMm: number };
  readonly pins: readonly PinDefinition[];
  readonly imageAspectRatio: number;
}

export interface CalibrationPoint {
  /** Normalized board corner [0..1]. */
  readonly boardCorner: { readonly x: number; readonly y: number };
  /** Screen/image pixel coordinate. */
  readonly screenPoint: { readonly x: number; readonly y: number };
}

export interface CalibrationResult {
  readonly isValid: boolean;
  readonly matrix: readonly number[];
  readonly residualError: number;
}

export interface ProjectedPin {
  readonly pin: PinDefinition;
  readonly screenX: number;
  readonly screenY: number;
  readonly highlighted: boolean;
  readonly color: string;
}

export interface OverlayState {
  readonly activeBoard: BoardLayout | null;
  readonly calibration: CalibrationResult | null;
  readonly highlightedPins: ReadonlySet<string>;
  readonly highlightedNets: ReadonlySet<string>;
  readonly projectedPins: readonly ProjectedPin[];
  readonly pinFilter: PinType | null;
}

// ─── Pin Type Colors ─────────────────────────────────────────────

export const PIN_TYPE_COLORS: Readonly<Record<PinType, string>> = {
  digital: '#4CAF50',
  analog: '#FF9800',
  pwm: '#9C27B0',
  power: '#F44336',
  ground: '#424242',
  communication: '#2196F3',
  interrupt: '#FFEB3B',
  special: '#00BCD4',
};

// ─── Board Layouts ───────────────────────────────────────────────

function makeUnoLayout(): BoardLayout {
  const pins: PinDefinition[] = [];
  // Digital pins 0-13 along top edge
  for (let i = 0; i <= 13; i++) {
    const altFns: string[] = [];
    const types: PinType[] = ['digital'];
    if ([3, 5, 6, 9, 10, 11].includes(i)) {
      altFns.push('PWM');
      types.push('pwm');
    }
    if ([2, 3].includes(i)) {
      altFns.push(`INT${i - 2}`);
      types.push('interrupt');
    }
    if (i === 10) { altFns.push('SPI SS'); }
    if (i === 11) { altFns.push('SPI MOSI'); }
    if (i === 12) { altFns.push('SPI MISO'); }
    if (i === 13) { altFns.push('SPI SCK', 'LED_BUILTIN'); }
    if (i === 0) { altFns.push('UART RX'); }
    if (i === 1) { altFns.push('UART TX'); }

    const commPins = [0, 1, 10, 11, 12, 13];
    const primaryType: PinType = commPins.includes(i) ? 'communication' : types.includes('pwm') ? 'pwm' : 'digital';

    pins.push({
      id: `D${i}`,
      label: `D${i}`,
      type: primaryType,
      altFunctions: altFns,
      normalizedPosition: { x: 0.15 + (i / 13) * 0.7, y: 0.05 },
    });
  }

  // Analog pins A0-A5 along bottom edge
  for (let i = 0; i <= 5; i++) {
    const altFns: string[] = [];
    if (i === 4) { altFns.push('I2C SDA'); }
    if (i === 5) { altFns.push('I2C SCL'); }

    pins.push({
      id: `A${i}`,
      label: `A${i}`,
      type: 'analog',
      altFunctions: altFns,
      normalizedPosition: { x: 0.35 + (i / 5) * 0.5, y: 0.95 },
    });
  }

  // Power pins
  pins.push(
    { id: 'VIN', label: 'VIN', type: 'power', altFunctions: [], normalizedPosition: { x: 0.1, y: 0.95 } },
    { id: '5V', label: '5V', type: 'power', altFunctions: [], normalizedPosition: { x: 0.15, y: 0.95 } },
    { id: '3V3', label: '3.3V', type: 'power', altFunctions: [], normalizedPosition: { x: 0.2, y: 0.95 } },
    { id: 'GND1', label: 'GND', type: 'ground', altFunctions: [], normalizedPosition: { x: 0.25, y: 0.95 } },
    { id: 'GND2', label: 'GND', type: 'ground', altFunctions: [], normalizedPosition: { x: 0.3, y: 0.95 } },
    { id: 'RESET', label: 'RESET', type: 'special', altFunctions: [], normalizedPosition: { x: 0.05, y: 0.05 } },
  );

  return {
    id: 'arduino-uno',
    name: 'Arduino Uno',
    manufacturer: 'Arduino',
    formFactor: { widthMm: 68.6, heightMm: 53.4 },
    pins,
    imageAspectRatio: 68.6 / 53.4,
  };
}

function makeNanoLayout(): BoardLayout {
  const pins: PinDefinition[] = [];
  // Digital D0-D13 along one side
  for (let i = 0; i <= 13; i++) {
    const altFns: string[] = [];
    if ([3, 5, 6, 9, 10, 11].includes(i)) { altFns.push('PWM'); }
    if (i === 0) { altFns.push('UART RX'); }
    if (i === 1) { altFns.push('UART TX'); }
    if (i === 10) { altFns.push('SPI SS'); }
    if (i === 11) { altFns.push('SPI MOSI'); }
    if (i === 12) { altFns.push('SPI MISO'); }
    if (i === 13) { altFns.push('SPI SCK'); }

    const isPwm = [3, 5, 6, 9, 10, 11].includes(i);
    const isComm = [0, 1, 10, 11, 12, 13].includes(i);

    pins.push({
      id: `D${i}`,
      label: `D${i}`,
      type: isComm ? 'communication' : isPwm ? 'pwm' : 'digital',
      altFunctions: altFns,
      normalizedPosition: { x: 0.05, y: 0.1 + (i / 13) * 0.8 },
    });
  }

  // Analog A0-A7 along other side
  for (let i = 0; i <= 7; i++) {
    const altFns: string[] = [];
    if (i === 4) { altFns.push('I2C SDA'); }
    if (i === 5) { altFns.push('I2C SCL'); }

    pins.push({
      id: `A${i}`,
      label: `A${i}`,
      type: 'analog',
      altFunctions: altFns,
      normalizedPosition: { x: 0.95, y: 0.1 + (i / 7) * 0.8 },
    });
  }

  // Power
  pins.push(
    { id: 'VIN', label: 'VIN', type: 'power', altFunctions: [], normalizedPosition: { x: 0.95, y: 0.05 } },
    { id: '5V', label: '5V', type: 'power', altFunctions: [], normalizedPosition: { x: 0.05, y: 0.05 } },
    { id: '3V3', label: '3.3V', type: 'power', altFunctions: [], normalizedPosition: { x: 0.05, y: 0.95 } },
    { id: 'GND', label: 'GND', type: 'ground', altFunctions: [], normalizedPosition: { x: 0.95, y: 0.95 } },
    { id: 'RST', label: 'RST', type: 'special', altFunctions: [], normalizedPosition: { x: 0.5, y: 0.02 } },
  );

  return {
    id: 'arduino-nano',
    name: 'Arduino Nano',
    manufacturer: 'Arduino',
    formFactor: { widthMm: 45.0, heightMm: 18.0 },
    pins,
    imageAspectRatio: 45.0 / 18.0,
  };
}

function makeMegaLayout(): BoardLayout {
  const pins: PinDefinition[] = [];
  // Digital 0-53
  for (let i = 0; i <= 53; i++) {
    const altFns: string[] = [];
    const pwmPins = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 44, 45, 46];
    if (pwmPins.includes(i)) { altFns.push('PWM'); }
    if ([2, 3, 18, 19, 20, 21].includes(i)) { altFns.push(`INT${[2, 3, 18, 19, 20, 21].indexOf(i)}`); }
    if (i === 0) { altFns.push('UART0 RX'); }
    if (i === 1) { altFns.push('UART0 TX'); }
    if (i === 14) { altFns.push('UART3 TX'); }
    if (i === 15) { altFns.push('UART3 RX'); }
    if (i === 16) { altFns.push('UART2 TX'); }
    if (i === 17) { altFns.push('UART2 RX'); }
    if (i === 18) { altFns.push('UART1 TX'); }
    if (i === 19) { altFns.push('UART1 RX'); }
    if (i === 20) { altFns.push('I2C SDA'); }
    if (i === 21) { altFns.push('I2C SCL'); }
    if (i === 50) { altFns.push('SPI MISO'); }
    if (i === 51) { altFns.push('SPI MOSI'); }
    if (i === 52) { altFns.push('SPI SCK'); }
    if (i === 53) { altFns.push('SPI SS'); }

    const isComm = [0, 1, 14, 15, 16, 17, 18, 19, 20, 21, 50, 51, 52, 53].includes(i);
    const isPwm = pwmPins.includes(i);

    // Distribute pins across top and right edges
    const row = Math.floor(i / 27);
    const col = i % 27;
    const x = row === 0 ? 0.05 + (col / 26) * 0.9 : 0.05 + (col / 26) * 0.9;
    const y = row === 0 ? 0.05 : 0.15;

    pins.push({
      id: `D${i}`,
      label: `${i}`,
      type: isComm ? 'communication' : isPwm ? 'pwm' : 'digital',
      altFunctions: altFns,
      normalizedPosition: { x, y },
    });
  }

  // Analog A0-A15
  for (let i = 0; i <= 15; i++) {
    pins.push({
      id: `A${i}`,
      label: `A${i}`,
      type: 'analog',
      altFunctions: [],
      normalizedPosition: { x: 0.05 + (i / 15) * 0.9, y: 0.95 },
    });
  }

  // Power
  pins.push(
    { id: '5V', label: '5V', type: 'power', altFunctions: [], normalizedPosition: { x: 0.1, y: 0.85 } },
    { id: '3V3', label: '3.3V', type: 'power', altFunctions: [], normalizedPosition: { x: 0.15, y: 0.85 } },
    { id: 'VIN', label: 'VIN', type: 'power', altFunctions: [], normalizedPosition: { x: 0.05, y: 0.85 } },
    { id: 'GND', label: 'GND', type: 'ground', altFunctions: [], normalizedPosition: { x: 0.2, y: 0.85 } },
    { id: 'RESET', label: 'RESET', type: 'special', altFunctions: [], normalizedPosition: { x: 0.02, y: 0.05 } },
  );

  return {
    id: 'arduino-mega',
    name: 'Arduino Mega 2560',
    manufacturer: 'Arduino',
    formFactor: { widthMm: 101.52, heightMm: 53.3 },
    pins,
    imageAspectRatio: 101.52 / 53.3,
  };
}

function makeEsp32Layout(): BoardLayout {
  const pins: PinDefinition[] = [];
  // ESP32 DevKit — GPIO 0-39 (not all exposed)
  const exposedGpios = [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39];
  const adcPins = [32, 33, 34, 35, 36, 39, 25, 26, 27, 14, 12, 13, 15, 2, 4];
  const touchPins = [0, 2, 4, 12, 13, 14, 15, 27, 32, 33];
  const pwmPins = exposedGpios.filter((g) => ![34, 35, 36, 39].includes(g)); // Input-only pins can't do PWM

  exposedGpios.forEach((gpio, idx) => {
    const altFns: string[] = [];
    if (adcPins.includes(gpio)) { altFns.push('ADC'); }
    if (touchPins.includes(gpio)) { altFns.push(`TOUCH${touchPins.indexOf(gpio)}`); }
    if (pwmPins.includes(gpio)) { altFns.push('PWM'); }
    if (gpio === 21) { altFns.push('I2C SDA'); }
    if (gpio === 22) { altFns.push('I2C SCL'); }
    if (gpio === 18) { altFns.push('VSPI SCK'); }
    if (gpio === 19) { altFns.push('VSPI MISO'); }
    if (gpio === 23) { altFns.push('VSPI MOSI'); }
    if (gpio === 5) { altFns.push('VSPI SS'); }
    if (gpio === 1) { altFns.push('UART0 TX'); }
    if (gpio === 3) { altFns.push('UART0 RX'); }
    if (gpio === 16) { altFns.push('UART2 RX'); }
    if (gpio === 17) { altFns.push('UART2 TX'); }
    if (gpio === 25) { altFns.push('DAC1'); }
    if (gpio === 26) { altFns.push('DAC2'); }

    const isAnalog = adcPins.includes(gpio);
    const isComm = [1, 3, 5, 16, 17, 18, 19, 21, 22, 23].includes(gpio);
    const side = idx < 13 ? 'left' : 'right';
    const sideIdx = side === 'left' ? idx : idx - 13;
    const sideCount = side === 'left' ? 13 : exposedGpios.length - 13;

    pins.push({
      id: `GPIO${gpio}`,
      label: `GPIO${gpio}`,
      type: isComm ? 'communication' : isAnalog ? 'analog' : 'digital',
      altFunctions: altFns,
      gpio,
      normalizedPosition: {
        x: side === 'left' ? 0.05 : 0.95,
        y: 0.1 + (sideIdx / (sideCount - 1)) * 0.8,
      },
    });
  });

  // Power
  pins.push(
    { id: 'VIN', label: 'VIN', type: 'power', altFunctions: [], normalizedPosition: { x: 0.05, y: 0.05 } },
    { id: '3V3', label: '3.3V', type: 'power', altFunctions: [], normalizedPosition: { x: 0.95, y: 0.05 } },
    { id: 'GND1', label: 'GND', type: 'ground', altFunctions: [], normalizedPosition: { x: 0.05, y: 0.95 } },
    { id: 'GND2', label: 'GND', type: 'ground', altFunctions: [], normalizedPosition: { x: 0.95, y: 0.95 } },
    { id: 'EN', label: 'EN', type: 'special', altFunctions: ['CHIP_EN'], normalizedPosition: { x: 0.5, y: 0.02 } },
  );

  return {
    id: 'esp32-devkit',
    name: 'ESP32 DevKit V1',
    manufacturer: 'Espressif',
    formFactor: { widthMm: 51.0, heightMm: 28.0 },
    pins,
    imageAspectRatio: 51.0 / 28.0,
  };
}

function makeNodeMcuLayout(): BoardLayout {
  const pins: PinDefinition[] = [];
  // NodeMCU ESP8266 — D0-D8, A0
  const dPinGpio: Record<number, number> = { 0: 16, 1: 5, 2: 4, 3: 0, 4: 2, 5: 14, 6: 12, 7: 13, 8: 15 };

  for (let d = 0; d <= 8; d++) {
    const gpio = dPinGpio[d];
    const altFns: string[] = [`GPIO${gpio}`];
    if (d === 1) { altFns.push('I2C SCL'); }
    if (d === 2) { altFns.push('I2C SDA'); }
    if (d === 5) { altFns.push('SPI SCK'); }
    if (d === 6) { altFns.push('SPI MISO'); }
    if (d === 7) { altFns.push('SPI MOSI'); }
    if (d === 8) { altFns.push('SPI SS'); }

    const isPwm = d !== 0; // D0 (GPIO16) has no PWM
    if (isPwm) { altFns.push('PWM'); }

    const isComm = [1, 2, 5, 6, 7, 8].includes(d);

    pins.push({
      id: `D${d}`,
      label: `D${d}`,
      type: isComm ? 'communication' : 'digital',
      altFunctions: altFns,
      gpio,
      normalizedPosition: { x: d <= 4 ? 0.05 : 0.95, y: 0.1 + ((d <= 4 ? d : d - 5) / 4) * 0.8 },
    });
  }

  // Analog
  pins.push({
    id: 'A0',
    label: 'A0',
    type: 'analog',
    altFunctions: ['ADC'],
    normalizedPosition: { x: 0.05, y: 0.95 },
  });

  // Power
  pins.push(
    { id: 'VIN', label: 'VIN', type: 'power', altFunctions: [], normalizedPosition: { x: 0.95, y: 0.05 } },
    { id: '3V3', label: '3.3V', type: 'power', altFunctions: [], normalizedPosition: { x: 0.05, y: 0.02 } },
    { id: 'GND', label: 'GND', type: 'ground', altFunctions: [], normalizedPosition: { x: 0.95, y: 0.95 } },
    { id: 'RST', label: 'RST', type: 'special', altFunctions: [], normalizedPosition: { x: 0.5, y: 0.02 } },
  );

  return {
    id: 'nodemcu-esp8266',
    name: 'NodeMCU ESP8266',
    manufacturer: 'Espressif',
    formFactor: { widthMm: 58.0, heightMm: 31.0 },
    pins,
    imageAspectRatio: 58.0 / 31.0,
  };
}

function makeEsp8266Layout(): BoardLayout {
  const pins: PinDefinition[] = [];
  // ESP-12E/F module — GPIO 0-16 (subset exposed)
  const exposed = [0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16];

  exposed.forEach((gpio, idx) => {
    const altFns: string[] = [];
    if (gpio === 1) { altFns.push('UART TX'); }
    if (gpio === 3) { altFns.push('UART RX'); }
    if (gpio === 4) { altFns.push('I2C SDA'); }
    if (gpio === 5) { altFns.push('I2C SCL'); }
    if (gpio === 12) { altFns.push('SPI MISO'); }
    if (gpio === 13) { altFns.push('SPI MOSI'); }
    if (gpio === 14) { altFns.push('SPI SCK'); }
    if (gpio === 15) { altFns.push('SPI SS'); }
    if (gpio !== 16) { altFns.push('PWM'); }

    const isComm = [1, 3, 4, 5, 12, 13, 14, 15].includes(gpio);

    pins.push({
      id: `GPIO${gpio}`,
      label: `GPIO${gpio}`,
      type: isComm ? 'communication' : 'digital',
      altFunctions: altFns,
      gpio,
      normalizedPosition: {
        x: idx < 6 ? 0.05 : 0.95,
        y: 0.1 + ((idx < 6 ? idx : idx - 6) / 5) * 0.8,
      },
    });
  });

  pins.push(
    { id: 'ADC', label: 'ADC', type: 'analog', altFunctions: ['TOUT'], normalizedPosition: { x: 0.5, y: 0.05 } },
    { id: 'VCC', label: 'VCC', type: 'power', altFunctions: [], normalizedPosition: { x: 0.05, y: 0.02 } },
    { id: 'GND', label: 'GND', type: 'ground', altFunctions: [], normalizedPosition: { x: 0.95, y: 0.95 } },
    { id: 'RST', label: 'RST', type: 'special', altFunctions: ['EXT_RSTB'], normalizedPosition: { x: 0.5, y: 0.95 } },
  );

  return {
    id: 'esp8266-module',
    name: 'ESP8266 (ESP-12)',
    manufacturer: 'Espressif',
    formFactor: { widthMm: 24.0, heightMm: 16.0 },
    pins,
    imageAspectRatio: 24.0 / 16.0,
  };
}

function makeRPiPicoLayout(): BoardLayout {
  const pins: PinDefinition[] = [];
  // Raspberry Pi Pico — GP0-GP28
  for (let gp = 0; gp <= 28; gp++) {
    const altFns: string[] = [];
    const adcPins = [26, 27, 28];
    // All GPIOs support PWM
    altFns.push('PWM');
    if (gp === 0) { altFns.push('UART0 TX', 'I2C0 SDA', 'SPI0 RX'); }
    if (gp === 1) { altFns.push('UART0 RX', 'I2C0 SCL', 'SPI0 CSn'); }
    if (gp === 2) { altFns.push('I2C1 SDA', 'SPI0 SCK'); }
    if (gp === 3) { altFns.push('I2C1 SCL', 'SPI0 TX'); }
    if (gp === 4) { altFns.push('UART1 TX', 'I2C0 SDA', 'SPI0 RX'); }
    if (gp === 5) { altFns.push('UART1 RX', 'I2C0 SCL', 'SPI0 CSn'); }
    if (gp === 6) { altFns.push('I2C1 SDA', 'SPI0 SCK'); }
    if (gp === 7) { altFns.push('I2C1 SCL', 'SPI0 TX'); }
    if (gp === 8) { altFns.push('UART1 TX', 'I2C0 SDA', 'SPI1 RX'); }
    if (gp === 9) { altFns.push('UART1 RX', 'I2C0 SCL', 'SPI1 CSn'); }
    if (gp === 16) { altFns.push('SPI0 RX'); }
    if (gp === 17) { altFns.push('SPI0 CSn'); }
    if (gp === 18) { altFns.push('SPI0 SCK'); }
    if (gp === 19) { altFns.push('SPI0 TX'); }
    if (adcPins.includes(gp)) { altFns.push('ADC'); }

    const isAnalog = adcPins.includes(gp);

    // Distribute pins along left and right sides
    const side = gp <= 14 ? 'left' : 'right';
    const sideIdx = side === 'left' ? gp : gp - 15;
    const sideCount = side === 'left' ? 15 : 14;

    pins.push({
      id: `GP${gp}`,
      label: `GP${gp}`,
      type: isAnalog ? 'analog' : 'digital',
      altFunctions: altFns,
      gpio: gp,
      normalizedPosition: {
        x: side === 'left' ? 0.05 : 0.95,
        y: 0.05 + (sideIdx / (sideCount - 1)) * 0.9,
      },
    });
  }

  // Power
  pins.push(
    { id: 'VBUS', label: 'VBUS', type: 'power', altFunctions: ['5V USB'], normalizedPosition: { x: 0.05, y: 0.02 } },
    { id: 'VSYS', label: 'VSYS', type: 'power', altFunctions: [], normalizedPosition: { x: 0.95, y: 0.02 } },
    { id: '3V3_OUT', label: '3V3', type: 'power', altFunctions: [], normalizedPosition: { x: 0.95, y: 0.95 } },
    { id: 'GND', label: 'GND', type: 'ground', altFunctions: [], normalizedPosition: { x: 0.05, y: 0.95 } },
    { id: 'RUN', label: 'RUN', type: 'special', altFunctions: ['RESET'], normalizedPosition: { x: 0.5, y: 0.02 } },
    { id: 'ADC_VREF', label: 'ADC_VREF', type: 'special', altFunctions: [], normalizedPosition: { x: 0.5, y: 0.95 } },
  );

  return {
    id: 'rpi-pico',
    name: 'Raspberry Pi Pico',
    manufacturer: 'Raspberry Pi',
    formFactor: { widthMm: 51.0, heightMm: 21.0 },
    pins,
    imageAspectRatio: 51.0 / 21.0,
  };
}

// ─── Perspective Transform ───────────────────────────────────────

/**
 * Compute a 3x3 perspective transform matrix from 4 point correspondences.
 * Maps (boardX, boardY) → (screenX, screenY) via homogeneous coordinates.
 *
 * Uses the DLT (Direct Linear Transform) method: solves 8 equations
 * from 4 pairs of corresponding points.
 *
 * Returns a 9-element row-major matrix [a,b,c, d,e,f, g,h,1].
 */
export function computePerspectiveTransform(
  calibrationPoints: readonly CalibrationPoint[],
): CalibrationResult {
  if (calibrationPoints.length < 4) {
    return { isValid: false, matrix: [], residualError: Infinity };
  }

  const pts = calibrationPoints.slice(0, 4);

  // Build the 8x8 system Ah = b
  // For each point pair (X,Y) → (x,y):
  //   X*a + Y*b + c - X*x*g - Y*x*h = x
  //   X*d + Y*e + f - X*y*g - Y*y*h = y
  const A: number[][] = [];
  const b: number[] = [];

  pts.forEach((p) => {
    const X = p.boardCorner.x;
    const Y = p.boardCorner.y;
    const x = p.screenPoint.x;
    const y = p.screenPoint.y;

    A.push([X, Y, 1, 0, 0, 0, -X * x, -Y * x]);
    b.push(x);
    A.push([0, 0, 0, X, Y, 1, -X * y, -Y * y]);
    b.push(y);
  });

  // Solve via Gaussian elimination with partial pivoting
  const solution = solveLinearSystem(A, b);
  if (!solution) {
    return { isValid: false, matrix: [], residualError: Infinity };
  }

  const matrix = [...solution, 1]; // h[8] = 1

  // Compute residual error (mean reprojection error)
  let totalError = 0;
  pts.forEach((p) => {
    const proj = applyTransformWithMatrix(matrix, p.boardCorner.x, p.boardCorner.y);
    const dx = proj.x - p.screenPoint.x;
    const dy = proj.y - p.screenPoint.y;
    totalError += Math.sqrt(dx * dx + dy * dy);
  });

  const residualError = totalError / pts.length;

  return {
    isValid: residualError < 50, // Allow up to 50px avg error
    matrix,
    residualError,
  };
}

/**
 * Apply a 3x3 perspective matrix to a point, returning screen coords.
 */
function applyTransformWithMatrix(
  matrix: readonly number[],
  bx: number,
  by: number,
): { x: number; y: number } {
  const w = matrix[6] * bx + matrix[7] * by + matrix[8];
  if (Math.abs(w) < 1e-10) {
    return { x: 0, y: 0 };
  }
  return {
    x: (matrix[0] * bx + matrix[1] * by + matrix[2]) / w,
    y: (matrix[3] * bx + matrix[4] * by + matrix[5]) / w,
  };
}

/**
 * Gaussian elimination with partial pivoting for Ax=b.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  // Augmented matrix
  const aug = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-12) {
      return null; // Singular
    }

    // Swap rows
    if (maxRow !== col) {
      const temp = aug[col];
      aug[col] = aug[maxRow];
      aug[maxRow] = temp;
    }

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back substitution
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = aug[row][n];
    for (let col = row + 1; col < n; col++) {
      sum -= aug[row][col] * x[col];
    }
    x[row] = sum / aug[row][row];
  }

  return x;
}

// ─── Board Layout Database ───────────────────────────────────────

const BOARD_LAYOUTS: Map<string, () => BoardLayout> = new Map([
  ['arduino-uno', makeUnoLayout],
  ['arduino-nano', makeNanoLayout],
  ['arduino-mega', makeMegaLayout],
  ['esp32-devkit', makeEsp32Layout],
  ['nodemcu-esp8266', makeNodeMcuLayout],
  ['esp8266-module', makeEsp8266Layout],
  ['rpi-pico', makeRPiPicoLayout],
]);

// ─── ArOverlayManager ────────────────────────────────────────────

export class ArOverlayManager {
  // Singleton
  private static _instance: ArOverlayManager | null = null;

  static getInstance(): ArOverlayManager {
    if (!ArOverlayManager._instance) {
      ArOverlayManager._instance = new ArOverlayManager();
    }
    return ArOverlayManager._instance;
  }

  static resetInstance(): void {
    ArOverlayManager._instance = null;
  }

  // State
  private _activeBoard: BoardLayout | null = null;
  private _calibration: CalibrationResult | null = null;
  private _highlightedPins: Set<string> = new Set();
  private _highlightedNets: Set<string> = new Set();
  private _pinFilter: PinType | null = null;
  private _netPinMapping: Map<string, string[]> = new Map();
  private _listeners: Set<Listener> = new Set();
  private _boardCache: Map<string, BoardLayout> = new Map();

  // ─── Subscribe ────────────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _notify(): void {
    this._listeners.forEach((fn) => { fn(); });
  }

  // ─── Board Management ─────────────────────────────────────────

  getAvailableBoards(): BoardLayout[] {
    return Array.from(BOARD_LAYOUTS.keys()).map((id) => this._resolveBoard(id));
  }

  private _resolveBoard(id: string): BoardLayout {
    const cached = this._boardCache.get(id);
    if (cached) { return cached; }
    const factory = BOARD_LAYOUTS.get(id);
    if (!factory) {
      throw new Error(`Unknown board: ${id}`);
    }
    const layout = factory();
    this._boardCache.set(id, layout);
    return layout;
  }

  getBoardById(id: string): BoardLayout | null {
    const factory = BOARD_LAYOUTS.get(id);
    if (!factory) { return null; }
    return this._resolveBoard(id);
  }

  selectBoard(boardId: string): void {
    const board = this.getBoardById(boardId);
    if (!board) {
      throw new Error(`Unknown board: ${boardId}`);
    }
    this._activeBoard = board;
    this._calibration = null;
    this._highlightedPins.clear();
    this._highlightedNets.clear();
    this._pinFilter = null;
    this._notify();
  }

  getActiveBoard(): BoardLayout | null {
    return this._activeBoard;
  }

  // ─── Calibration ──────────────────────────────────────────────

  calibrate(points: readonly CalibrationPoint[]): CalibrationResult {
    if (!this._activeBoard) {
      return { isValid: false, matrix: [], residualError: Infinity };
    }

    const result = computePerspectiveTransform(points);
    this._calibration = result;
    this._notify();
    return result;
  }

  getCalibration(): CalibrationResult | null {
    return this._calibration;
  }

  /**
   * Create standard 4-corner calibration points given screen coordinates
   * of the board corners (TL, TR, BR, BL).
   */
  createCornerCalibration(
    topLeft: { x: number; y: number },
    topRight: { x: number; y: number },
    bottomRight: { x: number; y: number },
    bottomLeft: { x: number; y: number },
  ): CalibrationResult {
    return this.calibrate([
      { boardCorner: { x: 0, y: 0 }, screenPoint: topLeft },
      { boardCorner: { x: 1, y: 0 }, screenPoint: topRight },
      { boardCorner: { x: 1, y: 1 }, screenPoint: bottomRight },
      { boardCorner: { x: 0, y: 1 }, screenPoint: bottomLeft },
    ]);
  }

  // ─── Pin Projection ───────────────────────────────────────────

  projectPins(): ProjectedPin[] {
    if (!this._activeBoard || !this._calibration?.isValid) {
      return [];
    }

    const matrix = this._calibration.matrix;

    return this._activeBoard.pins
      .filter((pin) => {
        if (this._pinFilter && pin.type !== this._pinFilter) {
          return false;
        }
        return true;
      })
      .map((pin) => {
        const projected = applyTransformWithMatrix(
          matrix,
          pin.normalizedPosition.x,
          pin.normalizedPosition.y,
        );

        const isHighlighted =
          this._highlightedPins.has(pin.id) ||
          this._isNetHighlighted(pin.id);

        return {
          pin,
          screenX: projected.x,
          screenY: projected.y,
          highlighted: isHighlighted,
          color: isHighlighted ? '#FFFFFF' : PIN_TYPE_COLORS[pin.type],
        };
      });
  }

  // ─── Highlighting ─────────────────────────────────────────────

  highlightPin(pinId: string): void {
    this._highlightedPins.add(pinId);
    this._notify();
  }

  unhighlightPin(pinId: string): void {
    this._highlightedPins.delete(pinId);
    this._notify();
  }

  clearPinHighlights(): void {
    this._highlightedPins.clear();
    this._notify();
  }

  highlightNet(netId: string): void {
    this._highlightedNets.add(netId);
    this._notify();
  }

  unhighlightNet(netId: string): void {
    this._highlightedNets.delete(netId);
    this._notify();
  }

  clearNetHighlights(): void {
    this._highlightedNets.clear();
    this._notify();
  }

  /**
   * Register which pins belong to a given net (for net highlighting).
   */
  setNetPinMapping(netId: string, pinIds: string[]): void {
    this._netPinMapping.set(netId, [...pinIds]);
  }

  clearNetPinMapping(): void {
    this._netPinMapping.clear();
  }

  private _isNetHighlighted(pinId: string): boolean {
    let found = false;
    this._highlightedNets.forEach((netId) => {
      const pins = this._netPinMapping.get(netId);
      if (pins && pins.includes(pinId)) {
        found = true;
      }
    });
    return found;
  }

  // ─── Filtering ────────────────────────────────────────────────

  setPinFilter(type: PinType | null): void {
    this._pinFilter = type;
    this._notify();
  }

  getPinFilter(): PinType | null {
    return this._pinFilter;
  }

  // ─── Lookup ───────────────────────────────────────────────────

  findPinByLabel(label: string): PinDefinition | null {
    if (!this._activeBoard) { return null; }
    const normalized = label.toUpperCase().trim();
    return this._activeBoard.pins.find((p) =>
      p.label.toUpperCase() === normalized || p.id.toUpperCase() === normalized,
    ) ?? null;
  }

  findPinsByType(type: PinType): PinDefinition[] {
    if (!this._activeBoard) { return []; }
    return this._activeBoard.pins.filter((p) => p.type === type);
  }

  findPinsByAltFunction(fn: string): PinDefinition[] {
    if (!this._activeBoard) { return []; }
    const normalized = fn.toUpperCase().trim();
    return this._activeBoard.pins.filter((p) =>
      p.altFunctions.some((af) => af.toUpperCase().includes(normalized)),
    );
  }

  findPinByGpio(gpio: number): PinDefinition | null {
    if (!this._activeBoard) { return null; }
    return this._activeBoard.pins.find((p) => p.gpio === gpio) ?? null;
  }

  // ─── State Snapshot ───────────────────────────────────────────

  getSnapshot(): OverlayState {
    return {
      activeBoard: this._activeBoard,
      calibration: this._calibration,
      highlightedPins: new Set(this._highlightedPins),
      highlightedNets: new Set(this._highlightedNets),
      projectedPins: this.projectPins(),
      pinFilter: this._pinFilter,
    };
  }

  // ─── Pin Info ─────────────────────────────────────────────────

  getPinTooltip(pin: PinDefinition): string {
    const parts = [pin.label];
    if (pin.gpio !== undefined) {
      parts.push(`GPIO ${pin.gpio}`);
    }
    if (pin.altFunctions.length > 0) {
      parts.push(`Alt: ${pin.altFunctions.join(', ')}`);
    }
    parts.push(`Type: ${pin.type}`);
    return parts.join(' | ');
  }
}
