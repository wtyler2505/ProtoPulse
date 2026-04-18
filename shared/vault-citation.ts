/**
 * Vault Citation — structured links from breadboard rules to Ars Contexta notes.
 *
 * Wave 2 audit findings #252, #253, #263, #269, #270, #276, #284, #292, #356.
 *
 * Replaces scattered hardcoded rule strings with a single citation helper that
 * produces `{ slug, href }` objects. The slug corresponds to an atomic note in
 * the ProtoPulse vault (`knowledge/<slug>.md`); the UI renders `knowledge_base`
 * source chips via AnswerSourcePanel, which opens a modal dialog that calls
 * `/api/vault/note/:slug` for the full note body.
 *
 * CONTRACT:
 *   - Every slug in VAULT_SLUGS MUST correspond to `knowledge/<slug>.md`.
 *   - The module test (see __tests__/vault-citation.test.ts) verifies existence
 *     on every run — slug renames fail loudly instead of degrading silently.
 *   - `shared/` cannot import from `client/` or `server/` — this module is
 *     the base layer for DRC engines and UI alike.
 *
 * Related infra:
 *   - server/lib/vault-search.ts        — vault indexer + Fuse.js search
 *   - /api/vault/note/:slug              — full-note endpoint for the modal
 *   - client/…/AnswerSourcePanel.tsx    — renders clickable citation chips
 */

// ---------------------------------------------------------------------------
// VAULT_SLUGS — stable citation aliases
// ---------------------------------------------------------------------------

/**
 * Stable vault-note slug aliases. Cite these instead of inlining rule text so
 * updates propagate when vault knowledge changes. Previously lived at
 * `client/src/lib/circuit-editor/breadboard-constants.ts`; relocated here so
 * server-side rules and shared DRC helpers can consume the same table.
 */
export const VAULT_SLUGS = {
  // --- ESP32 safety-critical rules ---
  ESP32_GPIO6_11_FLASH: 'esp32-six-flash-gpios-must-never-be-used',
  ESP32_GPIO12_STRAPPING: 'esp32-gpio12-must-be-low-at-boot-or-module-crashes',
  ESP32_GPIO5_STRAPPING:
    'esp32-gpio5-is-a-strapping-pin-for-boot-message-printing-and-should-not-be-treated-as-unconditionally-safe',
  ESP32_GPIO34_39_INPUT: 'esp32-gpio34-39-are-input-only-with-no-internal-pull-resistors',
  ESP32_ADC2_WIFI: 'esp32-adc2-unavailable-when-wifi-active',
  ESP32_SAFE_PINS: 'esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions',
  // --- ESP32 peripheral / design ---
  ESP32_I2C_REMAPPABLE: 'esp32-i2c-is-software-implemented-and-remappable-to-any-gpio-pair',
  ESP32_ADC_NONLINEAR: 'esp32-adc-is-nonlinear-above-2v5-requiring-calibration-or-external-adc',
  ESP32_ADC_ATTENUATION: 'esp32-adc-attenuation-setting-determines-input-voltage-range',
  ESP32_AMS1117_CURRENT: 'esp32-ams1117-regulator-limits-total-board-current-to-800ma',
  ESP32_VSPI_SAFEST:
    'vspi-is-the-safest-esp32-spi-bus-because-hspi-pins-have-boot-restrictions',
  ESP32_VIN_10UF:
    '10uf-ceramic-on-esp32-vin-prevents-wifi-tx-brownouts-because-radio-bursts-pull-current-faster-than-the-buck-regulator-responds',
  ESP32_STRAPPING_BUFFER:
    '74hc14-schmitt-trigger-buffer-isolates-esp32-strapping-pins-from-external-loads-during-boot',
  ESP32_38PIN_FIT: 'esp32-38pin-barely-fits-breadboard-with-one-free-column',
  // --- ESP8266 ---
  ESP8266_I2C_BOOT_PINS:
    'breadboard-bench-coach-should-flag-i2c-on-esp8266-boot-pins-as-wiring-error',
  // --- Mega 2560 ---
  MEGA2560_TOO_WIDE: 'mega-2560-too-wide-for-any-breadboard',
  MEGA2560_7_8_GAP: 'mega-2560-pin-7-8-gap-for-shield-compatibility',
  MEGA2560_3V3_50MA: 'mega-3v3-output-limited-to-50ma-cannot-power-wifi-or-bluetooth-modules',
  MEGA2560_SPI_MOVED:
    'mega-spi-pins-move-from-d10-d13-to-d50-d53-breaking-hardcoded-uno-code-silently',
  // --- NodeMCU ---
  NODEMCU_AMICA_FIT:
    'nodemcu-amica-23mm-spacing-fits-standard-breadboard-with-both-rails-accessible',
  NODEMCU_DEEP_SLEEP:
    'nodemcu-board-draws-8-20ma-in-deep-sleep-defeating-chip-level-20ua-spec',
  // --- Breadboard power + fit rules ---
  POWER_MODULE_700MA:
    'breadboard-power-module-700ma-total-budget-excludes-servos-and-motors-requiring-separate-power',
  POWER_MODULE_WRONG_JUMPER:
    'wrong-jumper-voltage-on-breadboard-power-module-silently-destroys-3v3-components-with-no-warning',
  POWER_MODULE_PER_RAIL:
    'independent-per-rail-voltage-selection-enables-mixed-voltage-breadboard-prototyping-without-isolation-circuits',
  OFF_BOARD_ENFORCEMENT:
    'enforcing-impossible-fit-and-off-board-only-rules-prevents-invalid-physical-layouts-of-over-sized-modules-in-virtual-breadboards',
  // --- BLDC motor control ---
  BLDC_STOP_BRAKE: 'bldc-stop-active-low-brake-active-high',
  BLDC_COMMUTATION:
    'bldc-commutation-table-maps-hall-states-to-phase-pairs-and-only-two-of-six-wire-permutations-produce-smooth-rotation',
  BLDC_COMMON_GROUND:
    'bldc-controller-and-mcu-must-share-common-ground-or-control-signals-float',
  BLDC_REVERSAL_CURRENT:
    'bldc-direction-reversal-under-load-creates-destructive-current-spikes-through-mosfets',
  BLDC_STARTUP_SEQUENCE:
    'safe-bldc-startup-sequence-initializes-el-stopped-then-brake-engaged-then-enable-low-before-setting-any-active-state',
  // --- Hall sensors ---
  HALL_PULLUP_GRAY:
    'hall-sensor-open-collector-outputs-need-pull-up-resistors-and-produce-gray-code-not-binary-position',
  HALL_WIRING_ORDER: 'hall-sensor-wiring-order-matters-for-bldc',
  // --- L293D / L298N motor drivers ---
  L293D_DIP16:
    'l293d-dip-16-package-makes-it-the-only-motor-driver-ic-that-drops-directly-into-a-breadboard',
  L293D_GND_THERMAL:
    'l293d-ground-pins-are-the-primary-thermal-dissipation-path-not-just-electrical-connections',
  L293D_D_SUFFIX:
    'the-d-suffix-on-l293d-denotes-built-in-clamp-diodes-and-the-non-d-variant-is-a-destructive-substitution',
  L298N_NO_FLYBACK:
    'l298n-has-no-internal-flyback-diodes-unlike-l293d-making-external-protection-mandatory',
  // --- Decoupling / bypass (Wave 2 additions) ---
  DECOUPLING_100NF:
    'every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients',
  DECOUPLING_MISSING_FAILURE_MODES:
    'missing-decoupling-capacitors-produce-three-distinct-failure-modes',
  DECOUPLING_PER_VCC_PIN:
    'multi-vcc-ics-need-one-decoupling-capacitor-per-vcc-pin-not-one-per-package',
  // --- Motor driver / inductive load (Wave 2 additions) ---
  DRIVER_INDUCTIVE_FLYBACK:
    'drc-should-flag-direct-gpio-to-inductive-load-connections-and-suggest-driver-plus-flyback-subcircuit',
  HBRIDGE_BRAKE_COAST:
    'h-bridge-brake-and-coast-are-distinct-stop-modes-that-beginners-conflate',
} as const;

