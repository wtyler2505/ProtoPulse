/**
 * Re-export barrel for backwards compatibility.
 *
 * All functionality has been decomposed into individual modules under
 * server/export/. Import directly from those modules for new code.
 *
 * @deprecated Import from server/export/* modules instead.
 */

// Types
export type {
  BomItemData,
  ComponentPartData,
  ArchNodeData,
  ArchEdgeData,
  CircuitInstanceData,
  CircuitNetData,
  CircuitWireData,
  ValidationIssueData,
  ExportResult,
} from './export/types';

// BOM generators
export {
  generateGenericBomCsv,
  generateJlcpcbBom,
  generateMouserBom,
  generateDigikeyBom,
} from './export/bom-exporter';

// KiCad generators
export { generateKicadSch, generateKicadNetlist } from './export/kicad-exporter';

// SPICE generator
export { generateSpiceNetlist } from './export/spice-exporter';

// CSV netlist generator
export { generateLegacyCsvNetlist as generateCsvNetlist } from './export/netlist-generator';

// Gerber generator
export { generateLegacyGerber as generateGerber } from './export/gerber-generator';

// Pick-and-place generator
export { generateLegacyPickAndPlace as generatePickAndPlace } from './export/pick-place-generator';

// Eagle schematic generator
export { generateEagleSch } from './export/eagle-exporter';

// Design report generators
export { generateDesignReportMd } from './export/design-report';
export { generateDesignReportPdf } from './export/pdf-report-generator';

// FMEA report generator
export { generateFmeaReport } from './export/fmea-generator';

// Firmware scaffold generator
export { generateFirmwareScaffold } from './export/firmware-scaffold-generator';
