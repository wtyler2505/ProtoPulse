/**
 * Tests for deriveTrustTier — audit #173, 4-canonical-tier trust model.
 *
 * Tiers (precedence order):
 *   stash-absent > verified-exact > connector-defined > heuristic
 *
 * PartVerificationStatus values: 'candidate' | 'verified' | 'deprecated'
 * BreadboardPinMapConfidence values: 'exact' | 'mixed' | 'heuristic'
 */

import { describe, it, expect } from 'vitest';
import type { BreadboardPinMapConfidence } from '../breadboard-part-inspector';
import { deriveTrustTier } from '../breadboard-part-inspector';
import type { PartVerificationStatus } from '@shared/component-trust';

describe('deriveTrustTier (audit #173 — 4 canonical tiers)', () => {
  it.each([
    // ---- stash-absent precedence (wins regardless of verification) ----
    // stash-absent fires when owned=0 AND required>0 AND readyNow=false
    {
      verificationStatus: 'verified' as PartVerificationStatus,
      pinMapConfidence: 'exact' as BreadboardPinMapConfidence,
      readyNow: false,
      ownedQuantity: 0,
      requiredQuantity: 1,
      expected: 'stash-absent',
    },
    {
      verificationStatus: 'candidate' as PartVerificationStatus,
      pinMapConfidence: 'mixed' as BreadboardPinMapConfidence,
      readyNow: false,
      ownedQuantity: 0,
      requiredQuantity: 2,
      expected: 'stash-absent',
    },
    {
      verificationStatus: 'deprecated' as PartVerificationStatus,
      pinMapConfidence: 'heuristic' as BreadboardPinMapConfidence,
      readyNow: false,
      ownedQuantity: 0,
      requiredQuantity: 3,
      expected: 'stash-absent',
    },

    // ---- stash-absent does NOT fire when requiredQuantity is 0 ----
    // (part is on shelf, nothing asked — not unbuildable)
    {
      verificationStatus: 'verified' as PartVerificationStatus,
      pinMapConfidence: 'exact' as BreadboardPinMapConfidence,
      readyNow: false,
      ownedQuantity: 0,
      requiredQuantity: 0,
      expected: 'verified-exact',
    },

    // ---- verified-exact: requires BOTH verified status AND exact pinmap ----
    {
      verificationStatus: 'verified' as PartVerificationStatus,
      pinMapConfidence: 'exact' as BreadboardPinMapConfidence,
      readyNow: true,
      ownedQuantity: 1,
      requiredQuantity: 1,
      expected: 'verified-exact',
    },

    // ---- connector-defined: mixed confidence ----
    {
      verificationStatus: 'verified' as PartVerificationStatus,
      pinMapConfidence: 'mixed' as BreadboardPinMapConfidence,
      readyNow: true,
      ownedQuantity: 1,
      requiredQuantity: 1,
      expected: 'connector-defined',
    },

    // ---- connector-defined: candidate status with non-heuristic pinmap ----
    {
      verificationStatus: 'candidate' as PartVerificationStatus,
      pinMapConfidence: 'exact' as BreadboardPinMapConfidence,
      readyNow: true,
      ownedQuantity: 1,
      requiredQuantity: 1,
      expected: 'connector-defined',
    },
    {
      verificationStatus: 'candidate' as PartVerificationStatus,
      pinMapConfidence: 'mixed' as BreadboardPinMapConfidence,
      readyNow: true,
      ownedQuantity: 1,
      requiredQuantity: 1,
      expected: 'connector-defined',
    },

    // ---- heuristic: pure fallback ----
    {
      verificationStatus: 'candidate' as PartVerificationStatus,
      pinMapConfidence: 'heuristic' as BreadboardPinMapConfidence,
      readyNow: true,
      ownedQuantity: 1,
      requiredQuantity: 1,
      expected: 'heuristic',
    },
    {
      verificationStatus: 'deprecated' as PartVerificationStatus,
      pinMapConfidence: 'heuristic' as BreadboardPinMapConfidence,
      readyNow: true,
      ownedQuantity: 1,
      requiredQuantity: 1,
      expected: 'heuristic',
    },
    // deprecated with any non-heuristic pinmap still falls to heuristic
    // (was verified, now removed — user must re-verify)
    {
      verificationStatus: 'deprecated' as PartVerificationStatus,
      pinMapConfidence: 'exact' as BreadboardPinMapConfidence,
      readyNow: true,
      ownedQuantity: 1,
      requiredQuantity: 1,
      expected: 'heuristic',
    },
  ])(
    '$verificationStatus + $pinMapConfidence + ready=$readyNow + owned=$ownedQuantity / required=$requiredQuantity → $expected',
    ({ verificationStatus, pinMapConfidence, readyNow, ownedQuantity, requiredQuantity, expected }) => {
      expect(
        deriveTrustTier({ verificationStatus, pinMapConfidence, readyNow, ownedQuantity, requiredQuantity }),
      ).toBe(expected);
    },
  );
});
