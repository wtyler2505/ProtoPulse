/**
 * Supplier Comparison Engine
 *
 * Compares pricing, stock, lead time, and MOQ across multiple distributors for
 * a given part number. Uses mock data from SupplierApiManager for demonstration.
 * Supports quantity-based total cost calculation, multi-column sorting, and
 * "best value" detection.
 */

import type {
  DistributorId,
  DistributorOffer,
  PricingTier,
  StockStatus,
} from './supplier-api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single distributor's offer normalized for the comparison table. */
export interface ComparisonRow {
  distributorId: DistributorId;
  distributorName: string;
  sku: string;
  stock: number;
  stockStatus: StockStatus;
  leadTimeDays: number | null;
  moq: number;
  packaging: string;
  unitPrice: number;
  totalPrice: number;
  pricingTiers: PricingTier[];
  url: string;
  isBestValue: boolean;
}

export type SortField =
  | 'distributorName'
  | 'unitPrice'
  | 'totalPrice'
  | 'stock'
  | 'leadTimeDays'
  | 'moq';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

export interface ComparisonResult {
  mpn: string;
  manufacturer: string;
  description: string;
  rows: ComparisonRow[];
  bestValueIndex: number;
  quantity: number;
}

// ---------------------------------------------------------------------------
// Mock supplier data — 5 distributors per part
// ---------------------------------------------------------------------------

interface MockPartData {
  mpn: string;
  manufacturer: string;
  description: string;
  offers: DistributorOffer[];
}

const MOCK_DISTRIBUTOR_IDS: DistributorId[] = [
  'mouser',
  'digikey',
  'lcsc',
  'farnell',
  'arrow',
];

const MOCK_DISTRIBUTOR_NAMES: Record<string, string> = {
  mouser: 'Mouser Electronics',
  digikey: 'DigiKey',
  lcsc: 'LCSC Electronics',
  farnell: 'Farnell / element14',
  arrow: 'Arrow Electronics',
};

function usdTiers(p1: number, p10: number, p100: number): PricingTier[] {
  return [
    { minQuantity: 1, maxQuantity: 9, unitPrice: p1, currency: 'USD' },
    { minQuantity: 10, maxQuantity: 99, unitPrice: p10, currency: 'USD' },
    { minQuantity: 100, maxQuantity: null, unitPrice: p100, currency: 'USD' },
  ];
}

function mkOffer(
  distId: DistributorId,
  sku: string,
  stock: number,
  moq: number,
  packaging: string,
  pricing: PricingTier[],
  leadTimeDays: number | null = null,
): DistributorOffer {
  return {
    distributorId: distId,
    distributorName: MOCK_DISTRIBUTOR_NAMES[distId] ?? distId,
    sku,
    stock,
    stockStatus: stock > 100 ? 'in-stock' : stock > 0 ? 'low-stock' : 'out-of-stock',
    leadTimeDays,
    moq,
    packaging,
    pricing,
    url: `https://${distId}.example.com/product/${sku}`,
    lastUpdated: Date.now(),
  };
}

