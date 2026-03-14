/**
 * SensorInputManager — manages environmental sensor inputs during live
 * simulation (BL-0622).
 *
 * Provides sensor type definitions with physics-based voltage/ADC
 * conversion functions, auto-detection of sensors from circuit instances,
 * and slider-driven environmental value overrides that feed back into
 * simulation state.
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported sensor hardware families. */
export type SensorFamily =
  | 'ntc_10k'
  | 'lm35'
  | 'ldr'
  | 'photodiode'
  | 'hc_sr04'
  | 'potentiometer'
  | 'dht11'
  | 'dht22'
  | 'bmp280';

/** Definition of a sensor type with its physics model. */
export interface SensorTypeDefinition {
  /** Machine-readable family identifier. */
  family: SensorFamily;
  /** Human-readable name. */
  name: string;
  /** Environmental quantity unit (e.g. '°C', 'lux', 'cm'). */
  unit: string;
  /** Minimum environmental value. */
  min: number;
  /** Maximum environmental value. */
  max: number;
  /** Default starting environmental value. */
  defaultValue: number;
  /** Convert environmental value → output voltage (V). */
  voltageFunction: (envValue: number) => number;
  /**
   * Convert environmental value → raw ADC digital reading.
   * @param envValue The environmental input value.
   * @param resolution ADC bit width (default 10 for Arduino).
   * @param vRef ADC reference voltage (default 5.0 V).
   */
  adcFunction: (envValue: number, resolution?: number, vRef?: number) => number;
}

/** A detected sensor instance with its current environmental value. */
export interface SensorInput {
  /** Unique sensor instance id (typically referenceDesignator). */
  id: string;
  /** The sensor type definition. */
  type: SensorTypeDefinition;
  /** Current environmental value set by the user. */
  currentValue: number;
}

