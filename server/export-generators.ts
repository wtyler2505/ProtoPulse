import crypto from "crypto";

// ---------------------------------------------------------------------------
// Data interfaces — match the shapes callers will pass in
// ---------------------------------------------------------------------------

export interface BomItemData {
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  supplier: string;
  stock: number;
  status: string;
  leadTime: string | null;
}

export interface ComponentPartData {
  id: number;
  nodeId: string | null;
  meta: Record<string, unknown>;
  connectors: unknown[];
  buses: unknown[];
  constraints: unknown[];
}

export interface ArchNodeData {
  nodeId: string;
  label: string;
  nodeType: string;
  positionX: number;
  positionY: number;
  data: Record<string, unknown> | null;
}

export interface ArchEdgeData {
  edgeId: string;
  source: string;
  target: string;
  label: string | null;
  signalType: string | null;
  voltage: string | null;
  busWidth: string | null;
  netName: string | null;
}

export interface CircuitInstanceData {
  id: number;
  partId: number;
  referenceDesignator: string;
  schematicX: number;
  schematicY: number;
  schematicRotation: number;
  pcbX: number | null;
  pcbY: number | null;
  pcbRotation: number | null;
  pcbSide: string | null;
  properties: Record<string, unknown>;
}

export interface CircuitNetData {
  id: number;
  name: string;
  netType: string;
  voltage: string | null;
  busWidth: number | null;
  segments: unknown[];
  labels: unknown[];
}

export interface CircuitWireData {
  id: number;
  netId: number;
  view: string;
  points: unknown[];
  layer: string | null;
  width: number;
}

export interface ValidationIssueData {
  severity: string;
  message: string;
  componentId: string | null;
  suggestion: string | null;
}

// ---------------------------------------------------------------------------
// Export result
// ---------------------------------------------------------------------------

export interface ExportResult {
  content: string;
  encoding: "utf8" | "base64";
  mimeType: string;
  filename: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCSV).join(",");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Sanitize a filename: remove path separators and problematic characters. */
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim() || "untitled";
}

/** Extract a string from a meta record, returning fallback if missing/non-string. */
function metaStr(meta: Record<string, unknown>, key: string, fallback: string = ""): string {
  const v = meta[key];
  return typeof v === "string" ? v : fallback;
}

/**
 * Guess a SPICE primitive prefix from a reference designator or component type.
 * R → resistor, C → capacitor, L → inductor, D → diode, Q → BJT, M → MOSFET,
 * V → voltage source, anything else → X (subcircuit).
 */
function spicePrefix(refDes: string): string {
  const first = refDes.charAt(0).toUpperCase();
  if ("RCLVDQM".includes(first)) return first;
  return "X";
}

// ---------------------------------------------------------------------------
// 1. Generic BOM CSV
// ---------------------------------------------------------------------------

export function generateGenericBomCsv(
  bom: BomItemData[],
  projectName: string,
): ExportResult {
  const header = csvRow([
    "Part Number",
    "Manufacturer",
    "Description",
    "Quantity",
    "Unit Price",
    "Total Price",
    "Supplier",
    "Status",
    "Stock",
    "Lead Time",
  ]);

  const rows = bom.map((item) =>
    csvRow([
      item.partNumber,
      item.manufacturer,
      item.description,
      item.quantity,
      item.unitPrice,
      item.totalPrice,
      item.supplier,
      item.status,
      item.stock,
      item.leadTime,
    ]),
  );

  return {
    content: [header, ...rows].join("\n"),
    encoding: "utf8",
    mimeType: "text/csv",
    filename: `${sanitizeFilename(projectName)}_BOM.csv`,
  };
}

// ---------------------------------------------------------------------------
// 2. JLCPCB BOM
// ---------------------------------------------------------------------------

