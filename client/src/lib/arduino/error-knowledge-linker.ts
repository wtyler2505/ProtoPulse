// ---------------------------------------------------------------------------
// Error → Knowledge Hub Linker
// ---------------------------------------------------------------------------
// Maps Arduino compile/upload errors and warnings to relevant knowledge hub
// articles from electronics-knowledge.ts. Each error pattern is linked to one
// or more article IDs, providing a "Learn more" pathway for makers who
// encounter unfamiliar compiler diagnostics.
//
// Usage:
//   import { getKnowledgeLinks } from '@/lib/arduino/error-knowledge-linker';
//   const links = getKnowledgeLinks(errorMessage);
//   // links = [{ articleId: 'resistors', title: 'Resistors', relevance: 'primary' }]
// ---------------------------------------------------------------------------

import { ElectronicsKnowledgeBase } from '@/lib/electronics-knowledge';
import type { ErrorTranslation } from './error-translator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LinkRelevance = 'primary' | 'secondary';

export interface KnowledgeLink {
  /** Article ID in the knowledge hub. */
  articleId: string;
  /** Human-readable article title. */
  title: string;
  /** Whether this is a primary or supplementary match. */
  relevance: LinkRelevance;
}

export interface LinkedError extends ErrorTranslation {
  /** Knowledge hub articles relevant to this error. */
  knowledgeLinks: KnowledgeLink[];
}

// ---------------------------------------------------------------------------
// Error-to-article mapping rules
// ---------------------------------------------------------------------------
// Each rule matches against the raw error message (case-insensitive) and
// maps to one or more knowledge hub article IDs with relevance ranking.

interface ErrorArticleRule {
  /** Regex to test against the error message or translated text. */
  pattern: RegExp;
  /** Primary article IDs — most directly relevant. */
  primary: string[];
  /** Secondary article IDs — supplementary context. */
  secondary: string[];
}

