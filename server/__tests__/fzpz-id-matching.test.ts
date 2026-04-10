/**
 * FZPZ XML/SVG Connector ID Matching Tests
 *
 * In a Fritzing part (.fzpz), the FZP XML references SVG element IDs
 * via `svgId` attributes. Every `svgId` in the FZP must match an actual
 * `id` attribute in the corresponding SVG file. Mismatches cause broken
 * connector rendering in Fritzing.
 *
 * Tests the validateConnectorIdMatching() function.
 */

import { describe, it, expect } from 'vitest';
import { validateConnectorIdMatching } from '../component-export';
import type { ConnectorIdValidation } from '../component-export';

// ===========================================================================
// validateConnectorIdMatching
// ===========================================================================

describe('validateConnectorIdMatching', () => {
  it('returns valid when all FZP svgIds exist in SVG', () => {
    const fzpXml = `
      <connector id="connector0">
        <views>
          <breadboardView><p svgId="connector0pin" terminalId="connector0terminal"/></breadboardView>
        </views>
      </connector>
      <connector id="connector1">
        <views>
          <breadboardView><p svgId="connector1pin" terminalId="connector1terminal"/></breadboardView>
        </views>
      </connector>
    `;

    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <circle id="connector0pin" cx="0" cy="0" r="3"/>
        <circle id="connector1pin" cx="9" cy="0" r="3"/>
      </svg>
    `;

    const result = validateConnectorIdMatching(fzpXml, svgContent);
    expect(result.valid).toBe(true);
    expect(result.missingInSvg).toHaveLength(0);
    expect(result.orphanedInSvg).toHaveLength(0);
  });

  it('reports svgIds missing from SVG', () => {
    const fzpXml = `
      <connector id="connector0">
        <views>
          <breadboardView><p svgId="connector0pin"/></breadboardView>
        </views>
      </connector>
      <connector id="connector1">
        <views>
          <breadboardView><p svgId="connector1pin"/></breadboardView>
        </views>
      </connector>
    `;

    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <circle id="connector0pin" cx="0" cy="0" r="3"/>
      </svg>
    `;

    const result = validateConnectorIdMatching(fzpXml, svgContent);
    expect(result.valid).toBe(false);
    expect(result.missingInSvg).toContain('connector1pin');
  });

  it('reports orphaned connector-pattern IDs in SVG not referenced by FZP', () => {
    const fzpXml = `
      <connector id="connector0">
        <views>
          <breadboardView><p svgId="connector0pin"/></breadboardView>
        </views>
      </connector>
    `;

    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <circle id="connector0pin" cx="0" cy="0" r="3"/>
        <circle id="connector5pin" cx="45" cy="0" r="3"/>
      </svg>
    `;

    const result = validateConnectorIdMatching(fzpXml, svgContent);
    // Still valid (no broken references), but orphaned IDs are noted
    expect(result.valid).toBe(true);
    expect(result.orphanedInSvg).toContain('connector5pin');
  });

  it('handles empty FZP with no svgId attributes', () => {
    const fzpXml = `<module><connectors></connectors></module>`;
    const svgContent = `<svg><circle id="connector0pin" cx="0" cy="0" r="3"/></svg>`;

    const result = validateConnectorIdMatching(fzpXml, svgContent);
    expect(result.valid).toBe(true);
    expect(result.missingInSvg).toHaveLength(0);
  });

  it('handles empty SVG with no IDs', () => {
    const fzpXml = `<connector><views><breadboardView><p svgId="connector0pin"/></breadboardView></views></connector>`;
    const svgContent = `<svg></svg>`;

    const result = validateConnectorIdMatching(fzpXml, svgContent);
    expect(result.valid).toBe(false);
    expect(result.missingInSvg).toContain('connector0pin');
  });

  it('handles multiple views referencing same svgId', () => {
    const fzpXml = `
      <connector id="connector0">
        <views>
          <breadboardView><p svgId="connector0pin"/></breadboardView>
          <schematicView><p svgId="connector0pin"/></schematicView>
        </views>
      </connector>
    `;

    const svgContent = `<svg><circle id="connector0pin" cx="0" cy="0" r="3"/></svg>`;

    const result = validateConnectorIdMatching(fzpXml, svgContent);
    expect(result.valid).toBe(true);
    // Deduplicates — only one entry needed
    expect(result.missingInSvg).toHaveLength(0);
  });

  it('handles terminalId references (not just svgId)', () => {
    const fzpXml = `
      <connector id="connector0">
        <views>
          <breadboardView><p svgId="connector0pin" terminalId="connector0terminal"/></breadboardView>
        </views>
      </connector>
    `;

    const svgContent = `
      <svg>
        <circle id="connector0pin" cx="0" cy="0" r="3"/>
        <circle id="connector0terminal" cx="0" cy="5" r="1"/>
      </svg>
    `;

    const result = validateConnectorIdMatching(fzpXml, svgContent);
    expect(result.valid).toBe(true);
  });

  it('is case-sensitive for IDs', () => {
    const fzpXml = `<connector><views><breadboardView><p svgId="Connector0Pin"/></breadboardView></views></connector>`;
    const svgContent = `<svg><circle id="connector0pin" cx="0" cy="0" r="3"/></svg>`;

    const result = validateConnectorIdMatching(fzpXml, svgContent);
    expect(result.valid).toBe(false);
    expect(result.missingInSvg).toContain('Connector0Pin');
  });
});
