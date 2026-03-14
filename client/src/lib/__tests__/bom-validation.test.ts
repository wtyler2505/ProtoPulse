import { describe, it, expect } from 'vitest';
import { validateBomCompleteness } from '../bom-validation';
import type { BomItemLike, BomCompletionIssue, BomIssueRule } from '../bom-validation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function item(overrides: Partial<BomItemLike> & { id: string | number }): BomItemLike {
  return {
    partNumber: 'MPN-001',
    manufacturer: 'Acme Corp',
    description: '100nF 0805 MLCC capacitor',
    quantity: 10,
    unitPrice: 0.05,
    ...overrides,
  };
}

function issuesByRule(issues: BomCompletionIssue[], rule: BomIssueRule): BomCompletionIssue[] {
  return issues.filter((i) => i.rule === rule);
}

// ---------------------------------------------------------------------------
// Empty BOM
// ---------------------------------------------------------------------------

describe('validateBomCompleteness', () => {
  describe('empty BOM', () => {
    it('returns no issues for an empty array', () => {
      const result = validateBomCompleteness([]);
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // All-complete BOM (no issues)
  // -------------------------------------------------------------------------

  describe('fully complete BOM', () => {
    it('returns no issues when all fields are populated correctly', () => {
      const items: BomItemLike[] = [
        item({ id: '1', partNumber: 'CAP-100NF', manufacturer: 'Murata', description: '100nF 0805 MLCC', quantity: 5, unitPrice: 0.02 }),
        item({ id: '2', partNumber: 'RES-10K', manufacturer: 'Yageo', description: '10k Ohm 0402 chip resistor', quantity: 20, unitPrice: 0.01 }),
        item({ id: '3', partNumber: 'IC-STM32', manufacturer: 'STMicro', description: 'STM32F4 QFP-64 microcontroller', quantity: 1, unitPrice: 5.50 }),
      ];
      const result = validateBomCompleteness(items);
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Rule 1: missing_mpn
  // -------------------------------------------------------------------------

  describe('missing_mpn', () => {
    it('flags items with empty partNumber', () => {
      const issues = validateBomCompleteness([item({ id: '1', partNumber: '' })]);
      const mpnIssues = issuesByRule(issues, 'missing_mpn');
      expect(mpnIssues).toHaveLength(1);
      expect(mpnIssues[0].severity).toBe('warning');
      expect(mpnIssues[0].bomItemId).toBe('1');
    });

    it('flags items with whitespace-only partNumber', () => {
      const issues = validateBomCompleteness([item({ id: '2', partNumber: '   ' })]);
      expect(issuesByRule(issues, 'missing_mpn')).toHaveLength(1);
    });

    it('does not flag items with valid partNumber', () => {
      const issues = validateBomCompleteness([item({ id: '1', partNumber: 'PART-001' })]);
      expect(issuesByRule(issues, 'missing_mpn')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Rule 2: missing_manufacturer
  // -------------------------------------------------------------------------

  describe('missing_manufacturer', () => {
    it('flags items with empty manufacturer', () => {
      const issues = validateBomCompleteness([item({ id: '1', manufacturer: '' })]);
      const mfrIssues = issuesByRule(issues, 'missing_manufacturer');
      expect(mfrIssues).toHaveLength(1);
      expect(mfrIssues[0].severity).toBe('info');
    });

    it('flags items with whitespace-only manufacturer', () => {
      const issues = validateBomCompleteness([item({ id: '1', manufacturer: '  ' })]);
      expect(issuesByRule(issues, 'missing_manufacturer')).toHaveLength(1);
    });

    it('does not flag items with valid manufacturer', () => {
      const issues = validateBomCompleteness([item({ id: '1', manufacturer: 'Texas Instruments' })]);
      expect(issuesByRule(issues, 'missing_manufacturer')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Rule 3: missing_description
  // -------------------------------------------------------------------------

  describe('missing_description', () => {
    it('flags items with empty description', () => {
      const issues = validateBomCompleteness([item({ id: '1', description: '' })]);
      const descIssues = issuesByRule(issues, 'missing_description');
      expect(descIssues).toHaveLength(1);
      expect(descIssues[0].severity).toBe('warning');
    });

    it('flags items with whitespace-only description', () => {
      const issues = validateBomCompleteness([item({ id: '1', description: '   ' })]);
      expect(issuesByRule(issues, 'missing_description')).toHaveLength(1);
    });

    it('does not flag items with valid description', () => {
      const issues = validateBomCompleteness([item({ id: '1', description: 'Decoupling capacitor' })]);
      expect(issuesByRule(issues, 'missing_description')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Rule 4: zero_quantity
  // -------------------------------------------------------------------------

  describe('zero_quantity', () => {
    it('flags items with quantity 0', () => {
      const issues = validateBomCompleteness([item({ id: '1', quantity: 0 })]);
      const qtyIssues = issuesByRule(issues, 'zero_quantity');
      expect(qtyIssues).toHaveLength(1);
      expect(qtyIssues[0].severity).toBe('warning');
      expect(qtyIssues[0].message).toContain('zero');
    });

    it('does not flag items with positive quantity', () => {
      const issues = validateBomCompleteness([item({ id: '1', quantity: 5 })]);
      expect(issuesByRule(issues, 'zero_quantity')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Rule 5: zero_price
  // -------------------------------------------------------------------------

  describe('zero_price', () => {
    it('flags items with unitPrice 0', () => {
      const issues = validateBomCompleteness([item({ id: '1', unitPrice: 0 })]);
      const priceIssues = issuesByRule(issues, 'zero_price');
      expect(priceIssues).toHaveLength(1);
      expect(priceIssues[0].severity).toBe('info');
    });

    it('does not flag items with positive unitPrice', () => {
      const issues = validateBomCompleteness([item({ id: '1', unitPrice: 1.25 })]);
      expect(issuesByRule(issues, 'zero_price')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Rule 6: no_package
  // -------------------------------------------------------------------------

  describe('no_package', () => {
    it('flags items without package keywords in description', () => {
      const issues = validateBomCompleteness([item({ id: '1', description: 'Generic resistor for power supply' })]);
      const pkgIssues = issuesByRule(issues, 'no_package');
      expect(pkgIssues).toHaveLength(1);
      expect(pkgIssues[0].severity).toBe('info');
    });

    it('does not flag items with 0805 in description', () => {
      const issues = validateBomCompleteness([item({ id: '1', description: '100nF 0805 capacitor' })]);
      expect(issuesByRule(issues, 'no_package')).toHaveLength(0);
    });

    it('does not flag items with SOIC in description', () => {
      const issues = validateBomCompleteness([item({ id: '1', description: 'Op-amp SOIC-8' })]);
      expect(issuesByRule(issues, 'no_package')).toHaveLength(0);
    });

    it('does not flag items with QFP in description', () => {
      const issues = validateBomCompleteness([item({ id: '1', description: 'MCU TQFP-64' })]);
      expect(issuesByRule(issues, 'no_package')).toHaveLength(0);
    });

    it('does not flag items with DIP in description', () => {
      const issues = validateBomCompleteness([item({ id: '1', description: 'Timer IC DIP-8' })]);
      expect(issuesByRule(issues, 'no_package')).toHaveLength(0);
    });

    it('does not flag items with through-hole in description', () => {
      const issues = validateBomCompleteness([item({ id: '1', description: 'Through-hole electrolytic cap' })]);
      expect(issuesByRule(issues, 'no_package')).toHaveLength(0);
    });

    it('does not flag items with BGA in description', () => {
      const issues = validateBomCompleteness([item({ id: '1', description: 'FPGA BGA-256' })]);
      expect(issuesByRule(issues, 'no_package')).toHaveLength(0);
    });

    it('is case-insensitive', () => {
      const issues = validateBomCompleteness([item({ id: '1', description: 'SMD resistor array' })]);
      expect(issuesByRule(issues, 'no_package')).toHaveLength(0);
    });

    it('skips check when description is blank', () => {
      const issues = validateBomCompleteness([item({ id: '1', description: '' })]);
      // Should get missing_description, but NOT no_package (blank descriptions are excluded)
      expect(issuesByRule(issues, 'no_package')).toHaveLength(0);
      expect(issuesByRule(issues, 'missing_description')).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Rule 7: duplicate_mpn
  // -------------------------------------------------------------------------

  describe('duplicate_mpn', () => {
    it('flags items sharing the same MPN', () => {
      const items: BomItemLike[] = [
        item({ id: '1', partNumber: 'CAP-100NF' }),
        item({ id: '2', partNumber: 'CAP-100NF' }),
      ];
      const issues = validateBomCompleteness(items);
      const dupIssues = issuesByRule(issues, 'duplicate_mpn');
      expect(dupIssues).toHaveLength(2);
      expect(dupIssues[0].severity).toBe('warning');
      expect(dupIssues[0].message).toContain('2 BOM lines');
    });

    it('is case-insensitive', () => {
      const items: BomItemLike[] = [
        item({ id: '1', partNumber: 'cap-100nf' }),
        item({ id: '2', partNumber: 'CAP-100NF' }),
      ];
      const issues = validateBomCompleteness(items);
      expect(issuesByRule(issues, 'duplicate_mpn')).toHaveLength(2);
    });

    it('does not flag unique MPNs', () => {
      const items: BomItemLike[] = [
        item({ id: '1', partNumber: 'CAP-100NF' }),
        item({ id: '2', partNumber: 'RES-10K' }),
      ];
      const issues = validateBomCompleteness(items);
      expect(issuesByRule(issues, 'duplicate_mpn')).toHaveLength(0);
    });

    it('does not flag blank MPNs as duplicates', () => {
      const items: BomItemLike[] = [
        item({ id: '1', partNumber: '' }),
        item({ id: '2', partNumber: '' }),
      ];
      const issues = validateBomCompleteness(items);
      expect(issuesByRule(issues, 'duplicate_mpn')).toHaveLength(0);
    });

    it('handles three items with same MPN', () => {
      const items: BomItemLike[] = [
        item({ id: '1', partNumber: 'PART-X' }),
        item({ id: '2', partNumber: 'PART-X' }),
        item({ id: '3', partNumber: 'PART-X' }),
      ];
      const issues = validateBomCompleteness(items);
      const dupIssues = issuesByRule(issues, 'duplicate_mpn');
      expect(dupIssues).toHaveLength(3);
      expect(dupIssues[0].message).toContain('3 BOM lines');
    });
  });

  // -------------------------------------------------------------------------
  // Rule 8: high_quantity
  // -------------------------------------------------------------------------

  describe('high_quantity', () => {
    it('flags items with quantity > 100', () => {
      const issues = validateBomCompleteness([item({ id: '1', quantity: 101 })]);
      const hiQty = issuesByRule(issues, 'high_quantity');
      expect(hiQty).toHaveLength(1);
      expect(hiQty[0].severity).toBe('info');
      expect(hiQty[0].message).toContain('101');
    });

    it('does not flag items with quantity exactly 100', () => {
      const issues = validateBomCompleteness([item({ id: '1', quantity: 100 })]);
      expect(issuesByRule(issues, 'high_quantity')).toHaveLength(0);
    });

    it('flags extreme quantities', () => {
      const issues = validateBomCompleteness([item({ id: '1', quantity: 10000 })]);
      const hiQty = issuesByRule(issues, 'high_quantity');
      expect(hiQty).toHaveLength(1);
      expect(hiQty[0].message).toContain('10000');
    });
  });

  // -------------------------------------------------------------------------
  // Issue ordering
  // -------------------------------------------------------------------------

  describe('ordering', () => {
    it('sorts warnings before info', () => {
      const issues = validateBomCompleteness([
        item({ id: '1', partNumber: '', unitPrice: 0 }),
      ]);
      // missing_mpn is warning, zero_price is info
      expect(issues.length).toBeGreaterThanOrEqual(2);
      const warnIndex = issues.findIndex((i) => i.severity === 'warning');
      const infoIndex = issues.findIndex((i) => i.severity === 'info');
      if (warnIndex >= 0 && infoIndex >= 0) {
        expect(warnIndex).toBeLessThan(infoIndex);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Mixed scenarios
  // -------------------------------------------------------------------------

  describe('mixed scenarios', () => {
    it('returns multiple issue types for a single item', () => {
      const issues = validateBomCompleteness([
        item({ id: '1', partNumber: '', manufacturer: '', description: '', quantity: 0, unitPrice: 0 }),
      ]);
      const rules = new Set(issues.map((i) => i.rule));
      expect(rules.has('missing_mpn')).toBe(true);
      expect(rules.has('missing_manufacturer')).toBe(true);
      expect(rules.has('missing_description')).toBe(true);
      expect(rules.has('zero_quantity')).toBe(true);
      expect(rules.has('zero_price')).toBe(true);
      // no_package should NOT fire because description is blank
      expect(rules.has('no_package')).toBe(false);
    });

    it('handles a realistic mixed BOM', () => {
      const items: BomItemLike[] = [
        item({ id: '1', partNumber: 'CAP-100NF', manufacturer: 'Murata', description: '100nF 0805 MLCC', quantity: 10, unitPrice: 0.02 }),
        item({ id: '2', partNumber: '', manufacturer: 'Unknown', description: 'Mystery component', quantity: 1, unitPrice: 0 }),
        item({ id: '3', partNumber: 'RES-10K', manufacturer: '', description: '10k resistor', quantity: 200, unitPrice: 0.01 }),
        item({ id: '4', partNumber: 'RES-10K', manufacturer: 'Yageo', description: '10k 0402 chip resistor', quantity: 5, unitPrice: 0.01 }),
      ];
      const issues = validateBomCompleteness(items);

      // Item 1: fully complete with package info → no issues
      expect(issues.filter((i) => i.bomItemId === '1')).toHaveLength(0);

      // Item 2: missing_mpn (warn), zero_price (info), no_package (info)
      const item2Issues = issues.filter((i) => i.bomItemId === '2');
      expect(item2Issues.length).toBeGreaterThanOrEqual(3);

      // Item 3: missing_manufacturer (info), high_quantity (info), no_package (info), duplicate_mpn (warn)
      const item3Issues = issues.filter((i) => i.bomItemId === '3');
      expect(item3Issues.length).toBeGreaterThanOrEqual(3);

      // Item 4: duplicate_mpn (warn) — shares RES-10K with item 3
      const item4Issues = issues.filter((i) => i.bomItemId === '4');
      expect(item4Issues.some((i) => i.rule === 'duplicate_mpn')).toBe(true);
    });

    it('includes partNumber in issue when available', () => {
      const issues = validateBomCompleteness([
        item({ id: '1', partNumber: 'PART-XYZ', manufacturer: '' }),
      ]);
      const mfrIssue = issuesByRule(issues, 'missing_manufacturer')[0];
      expect(mfrIssue.partNumber).toBe('PART-XYZ');
    });

    it('each issue has a unique id', () => {
      const items: BomItemLike[] = [
        item({ id: '1', partNumber: '', manufacturer: '', description: '' }),
        item({ id: '2', partNumber: '', manufacturer: '', description: '' }),
      ];
      const issues = validateBomCompleteness(items);
      const ids = issues.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('handles numeric item IDs', () => {
      const issues = validateBomCompleteness([item({ id: 42, partNumber: '' })]);
      const mpnIssue = issuesByRule(issues, 'missing_mpn')[0];
      expect(mpnIssue.bomItemId).toBe(42);
      expect(mpnIssue.id).toContain('42');
    });
  });
});
