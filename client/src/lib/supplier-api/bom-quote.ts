/**
 * Supplier API — BOM (bill of materials) quoting.
 * Operates on SupplierApiManager instance via its @internal fields.
 * Extracted from manager.ts.
 */

import { getEnabledDistributorIds } from './distributor-config';
import { convertCurrency, getPriceForQuantity } from './helpers';
import type { SupplierApiManager } from './manager';
import { searchPart } from './search';
import type { BomPricingResult, BomQuote, SearchOptions } from './types';

function estimateFallbackBestPrice(
  offers: BomPricingResult['allOffers'],
  quantity: number,
  currency: BomQuote['currency'],
): BomPricingResult['bestPrice'] {
  const pricedOffer = offers.find((offer) => offer.pricing.length > 0 && offer.pricing[0].unitPrice > 0);
  if (!pricedOffer) {
    return null;
  }

  const baselineTier = pricedOffer.pricing[0];
  const convertedUnitPrice = convertCurrency(baselineTier.unitPrice, baselineTier.currency, currency);
  return {
    distributor: pricedOffer.distributorId,
    unitPrice: convertedUnitPrice,
    totalPrice: convertedUnitPrice * quantity,
    sku: pricedOffer.sku,
    isMock: true,
  };
}

/** Quote an entire BOM — find best prices, stock status, and warnings per line item. */
export function quoteBom(
  mgr: SupplierApiManager,
  items: Array<{ mpn: string; quantity: number }>,
  options?: SearchOptions,
): BomQuote {
  const currency = options?.currency ?? mgr._currentCurrency;
  const bomItems: BomPricingResult[] = items.map((item) => {
    const results = searchPart(mgr, item.mpn, options);
    const warnings: string[] = [];

    if (results.length === 0) {
      return {
        mpn: item.mpn,
        quantity: item.quantity,
        bestPrice: null,
        allOffers: [],
        inStock: false,
        warnings: [`Part "${item.mpn}" not found in any distributor`],
        isMock: true,
      };
    }

    const part = results[0];
    const enabledDists = getEnabledDistributorIds(mgr, options?.distributors);
    const filteredOffers = part.offers.filter((o) => enabledDists.includes(o.distributorId));

    const hasStock = filteredOffers.some((o) => o.stock >= item.quantity);
    if (!hasStock) {
      const anyStock = filteredOffers.some((o) => o.stock > 0);
      if (anyStock) {
        warnings.push(`Insufficient stock for quantity ${item.quantity}`);
      } else {
        warnings.push('Out of stock at all distributors');
      }
    }

    if (part.lifecycle === 'nrnd') {
      warnings.push('Part is Not Recommended for New Designs (NRND)');
    } else if (part.lifecycle === 'eol') {
      warnings.push('Part is End of Life (EOL)');
    } else if (part.lifecycle === 'obsolete') {
      warnings.push('Part is obsolete');
    }

    let bestPrice: BomPricingResult['bestPrice'] = null;

    filteredOffers.forEach((offer) => {
      if (options?.inStockOnly && offer.stockStatus === 'out-of-stock') {
        return;
      }

      const tierPrice = getPriceForQuantity(offer.pricing, item.quantity);
      if (tierPrice === null) {
        return;
      }

      const convertedPrice = convertCurrency(tierPrice, 'USD', currency);
      const totalPrice = convertedPrice * item.quantity;

      if (!bestPrice || convertedPrice < bestPrice.unitPrice) {
        bestPrice = {
          distributor: offer.distributorId,
          unitPrice: convertedPrice,
          totalPrice,
          sku: offer.sku,
          isMock: false,
        };
      }
    });

    let itemIsMock = false;
    if (!bestPrice) {
      const fallback = estimateFallbackBestPrice(filteredOffers, item.quantity, currency);
      if (fallback) {
        bestPrice = fallback;
        warnings.push('Live tier pricing unavailable; using estimated fallback pricing');
      } else {
        warnings.push('No pricing data available from suppliers');
      }
      itemIsMock = true;
    }

    return {
      mpn: item.mpn,
      quantity: item.quantity,
      bestPrice,
      allOffers: filteredOffers,
      inStock: hasStock,
      warnings,
      isMock: itemIsMock || Boolean(bestPrice?.isMock),
    };
  });

  const totalCost = bomItems.reduce((sum, item) => sum + (item.bestPrice?.totalPrice ?? 0), 0);
  const itemsFound = bomItems.filter((item) => item.bestPrice !== null).length;
  const itemsMissing = bomItems.length - itemsFound;
  const containsMockData = bomItems.some((item) => item.isMock || Boolean(item.bestPrice?.isMock));

  return {
    items: bomItems,
    totalCost,
    currency,
    itemsFound,
    itemsMissing,
    timestamp: Date.now(),
    containsMockData,
  };
}
