/**
 * Supplier API — best-price selection and pricing tier lookups.
 * Operates on SupplierApiManager instance via its @internal fields.
 * Extracted from manager.ts.
 */

import { getEnabledDistributorIds } from './distributor-config';
import { convertCurrency, getPriceForQuantity } from './helpers';
import type { SupplierApiManager } from './manager';
import { searchPart } from './search';
import type { DistributorId, PricingTier, SearchOptions } from './types';

/** Get the best price for a part across enabled distributors. */
export function getBestPrice(
  mgr: SupplierApiManager,
  mpn: string,
  quantity: number,
  options?: SearchOptions,
): { distributor: DistributorId; unitPrice: number; totalPrice: number } | null {
  const results = searchPart(mgr, mpn, options);
  if (results.length === 0) {
    return null;
  }

  const part = results[0];
  let bestOffer: { distributor: DistributorId; unitPrice: number; totalPrice: number } | null = null;

  const enabledDists = getEnabledDistributorIds(mgr, options?.distributors);

  part.offers.forEach((offer) => {
    if (!enabledDists.includes(offer.distributorId)) {
      return;
    }
    if (options?.inStockOnly && offer.stockStatus === 'out-of-stock') {
      return;
    }

    const tierPrice = getPriceForQuantity(offer.pricing, quantity);
    if (tierPrice === null) {
      return;
    }

    const convertedPrice = convertCurrency(tierPrice, 'USD', mgr._currentCurrency);
    const totalPrice = convertedPrice * quantity;

    if (!bestOffer || convertedPrice < bestOffer.unitPrice) {
      bestOffer = {
        distributor: offer.distributorId,
        unitPrice: convertedPrice,
        totalPrice,
      };
    }
  });

  return bestOffer;
}

/** Get pricing tiers for a part from a specific distributor. */
export function getPricingTiers(
  mgr: SupplierApiManager,
  mpn: string,
  distributorId: DistributorId,
): PricingTier[] {
  const results = searchPart(mgr, mpn);
  if (results.length === 0) {
    return [];
  }

  const part = results[0];
  const offer = part.offers.find((o) => o.distributorId === distributorId);
  if (!offer) {
    return [];
  }

  return offer.pricing.map((t) => ({ ...t }));
}
