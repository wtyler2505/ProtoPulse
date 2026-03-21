/**
 * AI Textual Product Goals → Architecture Options (BL-0452)
 *
 * Parses natural language product descriptions into structured ProductGoal
 * objects with requirements/constraints, then generates 2-3 ArchitectureCandidates
 * (minimal/balanced/full). Uses a 30+ component knowledge base with keyword
 * detection for wireless, power, sensing, actuation, and more.
 *
 * Pure functions — no AI API calls, no React, no side effects.
 *
 * Usage:
 *   const goal = parseProductGoal('I want a battery-powered weather station with WiFi');
 *   const candidates = generateArchitectureCandidates(goal);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RequirementCategory =
  | 'wireless'
  | 'power'
  | 'sensing'
  | 'actuation'
  | 'display'
  | 'storage'
  | 'compute'
  | 'connectivity'
  | 'user-input'
  | 'audio'
  | 'safety'
  | 'mechanical';

export type ConstraintType =
  | 'power-source'
  | 'size'
  | 'cost'
  | 'temperature'
  | 'weight'
  | 'certification'
  | 'protocol'
  | 'voltage';

export type CandidateTier = 'minimal' | 'balanced' | 'full';

export interface Requirement {
  category: RequirementCategory;
  description: string;
  keywords: string[];
  priority: 'must' | 'should' | 'nice-to-have';
}

export interface Constraint {
  type: ConstraintType;
  value: string;
  description: string;
}

export interface ProductGoal {
  summary: string;
  requirements: Requirement[];
  constraints: Constraint[];
  detectedDomains: string[];
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface ComponentSuggestion {
  name: string;
  category: RequirementCategory;
  partNumber?: string;
  description: string;
  tier: CandidateTier;
  alternatives?: string[];
}

export interface ArchitectureCandidate {
  tier: CandidateTier;
  label: string;
  description: string;
  components: ComponentSuggestion[];
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  pros: string[];
  cons: string[];
  estimatedNodeCount: number;
}

// ---------------------------------------------------------------------------
// Keyword detection tables
// ---------------------------------------------------------------------------

interface KeywordRule {
  keywords: string[];
  category: RequirementCategory;
  description: string;
  priority: 'must' | 'should' | 'nice-to-have';
}

const REQUIREMENT_RULES: KeywordRule[] = [
  // Wireless
  {
    keywords: ['wifi', 'wi-fi', 'wireless', 'wlan', '802.11'],
    category: 'wireless',
    description: 'WiFi connectivity',
    priority: 'must',
  },
  {
    keywords: ['bluetooth', 'ble', 'bt'],
    category: 'wireless',
    description: 'Bluetooth / BLE connectivity',
    priority: 'must',
  },
  {
    keywords: ['lora', 'lorawan', 'long range'],
    category: 'wireless',
    description: 'LoRa long-range wireless',
    priority: 'must',
  },
  {
    keywords: ['zigbee', 'z-wave', 'thread', 'matter'],
    category: 'wireless',
    description: 'Mesh networking protocol',
    priority: 'must',
  },
  {
    keywords: ['cellular', 'gsm', 'lte', '4g', '5g', 'sim', 'nb-iot', 'cat-m1'],
    category: 'wireless',
    description: 'Cellular connectivity',
    priority: 'must',
  },
  {
    keywords: ['gps', 'gnss', 'location', 'positioning', 'geolocation'],
    category: 'wireless',
    description: 'GPS/GNSS positioning',
    priority: 'must',
  },
  {
    keywords: ['nfc', 'rfid', 'contactless'],
    category: 'wireless',
    description: 'NFC/RFID',
    priority: 'should',
  },

  // Sensing
  {
    keywords: ['temperature', 'temp sensor', 'thermometer', 'thermocouple'],
    category: 'sensing',
    description: 'Temperature measurement',
    priority: 'must',
  },
  {
    keywords: ['humidity', 'moisture'],
    category: 'sensing',
    description: 'Humidity sensing',
    priority: 'must',
  },
  {
    keywords: ['pressure', 'barometer', 'barometric', 'altitude'],
    category: 'sensing',
    description: 'Pressure / altitude sensing',
    priority: 'must',
  },
  {
    keywords: ['accelerometer', 'gyroscope', 'imu', 'motion', 'tilt', 'vibration'],
    category: 'sensing',
    description: 'Motion / IMU sensing',
    priority: 'must',
  },
  {
    keywords: ['light sensor', 'lux', 'ambient light', 'photoresistor', 'ldr'],
    category: 'sensing',
    description: 'Light level sensing',
    priority: 'should',
  },
  {
    keywords: ['camera', 'image', 'vision', 'video', 'webcam'],
    category: 'sensing',
    description: 'Camera / vision',
    priority: 'must',
  },
  {
    keywords: ['ultrasonic', 'distance', 'rangefinder', 'lidar', 'tof', 'proximity'],
    category: 'sensing',
    description: 'Distance / proximity measurement',
    priority: 'must',
  },
  {
    keywords: ['gas sensor', 'air quality', 'co2', 'smoke', 'particulate', 'pm2.5'],
    category: 'sensing',
    description: 'Gas / air quality sensing',
    priority: 'must',
  },
  {
    keywords: ['current sensor', 'voltage monitor', 'power monitor', 'energy meter'],
    category: 'sensing',
    description: 'Electrical measurement',
    priority: 'should',
  },
  {
    keywords: ['weather', 'weather station', 'meteorological'],
    category: 'sensing',
    description: 'Weather monitoring (temperature + humidity + pressure)',
    priority: 'must',
  },

  // Actuation
  {
    keywords: ['motor', 'dc motor', 'servo', 'stepper', 'actuator'],
    category: 'actuation',
    description: 'Motor / servo actuation',
    priority: 'must',
  },
  {
    keywords: ['relay', 'switch control', 'solid state relay', 'ssr'],
    category: 'actuation',
    description: 'Relay switching',
    priority: 'must',
  },
  {
    keywords: ['pump', 'valve', 'solenoid'],
    category: 'actuation',
    description: 'Fluid control (pump/valve)',
    priority: 'must',
  },
  {
    keywords: ['heater', 'heating', 'peltier', 'cooling', 'fan control'],
    category: 'actuation',
    description: 'Thermal control',
    priority: 'must',
  },
  {
    keywords: ['led strip', 'neopixel', 'ws2812', 'rgb led', 'addressable led', 'lighting'],
    category: 'actuation',
    description: 'LED / lighting control',
    priority: 'should',
  },

  // Display
  {
    keywords: ['display', 'screen', 'lcd', 'oled', 'tft', 'e-ink', 'e-paper'],
    category: 'display',
    description: 'Display output',
    priority: 'should',
  },

  // Storage
  {
    keywords: ['sd card', 'data logging', 'data logger', 'log data', 'storage', 'eeprom', 'flash memory'],
    category: 'storage',
    description: 'Data storage / logging',
    priority: 'should',
  },

  // Power
  {
    keywords: ['battery', 'rechargeable', 'lipo', 'lithium', 'li-ion', 'battery powered'],
    category: 'power',
    description: 'Battery power',
    priority: 'must',
  },
  {
    keywords: ['solar', 'solar panel', 'energy harvesting', 'solar powered'],
    category: 'power',
    description: 'Solar energy harvesting',
    priority: 'must',
  },
  {
    keywords: ['usb powered', 'usb-c power', 'usb power'],
    category: 'power',
    description: 'USB power supply',
    priority: 'should',
  },
  {
    keywords: ['low power', 'sleep mode', 'deep sleep', 'power saving', 'energy efficient'],
    category: 'power',
    description: 'Low power operation',
    priority: 'should',
  },

  // Compute
  {
    keywords: ['raspberry pi', 'rpi', 'linux', 'single board computer'],
    category: 'compute',
    description: 'Linux SBC compute',
    priority: 'must',
  },
  {
    keywords: ['arduino', 'esp32', 'esp8266', 'stm32', 'teensy', 'pico', 'rp2040', 'microcontroller', 'mcu'],
    category: 'compute',
    description: 'Microcontroller compute',
    priority: 'must',
  },

  // Connectivity
  {
    keywords: ['ethernet', 'rj45', 'wired network'],
    category: 'connectivity',
    description: 'Wired Ethernet',
    priority: 'must',
  },
  {
    keywords: ['usb', 'usb-c', 'usb host'],
    category: 'connectivity',
    description: 'USB interface',
    priority: 'should',
  },
  {
    keywords: ['can bus', 'canbus', 'obd', 'obd2', 'automotive'],
    category: 'connectivity',
    description: 'CAN bus / automotive',
    priority: 'must',
  },
  {
    keywords: ['rs485', 'rs232', 'modbus', 'industrial'],
    category: 'connectivity',
    description: 'Industrial serial protocol',
    priority: 'must',
  },
  {
    keywords: ['mqtt', 'iot', 'cloud', 'home assistant', 'homekit', 'alexa', 'google home'],
    category: 'connectivity',
    description: 'IoT / smart home integration',
    priority: 'should',
  },

  // User input
  {
    keywords: ['button', 'keypad', 'touchscreen', 'joystick', 'rotary encoder', 'knob', 'potentiometer'],
    category: 'user-input',
    description: 'User input controls',
    priority: 'should',
  },

  // Audio
  {
    keywords: ['speaker', 'buzzer', 'audio', 'microphone', 'sound', 'alarm', 'siren'],
    category: 'audio',
    description: 'Audio input/output',
    priority: 'should',
  },

  // Safety
  {
    keywords: ['waterproof', 'ip67', 'ip68', 'outdoor', 'weatherproof', 'sealed', 'enclosure'],
    category: 'safety',
    description: 'Environmental protection',
    priority: 'should',
  },

  // Mechanical
  {
    keywords: ['robot', 'rover', 'drone', 'vehicle', 'chassis', 'wheel', 'arm', 'gripper'],
    category: 'mechanical',
    description: 'Mechanical platform / robotics',
    priority: 'must',
  },
];

// ---------------------------------------------------------------------------
// Constraint detection
// ---------------------------------------------------------------------------

interface ConstraintRule {
  pattern: RegExp;
  type: ConstraintType;
  extractValue: (match: RegExpMatchArray) => string;
  description: (value: string) => string;
}

const CONSTRAINT_RULES: ConstraintRule[] = [
  {
    pattern: /battery[- ]?powered|runs?\s+on\s+batter(?:y|ies)/i,
    type: 'power-source',
    extractValue: () => 'battery',
    description: () => 'Must run on battery power',
  },
  {
    pattern: /solar[- ]?powered/i,
    type: 'power-source',
    extractValue: () => 'solar',
    description: () => 'Must use solar energy harvesting',
  },
  {
    pattern: /mains[- ]?powered|ac\s+power|wall\s+power|plug[- ]?in/i,
    type: 'power-source',
    extractValue: () => 'mains',
    description: () => 'Powered from mains AC',
  },
  {
    pattern: /(?:under|less than|<|max(?:imum)?)\s*\$?\s*(\d+(?:\.\d+)?)\s*(?:dollars|usd|\$)/i,
    type: 'cost',
    extractValue: (m) => `$${m[1]}`,
    description: (v) => `Target cost ${v} or less`,
  },
  {
    pattern: /(\d+(?:\.\d+)?)\s*(?:v|volt(?:s)?)\s*(?:input|supply|power)/i,
    type: 'voltage',
    extractValue: (m) => `${m[1]}V`,
    description: (v) => `${v} supply voltage`,
  },
  {
    pattern: /(?:small|compact|tiny|miniature|pocket[- ]?sized)/i,
    type: 'size',
    extractValue: () => 'small',
    description: () => 'Small / compact form factor',
  },
  {
    pattern: /outdoor|weatherproof|waterproof|ip6[5-8]/i,
    type: 'temperature',
    extractValue: () => 'outdoor-rated',
    description: () => 'Must withstand outdoor conditions',
  },
  {
    pattern: /(?:ce|fcc|ul|rohs)\s*(?:certified|compliant|certification)/i,
    type: 'certification',
    extractValue: (m) => m[0].split(/\s/)[0].toUpperCase(),
    description: (v) => `Requires ${v} certification`,
  },
];

// ---------------------------------------------------------------------------
// Domain detection
// ---------------------------------------------------------------------------

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  'Home Automation': ['smart home', 'home automation', 'home assistant', 'homekit', 'zigbee', 'z-wave', 'matter', 'thermostat', 'light switch', 'smart plug'],
  'Environmental Monitoring': ['weather station', 'air quality', 'environmental', 'climate', 'pollution', 'meteorological'],
  'Robotics': ['robot', 'rover', 'drone', 'autonomous', 'chassis', 'gripper', 'arm', 'navigation'],
  'Agriculture': ['plant', 'soil', 'irrigation', 'greenhouse', 'farm', 'agriculture', 'garden', 'watering'],
  'Wearable': ['wearable', 'watch', 'bracelet', 'fitness', 'health tracker', 'body'],
  'Industrial IoT': ['industrial', 'factory', 'machine monitoring', 'predictive maintenance', 'plc', 'scada', 'modbus'],
  'Automotive': ['car', 'vehicle', 'automotive', 'obd', 'can bus', 'dashboard', 'adas'],
  'Medical': ['medical', 'health', 'heart rate', 'spo2', 'pulse', 'blood pressure', 'ecg', 'ekg'],
  'Security': ['security', 'surveillance', 'alarm', 'intrusion', 'access control', 'lock', 'camera'],
  'Energy': ['solar', 'energy harvesting', 'power meter', 'energy monitor', 'battery management', 'bms', 'mppt'],
  'Audio': ['audio', 'music', 'speaker', 'amplifier', 'dac', 'synthesizer', 'midi'],
  'Education': ['learning', 'educational', 'beginner', 'starter', 'kit', 'tutorial'],
};

// ---------------------------------------------------------------------------
// Component knowledge base (30+ components)
// ---------------------------------------------------------------------------

interface ComponentKnowledge {
  name: string;
  partNumbers: string[];
  category: RequirementCategory;
  description: string;
  tier: CandidateTier;
  capabilities: string[];
}

const COMPONENT_KB: ComponentKnowledge[] = [
  // --- Compute: minimal ---
  { name: 'ATmega328P (Arduino Nano)', partNumbers: ['ATmega328P'], category: 'compute', description: '8-bit MCU, 32KB flash, 2KB RAM — simple control tasks', tier: 'minimal', capabilities: ['gpio', 'adc', 'pwm', 'uart', 'spi', 'i2c'] },
  { name: 'RP2040 (Pico)', partNumbers: ['RP2040'], category: 'compute', description: 'Dual-core ARM Cortex-M0+, 264KB RAM, PIO state machines', tier: 'minimal', capabilities: ['gpio', 'adc', 'pwm', 'uart', 'spi', 'i2c', 'pio'] },

  // --- Compute: balanced ---
  { name: 'ESP32-S3', partNumbers: ['ESP32-S3-WROOM-1'], category: 'compute', description: 'Dual-core 240MHz, WiFi + BLE 5, 512KB RAM, USB OTG', tier: 'balanced', capabilities: ['wifi', 'ble', 'gpio', 'adc', 'pwm', 'uart', 'spi', 'i2c', 'usb'] },
  { name: 'STM32F4', partNumbers: ['STM32F411CEU6'], category: 'compute', description: 'ARM Cortex-M4F, 100MHz, 512KB flash, DSP, FPU', tier: 'balanced', capabilities: ['gpio', 'adc', 'pwm', 'uart', 'spi', 'i2c', 'usb', 'dma', 'timer'] },

  // --- Compute: full ---
  { name: 'ESP32-S3 + SBC combo', partNumbers: ['ESP32-S3', 'RPi CM4'], category: 'compute', description: 'MCU for real-time I/O + Linux SBC for heavy compute (ML, vision, UI)', tier: 'full', capabilities: ['wifi', 'ble', 'gpio', 'adc', 'linux', 'ml', 'camera', 'hdmi'] },

  // --- Wireless ---
  { name: 'ESP32 WiFi (built-in)', partNumbers: ['ESP32-S3'], category: 'wireless', description: 'WiFi 802.11 b/g/n built into ESP32', tier: 'minimal', capabilities: ['wifi'] },
  { name: 'nRF52840 BLE', partNumbers: ['nRF52840'], category: 'wireless', description: 'Nordic BLE 5.3 + Thread/Zigbee, ultra-low power', tier: 'balanced', capabilities: ['ble', 'thread', 'zigbee'] },
  { name: 'SX1276 LoRa', partNumbers: ['SX1276'], category: 'wireless', description: 'Semtech LoRa transceiver, 15km range, 868/915MHz', tier: 'balanced', capabilities: ['lora'] },
  { name: 'SIM7600 LTE', partNumbers: ['SIM7600G-H'], category: 'wireless', description: '4G LTE Cat-4, global bands, GNSS, fallback 2G/3G', tier: 'full', capabilities: ['lte', 'gnss', 'sms'] },
  { name: 'NEO-6M GPS', partNumbers: ['NEO-6M'], category: 'wireless', description: 'u-blox GPS receiver, 2.5m accuracy, UART interface', tier: 'minimal', capabilities: ['gps'] },
  { name: 'NEO-M9N GNSS', partNumbers: ['NEO-M9N'], category: 'wireless', description: 'Multi-band GNSS, 1.5m accuracy, concurrent GPS+GLONASS+Galileo', tier: 'full', capabilities: ['gnss'] },

  // --- Sensing ---
  { name: 'DHT22', partNumbers: ['DHT22', 'AM2302'], category: 'sensing', description: 'Temperature + humidity sensor, ±0.5°C / ±2% RH', tier: 'minimal', capabilities: ['temperature', 'humidity'] },
  { name: 'BME280', partNumbers: ['BME280'], category: 'sensing', description: 'Temperature + humidity + pressure, I2C/SPI, ±1°C / ±3% RH', tier: 'balanced', capabilities: ['temperature', 'humidity', 'pressure'] },
  { name: 'BME688', partNumbers: ['BME688'], category: 'sensing', description: 'Temp + humidity + pressure + gas (VOC/CO2 equiv), AI gas scanner', tier: 'full', capabilities: ['temperature', 'humidity', 'pressure', 'gas'] },
  { name: 'MPU-6050', partNumbers: ['MPU-6050'], category: 'sensing', description: '6-axis IMU (3-axis accel + 3-axis gyro), I2C, DMP', tier: 'minimal', capabilities: ['accelerometer', 'gyroscope'] },
  { name: 'BNO055', partNumbers: ['BNO055'], category: 'sensing', description: '9-axis absolute orientation IMU with onboard sensor fusion', tier: 'balanced', capabilities: ['accelerometer', 'gyroscope', 'magnetometer', 'fusion'] },
  { name: 'HC-SR04', partNumbers: ['HC-SR04'], category: 'sensing', description: 'Ultrasonic distance sensor, 2-400cm range', tier: 'minimal', capabilities: ['distance'] },
  { name: 'VL53L1X', partNumbers: ['VL53L1X'], category: 'sensing', description: 'Time-of-Flight laser distance sensor, 4m range, I2C', tier: 'balanced', capabilities: ['distance', 'tof'] },
  { name: 'INA219', partNumbers: ['INA219'], category: 'sensing', description: 'Current/voltage/power monitor, I2C, 26V max', tier: 'balanced', capabilities: ['current', 'voltage', 'power'] },

  // --- Display ---
  { name: 'SSD1306 OLED 0.96"', partNumbers: ['SSD1306'], category: 'display', description: '128x64 monochrome OLED, I2C, low power', tier: 'minimal', capabilities: ['display'] },
  { name: 'ST7789 TFT 1.3"', partNumbers: ['ST7789'], category: 'display', description: '240x240 color TFT, SPI, IPS viewing angles', tier: 'balanced', capabilities: ['display', 'color'] },
  { name: 'ILI9341 TFT 2.4"', partNumbers: ['ILI9341'], category: 'display', description: '320x240 color TFT with touchscreen, SPI', tier: 'full', capabilities: ['display', 'color', 'touch'] },

  // --- Power ---
  { name: 'AMS1117-3.3', partNumbers: ['AMS1117-3.3'], category: 'power', description: '3.3V LDO regulator, 1A, low dropout', tier: 'minimal', capabilities: ['3.3v', 'regulation'] },
  { name: 'MCP73831 + LDO', partNumbers: ['MCP73831', 'AP2112K-3.3'], category: 'power', description: 'LiPo charger IC + LDO, USB charging, battery management', tier: 'balanced', capabilities: ['charging', 'battery', '3.3v'] },
  { name: 'BQ25895 + TPS63020', partNumbers: ['BQ25895', 'TPS63020'], category: 'power', description: 'I2C battery charger + buck-boost converter, MPPT solar input capable', tier: 'full', capabilities: ['charging', 'battery', 'solar', 'mppt', 'buck-boost'] },

  // --- Actuation ---
  { name: 'L298N Motor Driver', partNumbers: ['L298N'], category: 'actuation', description: 'Dual H-bridge, 2A per channel, 5-35V', tier: 'minimal', capabilities: ['dc-motor', 'h-bridge'] },
  { name: 'DRV8825 Stepper Driver', partNumbers: ['DRV8825'], category: 'actuation', description: 'Stepper driver, 1/32 microstepping, 2.5A', tier: 'balanced', capabilities: ['stepper', 'microstepping'] },
  { name: 'TMC2209 Silent Stepper', partNumbers: ['TMC2209'], category: 'actuation', description: 'Ultra-quiet stepper driver, StealthChop2, UART config', tier: 'full', capabilities: ['stepper', 'silent', 'uart-config'] },

  // --- Storage ---
  { name: 'MicroSD Card Module', partNumbers: ['SPI-SD'], category: 'storage', description: 'SPI microSD breakout, FAT32, data logging', tier: 'minimal', capabilities: ['sd-card', 'fat32'] },
  { name: 'W25Q128 Flash', partNumbers: ['W25Q128JVSIQ'], category: 'storage', description: '16MB SPI NOR flash, 104MHz, for firmware + data', tier: 'balanced', capabilities: ['flash', 'spi'] },

  // --- Audio ---
  { name: 'Passive Buzzer', partNumbers: ['TMB12A05'], category: 'audio', description: 'Passive piezo buzzer for tones and alerts', tier: 'minimal', capabilities: ['tone', 'alert'] },
  { name: 'MAX98357A I2S Amp', partNumbers: ['MAX98357A'], category: 'audio', description: 'I2S class-D amplifier, 3.2W, filterless', tier: 'balanced', capabilities: ['i2s', 'amplifier', 'speaker'] },

  // --- Connectivity ---
  { name: 'W5500 Ethernet', partNumbers: ['W5500'], category: 'connectivity', description: 'Hardwired TCP/IP Ethernet controller, SPI, 10/100Mbps', tier: 'balanced', capabilities: ['ethernet', 'tcp'] },
  { name: 'MCP2515 CAN', partNumbers: ['MCP2515'], category: 'connectivity', description: 'CAN bus controller + TJA1050 transceiver, SPI, automotive', tier: 'balanced', capabilities: ['can', 'automotive'] },

  // --- User Input ---
  { name: 'Tactile Buttons', partNumbers: ['SKHHAJA010'], category: 'user-input', description: 'Momentary push buttons for user interaction', tier: 'minimal', capabilities: ['button'] },
  { name: 'Rotary Encoder', partNumbers: ['EC11'], category: 'user-input', description: 'Rotary encoder with push button, for menu navigation', tier: 'balanced', capabilities: ['encoder', 'button'] },
];

// ---------------------------------------------------------------------------
// Goal parsing
// ---------------------------------------------------------------------------

/**
 * Parses a natural language product description into a structured ProductGoal.
 */