const ERROR_ARTICLE_RULES: ErrorArticleRule[] = [
  // --- Include / library errors ---
  {
    pattern: /(?:Serial|HardwareSerial).*(?:not declared|does not name)/i,
    primary: ['uart'],
    secondary: ['i2c', 'spi'],
  },
  {
    pattern: /(?:(?:Wire|TwoWire).*(?:not declared|does not name|no matching)|(?:not declared|does not name|no matching).*(?:Wire|TwoWire))/i,
    primary: ['i2c'],
    secondary: ['pull-up-pull-down'],
  },
  {
    pattern: /(?:SPI|SPIClass).*(?:not declared|does not name|no matching)/i,
    primary: ['spi'],
    secondary: [],
  },
  {
    pattern: /(?:analogRead|analogWrite|ADC|analogSetAttenuation)/i,
    primary: ['adc-dac'],
    secondary: ['pwm', 'voltage-dividers'],
  },
  {
    pattern: /(?:ledcSetup|ledcAttachPin|ledcWrite|analogWrite.*PWM)/i,
    primary: ['pwm'],
    secondary: ['mosfets', 'h-bridges'],
  },
  {
    pattern: /(?:Servo|myservo|attach).*(?:not declared|does not name|no matching)/i,
    primary: ['pwm'],
    secondary: [],
  },
  {
    pattern: /(?:pinMode|INPUT_PULLUP|PULLUP|PULLDOWN)/i,
    primary: ['pull-up-pull-down'],
    secondary: ['resistors'],
  },
  {
    pattern: /(?:digitalWrite|digitalRead|HIGH|LOW).*(?:not declared)/i,
    primary: ['pull-up-pull-down'],
    secondary: ['mosfets', 'transistors'],
  },

  // --- Memory / size errors ---
  {
    pattern: /(?:section|\.text).*(?:will not fit|overflow)/i,
    primary: ['pcb-basics'],
    secondary: [],
  },
  {
    pattern: /(?:RAM|data|SRAM).*(?:overflow|exceeded|not enough)/i,
    primary: ['pcb-basics'],
    secondary: [],
  },
  {
    pattern: /(?:region).*(?:overflowed)/i,
    primary: ['pcb-basics'],
    secondary: [],
  },

  // --- Upload / communication errors ---
  {
    pattern: /(?:avrdude|esptool).*(?:not in sync|sync error|timeout)/i,
    primary: ['uart'],
    secondary: ['pcb-basics'],
  },
  {
    pattern: /(?:avrdude|esptool).*(?:device signature|chip id)/i,
    primary: ['pcb-basics'],
    secondary: ['uart'],
  },
  {
    pattern: /(?:port|serial).*(?:not found|unavailable|busy|denied)/i,
    primary: ['uart'],
    secondary: [],
  },
  {
    pattern: /(?:baud|baud rate|baudrate)/i,
    primary: ['uart'],
    secondary: [],
  },

  // --- Voltage / type conversion errors (often relate to signal levels) ---
  {
    pattern: /invalid conversion.*(?:int|float|double|long|char|byte|uint)/i,
    primary: ['adc-dac'],
    secondary: [],
  },
  {
    pattern: /comparison between signed and unsigned/i,
    primary: ['adc-dac'],
    secondary: [],
  },

  // --- Motor / H-bridge related ---
  {
    pattern: /(?:L298|L293|TB6612|BTS7960|motor|Motor).*(?:not declared|does not name)/i,
    primary: ['h-bridges'],
    secondary: ['mosfets', 'pwm'],
  },

  // --- Display / OLED related ---
  {
    pattern: /(?:SSD1306|Adafruit_SSD1306|OLED|display|U8g2).*(?:not declared|does not name|no matching)/i,
    primary: ['i2c'],
    secondary: ['spi'],
  },

  // --- Sensor / measurement related ---
  {
    pattern: /(?:BME280|BMP280|DHT|MPU6050|IMU|sensor).*(?:not declared|does not name)/i,
    primary: ['i2c'],
    secondary: ['adc-dac', 'spi'],
  },

  // --- Op-amp / amplifier related ---
  {
    pattern: /(?:\bgain\b|amplif|opamp|op-amp|LM358|MCP6002)/i,
    primary: ['op-amps'],
    secondary: ['resistors', 'rc-lc-filters'],
  },

  // --- Voltage regulator related ---
  {
    pattern: /(?:7805|LM1117|AMS1117|LM317|LDO|regulator|Vin|voltage.*reg)/i,
    primary: ['voltage-regulators'],
    secondary: ['decoupling-capacitors', 'capacitors'],
  },

  // --- Capacitor / decoupling related ---
  {
    pattern: /(?:bypass|decoupling|decouple|bulk.*cap)/i,
    primary: ['decoupling-capacitors'],
    secondary: ['capacitors', 'voltage-regulators'],
  },

  // --- MOSFET / transistor related ---
  {
    pattern: /(?:IRLZ44|IRF540|IRF9540|MOSFET|FET|gate.*drive)/i,
    primary: ['mosfets'],
    secondary: ['transistors', 'h-bridges'],
  },
  {
    pattern: /(?:2N2222|2N3904|BC547|BC557|NPN|PNP|BJT|base.*resist)/i,
    primary: ['transistors'],
    secondary: ['resistors', 'diodes'],
  },

  // --- Diode / LED related ---
  {
    pattern: /(?:1N4001|1N5817|Zener|TVS|flyback|reverse.*polarity)/i,
    primary: ['diodes'],
    secondary: ['voltage-regulators'],
  },
  {
    pattern: /(?:LED|led).*(?:not declared|resistor|current.*limit)/i,
    primary: ['diodes'],
    secondary: ['resistors', 'pwm'],
  },

  // --- Filter related ---
  {
    pattern: /(?:low.?pass|high.?pass|band.?pass|cutoff.*freq|filter)/i,
    primary: ['rc-lc-filters'],
    secondary: ['capacitors', 'inductors', 'resistors'],
  },

  // --- PCB / soldering related ---
  {
    pattern: /(?:trace|via|footprint|pad|solder|Gerber|DRC|clearance)/i,
    primary: ['pcb-basics'],
    secondary: ['soldering-tips'],
  },

  // --- Resistor / voltage divider related ---
  {
    pattern: /(?:voltage.*divider|level.*shift|pull.?up|pull.?down)/i,
    primary: ['voltage-dividers'],
    secondary: ['resistors', 'pull-up-pull-down'],
  },
  {
    pattern: /(?:color.*code|E12|E24|tolerance|ohm)/i,
    primary: ['resistors'],
    secondary: ['voltage-dividers'],
  },

  // --- General include errors (fallback — suggest checking library docs) ---
  {
    pattern: /no such file or directory/i,
    primary: [],
    secondary: ['i2c', 'spi', 'uart'],
  },
  {
    pattern: /not declared in this scope/i,
    primary: [],
    secondary: [],
  },
  {
    pattern: /does not name a type/i,
    primary: [],
    secondary: [],
  },
  {
    pattern: /undefined reference to/i,
    primary: [],
    secondary: [],
  },
];

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Resolve article IDs to KnowledgeLink objects with titles from the hub.
 * Filters out any article IDs that don't exist in the knowledge base.
 */
