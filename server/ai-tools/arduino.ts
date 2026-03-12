/**
 * Arduino Workbench tools — sketch generation, compilation, board management, library search.
 *
 * Provides AI tools for embedded firmware development within the ProtoPulse workspace.
 */

import { z } from 'zod';
import type { ToolResult } from './types';
import { ToolRegistry } from './registry';
import { clientAction } from './registry';

/**
 * Register all Arduino-related tools into the provided registry.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerArduinoTools(registry: ToolRegistry): void {
  /**
   * generate_arduino_sketch — Create boilerplate Arduino code based on design intent.
   *
   * Dispatched client-side. Analyzes current circuit/architecture and generates 
   * a .ino sketch with appropriate pin mappings and library inclusions.
   */
  registry.register({
    name: 'generate_arduino_sketch',
    description: 'Generate an Arduino sketch (.ino) based on your current circuit design, including pin mappings and library boilerplate.',
    category: 'arduino',
    parameters: z.object({
      intent: z.string().min(1).describe('What the sketch should do (e.g., \"Read DHT22 sensor and print to Serial\")'),
      boardType: z.string().optional().describe('The target board (e.g., \"uno\", \"esp32\")'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('generate_arduino_sketch', params),
  });

  /**
   * compile_sketch — Compile the current Arduino sketch.
   *
   * Dispatched client-side. Triggers the background compilation job.
   */
  registry.register({
    name: 'compile_sketch',
    description: 'Compile the current Arduino sketch to check for syntax errors and prepare for upload.',
    category: 'arduino',
    parameters: z.object({
      fqbn: z.string().min(1).describe('Fully Qualified Board Name (e.g., \"arduino:avr:uno\")'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('compile_sketch', params),
  });

  /**
   * upload_firmware — Upload the compiled sketch to a board.
   *
   * Dispatched client-side. Triggers the background upload job.
   */
  registry.register({
    name: 'upload_firmware',
    description: 'Upload the current firmware to a connected Arduino or ESP32 board.',
    category: 'arduino',
    parameters: z.object({
      fqbn: z.string().min(1).describe('Fully Qualified Board Name'),
      port: z.string().min(1).describe('The serial port (e.g., \"/dev/ttyACM0\", \"COM3\")'),
    }),
    requiresConfirmation: true, // Hardware interaction is sensitive
    execute: async (params) => clientAction('upload_firmware', params),
  });

  /**
   * search_arduino_libraries — Find Arduino libraries.
   */
  registry.register({
    name: 'search_arduino_libraries',
    description: 'Search the Arduino library index for sensors, displays, or communication drivers.',
    category: 'arduino',
    parameters: z.object({
      query: z.string().min(1).describe('Search term (e.g., \"DHT22\", \"SSD1306\")'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('search_arduino_libraries', params),
  });

  /**
   * list_arduino_boards — Show connected boards.
   */
  registry.register({
    name: 'list_arduino_boards',
    description: 'List all currently connected Arduino or ESP32 boards detected on the host system.',
    category: 'arduino',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('list_arduino_boards', params),
  });
}