export function parseProductGoal(description: string): ProductGoal {
  const text = description.toLowerCase();
  const requirements: Requirement[] = [];
  const constraints: Constraint[] = [];
  const seenCategories = new Set<string>();

  // Detect requirements via keyword matching
  REQUIREMENT_RULES.forEach((rule) => {
    const matched = rule.keywords.some((kw) => text.includes(kw));
    if (matched) {
      const matchedKeywords = rule.keywords.filter((kw) => text.includes(kw));
      const key = `${rule.category}:${rule.description}`;
      if (!seenCategories.has(key)) {
        seenCategories.add(key);
        requirements.push({
          category: rule.category,
          description: rule.description,
          keywords: matchedKeywords,
          priority: rule.priority,
        });
      }
    }
  });

  // Detect constraints via regex matching
  const seenConstraints = new Set<string>();
  CONSTRAINT_RULES.forEach((rule) => {
    const match = rule.pattern.exec(description);
    if (match) {
      const value = rule.extractValue(match);
      const key = `${rule.type}:${value}`;
      if (!seenConstraints.has(key)) {
        seenConstraints.add(key);
        constraints.push({
          type: rule.type,
          value,
          description: rule.description(value),
        });
      }
    }
  });

  // Detect domains
  const detectedDomains: string[] = [];
  const domainEntries = Array.from(Object.entries(DOMAIN_KEYWORDS));
  domainEntries.forEach(([domain, keywords]) => {
    if (keywords.some((kw) => text.includes(kw))) {
      detectedDomains.push(domain);
    }
  });

  // Determine complexity
  const uniqueCategories = new Set(requirements.map((r) => r.category));
  let complexity: ProductGoal['complexity'];
  if (uniqueCategories.size <= 2) {
    complexity = 'simple';
  } else if (uniqueCategories.size <= 4) {
    complexity = 'moderate';
  } else {
    complexity = 'complex';
  }

  return {
    summary: generateSummary(requirements, detectedDomains, description),
    requirements,
    constraints,
    detectedDomains,
    complexity,
  };
}

