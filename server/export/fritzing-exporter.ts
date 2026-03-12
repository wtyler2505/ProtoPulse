/**
 * Fritzing Exporter
 *
 * Generates a .fzz archive (zipped XML) compatible with Fritzing.
 * Focuses on the breadboard and schematic views.
 */

import JSZip from 'jszip';
import type { 
  CircuitInstanceRow, 
  CircuitNetRow, 
  ComponentPart 
} from '@shared/schema';

interface FritzingExportOptions {
  projectName: string;
  instances: CircuitInstanceRow[];
  nets: CircuitNetRow[];
  parts: ComponentPart[];
}

export async function generateFritzingProject(opts: FritzingExportOptions) {
  const { projectName, instances, nets, parts } = opts;
  const zip = new JSZip();

  // 1. Create the .fz XML content (The main project file)
  let fz = `<?xml version="1.0" encoding="utf-8"?>\n`;
  fz += `<module fritzingVersion="0.9.3b" moduleId="${projectName}">\n`;
  fz += `  <views>\n`;
  fz += `    <breadboardView><layers image="breadboard"><layer layerId="breadboard"/></layers></breadboardView>\n`;
  fz += `    <schematicView><layers image="schematic"><layer layerId="schematic"/></layers></schematicView>\n`;
  fz += `    <pcbView><layers image="pcb"><layer layerId="copper0"/><layer layerId="silkscreen"/><layer layerId="copper1"/></layers></pcbView>\n`;
  fz += `  </views>\n`;
  fz += `  <instances>\n`;

  // Map parts for lookup
  const partMap = new Map(parts.map(p => [p.id, p]));

  // Add instances
  instances.forEach((inst, i) => {
    const part = inst.partId ? partMap.get(inst.partId) : null;
    const meta = (part?.meta ?? {}) as any;
    const moduleId = meta.title || 'generic_part';
    const partName = (meta.title || 'part').replace(/\s+/g, '_');
    
    fz += `    <instance moduleIdRef="${moduleId}" modelIndex="${5000 + i}" path="${partName}.fzp">\n`;
    fz += `      <title>${inst.referenceDesignator}</title>\n`;
    fz += `      <views>\n`;
    fz += `        <breadboardView layer="breadboard">\n`;
    fz += `          <geometry x="${inst.breadboardX || 0}" y="${inst.breadboardY || 0}" z="0"/>\n`;
    fz += `        </breadboardView>\n`;
    fz += `        <schematicView layer="schematic">\n`;
    fz += `          <geometry x="${inst.schematicX || 0}" y="${inst.schematicY || 0}" z="0"/>\n`;
    fz += `        </schematicView>\n`;
    fz += `      </views>\n`;
    fz += `    </instance>\n`;
  });

  fz += `  </instances>\n`;
  fz += `</module>\n`;

  zip.file(`${projectName}.fz`, fz);

  // 2. Generate the .fzz (zipped) buffer
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });

  return {
    content: buffer.toString('base64'),
    encoding: 'base64' as const,
    mimeType: 'application/x-fritzing-fz',
    filename: `${projectName.replace(/\s+/g, '_')}.fzz`
  };
}
