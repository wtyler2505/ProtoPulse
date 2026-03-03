import type { IntentHandler } from './types';

export const generateArchitectureHandler: IntentHandler = {
  match(lower) {
    return (
      lower.includes('generate architecture') ||
      lower.includes('generate schematic') ||
      (lower.includes('generate') && (lower.includes('arch') || lower.includes('design')))
    );
  },

  handle() {
    const components = [
      { label: 'ESP32-S3', nodeType: 'mcu', description: 'Main MCU', positionX: 300, positionY: 100 },
      { label: 'TP4056', nodeType: 'power', description: 'Power Management', positionX: 100, positionY: 250 },
      { label: 'SX1262', nodeType: 'comm', description: 'LoRa Communication', positionX: 500, positionY: 250 },
      { label: 'SHT40', nodeType: 'sensor', description: 'Temp/Humidity Sensor', positionX: 300, positionY: 400 },
    ];
    const connections = [
      { sourceLabel: 'ESP32-S3', targetLabel: 'TP4056', label: 'Power' },
      { sourceLabel: 'ESP32-S3', targetLabel: 'SX1262', label: 'SPI' },
      { sourceLabel: 'ESP32-S3', targetLabel: 'SHT40', label: 'I2C' },
    ];
    return {
      actions: [
        { type: 'generate_architecture', components, connections },
        { type: 'switch_view', view: 'architecture' as const },
      ],
      response: `[ACTION] Generated default architecture with 4 components.\n\nCreated: ESP32-S3 (MCU), TP4056 (Power), SX1262 (Communication), SHT40 (Sensor). All components are connected with data buses.`,
    };
  },
};

export const clearCanvasHandler: IntentHandler = {
  match(lower) {
    return lower.includes('clear all') && (lower.includes('node') || lower.includes('component'));
  },

  handle() {
    return {
      actions: [{ type: 'clear_canvas' }],
      response: `[ACTION] Cleared all nodes and edges from the architecture.\n\nThe canvas is now empty. You can add new components or generate a fresh architecture.`,
    };
  },
};