function generateSummary(
  requirements: Requirement[],
  domains: string[],
  originalDescription: string,
): string {
  if (requirements.length === 0) {
    return originalDescription.length > 120
      ? originalDescription.slice(0, 117) + '...'
      : originalDescription;
  }

  const domainPrefix = domains.length > 0 ? `${domains[0]} device` : 'Electronic device';
  const mustHaves = requirements
    .filter((r) => r.priority === 'must')
    .map((r) => r.description);
  const features = mustHaves.slice(0, 4).join(', ');
  if (features.length > 0) {
    return `${domainPrefix} with ${features}`;
  }
  return domainPrefix;
}

// ---------------------------------------------------------------------------
// Architecture candidate generation
// ---------------------------------------------------------------------------

/**
 * Generates 2-3 architecture candidates from a parsed ProductGoal.
 * Returns minimal + balanced, and full if complexity warrants it.
 */
export function generateArchitectureCandidates(
  goal: ProductGoal,
): ArchitectureCandidate[] {
  const requiredCategories = new Set(goal.requirements.map((r) => r.category));
  const hasBatteryConstraint = goal.constraints.some((c) => c.type === 'power-source' && c.value === 'battery');
  const hasSolarConstraint = goal.constraints.some((c) => c.type === 'power-source' && c.value === 'solar');

  const candidates: ArchitectureCandidate[] = [];

  // Always generate minimal and balanced
  candidates.push(buildCandidate('minimal', goal, requiredCategories, hasBatteryConstraint, hasSolarConstraint));
  candidates.push(buildCandidate('balanced', goal, requiredCategories, hasBatteryConstraint, hasSolarConstraint));

  // Generate full tier only for moderate+ complexity or 3+ requirements
  if (goal.complexity !== 'simple' || goal.requirements.length >= 3) {
    candidates.push(buildCandidate('full', goal, requiredCategories, hasBatteryConstraint, hasSolarConstraint));
  }

  return candidates;
}

