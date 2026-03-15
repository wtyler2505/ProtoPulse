/**
 * Semantic pin mapper for architecture-to-circuit expansion.
 *
 * Instead of blindly picking the first pin on each part, this module
 * analyses connector names and the edge's signal metadata to pick the
 * most appropriate pin on the source and target parts.
 *
 * Strategy (evaluated in priority order):
 *   1. **Power rails** — edge signalType 'power'/'ground' or label containing
 *      voltage keywords → match VCC/VDD/VIN/VBUS/GND/VSS pins.
 *   2. **Protocol buses** — edge label/netName containing I2C/SPI/UART/USART
 *      keywords → match the corresponding function pins (SDA/SCL,
 *      MOSI/MISO/SCK/CS, TX/RX).
 *   3. **Analog** — edge label containing ADC/analog/AIN → match ADC/AIN/Ax pins.
 *   4. **Digital/GPIO** — generic signal → match GPIO/Dx/PBx/IOx/digital pins.
 *   5. **Name similarity** — fuzzy best-match between edge label tokens and
 *      connector names.
 *   6. **Positional fallback** — first available pin (same as previous behaviour).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal connector shape expected from the parts stored in the DB. */
export interface ConnectorInfo {
  id: string;
  name: string;
  description?: string;
}

/** The information available on an architecture edge during expansion. */
export interface EdgeContext {
  label?: string | null;
  signalType?: string | null;
  netName?: string | null;
  voltage?: string | null;
}

/** Result of mapping a single side (source or target) of an edge. */
export interface PinMatch {
  pinId: string;
  strategy: PinMatchStrategy;
}

export type PinMatchStrategy =
  | 'power'
  | 'ground'
  | 'i2c'
  | 'spi'
  | 'uart'
  | 'analog'
  | 'digital'
  | 'name-similarity'
  | 'positional-fallback';

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

