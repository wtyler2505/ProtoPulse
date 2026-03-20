import type { PinConstant } from '@shared/arduino-pin-generator';

export interface PinConflict {
  line: number;
  message: string;
  severity: 'error' | 'warning';
  codeName: string;
  codeValue: string;
  schematicName?: string;
  schematicValue?: string | number;
}

interface CodePinDef {
  name: string;
  value: string;
  line: number;
}

export function detectPinConflicts(code: string, schematicPins: PinConstant[]): PinConflict[] {
  const conflicts: PinConflict[] = [];
  const lines = code.split('\n');
  const codePins: CodePinDef[] = [];

  // 1. Extract pin definitions from code
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Match #define NAME value
    const defineMatch = /^\s*#define\s+([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)/.exec(line);
    if (defineMatch) {
      codePins.push({ name: defineMatch[1], value: defineMatch[2], line: i + 1 });
      continue;
    }

    // Match const int NAME = value; or constexpr uint8_t NAME = value;
    const constMatch = /^\s*(?:const\s+|constexpr\s+)?(?:int|uint8_t|byte)\s+([A-Za-z0-9_]+)\s*=\s*([A-Za-z0-9_]+)\s*;/.exec(line);
    if (constMatch) {
      codePins.push({ name: constMatch[1], value: constMatch[2], line: i + 1 });
    }
  }

  // Helper to normalize pin values for comparison (e.g. "03" -> "3", "A0" -> "A0", "3" -> "3")
  const normValue = (v: string | number) => String(v).toUpperCase().replace(/^0+/, '') || '0';
  
  // Helper to normalize pin names (remove _PIN suffix, lowercase)
  const normName = (n: string) => n.toLowerCase().replace(/_pin$/, '').replace(/pin$/, '').replace(/_/g, '');

  // 2. Check for conflicts
  for (const codePin of codePins) {
    // Only check variables that look like pins (contain "PIN", or map exactly to a schematic net)
    const isExplicitPin = /pin/i.test(codePin.name);
    
    const cNameNorm = normName(codePin.name);
    const cValueNorm = normValue(codePin.value);

    // Skip if the value isn't a simple number or A-pin (e.g., #define LED_PIN OTHER_PIN)
    if (!/^(A\d+|\d+)$/.test(cValueNorm)) {
      continue;
    }

    let foundMatch = false;

    // Check against schematic pins
    for (const schPin of schematicPins) {
      if (schPin.pinNumber === '??') continue;

      const sNameNorm = normName(schPin.name);
      const sValueNorm = normValue(schPin.pinNumber);

      // Case A: Names match (or are very similar), but values differ
      if (cNameNorm === sNameNorm || cNameNorm.includes(sNameNorm) || sNameNorm.includes(cNameNorm)) {
        foundMatch = true;
        if (cValueNorm !== sValueNorm) {
          conflicts.push({
            line: codePin.line,
            message: `Pin conflict: '${codePin.name}' is set to ${codePin.value} in code, but '${schPin.name}' is connected to ${schPin.pinNumber} in the schematic.`,
            severity: 'error',
            codeName: codePin.name,
            codeValue: codePin.value,
            schematicName: schPin.name,
            schematicValue: schPin.pinNumber,
          });
        }
        break; // Found the matching semantic pin, stop checking others
      }

      // Case B: Values match exactly, but names are completely different (and it's explicitly a pin variable)
      if (isExplicitPin && cValueNorm === sValueNorm && cNameNorm !== sNameNorm) {
        // Warning: Multiple things mapped to same pin
        conflicts.push({
          line: codePin.line,
          message: `Pin collision: '${codePin.name}' uses pin ${codePin.value}, but schematic connects pin ${schPin.pinNumber} to '${schPin.name}'.`,
          severity: 'warning',
          codeName: codePin.name,
          codeValue: codePin.value,
          schematicName: schPin.name,
          schematicValue: schPin.pinNumber,
        });
      }
    }

    // Case C: Explicit pin variable in code, but no matching net in schematic (skip for now to reduce noise, unless we want strict mode)
  }

  return conflicts;
}