/** Snapshot returned by getSnapshot(). */
export interface SensorInputSnapshot {
  sensors: ReadonlyArray<Readonly<SensorInput>>;
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Physics constants
// ---------------------------------------------------------------------------

/** Steinhart-Hart NTC parameters for a standard 10K thermistor. */
const NTC_B = 3950;
const NTC_R0 = 10_000; // 10kΩ at T0
const NTC_T0_K = 298.15; // 25°C in Kelvin
const KELVIN_OFFSET = 273.15;

/** Speed of sound in air at 20°C (cm/µs). */
const SPEED_OF_SOUND_CM_US = 0.0343;

// ---------------------------------------------------------------------------
// Voltage → ADC helper
// ---------------------------------------------------------------------------

function voltageToAdc(voltage: number, resolution = 10, vRef = 5.0): number {
  const maxAdc = Math.pow(2, resolution) - 1;
  const clamped = Math.max(0, Math.min(vRef, voltage));
  return Math.round((clamped / vRef) * maxAdc);
}

// ---------------------------------------------------------------------------
// Sensor type definitions
// ---------------------------------------------------------------------------

/** NTC 10K thermistor — Steinhart-Hart equation (B-parameter model). */
const NTC_10K: SensorTypeDefinition = {
  family: 'ntc_10k',
  name: 'NTC 10K Thermistor',
  unit: '°C',
  min: -40,
  max: 125,
  defaultValue: 25,
  voltageFunction(tempC: number): number {
    // Resistance at temperature T: R = R0 * exp(B * (1/T - 1/T0))
    const tK = tempC + KELVIN_OFFSET;
    const resistance = NTC_R0 * Math.exp(NTC_B * (1 / tK - 1 / NTC_T0_K));
    // Voltage divider with 10K pull-up to 5V: Vout = 5 * R / (R + 10000)
    return 5.0 * resistance / (resistance + NTC_R0);
  },
  adcFunction(tempC: number, resolution = 10, vRef = 5.0): number {
    return voltageToAdc(NTC_10K.voltageFunction(tempC), resolution, vRef);
  },
};

/** LM35 linear temperature sensor — 10mV/°C, 0V at 0°C. */
const LM35: SensorTypeDefinition = {
  family: 'lm35',
  name: 'LM35 Temperature',
  unit: '°C',
  min: -55,
  max: 150,
  defaultValue: 25,
  voltageFunction(tempC: number): number {
    // LM35: 10mV per degree C, 0V at 0°C
    return tempC * 0.01;
  },
  adcFunction(tempC: number, resolution = 10, vRef = 5.0): number {
    return voltageToAdc(LM35.voltageFunction(tempC), resolution, vRef);
  },
};

/** LDR (light-dependent resistor) — logarithmic resistance model. */
const LDR: SensorTypeDefinition = {
  family: 'ldr',
  name: 'LDR (Light Sensor)',
  unit: 'lux',
  min: 0.1,
  max: 100_000,
  defaultValue: 500,
  voltageFunction(lux: number): number {
    // Typical LDR: R ≈ R_10lux / (lux/10)^0.7 where R_10lux ≈ 10kΩ
    // With 10K pull-up to 5V: Vout = 5 * R_ldr / (R_ldr + 10000)
    const safeLux = Math.max(0.1, lux);
    const resistance = 10_000 / Math.pow(safeLux / 10, 0.7);
    return 5.0 * resistance / (resistance + 10_000);
  },
  adcFunction(lux: number, resolution = 10, vRef = 5.0): number {
    return voltageToAdc(LDR.voltageFunction(lux), resolution, vRef);
  },
};

/** Photodiode — linear current proportional to light intensity. */
const PHOTODIODE: SensorTypeDefinition = {
  family: 'photodiode',
  name: 'Photodiode',
  unit: 'lux',
  min: 0,
  max: 100_000,
  defaultValue: 500,
  voltageFunction(lux: number): number {
    // Typical photodiode: ~1µA per 100 lux, into 10kΩ transimpedance
    // V = I * R = (lux / 100) * 1e-6 * 10000 = lux * 1e-4
    const voltage = lux * 1e-4;
    return Math.min(5.0, voltage);
  },
  adcFunction(lux: number, resolution = 10, vRef = 5.0): number {
    return voltageToAdc(PHOTODIODE.voltageFunction(lux), resolution, vRef);
  },
};

/** HC-SR04 ultrasonic distance sensor — echo time proportional to distance. */
const HC_SR04: SensorTypeDefinition = {
  family: 'hc_sr04',
  name: 'HC-SR04 Distance',
  unit: 'cm',
  min: 2,
  max: 400,
  defaultValue: 50,
  voltageFunction(distCm: number): number {
    // Echo pin: HIGH duration in µs = distance * 2 / speed_of_sound
    // Normalize to 0-5V proportional to distance (0-400cm range)
    const clampedDist = Math.max(2, Math.min(400, distCm));
    return (clampedDist / 400) * 5.0;
  },
  adcFunction(distCm: number, resolution = 10, vRef = 5.0): number {
    return voltageToAdc(HC_SR04.voltageFunction(distCm), resolution, vRef);
  },
};

/** Potentiometer — simple voltage divider. */
const POTENTIOMETER: SensorTypeDefinition = {
  family: 'potentiometer',
  name: 'Potentiometer',
  unit: '%',
  min: 0,
  max: 100,
  defaultValue: 50,
  voltageFunction(percent: number): number {
    // Linear wiper: Vout = Vcc * (percent / 100)
    return 5.0 * (percent / 100);
  },
  adcFunction(percent: number, resolution = 10, vRef = 5.0): number {
    return voltageToAdc(POTENTIOMETER.voltageFunction(percent), resolution, vRef);
  },
};

/** DHT11 humidity sensor — capacitive, 1% resolution. */
const DHT11: SensorTypeDefinition = {
  family: 'dht11',
  name: 'DHT11 Humidity',
  unit: '%RH',
  min: 20,
  max: 90,
  defaultValue: 50,
  voltageFunction(rh: number): number {
    // DHT11 is digital (one-wire), but we model an analog equivalent
    // Typical capacitive humidity sensor: ~30mV per %RH
    const clampedRH = Math.max(20, Math.min(90, rh));
    return clampedRH * 0.03;
  },
  adcFunction(rh: number, resolution = 10, vRef = 5.0): number {
    return voltageToAdc(DHT11.voltageFunction(rh), resolution, vRef);
  },
};

/** DHT22 humidity sensor — wider range, higher resolution. */
const DHT22: SensorTypeDefinition = {
  family: 'dht22',
  name: 'DHT22 Humidity',
  unit: '%RH',
  min: 0,
  max: 100,
  defaultValue: 50,
  voltageFunction(rh: number): number {
    // Same analog model as DHT11, wider range
    const clampedRH = Math.max(0, Math.min(100, rh));
    return clampedRH * 0.03;
  },
  adcFunction(rh: number, resolution = 10, vRef = 5.0): number {
    return voltageToAdc(DHT22.voltageFunction(rh), resolution, vRef);
  },
};

/** BMP280 pressure sensor — barometric pressure. */
const BMP280: SensorTypeDefinition = {
  family: 'bmp280',
  name: 'BMP280 Pressure',
  unit: 'hPa',
  min: 300,
  max: 1100,
  defaultValue: 1013.25,
  voltageFunction(hPa: number): number {
    // BMP280 is I2C/SPI digital, but we model analog equivalent
    // Map 300-1100 hPa to 0.5-4.5V (typical ratiometric sensor output)
    const clampedHPa = Math.max(300, Math.min(1100, hPa));
    return 0.5 + ((clampedHPa - 300) / (1100 - 300)) * 4.0;
  },
  adcFunction(hPa: number, resolution = 10, vRef = 5.0): number {
    return voltageToAdc(BMP280.voltageFunction(hPa), resolution, vRef);
  },
};

// ---------------------------------------------------------------------------
// Sensor type registry
// ---------------------------------------------------------------------------

/** All built-in sensor type definitions, keyed by family. */
export const SENSOR_TYPES: ReadonlyMap<SensorFamily, SensorTypeDefinition> = new Map([
  ['ntc_10k', NTC_10K],
  ['lm35', LM35],
  ['ldr', LDR],
  ['photodiode', PHOTODIODE],
  ['hc_sr04', HC_SR04],
  ['potentiometer', POTENTIOMETER],
  ['dht11', DHT11],
  ['dht22', DHT22],
  ['bmp280', BMP280],
]);

// ---------------------------------------------------------------------------
// Auto-detection from circuit instances
// ---------------------------------------------------------------------------

/** Minimal shape needed to detect sensors from circuit data. */
export interface DetectableInstance {
  referenceDesignator: string;
  properties: Record<string, unknown> | null;
}

/**
 * Map of component type patterns → sensor family.
 * Checked in order — first match wins.
 */
const DETECTION_PATTERNS: ReadonlyArray<{ pattern: RegExp; family: SensorFamily }> = [
  { pattern: /\bntc\b/i, family: 'ntc_10k' },
  { pattern: /\bthermistor\b/i, family: 'ntc_10k' },
  { pattern: /\blm35\b/i, family: 'lm35' },
  { pattern: /\bldr\b/i, family: 'ldr' },
  { pattern: /\bphoto\s*resistor\b/i, family: 'ldr' },
  { pattern: /\blight[\s_-]*dependent[\s_-]*resistor\b/i, family: 'ldr' },
  { pattern: /\bphotodiode\b/i, family: 'photodiode' },
  { pattern: /\bhc[\s_-]*sr04\b/i, family: 'hc_sr04' },
  { pattern: /\bultrasonic\b/i, family: 'hc_sr04' },
  { pattern: /\bpotentiometer\b/i, family: 'potentiometer' },
  { pattern: /\bpot\b/i, family: 'potentiometer' },
  { pattern: /\bdht[\s_-]*11\b/i, family: 'dht11' },
  { pattern: /\bdht[\s_-]*22\b/i, family: 'dht22' },
  { pattern: /\bam2302\b/i, family: 'dht22' },
  { pattern: /\bbmp[\s_-]*280\b/i, family: 'bmp280' },
  { pattern: /\bbarometric\b/i, family: 'bmp280' },
];

/**
 * Detect sensor components from a list of circuit instances.
 * Inspects componentType and name from instance properties.
 */
export function detectSensors(instances: DetectableInstance[]): SensorInput[] {
  const results: SensorInput[] = [];

  for (const inst of instances) {
    const props = (inst.properties && typeof inst.properties === 'object')
      ? inst.properties as Record<string, unknown>
      : {};

    const componentType = String(props.componentType ?? '');
    const name = String(props.name ?? '');
    const combined = `${componentType} ${name} ${inst.referenceDesignator}`;

    for (const { pattern, family } of DETECTION_PATTERNS) {
      if (pattern.test(combined)) {
        const typeDef = SENSOR_TYPES.get(family);
        if (typeDef) {
          results.push({
            id: inst.referenceDesignator,
            type: typeDef,
            currentValue: typeDef.defaultValue,
          });
        }
        break; // First match wins for this instance
      }
    }
  }

  // Sort by reference designator for stable ordering
  results.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return results;
}

// ---------------------------------------------------------------------------
// SensorInputManager (singleton + subscribe)
// ---------------------------------------------------------------------------

export class SensorInputManager {
  private static _instance: SensorInputManager | null = null;