function tokens(s: string): string[] {
  return s.split(/[\s_\-/,.;:()]+/).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Classification patterns
// ---------------------------------------------------------------------------

const POWER_PATTERNS = /^(vcc|vdd|vin|vbus|v\+|3v3|5v|12v|vbat|vsys|vout)$/i;
const GROUND_PATTERNS = /^(gnd|vss|v\-|ground|agnd|dgnd|pgnd)$/i;

const POWER_LABEL_PATTERNS = /\b(power|vcc|vdd|vin|vbus|vbat|vsys|3\.?3\s*v|5\s*v|12\s*v|supply)\b/i;
const GROUND_LABEL_PATTERNS = /\b(ground|gnd|vss)\b/i;

const I2C_LABEL_PATTERNS = /\b(i2c|iic|twi)\b/i;
const SPI_LABEL_PATTERNS = /\b(spi)\b/i;
const UART_LABEL_PATTERNS = /\b(uart|usart|serial|rs232|rs485)\b/i;
const ANALOG_LABEL_PATTERNS = /\b(adc|analog|ain|analogue)\b/i;

// Pin name patterns for protocol matching
const I2C_SDA_PATTERNS = /^(sda|i2c_sda|twi_sda|data)$/i;
const I2C_SCL_PATTERNS = /^(scl|i2c_scl|twi_scl|clock|clk)$/i;

const SPI_MOSI_PATTERNS = /^(mosi|spi_mosi|sdi|din|si|dout)$/i;
const SPI_MISO_PATTERNS = /^(miso|spi_miso|sdo|do|so)$/i;
const SPI_SCK_PATTERNS = /^(sck|spi_sck|sclk|spi_clk|clk)$/i;
const SPI_CS_PATTERNS = /^(cs|ss|nss|spi_cs|spi_ss|ce|csn|ncs)$/i;

const UART_TX_PATTERNS = /^(tx|txd|uart_tx|usart_tx|txo|dout|tout)$/i;
const UART_RX_PATTERNS = /^(rx|rxd|uart_rx|usart_rx|rxi|din|rin)$/i;

const ANALOG_PIN_PATTERNS = /^(a\d+|adc\d*|ain\d*|an\d+|analog\d*)$/i;

const DIGITAL_PIN_PATTERNS = /^(d\d+|gpio\d*|io\d+|p[a-d]\d+|pb\d+|pc\d+|pd\d+|pa\d+|digital\d*)$/i;

// ---------------------------------------------------------------------------
// Core matcher
// ---------------------------------------------------------------------------

/**
 * Given a list of connectors on a part and the edge context, return the
 * best-matching pin ID and the strategy that was used.
 *
 * @param connectors  The connectors array from the component part.
 * @param edge        The architecture edge being expanded.
 * @param role        Whether this part is the 'source' or 'target' of the edge.
 *                    For directional protocols (UART TX→RX) this determines
 *                    which function pin to prefer.
 * @param usedPinIds  Optional set of pin IDs already claimed on this instance.
 *                    The mapper will try to avoid re-using them.
 */
export function mapPin(
  connectors: ConnectorInfo[],
  edge: EdgeContext,
  role: 'source' | 'target',
  usedPinIds?: Set<string>,
): PinMatch {
  if (connectors.length === 0) {
    return { pinId: 'pin1', strategy: 'positional-fallback' };
  }

  const edgeLabel = norm(edge.label);
  const edgeSignal = norm(edge.signalType);
  const edgeNet = norm(edge.netName);
  const combined = [edgeLabel, edgeSignal, edgeNet].join(' ');

  // Helper: pick from candidates, preferring ones not yet used
  const pickBest = (candidates: ConnectorInfo[]): ConnectorInfo | undefined => {
    if (!usedPinIds || usedPinIds.size === 0) {
      return candidates[0];
    }
    const unused = candidates.filter((c) => !usedPinIds.has(c.id));
    return unused[0] ?? candidates[0];
  };

  // 1. Ground (check before power — GND is more specific)
  if (
    edgeSignal === 'ground' ||
    GROUND_LABEL_PATTERNS.test(edgeLabel) ||
    GROUND_LABEL_PATTERNS.test(edgeNet)
  ) {
    const gndPins = connectors.filter((c) => GROUND_PATTERNS.test(c.name));
    const match = pickBest(gndPins);
    if (match) {
      return { pinId: match.id, strategy: 'ground' };
    }
  }

  // 2. Power
  if (
    edgeSignal === 'power' ||
    POWER_LABEL_PATTERNS.test(edgeLabel) ||
    POWER_LABEL_PATTERNS.test(edgeNet)
  ) {
    const pwrPins = connectors.filter((c) => POWER_PATTERNS.test(c.name));
    const match = pickBest(pwrPins);
    if (match) {
      return { pinId: match.id, strategy: 'power' };
    }
  }

  // 3. I2C
  if (I2C_LABEL_PATTERNS.test(combined)) {
    // For I2C both source and target should get data/clock,
    // but we pick SDA first then SCL (or vice-versa if SDA is used)
    const sdaPins = connectors.filter((c) => I2C_SDA_PATTERNS.test(c.name));
    const sclPins = connectors.filter((c) => I2C_SCL_PATTERNS.test(c.name));
    // Prefer SDA for first match, SCL as secondary
    const sda = pickBest(sdaPins);
    if (sda) {
      return { pinId: sda.id, strategy: 'i2c' };
    }
    const scl = pickBest(sclPins);
    if (scl) {
      return { pinId: scl.id, strategy: 'i2c' };
    }
  }

  // 4. SPI
  if (SPI_LABEL_PATTERNS.test(combined)) {
    // Source typically drives MOSI/SCK/CS, target receives on MISO
    const mosiPins = connectors.filter((c) => SPI_MOSI_PATTERNS.test(c.name));
    const misoPins = connectors.filter((c) => SPI_MISO_PATTERNS.test(c.name));
    const sckPins = connectors.filter((c) => SPI_SCK_PATTERNS.test(c.name));
    const csPins = connectors.filter((c) => SPI_CS_PATTERNS.test(c.name));

    if (role === 'source') {
      // Source → MOSI first, then SCK, then CS
      const m = pickBest(mosiPins) ?? pickBest(sckPins) ?? pickBest(csPins);
      if (m) {
        return { pinId: m.id, strategy: 'spi' };
      }
    } else {
      // Target → MISO first, then MOSI (slave), then SCK, then CS
      const m = pickBest(misoPins) ?? pickBest(mosiPins) ?? pickBest(sckPins) ?? pickBest(csPins);
      if (m) {
        return { pinId: m.id, strategy: 'spi' };
      }
    }
  }

  // 5. UART
  if (UART_LABEL_PATTERNS.test(combined)) {
    const txPins = connectors.filter((c) => UART_TX_PATTERNS.test(c.name));
    const rxPins = connectors.filter((c) => UART_RX_PATTERNS.test(c.name));
    if (role === 'source') {
      const m = pickBest(txPins) ?? pickBest(rxPins);
      if (m) {
        return { pinId: m.id, strategy: 'uart' };
      }
    } else {
      const m = pickBest(rxPins) ?? pickBest(txPins);
      if (m) {
        return { pinId: m.id, strategy: 'uart' };
      }
    }
  }

  // 6. Analog
  if (ANALOG_LABEL_PATTERNS.test(combined)) {
    const analogPins = connectors.filter((c) => ANALOG_PIN_PATTERNS.test(c.name));
    const match = pickBest(analogPins);
    if (match) {
      return { pinId: match.id, strategy: 'analog' };
    }
  }

  // 7. Digital / GPIO
  if (edgeSignal === 'signal' || edgeSignal === '' || edgeSignal === 'bus') {
    const digitalPins = connectors.filter((c) => DIGITAL_PIN_PATTERNS.test(c.name));
    const match = pickBest(digitalPins);
    if (match) {
      return { pinId: match.id, strategy: 'digital' };
    }
  }

  // 8. Name similarity — tokenise the edge label and find the connector
  //    whose name shares the most tokens.
  if (edgeLabel) {
    const edgeTokens = tokens(edgeLabel);
    if (edgeTokens.length > 0) {
      let bestScore = 0;
      let bestConn: ConnectorInfo | undefined;
      for (const c of connectors) {
        const connTokens = tokens(norm(c.name));
        let score = 0;
        for (const et of edgeTokens) {
          for (const ct of connTokens) {
            if (ct === et) {
              score += 2;
            } else if (ct.includes(et) || et.includes(ct)) {
              score += 1;
            }
          }
        }
        if (score > bestScore && (!usedPinIds || !usedPinIds.has(c.id))) {
          bestScore = score;
          bestConn = c;
        }
      }
      if (bestConn && bestScore > 0) {
        return { pinId: bestConn.id, strategy: 'name-similarity' };
      }
    }
  }

  // 9. Positional fallback — first unused pin, or just the first pin
  const fallback = pickBest(connectors) ?? connectors[0];
  return { pinId: fallback.id, strategy: 'positional-fallback' };
}

// ---------------------------------------------------------------------------
// Batch helper for expansion route
// ---------------------------------------------------------------------------

/**
 * Map both sides of an architecture edge to their best pins.
 *
 * Tracks which pins have already been claimed per instance so that
 * successive edges don't all land on the same pin.
 */
export function mapEdgePins(
  sourceConnectors: ConnectorInfo[],
  targetConnectors: ConnectorInfo[],
  edge: EdgeContext,
  usedSourcePins: Set<string>,
  usedTargetPins: Set<string>,
): { fromPin: PinMatch; toPin: PinMatch } {
  const fromPin = mapPin(sourceConnectors, edge, 'source', usedSourcePins);
  usedSourcePins.add(fromPin.pinId);

  const toPin = mapPin(targetConnectors, edge, 'target', usedTargetPins);
  usedTargetPins.add(toPin.pinId);

  return { fromPin, toPin };
}

/**
 * Extract the ConnectorInfo array from a raw part object.
 * Parts store connectors as `jsonb` — this helper safely coerces
 * the stored value into the minimal shape we need.
 */
export function extractConnectors(part: { connectors?: unknown }): ConnectorInfo[] {
  const raw = part.connectors;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((c): c is { id: string; name: string; description?: string } =>
      typeof c === 'object' && c !== null && typeof (c as Record<string, unknown>).id === 'string' && typeof (c as Record<string, unknown>).name === 'string',
    )
    .map((c) => ({ id: c.id, name: c.name, description: c.description }));
}