function buildCandidate(
  tier: CandidateTier,
  goal: ProductGoal,
  requiredCategories: Set<RequirementCategory>,
  hasBatteryConstraint: boolean,
  hasSolarConstraint: boolean,
): ArchitectureCandidate {
  const components: ComponentSuggestion[] = [];
  const usedCategories = new Set<string>();

  // Always need a compute component
  const computeComponents = selectComponents('compute', tier);
  if (computeComponents.length > 0) {
    const comp = computeComponents[0];
    components.push({
      name: comp.name,
      category: 'compute',
      partNumber: comp.partNumbers[0],
      description: comp.description,
      tier,
      alternatives: computeComponents.slice(1).map((c) => c.name),
    });
    usedCategories.add('compute');

    // If ESP32-based compute is selected, WiFi/BLE may be built-in
    if (comp.name.includes('ESP32') && requiredCategories.has('wireless')) {
      usedCategories.add('wireless:wifi');
      usedCategories.add('wireless:ble');
    }
  }

  // Add components for each required category
  requiredCategories.forEach((category) => {
    if (category === 'compute') {
      return; // already handled
    }

    // Skip wireless if already covered by ESP32
    if (category === 'wireless') {
      const wifiReq = goal.requirements.some(
        (r) => r.category === 'wireless' && r.keywords.some((k) => ['wifi', 'wi-fi', 'wireless', 'wlan', '802.11'].includes(k)),
      );
      if (wifiReq && usedCategories.has('wireless:wifi')) {
        // WiFi covered by ESP32, but check for other wireless needs
        const otherWireless = goal.requirements.filter(
          (r) => r.category === 'wireless' && !r.keywords.some((k) => ['wifi', 'wi-fi', 'wireless', 'wlan', '802.11', 'bluetooth', 'ble', 'bt'].includes(k)),
        );
        otherWireless.forEach((req) => {
          const key = `${category}:${req.description}`;
          if (!usedCategories.has(key)) {
            usedCategories.add(key);
            addBestComponent(components, category, tier, req.keywords);
          }
        });
        return;
      }
    }

    const key = `${category}:general`;
    if (!usedCategories.has(key)) {
      usedCategories.add(key);
      addBestComponent(components, category, tier, []);
    }
  });

  // Add power management if battery or solar constraint
  if ((hasBatteryConstraint || hasSolarConstraint) && !requiredCategories.has('power')) {
    addBestComponent(components, 'power', tier, hasSolarConstraint ? ['solar'] : ['battery']);
  }

  // Always add basic power regulation if nothing was added
  if (!components.some((c) => c.category === 'power')) {
    const powerComp = selectComponents('power', 'minimal');
    if (powerComp.length > 0) {
      components.push({
        name: powerComp[0].name,
        category: 'power',
        partNumber: powerComp[0].partNumbers[0],
        description: powerComp[0].description,
        tier: 'minimal',
      });
    }
  }

  const tierLabels: Record<CandidateTier, string> = {
    minimal: 'Minimal — Get Started Quick',
    balanced: 'Balanced — Best Value',
    full: 'Full — Maximum Capability',
  };

  const { pros, cons } = generateProsCons(tier, components, goal);

  return {
    tier,
    label: tierLabels[tier],
    description: generateCandidateDescription(tier, components, goal),
    components,
    estimatedComplexity: tier === 'minimal' ? 'simple' : tier === 'balanced' ? 'moderate' : 'complex',
    pros,
    cons,
    estimatedNodeCount: estimateNodeCount(components),
  };
}

