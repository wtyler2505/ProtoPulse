// ---------------------------------------------------------------------------
// Pin Constant Generator
// ---------------------------------------------------------------------------
// Generates #define pin constants for Arduino sketches from schematic net
// labels. Maps nets to physical Arduino pins based on board type and
// categorizes them (digital, analog, PWM, I2C, SPI, serial).
//
// Pure module — no React/DOM dependencies.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BoardPinMap {
  readonly boardType: BoardType;
  readonly digitalPins: readonly number[];
  readonly analogPins: readonly string[];
  readonly pwmPins: readonly number[];
  readonly i2cPins: { readonly sda: number; readonly scl: number };
  readonly spiPins: {
    readonly mosi: number;
    readonly miso: number;
    readonly sck: number;
    readonly ss: number;
  };
  readonly serialPins: { readonly rx: number; readonly tx: number };
}

export type BoardType = 'uno' | 'nano' | 'mega';

export type PinCategory =
  | 'digital_input'
  | 'digital_output'
  | 'analog_input'
  | 'pwm'
  | 'i2c'
  | 'spi'
  | 'serial'
  | 'unmapped';

export interface PinConstant {
  readonly name: string;
  readonly originalLabel: string;
  readonly pinNumber: number | string;
  readonly category: PinCategory;
  readonly comment: string;
}

export interface PinGeneratorOptions {
  readonly boardType: BoardType;
  readonly includeComments: boolean;
  readonly groupByCategory: boolean;
}

/** Minimal net info needed for pin generation. */
export interface NetInfo {
  readonly id: string;
  readonly name: string;
}

/** Minimal instance info: which component pin connects to which net. */
export interface InstanceInfo {
  readonly id: string;
  readonly componentType: string;
  readonly label: string;
  readonly pins: ReadonlyArray<{
    readonly pinName: string;
    readonly netId: string;
    readonly physicalPin?: number | string;
  }>;
}

// ---------------------------------------------------------------------------
// Board Pin Maps
// ---------------------------------------------------------------------------

const UNO_PIN_MAP: BoardPinMap = {
  boardType: 'uno',
  digitalPins: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  analogPins: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
  pwmPins: [3, 5, 6, 9, 10, 11],
  i2cPins: { sda: 18, scl: 19 }, // A4=18, A5=19 in digital numbering
  spiPins: { mosi: 11, miso: 12, sck: 13, ss: 10 },
  serialPins: { rx: 0, tx: 1 },
};

const NANO_PIN_MAP: BoardPinMap = {
  boardType: 'nano',
  digitalPins: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  analogPins: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'],
  pwmPins: [3, 5, 6, 9, 10, 11],
  i2cPins: { sda: 18, scl: 19 },
  spiPins: { mosi: 11, miso: 12, sck: 13, ss: 10 },
  serialPins: { rx: 0, tx: 1 },
};

const MEGA_PIN_MAP: BoardPinMap = {
  boardType: 'mega',
  digitalPins: Array.from({ length: 54 }, (_, i) => i),
  analogPins: Array.from({ length: 16 }, (_, i) => `A${i}`),
  pwmPins: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 44, 45, 46],
  i2cPins: { sda: 20, scl: 21 },
  spiPins: { mosi: 51, miso: 50, sck: 52, ss: 53 },
  serialPins: { rx: 0, tx: 1 },
};

const BOARD_MAPS: Record<BoardType, BoardPinMap> = {
  uno: UNO_PIN_MAP,
  nano: NANO_PIN_MAP,
  mega: MEGA_PIN_MAP,
};

/** Get the board pin map for a given board type. */
export function getBoardPinMap(boardType: BoardType): BoardPinMap {
  return BOARD_MAPS[boardType];
}

// ---------------------------------------------------------------------------
// Label Sanitization
// ---------------------------------------------------------------------------

/**
 * Sanitize a net label into a valid C identifier for #define.
 *
 * Rules:
 * - Replace spaces, dashes, dots, slashes with underscores
 * - Remove non-alphanumeric chars (except underscore)
 * - Prefix with underscore if starts with a digit
 * - Convert to UPPER_CASE
 * - Collapse consecutive underscores
 * - Trim leading/trailing underscores (except digit-prefix)
 */