export function generateJlcpcbBom(
  bom: BomItemData[],
  parts: ComponentPartData[],
): ExportResult {
  const header = csvRow(["Comment", "Designator", "Footprint", "LCSC Part #"]);

  // Build lookup: MPN → part meta
  const mpnToMeta = new Map<string, Record<string, unknown>>();
  for (const part of parts) {
    const mpn = metaStr(part.meta, "mpn");
    if (mpn) {
      mpnToMeta.set(mpn.toLowerCase(), part.meta);
    }
  }

  // Counters for auto-generated reference designators by prefix
  const refDesCounters = new Map<string, number>();

  function nextRefDes(prefix: string): string {
    const current = (refDesCounters.get(prefix) ?? 0) + 1;
    refDesCounters.set(prefix, current);
    return `${prefix}${current}`;
  }

  /** Guess a ref-des prefix from a description. */
  function guessPrefix(description: string): string {
    const desc = description.toLowerCase();
    if (desc.includes("resistor") || desc.includes("res ")) return "R";
    if (desc.includes("capacitor") || desc.includes("cap ")) return "C";
    if (desc.includes("inductor") || desc.includes("ind ")) return "L";
    if (desc.includes("diode") || desc.includes("led")) return "D";
    if (desc.includes("transistor") || desc.includes("mosfet") || desc.includes("bjt")) return "Q";
    if (desc.includes("connector") || desc.includes("header")) return "J";
    if (desc.includes("crystal") || desc.includes("oscillator")) return "Y";
    return "U";
  }

  const rows = bom.map((item) => {
    const meta = mpnToMeta.get(item.partNumber.toLowerCase());

    let designator: string;
    if (meta) {
      const existingRef = metaStr(meta, "referenceDesignator");
      designator = existingRef || nextRefDes(guessPrefix(item.description));
    } else {
      designator = nextRefDes(guessPrefix(item.description));
    }

    const footprint = meta ? metaStr(meta, "footprint", "Unknown") : "Unknown";
    const lcsc = meta ? metaStr(meta, "lcscPartNumber") : "";

    return csvRow([item.description, designator, footprint, lcsc]);
  });

  return {
    content: [header, ...rows].join("\n"),
    encoding: "utf8",
    mimeType: "text/csv",
    filename: "JLCPCB_BOM.csv",
  };
}

// ---------------------------------------------------------------------------
// 3. Mouser BOM
// ---------------------------------------------------------------------------

export function generateMouserBom(bom: BomItemData[]): ExportResult {
  const header = csvRow([
    "Mouser Part #",
    "MFR Part #",
    "Manufacturer",
    "Quantity",
    "Description",
    "Unit Price",
  ]);

  const rows = bom.map((item) =>
    csvRow([
      "", // Mouser Part # — user fills in
      item.partNumber,
      item.manufacturer,
      item.quantity,
      item.description,
      item.unitPrice,
    ]),
  );

  return {
    content: [header, ...rows].join("\n"),
    encoding: "utf8",
    mimeType: "text/csv",
    filename: "Mouser_BOM.csv",
  };
}

// ---------------------------------------------------------------------------
// 4. DigiKey BOM
// ---------------------------------------------------------------------------

export function generateDigikeyBom(bom: BomItemData[]): ExportResult {
  const header = csvRow([
    "DigiKey Part #",
    "MFR Part #",
    "Manufacturer Name",
    "Quantity",
    "Unit Price",
    "Extended Price",
  ]);

  const rows = bom.map((item) =>
    csvRow([
      "", // DigiKey Part # — user fills in
      item.partNumber,
      item.manufacturer,
      item.quantity,
      item.unitPrice,
      item.totalPrice,
    ]),
  );

  return {
    content: [header, ...rows].join("\n"),
    encoding: "utf8",
    mimeType: "text/csv",
    filename: "DigiKey_BOM.csv",
  };
}

// ---------------------------------------------------------------------------
// 5. KiCad Schematic (.kicad_sch) — S-expression format (KiCad 7+)
// ---------------------------------------------------------------------------