function selectComponents(
  category: RequirementCategory,
  tier: CandidateTier,
): ComponentKnowledge[] {
  // Find components that match the category and tier
  const exactMatch = COMPONENT_KB.filter((c) => c.category === category && c.tier === tier);
  if (exactMatch.length > 0) {
    return exactMatch;
  }

  // Fall back: for minimal, use minimal; for balanced, try balanced then minimal; for full, try full then balanced then minimal
  const tierFallback: Record<CandidateTier, CandidateTier[]> = {
    minimal: ['minimal'],
    balanced: ['balanced', 'minimal'],
    full: ['full', 'balanced', 'minimal'],
  };

  for (const fallbackTier of tierFallback[tier]) {
    const match = COMPONENT_KB.filter((c) => c.category === category && c.tier === fallbackTier);
    if (match.length > 0) {
      return match;
    }
  }

  return [];
}

function addBestComponent(
  components: ComponentSuggestion[],
  category: RequirementCategory,
  tier: CandidateTier,
  hints: string[],
): void {
  const candidates = selectComponents(category, tier);
  if (candidates.length === 0) {
    return;
  }

  // Score candidates by hint keyword match
  let best = candidates[0];
  if (hints.length > 0) {
    let bestScore = 0;
    candidates.forEach((c) => {
      const combinedText = `${c.name} ${c.description} ${c.capabilities.join(' ')}`.toLowerCase();
      let score = 0;
      hints.forEach((h) => {
        if (combinedText.includes(h.toLowerCase())) {
          score++;
        }
      });
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    });
  }

  components.push({
    name: best.name,
    category,
    partNumber: best.partNumbers[0],
    description: best.description,
    tier,
    alternatives: candidates.filter((c) => c !== best).map((c) => c.name),
  });
}