function resolveLinks(
  primaryIds: string[],
  secondaryIds: string[],
  kb: ElectronicsKnowledgeBase,
): KnowledgeLink[] {
  const links: KnowledgeLink[] = [];
  const seen = new Set<string>();

  for (const id of primaryIds) {
    if (seen.has(id)) {
      continue;
    }
    const article = kb.getArticle(id);
    if (article) {
      links.push({ articleId: id, title: article.title, relevance: 'primary' });
      seen.add(id);
    }
  }

  for (const id of secondaryIds) {
    if (seen.has(id)) {
      continue;
    }
    const article = kb.getArticle(id);
    if (article) {
      links.push({ articleId: id, title: article.title, relevance: 'secondary' });
      seen.add(id);
    }
  }

  return links;
}

/**
 * Find knowledge hub articles relevant to a given error message.
 * Tests the message against all error-article rules and returns
 * matching article links ranked by relevance.
 *
 * @param errorMessage - The raw or translated error message to match.
 * @returns Array of KnowledgeLink objects (may be empty if no match found).
 */
export function getKnowledgeLinks(errorMessage: string): KnowledgeLink[] {
  if (!errorMessage || errorMessage.trim().length === 0) {
    return [];
  }

  const kb = ElectronicsKnowledgeBase.getInstance();
  const allPrimary: string[] = [];
  const allSecondary: string[] = [];

  for (const rule of ERROR_ARTICLE_RULES) {
    if (rule.pattern.test(errorMessage)) {
      allPrimary.push(...rule.primary);
      allSecondary.push(...rule.secondary);
    }
  }

  // If we matched rules but they had no article mappings (generic fallbacks),
  // don't return empty — the caller can handle the no-links case.
  return resolveLinks(allPrimary, allSecondary, kb);
}

/**
 * Find knowledge hub articles relevant to an ErrorTranslation object.
 * Searches across the original message, translated text, and suggestion
 * for broader matching coverage.
 *
 * @param translation - An ErrorTranslation from the error-translator.
 * @returns Array of KnowledgeLink objects.
 */
export function getKnowledgeLinksForTranslation(translation: ErrorTranslation): KnowledgeLink[] {
  // Try matching against original, translated, and suggestion text
  const textsToMatch = [translation.original, translation.translated, translation.suggestion];

  const kb = ElectronicsKnowledgeBase.getInstance();
  const allPrimary: string[] = [];
  const allSecondary: string[] = [];

  for (const text of textsToMatch) {
    for (const rule of ERROR_ARTICLE_RULES) {
      if (rule.pattern.test(text)) {
        allPrimary.push(...rule.primary);
        allSecondary.push(...rule.secondary);
      }
    }
  }

  return resolveLinks(allPrimary, allSecondary, kb);
}

/**
 * Enrich an array of ErrorTranslation objects with knowledge hub links.
 * Returns new LinkedError objects (does not mutate the input array).
 *
 * @param translations - Array of ErrorTranslation objects to enrich.
 * @returns Array of LinkedError objects with knowledgeLinks attached.
 */
export function linkErrorsToKnowledge(translations: ErrorTranslation[]): LinkedError[] {
  return translations.map((t) => ({
    ...t,
    knowledgeLinks: getKnowledgeLinksForTranslation(t),
  }));
}

/**
 * Get the total number of error-article mapping rules.
 * Useful for testing and diagnostics.
 */
export function getRuleCount(): number {
  return ERROR_ARTICLE_RULES.length;
}

/**
 * Get all unique article IDs referenced across all rules.
 * Useful for validation that all referenced articles exist.
 */
export function getReferencedArticleIds(): string[] {
  const ids = new Set<string>();
  for (const rule of ERROR_ARTICLE_RULES) {
    for (const id of rule.primary) {
      ids.add(id);
    }
    for (const id of rule.secondary) {
      ids.add(id);
    }
  }
  return Array.from(ids).sort();
}
