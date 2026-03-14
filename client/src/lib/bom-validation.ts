/**
 * BOM Completeness Validation
 *
 * Validates BOM items for data quality and completeness issues.
 * Runs client-side to provide immediate feedback in the ValidationView.
 */

/** Minimal BOM item shape — avoids coupling to the full DB-generated BomItem type. */
export interface BomItemLike {
  id: string | number;
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export type BomIssueSeverity = 'warning' | 'info';

export type BomIssueRule =
  | 'missing_mpn'
  | 'missing_manufacturer'
  | 'missing_description'
  | 'zero_quantity'
  | 'zero_price'
  | 'no_package'
  | 'duplicate_mpn'
  | 'high_quantity';

export interface BomCompletionIssue {
  id: string;
  severity: BomIssueSeverity;
  message: string;
  bomItemId?: number | string;
  rule: BomIssueRule;
  partNumber?: string;
}

/** Common package/footprint keywords that indicate a known package type. */
const PACKAGE_KEYWORDS = [
  'smd', 'smt', 'dip', 'soic', 'sop', 'qfp', 'qfn', 'bga', 'lga',
  'tqfp', 'ssop', 'tssop', 'msop', 'dfn', 'son', 'sot', 'to-',
  'through-hole', 'tht', 'axial', 'radial', 'chip',
  '0201', '0402', '0603', '0805', '1206', '1210', '1812', '2010', '2512',
];

function hasPackageInfo(description: string): boolean {
  const lower = description.toLowerCase();
  return PACKAGE_KEYWORDS.some((kw) => lower.includes(kw));
}

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

/**
 * Validate an array of BOM items for completeness issues.
 * Returns an array of issues sorted by severity (warnings first, then info).
 */
export function validateBomCompleteness(bomItems: BomItemLike[]): BomCompletionIssue[] {
  const issues: BomCompletionIssue[] = [];

  // Per-item rules
  for (const item of bomItems) {
    // 1. missing_mpn — MPN (partNumber) blank
    if (isBlank(item.partNumber)) {
      issues.push({
        id: `missing_mpn-${item.id}`,
        severity: 'warning',
        message: 'Missing manufacturer part number (MPN)',
        bomItemId: item.id,
        rule: 'missing_mpn',
      });
    }

    // 2. missing_manufacturer — manufacturer blank
    if (isBlank(item.manufacturer)) {
      issues.push({
        id: `missing_manufacturer-${item.id}`,
        severity: 'info',
        message: 'Missing manufacturer name',
        bomItemId: item.id,
        rule: 'missing_manufacturer',
        partNumber: item.partNumber || undefined,
      });
    }

    // 3. missing_description — description blank
    if (isBlank(item.description)) {
      issues.push({
        id: `missing_description-${item.id}`,
        severity: 'warning',
        message: 'Missing component description',
        bomItemId: item.id,
        rule: 'missing_description',
        partNumber: item.partNumber || undefined,
      });
    }

    // 4. zero_quantity — quantity is 0
    if (item.quantity === 0) {
      issues.push({
        id: `zero_quantity-${item.id}`,
        severity: 'warning',
        message: 'Quantity is zero — component will not appear in production BOM',
        bomItemId: item.id,
        rule: 'zero_quantity',
        partNumber: item.partNumber || undefined,
      });
    }

    // 5. zero_price — unitPrice is 0, null, or effectively empty
    if (!item.unitPrice || item.unitPrice === 0) {
      issues.push({
        id: `zero_price-${item.id}`,
        severity: 'info',
        message: 'Unit price is zero or missing — cost estimates will be inaccurate',
        bomItemId: item.id,
        rule: 'zero_price',
        partNumber: item.partNumber || undefined,
      });
    }

    // 6. no_package — cannot determine package from description
    if (!isBlank(item.description) && !hasPackageInfo(item.description)) {
      issues.push({
        id: `no_package-${item.id}`,
        severity: 'info',
        message: 'No package/footprint info detected in description',
        bomItemId: item.id,
        rule: 'no_package',
        partNumber: item.partNumber || undefined,
      });
    }

    // 8. high_quantity — qty > 100
    if (item.quantity > 100) {
      issues.push({
        id: `high_quantity-${item.id}`,
        severity: 'info',
        message: `Unusually high quantity (${item.quantity}) — verify this is intentional`,
        bomItemId: item.id,
        rule: 'high_quantity',
        partNumber: item.partNumber || undefined,
      });
    }
  }

  // 7. duplicate_mpn — same non-blank MPN on different items
  const mpnMap = new Map<string, BomItemLike[]>();
  for (const item of bomItems) {
    if (!isBlank(item.partNumber)) {
      const key = item.partNumber.trim().toLowerCase();
      const existing = mpnMap.get(key);
      if (existing) {
        existing.push(item);
      } else {
        mpnMap.set(key, [item]);
      }
    }
  }
  for (const [, items] of Array.from(mpnMap.entries())) {
    if (items.length > 1) {
      for (const item of items) {
        issues.push({
          id: `duplicate_mpn-${item.id}`,
          severity: 'warning',
          message: `Duplicate MPN "${item.partNumber}" found on ${items.length} BOM lines — consider consolidating`,
          bomItemId: item.id,
          rule: 'duplicate_mpn',
          partNumber: item.partNumber,
        });
      }
    }
  }

  // Sort: warnings first, then info
  issues.sort((a, b) => {
    if (a.severity === b.severity) { return 0; }
    return a.severity === 'warning' ? -1 : 1;
  });

  return issues;
}