/** Built-in mock catalog — covers common maker components. */
const MOCK_CATALOG: MockPartData[] = [
  {
    mpn: 'ATmega328P',
    manufacturer: 'Microchip Technology',
    description: '8-bit AVR Microcontroller, 32KB Flash, 2KB SRAM, 20MHz',
    offers: [
      mkOffer('mouser', '556-ATMEGA328P-PU', 3180, 1, 'tube', usdTiers(2.52, 2.25, 1.92)),
      mkOffer('digikey', 'ATMEGA328P-PU-ND', 4523, 1, 'tube', usdTiers(2.48, 2.21, 1.89)),
      mkOffer('lcsc', 'C14877', 12500, 1, 'tape-reel', usdTiers(1.95, 1.78, 1.55)),
      mkOffer('farnell', '1748525', 1240, 1, 'tube', usdTiers(2.65, 2.38, 2.05)),
      mkOffer('arrow', 'ATMEGA328P-PU', 890, 5, 'tube', usdTiers(2.40, 2.15, 1.82), 7),
    ],
  },
  {
    mpn: 'ESP32-WROOM-32',
    manufacturer: 'Espressif Systems',
    description: 'Wi-Fi + Bluetooth SoC Module, 4MB Flash, 240MHz Dual-Core',
    offers: [
      mkOffer('mouser', '356-ESP32WROOM32', 1560, 1, 'tray', usdTiers(3.25, 2.95, 2.55)),
      mkOffer('digikey', '1965-ESP32-WROOM-32-ND', 2890, 1, 'tray', usdTiers(3.10, 2.85, 2.45)),
      mkOffer('lcsc', 'C82899', 45000, 1, 'tape-reel', usdTiers(2.50, 2.20, 1.90)),
      mkOffer('farnell', '3230130', 670, 1, 'tray', usdTiers(3.45, 3.10, 2.70)),
      mkOffer('arrow', 'ESP32-WROOM-32', 2100, 10, 'tray', usdTiers(2.90, 2.60, 2.25), 5),
    ],
  },
  {
    mpn: 'LM7805',
    manufacturer: 'Texas Instruments',
    description: '5V 1.5A Fixed Positive Voltage Regulator, TO-220',
    offers: [
      mkOffer('mouser', '511-LM7805CT', 6200, 1, 'bulk', usdTiers(0.61, 0.55, 0.44)),
      mkOffer('digikey', '296-LM7805CT-ND', 8700, 1, 'bulk', usdTiers(0.58, 0.52, 0.42)),
      mkOffer('lcsc', 'C347220', 25000, 5, 'tape-reel', usdTiers(0.35, 0.30, 0.24)),
      mkOffer('farnell', '2395790', 4100, 1, 'bulk', usdTiers(0.66, 0.59, 0.48)),
      mkOffer('arrow', 'LM7805CT/NOPB', 3500, 1, 'bulk', usdTiers(0.55, 0.49, 0.40), 3),
    ],
  },
  {
    mpn: 'NE555',
    manufacturer: 'Texas Instruments',
    description: 'Precision Timer IC, DIP-8',
    offers: [
      mkOffer('mouser', '595-NE555P', 9800, 1, 'tube', usdTiers(0.45, 0.40, 0.32)),
      mkOffer('digikey', '296-NE555P-ND', 15200, 1, 'tube', usdTiers(0.42, 0.37, 0.29)),
      mkOffer('lcsc', 'C46919', 50000, 5, 'tape-reel', usdTiers(0.18, 0.15, 0.11)),
      mkOffer('farnell', '1467742', 7200, 1, 'tube', usdTiers(0.48, 0.43, 0.35)),
      mkOffer('arrow', 'NE555P', 5600, 1, 'tube', usdTiers(0.40, 0.35, 0.28), 2),
    ],
  },
  {
    mpn: 'STM32F103C8T6',
    manufacturer: 'STMicroelectronics',
    description: 'ARM Cortex-M3 MCU, 64KB Flash, 20KB SRAM, 72MHz',
    offers: [
      mkOffer('mouser', '511-STM32F103C8T6', 2100, 1, 'tray', usdTiers(4.85, 4.40, 3.80)),
      mkOffer('digikey', '497-STM32F103C8T6-ND', 3450, 1, 'tray', usdTiers(4.72, 4.28, 3.68)),
      mkOffer('lcsc', 'C8734', 35000, 1, 'tape-reel', usdTiers(3.20, 2.85, 2.45)),
      mkOffer('farnell', '2060891', 890, 1, 'tray', usdTiers(5.10, 4.65, 4.00)),
      mkOffer('arrow', 'STM32F103C8T6', 1560, 5, 'tray', usdTiers(4.50, 4.10, 3.55), 10),
    ],
  },
  {
    mpn: 'AMS1117-3.3',
    manufacturer: 'Advanced Monolithic Systems',
    description: '3.3V 1A LDO Voltage Regulator, SOT-223',
    offers: [
      mkOffer('mouser', '700-AMS1117-3.3', 18000, 1, 'tape-reel', usdTiers(0.28, 0.22, 0.16)),
      mkOffer('digikey', 'AMS1117-3.3-ND', 12000, 1, 'tape-reel', usdTiers(0.30, 0.24, 0.18)),
      mkOffer('lcsc', 'C6186', 120000, 10, 'tape-reel', usdTiers(0.08, 0.06, 0.04)),
      mkOffer('farnell', '2988451', 5500, 1, 'tape-reel', usdTiers(0.35, 0.28, 0.21)),
      mkOffer('arrow', 'AMS1117-3.3', 8000, 1, 'tape-reel', usdTiers(0.25, 0.20, 0.14), 4),
    ],
  },
];

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/** Look up the unit price for a given quantity from a pricing tier array. */
export function getUnitPriceForQuantity(
  tiers: PricingTier[],
  quantity: number,
): number {
  if (tiers.length === 0) { return 0; }
  // Tiers are sorted ascending by minQuantity. Pick the tier whose range covers quantity.
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
  let matched = sorted[0];
  for (const tier of sorted) {
    if (quantity >= tier.minQuantity) {
      matched = tier;
    }
  }
  return matched.unitPrice;
}