function estimateNodeCount(components: ComponentSuggestion[]): number {
  // Each component becomes 1 architecture node + supporting passives
  // Rule of thumb: 1 IC = ~3-5 total nodes (IC + decoupling caps + connectors)
  return components.reduce((sum, c) => {
    if (c.category === 'compute') {
      return sum + 5; // MCU + crystal + decoupling + reset + programming header
    }
    if (c.category === 'power') {
      return sum + 4; // regulator + input cap + output cap + inductor
    }
    return sum + 3; // component + supporting passives
  }, 0);
}

function generateCandidateDescription(
  tier: CandidateTier,
  components: ComponentSuggestion[],
  goal: ProductGoal,
): string {
  const componentCount = components.length;
  const domainStr = goal.detectedDomains.length > 0
    ? goal.detectedDomains[0].toLowerCase()
    : 'general-purpose';

  const descriptions: Record<CandidateTier, string> = {
    minimal: `Simplest ${domainStr} architecture with ${componentCount} core components. Focuses on essential functionality with minimal complexity. Good for prototyping and proof-of-concept.`,
    balanced: `Well-rounded ${domainStr} architecture with ${componentCount} components. Balances capability, cost, and complexity. Suitable for production-quality prototypes.`,
    full: `Feature-complete ${domainStr} architecture with ${componentCount} components. Maximum capability with premium parts. Designed for production or advanced prototyping.`,
  };

  return descriptions[tier];
}

