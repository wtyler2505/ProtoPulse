/**
 * Supplier API — constants and default configuration.
 * Split from supplier-api.ts.
 */

import type { Currency, SupplierConfig } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STORAGE_KEY = 'protopulse-supplier-api';
export const DEFAULT_CACHE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

// ---------------------------------------------------------------------------
// Currency conversion rates (approximate, hardcoded)
// ---------------------------------------------------------------------------

export const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149,
  CNY: 7.24,
};

// ---------------------------------------------------------------------------
// Built-in distributor configurations
// ---------------------------------------------------------------------------

export const DEFAULT_DISTRIBUTORS: SupplierConfig[] = [
  {
    distributorId: 'digikey',
    name: 'DigiKey',
    enabled: true,
    apiKeyRequired: true,
    rateLimit: 60,
    baseUrl: 'https://api.digikey.com/v3',
    regions: ['US', 'EU', 'APAC'],
  },
  {
    distributorId: 'mouser',
    name: 'Mouser Electronics',
    enabled: true,
    apiKeyRequired: true,
    rateLimit: 30,
    baseUrl: 'https://api.mouser.com/api/v2',
    regions: ['US', 'EU', 'APAC'],
  },
  {
    distributorId: 'octopart',
    name: 'Octopart / Nexar',
    enabled: true,
    apiKeyRequired: true,
    rateLimit: 100,
    baseUrl: 'https://octopart.com/api/v4',
    regions: ['US', 'EU', 'APAC'],
  },
  {
    distributorId: 'newark',
    name: 'Newark',
    enabled: true,
    apiKeyRequired: true,
    rateLimit: 30,
    baseUrl: 'https://api.newark.com/v1',
    regions: ['US', 'EU'],
  },
  {
    distributorId: 'arrow',
    name: 'Arrow Electronics',
    enabled: true,
    apiKeyRequired: true,
    rateLimit: 45,
    baseUrl: 'https://api.arrow.com/itemservice/v4',
    regions: ['US', 'EU', 'APAC'],
  },
  {
    distributorId: 'lcsc',
    name: 'LCSC Electronics',
    enabled: true,
    apiKeyRequired: false,
    rateLimit: 120,
    baseUrl: 'https://www.lcsc.com/api/v1',
    regions: ['APAC', 'US'],
  },
  {
    distributorId: 'farnell',
    name: 'Farnell / element14',
    enabled: true,
    apiKeyRequired: true,
    rateLimit: 30,
    baseUrl: 'https://api.element14.com/catalog/products',
    regions: ['EU', 'APAC'],
  },
];
