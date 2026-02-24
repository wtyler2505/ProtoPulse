/**
 * Centralized supplier constants for the procurement system.
 */

export const SUPPLIER_NAMES = ['Digi-Key', 'Mouser', 'LCSC'] as const;

export type SupplierName = (typeof SUPPLIER_NAMES)[number];

export const SUPPLIER_SEARCH_URLS: Record<SupplierName, string> = {
  'Mouser': 'https://www.mouser.com/Search/Refine?Keyword=',
  'Digi-Key': 'https://www.digikey.com/en/products/result?keywords=',
  'LCSC': 'https://www.lcsc.com/search?q=',
};

/** Safe lookup — returns URL or empty string for unknown suppliers. */
export function getSupplierSearchUrl(supplier: string): string {
  return (SUPPLIER_SEARCH_URLS as Record<string, string>)[supplier] ?? '';
}

export const DEFAULT_PREFERRED_SUPPLIERS: Record<SupplierName, boolean> = {
  'Mouser': true,
  'Digi-Key': true,
  'LCSC': false,
};

export const OPTIMIZATION_GOALS: Record<string, string> = {
  'Cost': 'Minimize total cost',
  'Power': 'Minimize power consumption',
  'Size': 'Minimize board footprint',
  'Avail': 'Maximize component availability',
};