export function generateKicadSch(
  nodes: ArchNodeData[],
  edges: ArchEdgeData[],
  projectName: string,
): ExportResult {
  const uuid = () => crypto.randomUUID();
  const schUuid = uuid();

  // Scale factor: architecture positions are in logical units, KiCad uses mils
  const SCALE = 2.54; // 1 unit → 2.54 mm (100 mil grid)

  // Build node position lookup for wiring
  const nodePositions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    nodePositions.set(node.nodeId, {
      x: node.positionX * SCALE,
      y: node.positionY * SCALE,
    });
  }

  // --- lib_symbols section ---
  const libSymbols = nodes.map((node) => {
    const libId = `protopulse:${node.label.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    return `    (symbol "${libId}"
      (in_bom yes) (on_board yes)
      (property "Reference" "U" (at 0 2.54 0) (effects (font (size 1.27 1.27))))
      (property "Value" "${escapeKicad(node.label)}" (at 0 -2.54 0) (effects (font (size 1.27 1.27))))
      (property "Footprint" "" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
      (property "Datasheet" "" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
      (symbol "${libId}_0_1"
        (rectangle (start -5.08 5.08) (end 5.08 -5.08) (stroke (width 0.254) (type default)) (fill (type background)))
      )
    )`;
  });

  // --- symbol instances on the sheet ---
  const symbols = nodes.map((node, i) => {
    const pos = nodePositions.get(node.nodeId)!;
    const libId = `protopulse:${node.label.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    const refDes = `U${i + 1}`;
    const desc =
      node.data && typeof node.data.description === "string"
        ? node.data.description
        : "";

    return `  (symbol (lib_id "${libId}") (at ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} 0) (unit 1)
    (in_bom yes) (on_board yes) (dnp no)
    (uuid "${uuid()}")
    (property "Reference" "${refDes}" (at ${pos.x.toFixed(2)} ${(pos.y - 5.08).toFixed(2)} 0)
      (effects (font (size 1.27 1.27))))
    (property "Value" "${escapeKicad(node.label)}" (at ${pos.x.toFixed(2)} ${(pos.y + 5.08).toFixed(2)} 0)
      (effects (font (size 1.27 1.27))))
    (property "Footprint" "" (at ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} 0)
      (effects (font (size 1.27 1.27)) hide))
    (property "Datasheet" "" (at ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} 0)
      (effects (font (size 1.27 1.27)) hide))
    (property "Description" "${escapeKicad(desc)}" (at ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} 0)
      (effects (font (size 1.27 1.27)) hide))
  )`;
  });

  // --- wires ---
  const wires = edges
    .map((edge) => {
      const src = nodePositions.get(edge.source);
      const tgt = nodePositions.get(edge.target);
      if (!src || !tgt) return null;
      // Offset wire endpoints to the edge of the symbol rectangle (5.08mm half-width)
      const srcX = src.x + 5.08;
      const tgtX = tgt.x - 5.08;
      return `  (wire (pts (xy ${srcX.toFixed(2)} ${src.y.toFixed(2)}) (xy ${tgtX.toFixed(2)} ${tgt.y.toFixed(2)}))
    (stroke (width 0) (type default))
    (uuid "${uuid()}")
  )`;
    })
    .filter(Boolean);

  const content = `(kicad_sch (version 20230121) (generator "protopulse") (generator_version "1.0")

  (uuid "${schUuid}")

  (paper "A4")

  (lib_symbols
${libSymbols.join("\n")}
  )

${symbols.join("\n\n")}

${wires.join("\n\n")}

)
`;

  return {
    content,
    encoding: "utf8",
    mimeType: "application/x-kicad-schematic",
    filename: `${sanitizeFilename(projectName)}.kicad_sch`,
  };
}

/** Escape a string for use inside a KiCad S-expression quoted value. */
function escapeKicad(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// ---------------------------------------------------------------------------
// 6. KiCad Netlist (.net)
// ---------------------------------------------------------------------------

export function generateKicadNetlist(
  instances: CircuitInstanceData[],
  nets: CircuitNetData[],
  parts: ComponentPartData[],
): ExportResult {
  // Build partId → part lookup
  const partMap = new Map<number, ComponentPartData>();
  for (const part of parts) {
    partMap.set(part.id, part);
  }

  // --- components ---
  const components = instances.map((inst) => {
    const part = partMap.get(inst.partId);
    const meta = part?.meta ?? {};
    const value = metaStr(meta, "title", inst.referenceDesignator);
    const footprint = metaStr(meta, "footprint", "Unknown:Unknown");
    const datasheet = metaStr(meta, "datasheet", "~");

    return `    (comp (ref "${escapeKicad(inst.referenceDesignator)}")
      (value "${escapeKicad(value)}")
      (footprint "${escapeKicad(footprint)}")
      (datasheet "${escapeKicad(datasheet)}")
    )`;
  });

  // --- nets ---
  // Each net can reference pins. We derive pin connections from net segments.
  const netEntries = nets.map((net, i) => {
    const code = i + 1;
    // Extract pin connections from segments
    const pinNodes = extractNetPinNodes(net, instances);

    const nodeLines = pinNodes.map(
      (pn) => `      (node (ref "${escapeKicad(pn.ref)}") (pin "${pn.pin}"))`,
    );

    return `    (net (code ${code}) (name "${escapeKicad(net.name)}")
${nodeLines.join("\n")}
    )`;
  });

  const content = `(export (version "E")
  (design
    (source "ProtoPulse")
    (date "${new Date().toISOString()}")
    (tool "ProtoPulse Export")
  )
  (components
${components.join("\n")}
  )
  (nets
    (net (code 0) (name ""))
${netEntries.join("\n")}
  )
)
`;

  return {
    content,
    encoding: "utf8",
    mimeType: "application/x-kicad-netlist",
    filename: "netlist.net",
  };
}

/** Extract pin-to-component connections from a net's segments. */
function extractNetPinNodes(
  net: CircuitNetData,
  instances: CircuitInstanceData[],
): Array<{ ref: string; pin: string }> {
  const results: Array<{ ref: string; pin: string }> = [];

  // Segments may contain connection info
  if (Array.isArray(net.segments)) {
    for (const seg of net.segments) {
      if (seg && typeof seg === "object") {
        const s = seg as Record<string, unknown>;
        if (typeof s.instanceId === "number" && typeof s.pinId === "string") {
          const inst = instances.find((i) => i.id === s.instanceId);
          if (inst) {
            results.push({ ref: inst.referenceDesignator, pin: s.pinId as string });
          }
        }
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// 7. SPICE Netlist (.cir)
// ---------------------------------------------------------------------------

export function generateSpiceNetlist(
  instances: CircuitInstanceData[],
  nets: CircuitNetData[],
  parts: ComponentPartData[],
  projectName: string,
): ExportResult {
  const partMap = new Map<number, ComponentPartData>();
  for (const part of parts) {
    partMap.set(part.id, part);
  }

  // Build instance → net connections from net segments
  const instanceNets = new Map<number, string[]>();
  for (const net of nets) {
    if (Array.isArray(net.segments)) {
      for (const seg of net.segments) {
        if (seg && typeof seg === "object") {
          const s = seg as Record<string, unknown>;
          if (typeof s.instanceId === "number") {
            const existing = instanceNets.get(s.instanceId) ?? [];
            existing.push(net.name);
            instanceNets.set(s.instanceId, existing);
          }
        }
      }
    }
  }

  const lines: string[] = [
    `* SPICE Netlist - ${projectName}`,
    `* Generated by ProtoPulse`,
    `* Date: ${new Date().toISOString()}`,
    "",
  ];

  for (const inst of instances) {
    const part = partMap.get(inst.partId);
    const meta = part?.meta ?? {};
    const prefix = spicePrefix(inst.referenceDesignator);
    const value = metaStr(meta, "value", "1");
    const connectedNets = instanceNets.get(inst.id) ?? [];

    // Pad net list to at least 2 nodes (most components need at least 2 terminals)
    const netNames = connectedNets.length >= 2
      ? connectedNets
      : [...connectedNets, ...Array(2 - connectedNets.length).fill("0")];

    const netStr = netNames.join(" ");

    if (prefix === "X") {
      // Subcircuit instance
      const modelName = metaStr(meta, "title", "SUBCKT").replace(/\s+/g, "_");
      lines.push(`${inst.referenceDesignator} ${netStr} ${modelName}`);
    } else {
      lines.push(`${inst.referenceDesignator} ${netStr} ${value}`);
    }
  }

  lines.push("", ".end", "");

  return {
    content: lines.join("\n"),
    encoding: "utf8",
    mimeType: "text/plain",
    filename: `${sanitizeFilename(projectName)}.cir`,
  };
}

// ---------------------------------------------------------------------------
// 8. CSV Netlist
// ---------------------------------------------------------------------------

export function generateCsvNetlist(
  instances: CircuitInstanceData[],
  nets: CircuitNetData[],
  parts: ComponentPartData[],
): ExportResult {
  const header = csvRow(["Net Name", "Component", "Pin", "Net Type", "Voltage"]);

  const instMap = new Map<number, CircuitInstanceData>();
  for (const inst of instances) {
    instMap.set(inst.id, inst);
  }

  const rows: string[] = [];

  for (const net of nets) {
    if (Array.isArray(net.segments)) {
      for (const seg of net.segments) {
        if (seg && typeof seg === "object") {
          const s = seg as Record<string, unknown>;
          const instId = typeof s.instanceId === "number" ? s.instanceId : null;
          const pinId = typeof s.pinId === "string" ? s.pinId : "";
          const inst = instId !== null ? instMap.get(instId) : undefined;
          const component = inst?.referenceDesignator ?? "";

          rows.push(
            csvRow([net.name, component, pinId, net.netType, net.voltage]),
          );
        }
      }
    }

    // If net has no segments, still output a row with the net info
    if (!Array.isArray(net.segments) || net.segments.length === 0) {
      rows.push(csvRow([net.name, "", "", net.netType, net.voltage]));
    }
  }

  return {
    content: [header, ...rows].join("\n"),
    encoding: "utf8",
    mimeType: "text/csv",
    filename: "netlist.csv",
  };
}

// ---------------------------------------------------------------------------
// 9. Gerber (RS-274X) — multi-layer output
// ---------------------------------------------------------------------------

export function generateGerber(
  instances: CircuitInstanceData[],
  wires: CircuitWireData[],
  parts: ComponentPartData[],
  projectName: string,
): ExportResult {
  const partMap = new Map<number, ComponentPartData>();
  for (const part of parts) {
    partMap.set(part.id, part);
  }

  // Collect all PCB coordinates to compute board outline
  const allX: number[] = [];
  const allY: number[] = [];

  for (const inst of instances) {
    if (inst.pcbX !== null && inst.pcbY !== null) {
      allX.push(inst.pcbX);
      allY.push(inst.pcbY);
    }
  }

  for (const wire of wires) {
    if (Array.isArray(wire.points)) {
      for (const pt of wire.points) {
        if (pt && typeof pt === "object") {
          const p = pt as Record<string, unknown>;
          if (typeof p.x === "number" && typeof p.y === "number") {
            allX.push(p.x);
            allY.push(p.y);
          }
        }
      }
    }
  }

  // Default board if no coordinates
  const MARGIN = 5; // mm
  const minX = allX.length > 0 ? Math.min(...allX) - MARGIN : 0;
  const minY = allY.length > 0 ? Math.min(...allY) - MARGIN : 0;
  const maxX = allX.length > 0 ? Math.max(...allX) + MARGIN : 100;
  const maxY = allY.length > 0 ? Math.max(...allY) + MARGIN : 100;

  // Convert mm to Gerber integer coords (format 4.6 → multiply by 1e6)
  const g = (mm: number) => Math.round(mm * 1e6);

  // ========================================
  // Layer 1: Board Outline (Edge.Cuts)
  // ========================================
  const outlineLines = [
    `G04 Board Outline - ${projectName}*`,
    "%FSLAX46Y46*%",
    "%MOIN*%",
    "%ADD10C,0.150000*%",
    "D10*",
    `X${g(minX)}Y${g(minY)}D02*`,
    `X${g(maxX)}Y${g(minY)}D01*`,
    `X${g(maxX)}Y${g(maxY)}D01*`,
    `X${g(minX)}Y${g(maxY)}D01*`,
    `X${g(minX)}Y${g(minY)}D01*`,
    "M02*",
  ];

  // ========================================
  // Layer 2: Front Copper (F.Cu)
  // ========================================
  const copperLines = [
    `G04 Front Copper Layer - ${projectName}*`,
    "%FSLAX46Y46*%",
    "%MOIN*%",
    "%ADD11C,0.800000*%", // Round pad aperture
    "%ADD12R,1.600000X1.600000*%", // Rectangular pad aperture
    "%ADD13C,0.254000*%", // Trace aperture
  ];

  // Component pads
  copperLines.push("D11*");
  for (const inst of instances) {
    if (inst.pcbX === null || inst.pcbY === null) continue;

    const part = partMap.get(inst.partId);
    const connectorCount = part ? part.connectors.length : 2;
    const padCount = Math.max(connectorCount, 2);

    // Place pads in a row centered on the component position
    const padSpacing = 2.54; // mm, standard 100-mil spacing
    const startOffset = -((padCount - 1) * padSpacing) / 2;

    for (let p = 0; p < padCount; p++) {
      const padX = inst.pcbX + startOffset + p * padSpacing;
      const padY = inst.pcbY;
      copperLines.push(`X${g(padX)}Y${g(padY)}D03*`);
    }
  }

  // PCB traces from wires
  const pcbWires = wires.filter((w) => w.view === "pcb");
  if (pcbWires.length > 0) {
    copperLines.push("D13*");
    for (const wire of pcbWires) {
      if (!Array.isArray(wire.points) || wire.points.length < 2) continue;
      const pts = wire.points as Array<Record<string, unknown>>;

      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        if (typeof pt.x !== "number" || typeof pt.y !== "number") continue;
        const dCode = i === 0 ? "D02" : "D01";
        copperLines.push(`X${g(pt.x as number)}Y${g(pt.y as number)}${dCode}*`);
      }
    }
  }

  copperLines.push("M02*");

  // ========================================
  // Layer 3: Drill File (Excellon)
  // ========================================
  const drillLines = [
    `; Drill File - ${projectName}`,
    "; Generated by ProtoPulse",
    "M48",
    ";FORMAT={-:-/ absolute / metric / decimal}",
    "FMAT,2",
    "METRIC,TZ",
    "T01C0.800",
    "%",
    "T01",
  ];

  for (const inst of instances) {
    if (inst.pcbX === null || inst.pcbY === null) continue;

    const part = partMap.get(inst.partId);
    const connectorCount = part ? part.connectors.length : 2;
    const padCount = Math.max(connectorCount, 2);
    const padSpacing = 2.54;
    const startOffset = -((padCount - 1) * padSpacing) / 2;

    for (let p = 0; p < padCount; p++) {
      const drillX = inst.pcbX + startOffset + p * padSpacing;
      const drillY = inst.pcbY;
      drillLines.push(`X${drillX.toFixed(3)}Y${drillY.toFixed(3)}`);
    }
  }

  drillLines.push("M30");

  // Concatenate all layers with separator comments
  const content = [
    "G04 === BOARD OUTLINE (Edge.Cuts) ===*",
    ...outlineLines,
    "",
    "G04 === FRONT COPPER (F.Cu) ===*",
    ...copperLines,
    "",
    "G04 === DRILL FILE (Excellon) ===*",
    ...drillLines,
  ].join("\n");

  return {
    content,
    encoding: "utf8",
    mimeType: "application/x-gerber",
    filename: `${sanitizeFilename(projectName)}_gerber.gbr`,
  };
}

// ---------------------------------------------------------------------------
// 10. Pick-and-Place CSV
// ---------------------------------------------------------------------------

export function generatePickAndPlace(
  instances: CircuitInstanceData[],
  parts: ComponentPartData[],
): ExportResult {
  const partMap = new Map<number, ComponentPartData>();
  for (const part of parts) {
    partMap.set(part.id, part);
  }

  const header = csvRow([
    "Designator",
    "Value",
    "Package",
    "Mid X (mm)",
    "Mid Y (mm)",
    "Rotation",
    "Layer",
  ]);

  const rows = instances
    .filter((inst) => inst.pcbX !== null && inst.pcbY !== null)
    .map((inst) => {
      const part = partMap.get(inst.partId);
      const meta = part?.meta ?? {};
      const value = metaStr(meta, "value", metaStr(meta, "title", ""));
      const footprint = metaStr(meta, "footprint", "Unknown");
      const layer = inst.pcbSide === "back" ? "Bottom" : "Top";
      const rotation = inst.pcbRotation ?? 0;

      return csvRow([
        inst.referenceDesignator,
        value,
        footprint,
        inst.pcbX!.toFixed(3),
        inst.pcbY!.toFixed(3),
        rotation,
        layer,
      ]);
    });

  return {
    content: [header, ...rows].join("\n"),
    encoding: "utf8",
    mimeType: "text/csv",
    filename: "pick_and_place.csv",
  };
}

// ---------------------------------------------------------------------------
// 11. Eagle Schematic (.sch) — XML format
// ---------------------------------------------------------------------------

export function generateEagleSch(
  nodes: ArchNodeData[],
  edges: ArchEdgeData[],
  projectName: string,
): ExportResult {
  // Build node position lookup
  const nodePositions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    nodePositions.set(node.nodeId, {
      x: node.positionX * 2.54, // Convert to Eagle mil-based coords
      y: node.positionY * 2.54,
    });
  }

  // Generate library entries for each unique node type
  const librarySymbols = nodes.map((node, i) => {
    const safeName = node.label.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `        <deviceset name="${escapeXml(safeName)}">
          <gates>
            <gate name="G$1" symbol="${escapeXml(safeName)}" x="0" y="0"/>
          </gates>
          <devices>
            <device name="">
              <technologies>
                <technology name=""/>
              </technologies>
            </device>
          </devices>
        </deviceset>`;
  });

  const librarySymbolDefs = nodes.map((node) => {
    const safeName = node.label.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `        <symbol name="${escapeXml(safeName)}">
          <wire x1="-5.08" y1="5.08" x2="5.08" y2="5.08" width="0.254" layer="94"/>
          <wire x1="5.08" y1="5.08" x2="5.08" y2="-5.08" width="0.254" layer="94"/>
          <wire x1="5.08" y1="-5.08" x2="-5.08" y2="-5.08" width="0.254" layer="94"/>
          <wire x1="-5.08" y1="-5.08" x2="-5.08" y2="5.08" width="0.254" layer="94"/>
          <text x="-5.08" y="6.35" size="1.778" layer="95">&gt;NAME</text>
          <text x="-5.08" y="-8.89" size="1.778" layer="96">&gt;VALUE</text>
          <pin name="IN" x="-10.16" y="0" length="middle"/>
          <pin name="OUT" x="10.16" y="0" length="middle" rot="R180"/>
        </symbol>`;
  });

  // Parts
  const partEntries = nodes.map((node, i) => {
    const safeName = node.label.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `        <part name="U${i + 1}" library="protopulse" deviceset="${escapeXml(safeName)}" device="" value="${escapeXml(node.label)}"/>`;
  });

  // Instances
  const instanceEntries = nodes.map((node, i) => {
    const pos = nodePositions.get(node.nodeId)!;
    return `            <instance part="U${i + 1}" gate="G$1" x="${pos.x.toFixed(2)}" y="${pos.y.toFixed(2)}"/>`;
  });

  // Nets
  const netEntries = edges.map((edge, i) => {
    const src = nodePositions.get(edge.source);
    const tgt = nodePositions.get(edge.target);
    if (!src || !tgt) return "";

    const netName = edge.netName || edge.label || `N$${i + 1}`;
    // Connect from source OUT pin to target IN pin
    const srcX = src.x + 10.16; // OUT pin offset
    const tgtX = tgt.x - 10.16; // IN pin offset

    return `            <net name="${escapeXml(netName)}" class="0">
              <segment>
                <wire x1="${srcX.toFixed(2)}" y1="${src.y.toFixed(2)}" x2="${tgtX.toFixed(2)}" y2="${tgt.y.toFixed(2)}" width="0.1524" layer="91"/>
                <pinref part="U${nodes.findIndex((n) => n.nodeId === edge.source) + 1}" gate="G$1" pin="OUT"/>
                <pinref part="U${nodes.findIndex((n) => n.nodeId === edge.target) + 1}" gate="G$1" pin="IN"/>
              </segment>
            </net>`;
  });

  const content = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE eagle SYSTEM "eagle.dtd">
<eagle version="9.6.2">
  <drawing>
    <settings>
      <setting alwaysvectorfont="no"/>
      <setting verticaltext="up"/>
    </settings>
    <grid distance="0.1" unitdist="inch" unit="inch" style="lines" multiple="1" display="no" altdistance="0.01" altunitdist="inch" altunit="inch"/>
    <layers>
      <layer number="91" name="Nets" color="2" fill="1" visible="yes" active="yes"/>
      <layer number="94" name="Symbols" color="4" fill="1" visible="yes" active="yes"/>
      <layer number="95" name="Names" color="7" fill="1" visible="yes" active="yes"/>
      <layer number="96" name="Values" color="7" fill="1" visible="yes" active="yes"/>
    </layers>
    <schematic xreflabel="%F%N/%S.%C%R" xrefpart="/%S.%C%R">
      <libraries>
        <library name="protopulse">
          <symbols>
${librarySymbolDefs.join("\n")}
          </symbols>
          <devicesets>
${librarySymbols.join("\n")}
          </devicesets>
        </library>
      </libraries>
      <parts>
${partEntries.join("\n")}
      </parts>
      <sheets>
        <sheet>
          <instances>
${instanceEntries.join("\n")}
          </instances>
          <nets>
${netEntries.filter(Boolean).join("\n")}
          </nets>
        </sheet>
      </sheets>
    </schematic>
  </drawing>
</eagle>
`;

  return {
    content,
    encoding: "utf8",
    mimeType: "application/xml",
    filename: `${sanitizeFilename(projectName)}.sch`,
  };
}

// ---------------------------------------------------------------------------
// 12. Design Report (Markdown)
// ---------------------------------------------------------------------------

export function generateDesignReportMd(data: {
  projectName: string;
  projectDescription: string;
  nodes: ArchNodeData[];
  edges: ArchEdgeData[];
  bom: BomItemData[];
  issues: ValidationIssueData[];
  circuits: Array<{ name: string; instanceCount: number; netCount: number }>;
}): ExportResult {
  const {
    projectName,
    projectDescription,
    nodes,
    edges,
    bom,
    issues,
    circuits,
  } = data;

  const now = new Date().toISOString().split("T")[0];

  // BOM cost totals
  const totalCost = bom.reduce(
    (sum, item) => sum + parseFloat(item.totalPrice || "0"),
    0,
  );

  // Validation counts
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  const lines: string[] = [
    `# Design Report: ${projectName}`,
    "",
    `**Generated:** ${now}  `,
    `**Generator:** ProtoPulse EDA`,
    "",
    "---",
    "",
    "## Project Overview",
    "",
    projectDescription || "_No description provided._",
    "",
    "---",
    "",
    "## Architecture Summary",
    "",
    `- **Nodes:** ${nodes.length}`,
    `- **Connections:** ${edges.length}`,
    "",
  ];

  if (nodes.length > 0) {
    lines.push("### Components");
    lines.push("");
    lines.push("| # | Label | Type | Position |");
    lines.push("|---|-------|------|----------|");
    nodes.forEach((node, i) => {
      lines.push(
        `| ${i + 1} | ${node.label} | ${node.nodeType} | (${node.positionX.toFixed(0)}, ${node.positionY.toFixed(0)}) |`,
      );
    });
    lines.push("");
  }

  if (edges.length > 0) {
    lines.push("### Connections");
    lines.push("");
    lines.push("| Source | Target | Label | Signal | Voltage |");
    lines.push("|--------|--------|-------|--------|---------|");
    edges.forEach((edge) => {
      const srcNode = nodes.find((n) => n.nodeId === edge.source);
      const tgtNode = nodes.find((n) => n.nodeId === edge.target);
      lines.push(
        `| ${srcNode?.label ?? edge.source} | ${tgtNode?.label ?? edge.target} | ${edge.label ?? "-"} | ${edge.signalType ?? "-"} | ${edge.voltage ?? "-"} |`,
      );
    });
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## BOM Summary");
  lines.push("");
  lines.push(`- **Total Items:** ${bom.length}`);
  lines.push(
    `- **Total Quantity:** ${bom.reduce((s, i) => s + i.quantity, 0)}`,
  );
  lines.push(`- **Total Cost:** $${totalCost.toFixed(2)}`);
  lines.push("");

  if (bom.length > 0) {
    lines.push("| Part Number | Manufacturer | Qty | Unit | Total | Status |");
    lines.push("|-------------|-------------|-----|------|-------|--------|");
    bom.forEach((item) => {
      lines.push(
        `| ${item.partNumber} | ${item.manufacturer} | ${item.quantity} | $${item.unitPrice} | $${item.totalPrice} | ${item.status} |`,
      );
    });
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Validation Status");
  lines.push("");

  if (issues.length === 0) {
    lines.push("No validation issues found.");
  } else {
    lines.push(
      `- **Errors:** ${errorCount}`,
    );
    lines.push(
      `- **Warnings:** ${warningCount}`,
    );
    lines.push(
      `- **Info:** ${infoCount}`,
    );
    lines.push("");
    lines.push("| Severity | Message | Component | Suggestion |");
    lines.push("|----------|---------|-----------|------------|");
    issues.forEach((issue) => {
      lines.push(
        `| ${issue.severity.toUpperCase()} | ${issue.message} | ${issue.componentId ?? "-"} | ${issue.suggestion ?? "-"} |`,
      );
    });
  }
  lines.push("");

  if (circuits.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Circuit Designs");
    lines.push("");
    lines.push("| Name | Instances | Nets |");
    lines.push("|------|-----------|------|");
    circuits.forEach((c) => {
      lines.push(`| ${c.name} | ${c.instanceCount} | ${c.netCount} |`);
    });
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Recommendations");
  lines.push("");

  const recommendations: string[] = [];

  if (errorCount > 0) {
    recommendations.push(
      `- **Resolve ${errorCount} validation error(s)** before proceeding to manufacturing.`,
    );
  }
  if (warningCount > 0) {
    recommendations.push(
      `- **Review ${warningCount} warning(s)** for potential design improvements.`,
    );
  }

  const outOfStock = bom.filter((i) => i.status === "Out of Stock");
  if (outOfStock.length > 0) {
    recommendations.push(
      `- **${outOfStock.length} component(s) out of stock** — find alternatives or place orders.`,
    );
  }

  const noEdgeNodes = nodes.filter(
    (n) =>
      !edges.some((e) => e.source === n.nodeId || e.target === n.nodeId),
  );
  if (noEdgeNodes.length > 0) {
    recommendations.push(
      `- **${noEdgeNodes.length} unconnected node(s):** ${noEdgeNodes.map((n) => n.label).join(", ")}. Verify intentional isolation.`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "- Design looks good. Proceed with detailed schematic capture and layout.",
    );
  }

  lines.push(...recommendations);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("*Report generated by ProtoPulse EDA*");
  lines.push("");

  return {
    content: lines.join("\n"),
    encoding: "utf8",
    mimeType: "text/markdown",
    filename: `${sanitizeFilename(projectName)}_Design_Report.md`,
  };
}
