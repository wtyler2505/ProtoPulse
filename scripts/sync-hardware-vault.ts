import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllVerifiedBoards, type VerifiedBoardDefinition } from '../shared/verified-boards/index.js';
import { STANDARD_LIBRARY_COMPONENTS, type StandardComponentDef } from '../shared/standard-library.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KNOWLEDGE_DIR = path.resolve(__dirname, '../knowledge');

function sanitizeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getSubMoc(category: string, family: string, tags: string[] = []): string {
  const combined = [category, family, ...tags].join(' ').toLowerCase();
  if (combined.includes('passive') || combined.includes('resistor') || combined.includes('capacitor') || combined.includes('inductor') || combined.includes('diode')) return 'hardware-components-passives';
  if (combined.includes('display') || combined.includes('led') || combined.includes('lcd') || combined.includes('oled') || combined.includes('screen')) return 'hardware-components-displays';
  if (combined.includes('sensor') || combined.includes('measure') || combined.includes('detect')) return 'hardware-components-sensors';
  if (combined.includes('actuator') || combined.includes('motor') || combined.includes('servo') || combined.includes('relay') || combined.includes('switch')) return 'hardware-components-actuators';
  if (combined.includes('comm') || combined.includes('wireless') || combined.includes('radio') || combined.includes('rf') || combined.includes('bluetooth') || combined.includes('wifi') || combined.includes('nrf') || combined.includes('lora')) return 'hardware-components-communication';
  if (combined.includes('power') || combined.includes('battery') || combined.includes('regulator') || combined.includes('converter') || combined.includes('supply') || combined.includes('lipo')) return 'hardware-components-power';
  if (combined.includes('mcu') || combined.includes('board') || combined.includes('esp') || combined.includes('arduino') || combined.includes('microcontroller') || combined.includes('processor') || combined.includes('pico')) return 'hardware-components-mcu';
  return 'hardware-components';
}

function writeMarkdownNote(filename: string, content: string) {
  const filePath = path.join(KNOWLEDGE_DIR, `${filename}.md`);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Synced: ${filename}.md`);
}

function generateVerifiedBoardNote(board: VerifiedBoardDefinition) {
  const filename = `hardware-board-${board.id}`;
  const dims = board.dimensions;
  const visual = board.visual;
  const subMoc = getSubMoc('', board.family, [board.description, board.title]);
  
  let content = `---
description: "Exact physical and electrical specifications for ${board.title}."
type: domain-knowledge
category: hardware-components
status: verified
topics: [${subMoc}]
tags: [board, hardware, ${board.manufacturer.toLowerCase().replace(/\s+/g, '-')}]
---

# ${board.title} Specifications

This note is the canonical Ars Contexta source of truth for the ${board.title}, used to enforce physical constraints and validate AI-generated wiring logic.

## Identity & Verification
- **Manufacturer:** ${board.manufacturer}
- **MPN:** ${board.mpn}
- **Aliases:** ${board.aliases.join(', ')}
- **Family:** ${board.family}
- **Description:** ${board.description}
- **Breadboard Fit:** \`${board.breadboardFit}\`
- **Breadboard Notes:** ${board.breadboardNotes}

## Exact Physical Dimensions
- **Width:** ${dims.width} mm
- **Height:** ${dims.height} mm
- **Thickness:** ${dims.thickness ?? 'N/A'} mm
- **Pin Pitch:** ${board.pinSpacing} mm

## Visual Characteristics
- **PCB Color (Hex):** \`${visual?.pcbColor ?? 'Unknown'}\`
- **Silkscreen Color (Hex):** \`${visual?.silkscreenColor ?? 'Unknown'}\`

## Electrical Constraints
- **Operating Voltage:** ${board.operatingVoltage}V
- **Input Voltage Range:** ${board.inputVoltageRange[0]}V - ${board.inputVoltageRange[1]}V
- **Max Current Per Pin:** ${board.maxCurrentPerPin} mA
${board.maxTotalCurrent ? `- **Max Total Current:** ${board.maxTotalCurrent} mA` : ''}

## Headers & Pinout
${board.headerLayout.map(h => `### ${h.id} Header (${h.side} side, ${h.pinCount} pins)\n${h.pinIds.map(pid => {
    const pin = board.pins.find(p => p.id === pid);
    return pin ? `- **${pin.name}** (${pin.role}, ${pin.voltage}V): ${(pin.warnings || []).join(' ')}` : `- ${pid} (NC)`;
  }).join('\n')}`).join('\n\n')}

## Critical Safety & Verification Notes
${(board.warnings || []).map(w => `- **WARNING:** ${w}`).join('\n')}
${(board.verificationNotes || []).map(n => `- ${n}`).join('\n')}
${(board.evidence || []).map(e => `- [${e.label}](${e.href}) (Confidence: ${e.confidence})`).join('\n')}

---
Related: [[${subMoc}]], [[hardware-components]], [[architecture-decisions]]
`;

  writeMarkdownNote(filename, content);
}

function generateStandardLibraryNote(component: StandardComponentDef) {
  const filename = `hardware-component-${sanitizeFilename(component.title)}`;
  const meta = component.meta || {};
  const dims = meta.dimensions as any;
  const subMoc = getSubMoc(component.category, '', component.tags.concat(component.title));
  
  let content = `---
description: "Standard library specifications for ${component.title}."
type: domain-knowledge
category: hardware-components
status: verified
topics: [${subMoc}]
tags: [component, hardware, ${component.category.toLowerCase().replace(/\s+/g, '-')}]
---

# ${component.title}

## Description
${component.description}

## Identity
- **Category:** ${component.category}
- **Tags:** ${component.tags.join(', ')}
${meta.manufacturer ? `- **Manufacturer:** ${meta.manufacturer}` : ''}
${meta.mpn ? `- **MPN:** ${meta.mpn}` : ''}
${meta.mountingType ? `- **Mounting Type:** ${meta.mountingType}` : ''}
${meta.packageType ? `- **Package Type:** ${meta.packageType}` : ''}

## Exact Physical Dimensions
${dims ? `- **Length:** ${dims.length ?? dims.diameter ?? 'N/A'} mm\n- **Width:** ${dims.width ?? 'N/A'} mm\n- **Height:** ${dims.height ?? 'N/A'} mm\n- **Pitch:** ${dims.pitch ?? 'N/A'} mm` : '*(Dimensions not explicitly modeled in standard library)*'}

## Connectors & Interfaces
${component.connectors.map(c => `- **${c.name}** (${c.id}): ${c.description}`).join('\n')}

---
Related: [[${subMoc}]], [[hardware-components]]
`;

  writeMarkdownNote(filename, content);
}

async function run() {
  console.log('Synchronizing Hardware Data to Ars Contexta Vault...');
  
  const boards = getAllVerifiedBoards();
  for (const board of boards) {
    generateVerifiedBoardNote(board);
  }

  for (const component of STANDARD_LIBRARY_COMPONENTS) {
    generateStandardLibraryNote(component);
  }

  console.log('Sync complete.');
}

run().catch(console.error);
