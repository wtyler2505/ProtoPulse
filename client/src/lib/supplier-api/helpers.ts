/**
 * Supplier API — pure helper functions (no instance state).
 * Split from supplier-api.ts.
 */

import { EXCHANGE_RATES } from './config';
import type { Currency, DistributorOffer, PricingTier } from './types';

/** Get the unit price for a given quantity from a tier list. */
export function getPriceForQuantity(tiers: PricingTier[], quantity: number): number | null {
  // Find the tier that matches the quantity (highest minQuantity that still applies)
  let matchedTier: PricingTier | null = null;
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    if (quantity >= tier.minQuantity && (tier.maxQuantity === null || quantity <= tier.maxQuantity)) {
      if (!matchedTier || tier.minQuantity > matchedTier.minQuantity) {
        matchedTier = tier;
      }
    }
  }

  if (matchedTier) {
    return matchedTier.unitPrice;
  }
  const firstTier = tiers[0] as PricingTier | undefined;
  return firstTier ? firstTier.unitPrice : null;
}

/** Minimum unit price across all offers/tiers. Returns 0 when none found. */
export function getMinPrice(offers: DistributorOffer[]): number {
  let min = Infinity;
  offers.forEach((o) => {
    o.pricing.forEach((t) => {
      if (t.unitPrice < min) {
        min = t.unitPrice;
      }
    });
  });
  return min === Infinity ? 0 : min;
}

/** Minimum lead time across all offers. Returns 9999 sentinel when none have lead time. */
export function getMinLeadTime(offers: DistributorOffer[]): number {
  let min = Infinity;
  offers.forEach((o) => {
    if (o.leadTimeDays !== null && o.leadTimeDays < min) {
      min = o.leadTimeDays;
    }
  });
  return min === Infinity ? 9999 : min;
}

/** Convert an amount between currencies using hardcoded exchange rates. */
export function convertCurrency(amount: number, from: Currency, to: Currency): number {
  if (from === to) {
    return amount;
  }
  // Convert to USD first, then to target currency
  const inUsd = amount / EXCHANGE_RATES[from];
  return inUsd * EXCHANGE_RATES[to];
}