/** Find the mock part data for a given MPN (case-insensitive). */
export function findMockPart(mpn: string): MockPartData | null {
  const needle = mpn.toLowerCase().trim();
  return MOCK_CATALOG.find((p) => p.mpn.toLowerCase() === needle) ?? null;
}

/**
 * Build a comparison result for a given MPN and quantity.
 * Returns null if the part is not found in the mock catalog.
 */
export function buildComparison(
  mpn: string,
  quantity: number,
): ComparisonResult | null {
  const part = findMockPart(mpn);
  if (!part) { return null; }

  const effectiveQty = Math.max(1, Math.round(quantity));

  const rows: ComparisonRow[] = part.offers.map((offer) => {
    const unitPrice = getUnitPriceForQuantity(offer.pricing, effectiveQty);
    const totalPrice = Math.round(unitPrice * effectiveQty * 100) / 100;
    return {
      distributorId: offer.distributorId,
      distributorName: offer.distributorName,
      sku: offer.sku,
      stock: offer.stock,
      stockStatus: offer.stockStatus,
      leadTimeDays: offer.leadTimeDays,
      moq: offer.moq,
      packaging: offer.packaging,
      unitPrice,
      totalPrice,
      pricingTiers: offer.pricing,
      url: offer.url,
      isBestValue: false,
    };
  });

  // Determine best value: lowest total price among in-stock distributors,
  // falling back to lowest total price overall if nothing is in stock.
  const inStockRows = rows.filter(
    (r) => r.stockStatus === 'in-stock' || r.stockStatus === 'low-stock',
  );
  const candidatePool = inStockRows.length > 0 ? inStockRows : rows;
  let bestIdx = -1;
  let bestTotal = Infinity;
  for (let i = 0; i < rows.length; i++) {
    if (candidatePool.includes(rows[i]) && rows[i].totalPrice < bestTotal) {
      bestTotal = rows[i].totalPrice;
      bestIdx = i;
    }
  }
  if (bestIdx >= 0) {
    rows[bestIdx].isBestValue = true;
  }

  return {
    mpn: part.mpn,
    manufacturer: part.manufacturer,
    description: part.description,
    rows,
    bestValueIndex: bestIdx,
    quantity: effectiveQty,
  };
}

/**
 * Sort comparison rows by the given field and direction.
 * Returns a new sorted array — does not mutate.
 */
export function sortComparisonRows(
  rows: readonly ComparisonRow[],
  sort: SortState,
): ComparisonRow[] {
  const { field, direction } = sort;
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    // null lead times sort to the end
    if (aVal === null && bVal === null) { return 0; }
    if (aVal === null) { return 1; }
    if (bVal === null) { return -1; }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal) * multiplier;
    }
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * multiplier;
    }
    return 0;
  });
}

/** Return the list of MPNs available in the mock catalog. */
export function getAvailableMpns(): string[] {
  return MOCK_CATALOG.map((p) => p.mpn);
}

/** Return the number of mock distributors. */
export function getMockDistributorCount(): number {
  return MOCK_DISTRIBUTOR_IDS.length;
}

/** Return mock distributor IDs. */
export function getMockDistributorIds(): DistributorId[] {
  return [...MOCK_DISTRIBUTOR_IDS];
}