export type VaultSlugKey = keyof typeof VAULT_SLUGS;
export type VaultSlug = typeof VAULT_SLUGS[VaultSlugKey];

// ---------------------------------------------------------------------------
// cite() — structured citation helper
// ---------------------------------------------------------------------------

/**
 * A structured citation link — matches the `ToolSource` shape expected by
 * AnswerSourcePanel when `type === 'knowledge_base'`. The `id` field carries
 * the slug so the UI click-through resolves to `/api/vault/note/:slug`.
 */
export interface VaultCitation {
  /** Vault note slug (kebab-case, no extension). */
  slug: string;
  /** Canonical URL fragment for linking into the app's vault viewer. */
  href: string;
  /** Pre-built ToolSource-compatible object for direct drop-in to sources[]. */
  source: {
    type: 'knowledge_base';
    id: string;
    label: string;
  };
}

/**
 * Build a citation from a VAULT_SLUGS key.
 *
 *   cite('ESP32_GPIO12_STRAPPING')
 *   // => { slug: 'esp32-gpio12-…', href: '/knowledge/esp32-gpio12-…',
 *   //      source: { type: 'knowledge_base', id: 'esp32-gpio12-…', label: … } }
 *
 * The `label` is a human-friendly title derived from the slug; for ad-hoc
 * situations callers can pass `labelOverride` to attach a rule-specific message.
 */
export function cite(key: VaultSlugKey, labelOverride?: string): VaultCitation {
  const slug = VAULT_SLUGS[key];
  return citeSlug(slug, labelOverride);
}

/**
 * Build a citation from a raw slug string. Prefer `cite(key)` — only use this
 * form for slugs that have already been validated (e.g. round-tripped through
 * a vault-search result or a persisted `remediationLink` field).
 */
export function citeSlug(slug: string, labelOverride?: string): VaultCitation {
  return {
    slug,
    href: `/knowledge/${slug}`,
    source: {
      type: 'knowledge_base',
      id: slug,
      label: labelOverride ?? slugToLabel(slug),
    },
  };
}

/**
 * Convert a kebab-case slug back into a readable title-ish label.
 * Best-effort — for precise titles, fetch via `/api/vault/note/:slug`.
 */
export function slugToLabel(slug: string): string {
  return slug
    .split('-')
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Legacy compatibility — named constants mirroring VAULT_SLUGS
// ---------------------------------------------------------------------------

// (kept as direct export above — consumers should prefer `cite(KEY)`.)
