/**
 * Breadboard Lab — Central Constants Module
 *
 * Single source of truth for all magic numbers that were previously scattered
 * across BreadboardView.tsx, breadboard-model.ts, breadboard-drc.ts, and
 * related files. Addresses Theme A of the deep-audit plan at:
 * /home/wtyler/.claude/plans/calm-yawning-kitten.md
 *
 * Findings addressed: #185–187, #199, #203, #220–223, #227, #231, #258,
 * #270, #271, #349, #352, #360, #365, #370, #377, #386.
 *
 * Style precedent: client/src/lib/compliance/compliance-constants.ts
 * (Record-shaped lookup tables with JSDoc citing standards, helper functions
 * alongside constants, section-comment dividers).
 *
 * CONTRACT: No runtime imports from other project modules — this file is a
 * pure data module. Consumers import from here; this module imports from
 * nothing in the application tree.
 */

// ---------------------------------------------------------------------------
// PHYSICAL — datasheet-authoritative breadboard geometry
// ---------------------------------------------------------------------------

/**
 * Physical dimensions and geometry for the BB830 breadboard.
 * All values are datasheet-authoritative. Do NOT change these to match
 * on-screen rendering — that is UI's job. Source: busboard.com/BB830.
 */
export const PHYSICAL = {
  /** Industry-standard 0.1" pitch — 2.54mm exact. Source: BB830 datasheet. */
  PITCH_MM: 2.54,
  /**
   * CSS px equivalent at 96dpi: 2.54mm × (96/25.4) = 9.6 exactly.
   * W3C CSS Values Level 3 §5.2 defines 1in = 96px and 1in = 2.54cm.
   * Note: the UI layer uses UI.PITCH_PX = 10 as a documented rounding
   * pitfall — over 63 rows this accumulates 25.2 px drift. Use this
   * constant for physical-to-CSS conversions, NOT UI.PITCH_PX.
   */
  PITCH_PX_96DPI: 9.6,
  /** BB830 width in mm (landscape orientation). Source: busboard.com/BB830. */
  BOARD_WIDTH_MM: 165.1,
  /** BB830 height in mm. Source: busboard.com/BB830. */
  BOARD_HEIGHT_MM: 54.6,
  /** BB830 thickness in mm. Source: busboard.com/BB830. */
  BOARD_THICKNESS_MM: 8.5,
  /** DIP center-channel gap — 0.3" = 7.62mm, fits standard 0.3" DIP ICs straddling e/f cols. */
  CHANNEL_GAP_MM: 7.62,
  /** Real-world BB830 tie-point count. Matches BB.PHYSICAL_TIE_POINTS in breadboard-model. */
  TIE_POINTS: 830,
} as const;

// ---------------------------------------------------------------------------
// UI — canvas/rendering pixel values (app-specific, some documented pitfalls)
// ---------------------------------------------------------------------------

/**
 * Canvas and rendering pixel values for the Breadboard Lab view.
 * Several of these values are intentionally rounded from physical equivalents
 * for integer-friendly math — see individual JSDoc for the documented pitfalls.
 */
export const UI = {
  /**
   * Legacy pixel-pitch used throughout the canvas. The CSS-accurate value at
   * 96dpi is PHYSICAL.PITCH_PX_96DPI = 9.6, but the app uses 10 for simplicity
   * and integer-friendly math. Over 63 rows this is 25.2 px total drift vs
   * physical pitch — acceptable inside UI, but DO NOT use for physical
   * measurement conversions. (audit #220)
   */
  PITCH_PX: 10,
  /** Canvas origin X offset (px) from SVG top-left. Leaves room for row labels. */
  ORIGIN_X_PX: 30,
  /** Canvas origin Y offset (px). */
  ORIGIN_Y_PX: 50,
  /** Gap height between rails and terminal strips on canvas (px). */
  CHANNEL_GAP_PX: 20,
  /** Distance from left edge of terminal strips to left rails (px). */
  RAIL_MARGIN_LEFT_PX: 20,
  /** Distance from right edge of terminal strips to right rails (px). */
  RAIL_MARGIN_RIGHT_PX: 20,
  /** Terminal hole radius as fraction of pitch. Renders as PITCH_PX × this. (audit #185) */
  HOLE_RADIUS_TERMINAL_FRACTION: 0.28,
  /** Rail hole radius as fraction of pitch (slightly smaller than terminals). */
  HOLE_RADIUS_RAIL_FRACTION: 0.24,
  /** Pixels added to hole radius on hover for feedback. */
  HOVER_RADIUS_DELTA_PX: 1,
  /** Unified snap radius for grid coordinate resolution (px). PITCH_PX × 0.6. (audits #199, #223, #370) */
  SNAP_RADIUS_PX: 6,
  /** Wire-endpoint snap tolerance in px — larger than SNAP_RADIUS_PX to catch near-misses during drag. (audit #199) */
  PIN_SNAP_TOLERANCE_PX: 15,
  /** Visible radius of bench-part connector anchors (px). */
  BENCH_ANCHOR_VISIBLE_RADIUS_PX: 3.1,
  /** Invisible hit-area radius of bench-part connector anchors (px). Kept larger than visible for touch forgiveness but <= 2x visible to avoid "click from far away" surprises. (audit #196) */
  BENCH_ANCHOR_HIT_RADIUS_PX: 5,
} as const;

