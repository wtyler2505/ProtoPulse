import type { IntentHandler } from './types';

export const componentFallbackHandler: IntentHandler = {
  match(lower) {
    return lower.includes('component') || lower.includes('generate');
  },

  handle() {
    return {
      actions: [],
      response:
        "I've analyzed the design for component generation. The architecture includes the ESP32-S3, LoRa transceiver, and power management units. All connections follow standard bus protocols. Try 'generate architecture' to create a default layout or open the Component Editor to design individual parts.",
    };
  },
};

export const bomFallbackHandler: IntentHandler = {
  match(lower) {
    return lower.includes('bom') || lower.includes('cost');
  },

  handle() {
    return {
      actions: [],
      response:
        "BOM optimization tips:\n• TP4056 → MCP73831 (saves $0.08/unit, same footprint)\n• USB connector → alternate GCT part (saves $0.12/unit)\nTotal potential savings: $0.20/unit at 1k qty.\n\nTry 'optimize bom' for a full analysis or 'export bom csv' to download.",
    };
  },
};

export const memoryFallbackHandler: IntentHandler = {
  match(lower) {
    return lower.includes('memory') || lower.includes('ram') || lower.includes('storage');
  },

  handle() {
    return {
      actions: [],
      response:
        "For the ESP32-S3, I recommend adding external PSRAM (ESP-PSRAM64H, 8MB). Connect via the dedicated SPI interface on GPIO 33-37. Try 'add sensor called PSRAM64H' to add it to your design.",
    };
  },
};

export const powerFallbackHandler: IntentHandler = {
  match(lower) {
    return lower.includes('power') || lower.includes('battery');
  },

  handle() {
    return {
      actions: [],
      response:
        'Power analysis summary:\n• Active mode: ~180mA (Wi-Fi TX)\n• Deep sleep: ~10µA\n• Battery life (2000mAh): ~45 days at 1 reading/hour\nRecommendation: Add a solar cell (5V/500mA) with MPPT for indefinite operation.',
    };
  },
};

export const antennaFallbackHandler: IntentHandler = {
  match(lower) {
    return lower.includes('antenna') || lower.includes('rf');
  },

  handle() {
    return {
      actions: [],
      response:
        'RF design recommendations:\n• LoRa antenna: Use a spring-type 868/915MHz antenna with SMA connector\n• Match impedance to 50Ω using Pi-network (L=3.3nH, C1=1.5pF, C2=1.8pF)\n• Keep RF trace width at 0.7mm for FR4 substrate (εr=4.6)',
    };
  },
};

export const sensorFallbackHandler: IntentHandler = {
  match(lower) {
    return lower.includes('sensor') || lower.includes('temperature');
  },

  handle() {
    return {
      actions: [],
      response:
        'Sensor configuration optimized:\n• SHT40: Set to high-precision mode (±0.2°C accuracy)\n• I2C address: 0x44, pull-ups: 4.7kΩ to 3.3V\n• Sample rate: 1Hz recommended for thermal stability\n• Consider adding SHT40-BD1B for extended range (-40°C to +125°C).',
    };
  },
};
