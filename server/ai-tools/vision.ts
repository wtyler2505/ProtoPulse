/**
 * Vision tools — camera-based component identification via AI vision.
 *
 * Provides an AI tool that accepts a base64-encoded photo of an electronic
 * component and returns a structured identification analysis. The tool builds
 * a detailed prompt that guides the AI model through component recognition,
 * marking interpretation, and parameter extraction.
 *
 * The identification result includes component type, package, part number,
 * pin count, confidence level, and suggested BOM fields — enabling the user
 * to go from "I found this part in my drawer" to a fully populated BOM entry
 * in a single step.
 *
 * @module ai-tools/vision
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import type { ToolResult } from './types';

/**
 * Register all vision-category tools with the given registry.
 *
 * Tools registered (1 total):
 *
 * - `identify_component_from_image` — Analyze a photo of an electronic
 *   component and return structured identification data.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerVisionTools(registry: ToolRegistry): void {
  /**
   * identify_component_from_image — Analyze a photo of an electronic component.
   *
   * Accepts a base64-encoded image and optional context string. Returns a
   * structured analysis prompt that guides the AI model to identify:
   *
   * - Component type (resistor, capacitor, IC, transistor, connector, etc.)
   * - Package type (DIP-8, SOT-23, 0805, TO-220, etc.)
   * - Likely part number or family
   * - Pin count
   * - For resistors: color band reading and resistance value
   * - For ICs: marking interpretation (manufacturer logo, part number, date code)
   * - Confidence level (high / medium / low)
   * - Suggested BOM entry fields
   *
   * The tool does not perform the vision analysis itself — it constructs the
   * prompt and returns structured data for the AI model to process alongside
   * the image.
   */
  registry.register({
    name: 'identify_component_from_image',
    description:
      'Analyze a photo of an electronic component to identify it. ' +
      'Accepts a base64-encoded image of the component and returns a structured identification ' +
      'including component type, package, part number, pin count, markings interpretation, ' +
      'confidence level, and suggested BOM entry fields. ' +
      'For resistors, reads color bands to determine resistance value. ' +
      'For ICs, interprets manufacturer logos, part numbers, and date codes. ' +
      'Use this when the user wants to identify a component from a photo or camera capture.',
    category: 'component',
    parameters: z.object({
      image_data: z
        .string()
        .min(1)
        .describe('Base64-encoded image data of the electronic component (JPEG or PNG)'),
      context: z
        .string()
        .optional()
        .describe(
          'Optional context about what the user expects or where the component was found ' +
          '(e.g., "found on an Arduino board", "salvaged from a power supply")',
        ),
    }),
    requiresConfirmation: false,
    modelPreference: 'premium',
    execute: async (params): Promise<ToolResult> => {
      const contextNote = params.context
        ? `\n\nUser-provided context: ${params.context}`
        : '';

      const analysisPrompt =
        'Analyze the provided electronic component image and identify it with the following structure:\n\n' +
        '1. **Component Type**: What kind of component is this? (resistor, capacitor, IC, transistor, ' +
        'diode, LED, connector, inductor, relay, fuse, crystal, transformer, voltage regulator, etc.)\n\n' +
        '2. **Package Type**: What is the physical package? (DIP-8, DIP-14, DIP-16, SOIC-8, SOT-23, ' +
        'SOT-223, QFP-44, QFN-32, BGA, 0402, 0603, 0805, 1206, TO-92, TO-220, TO-263, axial, radial, ' +
        'through-hole, SMD, etc.)\n\n' +
        '3. **Identification**:\n' +
        '   - For resistors: Read the color bands (list each band color and its meaning) and calculate ' +
        'the resistance value with tolerance\n' +
        '   - For capacitors: Read any printed values, voltage ratings, and dielectric type\n' +
        '   - For ICs: Read the top marking — identify manufacturer logo, part number, date code, ' +
        'lot number, and country of origin\n' +
        '   - For transistors/diodes: Read the marking code and identify the part\n' +
        '   - For connectors: Identify the type (JST, Molex, pin header, screw terminal, etc.), ' +
        'pitch, and pin count\n\n' +
        '4. **Part Number**: The most likely specific part number or part family\n\n' +
        '5. **Manufacturer**: The most likely manufacturer based on markings and package\n\n' +
        '6. **Pin Count**: How many pins/leads does the component have?\n\n' +
        '7. **Key Specifications**: Any specifications visible or inferrable (voltage rating, ' +
        'current rating, power rating, tolerance, frequency, etc.)\n\n' +
        '8. **Confidence Level**: How confident are you in this identification?\n' +
        '   - HIGH: Clear markings, unambiguous identification\n' +
        '   - MEDIUM: Some markings readable but some ambiguity\n' +
        '   - LOW: Poor image quality, worn markings, or uncommon component\n\n' +
        '9. **Suggested BOM Entry**:\n' +
        '   - partNumber: (string)\n' +
        '   - manufacturer: (string)\n' +
        '   - description: (string — concise component description)\n' +
        '   - category: (string — e.g., "IC", "Passive", "Connector", "Discrete")\n' +
        '   - unitPrice: (number — estimated typical unit price in USD, or null if unknown)\n\n' +
        '10. **Additional Notes**: Any warnings, alternative identifications, or suggestions ' +
        '(e.g., "This could also be XYZ", "Check the datasheet for pin 1 orientation", ' +
        '"This component may be counterfeit — verify with distributor")' +
        contextNote;

      return {
        success: true,
        message: 'Component image received for identification analysis.',
        data: {
          type: 'vision_analysis',
          imageProvided: true,
          imageLength: params.image_data.length,
          analysisPrompt,
          context: params.context ?? null,
        },
      };
    },
  });
}
