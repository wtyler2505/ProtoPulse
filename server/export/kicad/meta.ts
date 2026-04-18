// =============================================================================
// KiCad Exporter — Part metadata extraction + layer mapping
// =============================================================================

/**
 * Extract a human-readable value string from a part's meta.
 * Tries common field names: value, then walks the properties array.
 */
export function extractPartValue(meta: Record<string, unknown>): string {
  if (typeof meta['value'] === 'string' && meta['value']) return meta['value'];

  const props = meta['properties'];
  if (Array.isArray(props)) {
    for (let i = 0; i < props.length; i++) {
      const p = props[i];
      if (p && typeof p === 'object' && 'key' in p && 'value' in p) {
        const k = String((p as { key: string }).key).toLowerCase();
        if (k === 'value' || k === 'resistance' || k === 'capacitance' || k === 'inductance') {
          const v = String((p as { value: string }).value);
          if (v) return v;
        }
      }
    }
  }

  return '';
}

/**
 * Extract a footprint / package string from the part's meta.
 */
export function extractFootprint(meta: Record<string, unknown>): string {
  if (typeof meta['packageType'] === 'string' && meta['packageType']) return meta['packageType'];
  if (typeof meta['package'] === 'string' && meta['package']) return meta['package'];
  if (typeof meta['footprint'] === 'string' && meta['footprint']) return meta['footprint'];
  return '';
}

/**
 * Extract a part title / model name from meta.
 */
export function extractTitle(meta: Record<string, unknown>): string {
  if (typeof meta['title'] === 'string' && meta['title']) return meta['title'];
  if (typeof meta['family'] === 'string' && meta['family']) return meta['family'];
  return 'Unknown';
}

/**
 * Extract the manufacturer from the part's meta.
 */
export function extractManufacturer(meta: Record<string, unknown>): string {
  if (typeof meta['manufacturer'] === 'string' && meta['manufacturer']) return meta['manufacturer'];
  return '';
}

/**
 * Extract the manufacturer part number from the part's meta.
 */
export function extractMpn(meta: Record<string, unknown>): string {
  if (typeof meta['mpn'] === 'string' && meta['mpn']) return meta['mpn'];
  return '';
}

/**
 * Extract the mounting type: 'tht' | 'smd' | 'other' | '' .
 */
export function extractMountingType(meta: Record<string, unknown>): string {
  if (typeof meta['mountingType'] === 'string') return meta['mountingType'];
  return '';
}

/**
 * Extract the datasheet URL from the part's meta.
 */
export function extractDatasheet(meta: Record<string, unknown>): string {
  if (typeof meta['datasheetUrl'] === 'string' && meta['datasheetUrl']) return meta['datasheetUrl'];
  return '';
}

/**
 * Guesses the KiCad pin electrical type from the connector and part metadata.
 *
 * KiCad pin types: input, output, bidirectional, tri_state, passive,
 * free, unspecified, power_in, power_out, open_collector, open_emitter,
 * no_connect.
 */
export function guessPinType(
  connector: { id: string; name: string; padType?: string },
  meta: Record<string, unknown>,
): string {
  const nameLC = connector.name.toLowerCase();

  // Power pins
  if (nameLC === 'vcc' || nameLC === 'vdd' || nameLC === 'vin' ||
      nameLC === '3v3' || nameLC === '5v' || nameLC === 'v+') {
    return 'power_in';
  }
  if (nameLC === 'gnd' || nameLC === 'vss' || nameLC === 'agnd' || nameLC === 'dgnd') {
    return 'power_in';
  }
  if (nameLC === 'vout' || nameLC === 'v-') {
    return 'power_out';
  }

  // Passive components (resistors, capacitors, inductors)
  const family = typeof meta['family'] === 'string' ? meta['family'].toLowerCase() : '';
  if (family === 'resistor' || family === 'capacitor' || family === 'inductor' ||
      family === 'fuse' || family === 'crystal') {
    return 'passive';
  }

  return 'unspecified';
}

// ---------------------------------------------------------------------------
// Layer mapping
// ---------------------------------------------------------------------------

/**
 * Maps a ProtoPulse side string ('front'/'back') to the KiCad copper layer.
 */
export function mapCopperLayer(side: string | null): string {
  if (!side) return 'F.Cu';
  switch (side.toLowerCase()) {
    case 'back':
    case 'bottom':
      return 'B.Cu';
    case 'front':
    case 'top':
    default:
      return 'F.Cu';
  }
}

/**
 * Maps a ProtoPulse side to the KiCad silkscreen layer.
 */
export function mapSilkLayer(side: string | null): string {
  if (!side) return 'F.SilkS';
  switch (side.toLowerCase()) {
    case 'back':
    case 'bottom':
      return 'B.SilkS';
    default:
      return 'F.SilkS';
  }
}

/**
 * Maps a ProtoPulse wire layer name to a KiCad PCB layer name.
 * Falls back to F.Cu for unknown layers.
 */
export function mapWireLayer(layer: string): string {
  switch (layer.toLowerCase()) {
    case 'back':
    case 'bottom':
    case 'b.cu':
      return 'B.Cu';
    case 'front':
    case 'top':
    case 'f.cu':
      return 'F.Cu';
    default:
      return 'F.Cu';
  }
}