  /** Active sensor inputs keyed by instance id. */
  private sensors = new Map<string, SensorInput>();

  /** Registered listeners for state changes. */
  private listeners = new Set<Listener>();

  /** Immutable snapshot — refreshed on every mutation. */
  private snapshot: SensorInputSnapshot = { sensors: [] };

  private constructor() {}

  static getInstance(): SensorInputManager {
    if (!SensorInputManager._instance) {
      SensorInputManager._instance = new SensorInputManager();
    }
    return SensorInputManager._instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    SensorInputManager._instance = null;
  }

  // -------------------------------------------------------------------------
  // Subscribe pattern (useSyncExternalStore compatible)
  // -------------------------------------------------------------------------

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): SensorInputSnapshot => {
    return this.snapshot;
  };

  private rebuildSnapshot(): void {
    this.snapshot = {
      sensors: Array.from(this.sensors.values()),
    };
  }

  private notify(): void {
    this.rebuildSnapshot();
    Array.from(this.listeners).forEach((listener) => {
      listener();
    });
  }

  // -------------------------------------------------------------------------
  // Sensor lifecycle
  // -------------------------------------------------------------------------

  /**
   * Register sensors detected from circuit instances.
   * Replaces any previously registered sensors.
   */
  registerSensors(instances: DetectableInstance[]): void {
    this.sensors.clear();
    const detected = detectSensors(instances);
    for (const sensor of detected) {
      this.sensors.set(sensor.id, sensor);
    }
    this.notify();
  }