function generateProsCons(
  tier: CandidateTier,
  components: ComponentSuggestion[],
  _goal: ProductGoal,
): { pros: string[]; cons: string[] } {
  const pros: string[] = [];
  const cons: string[] = [];

  if (tier === 'minimal') {
    pros.push('Lowest cost and fastest to build');
    pros.push('Simplest wiring and firmware');
    pros.push('Easiest to debug');
    cons.push('Limited headroom for feature expansion');
    cons.push('Basic sensors may lack accuracy');
    if (components.length <= 3) {
      cons.push('May require external modules for missing features');
    }
  } else if (tier === 'balanced') {
    pros.push('Good balance of features and cost');
    pros.push('Integrated wireless (WiFi + BLE) if ESP32-based');
    pros.push('Room for firmware upgrades');
    cons.push('Moderate wiring complexity');
    cons.push('Higher power consumption than minimal');
  } else {
    pros.push('Maximum sensor accuracy and range');
    pros.push('Production-ready component selection');
    pros.push('Best expansion capability');
    cons.push('Highest cost');
    cons.push('Most complex PCB layout');
    cons.push('Longer development timeline');
  }

  return { pros, cons };
}

// ---------------------------------------------------------------------------
// Utility: get all known component categories
// ---------------------------------------------------------------------------

export function getKnownComponents(): ComponentKnowledge[] {
  return [...COMPONENT_KB];
}

/**
 * Returns all requirement categories the parser can detect.
 */
export function getDetectableCategories(): RequirementCategory[] {
  const categories = new Set<RequirementCategory>();
  REQUIREMENT_RULES.forEach((rule) => {
    categories.add(rule.category);
  });
  return Array.from(categories);
}