// ---------------------------------------------------------------------------
// SEVERITY_WEIGHTS — audit score deduction per issue
// ---------------------------------------------------------------------------

/**
 * Score-deduction weights by severity, on a 100-point scale.
 * Recalibrated per audit #271: previous (critical=15, warning=8, info=3) led
 * 3 critical issues to only drop score by 45 — qualitatively insufficient
 * for 3 restricted-pin violations.
 */
export const SEVERITY_WEIGHTS = {
  critical: 20,
  warning: 10,
  info: 2,
} as const;

// ---------------------------------------------------------------------------
// LAYOUT_QUALITY — scoring thresholds and curve parameters
// ---------------------------------------------------------------------------

/**
 * Layout-quality scoring constants. Derivation notes (audit #245, #246, #285):
 * - Base pin-trust values were empirically calibrated against Tyler's pilot layouts.
 * - CRITICAL_HEURISTIC_PENALTY was reduced from 10 to 5 to avoid unrealistic
 *   pessimism on heuristic parts (3+ critical pins previously clamped at 24 floor).
 * - CRITICAL_HEURISTIC_FLOOR raised from 24 to 30 for the same reason.
 * - STASH_MODIFIER_MAX clamped from ±5 to ±3 to restore scoring monotonicity
 *   when stash readiness flips (audit #246).
 */
export const LAYOUT_QUALITY = {
  PIN_TRUST_BASE_VERIFIED: 96,
  PIN_TRUST_BASE_CONNECTOR: 80,
  PIN_TRUST_BASE_HEURISTIC: 62,
  PIN_TRUST_BASE_STASH_ABSENT: 45,
  CRITICAL_HEURISTIC_PENALTY: 5,
  CRITICAL_HEURISTIC_FLOOR: 30,
  STASH_MODIFIER_MAX: 3,
  BAND_DIALED_IN: 85,
  BAND_SOLID: 68,
  BAND_DEVELOPING: 48,
  TONE_GOOD_THRESHOLD: 85,
  TONE_WATCH_THRESHOLD: 65,
} as const;

// ---------------------------------------------------------------------------
// POWER_BUDGET — current-draw thresholds for preflight checks
// ---------------------------------------------------------------------------

/**
 * Power-budget thresholds in milliamps.
 * - USB rail: 500 mA hard cap (USB 2.0 standard), warn at 80% (400 mA).
 * - External breadboard-power module: 700 mA external-load cap before
 *   motors/servos must move to dedicated supply. Source vault note:
 *   breadboard-power-module-700ma-total-budget-excludes-servos-and-motors...
 * Split introduced per audit #258.
 */
export const POWER_BUDGET = {
  USB_WARN_MA: 400,
  USB_FAIL_MA: 500,
  EXTERNAL_MODULE_FAIL_MA: 700,
} as const;

// ---------------------------------------------------------------------------
// VAULT_SLUGS — stable citation aliases for audit/coach/prompt integration
// ---------------------------------------------------------------------------

/**
 * Stable vault-note slug aliases for audit rules, coach plans, and AI prompts.
 * Cite these instead of hardcoded rule text so rule updates propagate when
 * vault knowledge changes. Addresses Theme A (magic numbers → vault citations)
 * across findings #252, #269, #270, #283, #292, #356.
 *
 * CONTRACT: every slug in this object MUST correspond to an existing
 * `knowledge/<slug>.md` file. The module test verifies this on every run —
 * if a note is renamed/deleted in the vault, the test fails loudly so the
 * slug constant gets updated instead of quietly going stale.
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
} as const;

export type VaultSlugKey = keyof typeof VAULT_SLUGS;