export function sanitizeLabel(label: string): string {
  if (label.trim().length === 0) {
    return '';
  }

  let result = label
    // Replace common separators with underscore
    .replace(/[\s\-./\\]+/g, '_')
    // Remove non-alphanumeric/underscore chars
    .replace(/[^a-zA-Z0-9_]/g, '')
    // Collapse multiple underscores
    .replace(/_{2,}/g, '_')
    // Convert to uppercase
    .toUpperCase();

  // Trim leading/trailing underscores
  result = result.replace(/^_+|_+$/g, '');

  // Prefix with underscore if starts with digit
  if (/^\d/.test(result)) {
    result = '_' + result;
  }

  return result;
}

/**
 * Deduplicate constant names by appending _2, _3, etc.
 */
export function deduplicateNames(names: string[]): string[] {
  const counts = new Map<string, number>();
  const result: string[] = [];

  for (const name of names) {
    const existing = counts.get(name);
    if (existing !== undefined) {
      const newCount = existing + 1;
      counts.set(name, newCount);
      result.push(`${name}_${newCount}`);
    } else {
      counts.set(name, 1);
      result.push(name);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Pin Category Detection
// ---------------------------------------------------------------------------

/**
 * Detect the category of a pin based on its number and the board pin map.
 * Priority: I2C > SPI > Serial > Analog > PWM > Digital
 */
export function detectPinCategory(
  pinNumber: number | string,
  board: BoardPinMap,
): PinCategory {
  // String pins are analog (e.g. 'A0')
  if (typeof pinNumber === 'string') {
    if (board.analogPins.includes(pinNumber)) {
      return 'analog_input';
    }
    return 'unmapped';
  }

  // I2C pins
  if (pinNumber === board.i2cPins.sda || pinNumber === board.i2cPins.scl) {
    return 'i2c';
  }

  // SPI pins
  const spi = board.spiPins;
  if (
    pinNumber === spi.mosi ||
    pinNumber === spi.miso ||
    pinNumber === spi.sck ||
    pinNumber === spi.ss
  ) {
    return 'spi';
  }

  // Serial pins
  if (
    pinNumber === board.serialPins.rx ||
    pinNumber === board.serialPins.tx
  ) {
    return 'serial';
  }

  // PWM-capable digital pin
  if (board.pwmPins.includes(pinNumber)) {
    return 'pwm';
  }

  // Regular digital pin
  if (board.digitalPins.includes(pinNumber)) {
    return 'digital_output';
  }

  return 'unmapped';
}

// ---------------------------------------------------------------------------
// Net-to-Pin Resolution
// ---------------------------------------------------------------------------

/**
 * Attempt to extract a pin number from a net name using common naming
 * conventions: "D3", "A0", "PIN_5", "GPIO_12", etc.
 */
export function extractPinFromLabel(label: string, board: BoardPinMap): number | string | null {
  const upper = label.toUpperCase().trim();

  // Match "A0"-"A15" style analog pins
  const analogMatch = /^A(\d+)$/.exec(upper);
  if (analogMatch) {
    const pin = `A${analogMatch[1]}`;
    if (board.analogPins.includes(pin)) {
      return pin;
    }
  }

  // Match "D3", "D13" style digital pins
  const digitalMatch = /^D(\d+)$/.exec(upper);
  if (digitalMatch) {
    const pin = parseInt(digitalMatch[1], 10);
    if (board.digitalPins.includes(pin)) {
      return pin;
    }
  }

  // Match "PIN_5", "PIN5", "GPIO_12", "GPIO12" patterns
  const pinMatch = /^(?:PIN|GPIO)[_\s]?(\d+)$/i.exec(upper);
  if (pinMatch) {
    const pin = parseInt(pinMatch[1], 10);
    if (board.digitalPins.includes(pin)) {
      return pin;
    }
  }

  // Check for special function names
  const specialPins: Record<string, number | string> = {
    SDA: board.i2cPins.sda,
    SCL: board.i2cPins.scl,
    MOSI: board.spiPins.mosi,
    MISO: board.spiPins.miso,
    SCK: board.spiPins.sck,
    SS: board.spiPins.ss,
    RX: board.serialPins.rx,
    TX: board.serialPins.tx,
    LED_BUILTIN: 13,
    LED: 13,
  };

  if (upper in specialPins) {
    return specialPins[upper];
  }

  return null;
}

// ---------------------------------------------------------------------------
// Core Generator
// ---------------------------------------------------------------------------

/**
 * Generate pin constants from circuit nets and component instances.
 *
 * Resolution strategy:
 * 1. Try to extract a pin number from the net label (e.g. "D3" → 3)
 * 2. Check if any instance has explicit physicalPin assignments for the net
 * 3. If neither, mark as unmapped
 */
export function generatePinConstants(
  nets: readonly NetInfo[],
  instances: readonly InstanceInfo[],
  options: PinGeneratorOptions,
): PinConstant[] {
  const board = getBoardPinMap(options.boardType);
  const constants: PinConstant[] = [];

  // Build a lookup: netId → physicalPin from instance data
  const netToPinMap = new Map<string, number | string>();
  for (const instance of instances) {
    for (const pin of instance.pins) {
      if (pin.physicalPin !== undefined && pin.netId) {
        netToPinMap.set(pin.netId, pin.physicalPin);
      }
    }
  }

  for (const net of nets) {
    // Skip power nets (VCC, GND, 5V, 3V3, etc.)
    if (isPowerNet(net.name)) {
      continue;
    }

    // Skip empty/unnamed nets
    if (!net.name || net.name.trim().length === 0) {
      continue;
    }

    const sanitized = sanitizeLabel(net.name);
    if (sanitized.length === 0) {
      continue;
    }

    // Try to resolve pin number
    let pinNumber: number | string | null = null;

    // Strategy 1: Extract from net label
    pinNumber = extractPinFromLabel(net.name, board);

    // Strategy 2: Check instance pin assignments
    if (pinNumber === null) {
      const fromInstance = netToPinMap.get(net.id);
      if (fromInstance !== undefined) {
        pinNumber = fromInstance;
      }
    }

    const category = pinNumber !== null
      ? detectPinCategory(pinNumber, board)
      : 'unmapped';

    const comment = buildComment(net.name, pinNumber, category);

    constants.push({
      name: sanitized,
      originalLabel: net.name,
      pinNumber: pinNumber ?? '??',
      category,
      comment,
    });
  }

  // Deduplicate names
  const names = constants.map((c) => c.name);
  const deduplicated = deduplicateNames(names);
  for (let i = 0; i < constants.length; i++) {
    if (deduplicated[i] !== constants[i].name) {
      (constants[i] as { name: string }).name = deduplicated[i];
    }
  }

  // Sort: mapped pins first (by category order), then unmapped
  const categoryOrder: Record<PinCategory, number> = {
    digital_output: 0,
    digital_input: 1,
    analog_input: 2,
    pwm: 3,
    i2c: 4,
    spi: 5,
    serial: 6,
    unmapped: 7,
  };

  constants.sort((a, b) => {
    const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
    if (catDiff !== 0) {
      return catDiff;
    }
    return a.name.localeCompare(b.name);
  });

  return constants;
}

// ---------------------------------------------------------------------------
// Output Formatting
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<PinCategory, string> = {
  digital_output: 'Digital Outputs',
  digital_input: 'Digital Inputs',
  analog_input: 'Analog Inputs',
  pwm: 'PWM Outputs',
  i2c: 'I2C Bus',
  spi: 'SPI Bus',
  serial: 'Serial (UART)',
  unmapped: 'Unmapped',
};

const BOARD_NAMES: Record<BoardType, string> = {
  uno: 'Arduino Uno (ATmega328P)',
  nano: 'Arduino Nano (ATmega328P)',
  mega: 'Arduino Mega 2560 (ATmega2560)',
};

/**
 * Format pin constants as C #define directives.
 */
export function formatAsDefines(
  constants: readonly PinConstant[],
  options: PinGeneratorOptions,
): string {
  if (constants.length === 0) {
    return options.includeComments
      ? `// ProtoPulse Pin Constants — ${BOARD_NAMES[options.boardType]}\n// No pin constants generated.\n`
      : '';
  }

  const lines: string[] = [];

  if (options.includeComments) {
    lines.push(`// ProtoPulse Pin Constants — ${BOARD_NAMES[options.boardType]}`);
    lines.push(`// Generated: ${new Date().toISOString()}`);
    lines.push(`// Board: ${BOARD_NAMES[options.boardType]}`);
    lines.push('');
  }

  // Find the longest name for alignment
  const maxNameLen = Math.max(...constants.map((c) => c.name.length));

  if (options.groupByCategory) {
    // Group constants by category
    const groups = new Map<PinCategory, PinConstant[]>();
    for (const constant of constants) {
      const existing = groups.get(constant.category);
      if (existing) {
        existing.push(constant);
      } else {
        groups.set(constant.category, [constant]);
      }
    }

    let first = true;
    const groupEntries = Array.from(groups.entries());
    for (let gi = 0; gi < groupEntries.length; gi++) {
      const [category, group] = groupEntries[gi];
      if (!first) {
        lines.push('');
      }
      first = false;

      if (options.includeComments) {
        lines.push(`// === ${CATEGORY_LABELS[category]} ===`);
      }

      for (let ci = 0; ci < group.length; ci++) {
        lines.push(formatDefine(group[ci], maxNameLen, options.includeComments));
      }
    }
  } else {
    for (const c of constants) {
      lines.push(formatDefine(c, maxNameLen, options.includeComments));
    }
  }

  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDefine(
  constant: PinConstant,
  maxNameLen: number,
  includeComment: boolean,
): string {
  const pinStr = typeof constant.pinNumber === 'string'
    ? constant.pinNumber
    : String(constant.pinNumber);

  const padding = ' '.repeat(Math.max(1, maxNameLen - constant.name.length + 1));

  if (constant.category === 'unmapped') {
    const base = `// #define ${constant.name}${padding}${pinStr}`;
    return includeComment
      ? `${base}  // ${constant.comment}`
      : base;
  }

  const base = `#define ${constant.name}${padding}${pinStr}`;
  return includeComment
    ? `${base}  // ${constant.comment}`
    : base;
}

function buildComment(
  originalLabel: string,
  pinNumber: number | string | null,
  category: PinCategory,
): string {
  if (category === 'unmapped') {
    return `Could not determine pin mapping for "${originalLabel}"`;
  }

  const categoryDesc = CATEGORY_LABELS[category].toLowerCase();
  const pinDesc = pinNumber !== null ? ` (pin ${pinNumber})` : '';
  return `${originalLabel}${pinDesc} — ${categoryDesc}`;
}

const POWER_NET_PATTERNS = [
  /^VCC$/i,
  /^VDD$/i,
  /^GND$/i,
  /^VSS$/i,
  /^V\+$/i,
  /^V-$/i,
  /^3V3$/i,
  /^3\.3V$/i,
  /^5V$/i,
  /^12V$/i,
  /^VBAT$/i,
  /^VBUS$/i,
  /^VIN$/i,
  /^AVCC$/i,
  /^AREF$/i,
  /^GROUND$/i,
  /^POWER$/i,
  /^\+\d+V$/i,
  /^-\d+V$/i,
];

/**
 * Check if a net name represents a power rail (VCC, GND, 5V, etc.).
 * Power nets are excluded from pin constant generation.
 */
export function isPowerNet(name: string): boolean {
  const trimmed = name.trim();
  return POWER_NET_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Get a summary of generated constants.
 */
export function getConstantsSummary(
  constants: readonly PinConstant[],
  totalNets: number,
): string {
  const mapped = constants.filter((c) => c.category !== 'unmapped').length;
  const unmapped = constants.filter((c) => c.category === 'unmapped').length;
  return `${constants.length} pin constant${constants.length !== 1 ? 's' : ''} generated from ${totalNets} net${totalNets !== 1 ? 's' : ''} (${mapped} mapped, ${unmapped} unmapped)`;
}
