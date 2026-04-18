/**
 * Supplier API — shared types.
 * Split from supplier-api.ts. Pure type declarations, zero runtime.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DistributorId = 'octopart' | 'digikey' | 'mouser' | 'newark' | 'arrow' | 'lcsc' | 'farnell';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY';
export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock' | 'on-order' | 'discontinued' | 'unknown';

export interface PricingTier {
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: number;
  currency: Currency;
}

export interface DistributorOffer {
  distributorId: DistributorId;
  distributorName: string;
  sku: string;
  stock: number;
  stockStatus: StockStatus;
  leadTimeDays: number | null;
  moq: number;
  packaging: string;
  pricing: PricingTier[];
  url: string;
  lastUpdated: number;
}

export interface PartSearchResult {
  mpn: string;
  manufacturer: string;
  description: string;
  category: string;
  datasheet?: string;
  lifecycle: 'active' | 'nrnd' | 'eol' | 'obsolete' | 'unknown';
  specifications: Record<string, string>;
  offers: DistributorOffer[];
  imageUrl?: string;
}

export interface SupplierConfig {
  distributorId: DistributorId;
  name: string;
  enabled: boolean;
  apiKeyRequired: boolean;
  rateLimit: number;
  baseUrl: string;
  regions: string[];
}

export interface SearchOptions {
  distributors?: DistributorId[];
  inStockOnly?: boolean;
  currency?: Currency;
  maxResults?: number;
  sortBy?: 'price' | 'stock' | 'leadTime' | 'relevance';
}

export interface BomPricingResult {
  mpn: string;
  quantity: number;
  bestPrice: { distributor: DistributorId; unitPrice: number; totalPrice: number; sku: string } | null;
  allOffers: DistributorOffer[];
  inStock: boolean;
  warnings: string[];
}

export interface BomQuote {
  items: BomPricingResult[];
  totalCost: number;
  currency: Currency;
  itemsFound: number;
  itemsMissing: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Internal types (module-scoped, exported for manager + persistence)
// ---------------------------------------------------------------------------

export interface CachedSearch {
  query: string;
  results: PartSearchResult[];
  timestamp: number;
  expiresAt: number;
}

export interface StockAlert {
  mpn: string;
  threshold: number;
}

export interface RateLimitState {
  requests: number[];
}

export interface PersistedState {
  enabledDistributors: DistributorId[];
  currency: Currency;
  cacheExpiryMs: number;
  stockAlerts: StockAlert[];
}

export type Listener = () => void;