  /**
   * Set the environmental value for a specific sensor.
   * Clamps to the sensor's [min, max] range.
   */
  setEnvironmentalValue(sensorId: string, value: number): void {
    const sensor = this.sensors.get(sensorId);
    if (!sensor) { return; }

    const clamped = Math.max(sensor.type.min, Math.min(sensor.type.max, value));

    this.sensors.set(sensorId, {
      ...sensor,
      currentValue: clamped,
    });

    this.notify();
  }

  /**
   * Get the current output voltage for a sensor.
   */
  getVoltage(sensorId: string): number {
    const sensor = this.sensors.get(sensorId);
    if (!sensor) { return 0; }
    return sensor.type.voltageFunction(sensor.currentValue);
  }

  /**
   * Get the current ADC digital value for a sensor.
   * @param sensorId Sensor instance id.
   * @param bits ADC resolution in bits (default 10).
   * @param vRef ADC reference voltage (default 5.0V).
   */
  getAdcValue(sensorId: string, bits = 10, vRef = 5.0): number {
    const sensor = this.sensors.get(sensorId);
    if (!sensor) { return 0; }
    return sensor.type.adcFunction(sensor.currentValue, bits, vRef);
  }

  /**
   * Get a specific sensor by id, or undefined if not found.
   */
  getSensor(sensorId: string): Readonly<SensorInput> | undefined {
    return this.sensors.get(sensorId);
  }

  /**
   * Get all registered sensors.
   */
  getAllSensors(): ReadonlyMap<string, SensorInput> {
    return this.sensors;
  }

  /**
   * Reset all sensors to their default environmental values.
   */
  resetAll(): void {
    for (const [id, sensor] of Array.from(this.sensors.entries())) {
      this.sensors.set(id, {
        ...sensor,
        currentValue: sensor.type.defaultValue,
      });
    }
    this.notify();
  }

  /**
   * Clear all sensors (typically when simulation stops).
   */
  clear(): void {
    this.sensors.clear();
    this.notify();
  }

  /**
   * Get the count of registered sensors.
   */
  get size(): number {
    return this.sensors.size;
  }
}

// ---------------------------------------------------------------------------
// Convenience: echo time for HC-SR04 (useful for firmware templates)
// ---------------------------------------------------------------------------

/**
 * Calculate the echo pulse duration (µs) for a given distance.
 * HC-SR04: duration = distance * 2 / speed_of_sound
 */
export function hcSr04EchoTime(distanceCm: number): number {
  return (distanceCm * 2) / SPEED_OF_SOUND_CM_US;
}

/**
 * Calculate distance (cm) from echo pulse duration (µs).
 */
export function hcSr04Distance(echoMicroseconds: number): number {
  return (echoMicroseconds * SPEED_OF_SOUND_CM_US) / 2;
}
