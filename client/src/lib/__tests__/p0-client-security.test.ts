// @vitest-environment jsdom
/**
 * P0 client security suite — sanitizeSvg smoke tests.
 *
 * History: this file was written against the legacy regex sanitizer that
 * preserved input byte-for-byte (e.g. `<rect/>` stayed `<rect/>`). The
 * sanitizer was replaced 2026-04-14 with isomorphic-dompurify (see
 * shared/svg-sanitize.ts). DOMPurify normalizes output via the browser's
 * HTML serializer:
 *   - SVG element self-closing syntax (`<rect/>`) is rewritten to an
 *     explicit open/close pair (`<rect></rect>`). Documented in DOMPurify
 *     README under "Output format" and inherent to `Element.outerHTML` in
 *     the DOM spec — DOMPurify uses the HTML serialization algorithm, not
 *     the XML one, so SVG element shorthand collapses to long form.
 *   - `javascript:` URIs are STRIPPED ENTIRELY along with their carrying
 *     attribute (DOMPurify does not rewrite to `href="#"`); the
 *     surrounding element survives only if it has another reason to.
 *
 * Assertions below verify the *security invariant* (no executable script,
 * no event handler, no javascript:/data:text URI escapes) and the
 * *content-survival invariant* (benign attributes/elements are kept),
 * without asserting byte-exact equality with the input.
 *
 * Comprehensive XSS coverage lives in svg-sanitize.test.ts; this file
 * stays as the P0 smoke suite.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeSvg } from '@/lib/svg-sanitize';

describe('sanitizeSvg', () => {
  it('strips <script> tags from SVG', () => {
    const input = '<svg><rect/><script>alert("xss")</script></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert');
    expect(out).toContain('<rect');
  });

  it('strips <script> tags case-insensitively', () => {
    const input = '<svg><SCRIPT>alert(1)</SCRIPT></svg>';
    const out = sanitizeSvg(input);
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips <foreignObject> tags', () => {
    const input = '<svg><foreignObject><div>evil</div></foreignObject></svg>';
    const out = sanitizeSvg(input);
    expect(out.toLowerCase()).not.toContain('<foreignobject');
    expect(out).not.toContain('<div');
    expect(out).not.toContain('evil');
  });

  it('strips onclick event handlers', () => {
    const input = '<svg><rect onclick="alert(1)" width="10"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('<rect');
    expect(out).toContain('width="10"');
  });

  it('strips onload event handlers', () => {
    const input = '<svg onload="alert(1)"><rect/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('onload');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('<rect');
  });

  it('strips onmouseover event handlers', () => {
    const input = '<svg><circle onmouseover="alert(1)" r="5"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('onmouseover');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('<circle');
    expect(out).toContain('r="5"');
  });

  it('strips javascript: URIs in href', () => {
    // DOMPurify drops the entire href attribute when the value matches a
    // dangerous URI scheme (javascript:, vbscript:, data:text/html, etc.) —
    // it does not rewrite to href="#". The <a> element itself survives
    // because it is in the SVG profile allowlist; only the unsafe
    // attribute is removed. See DOMPurify README "ALLOWED_URI_REGEXP".
    const input = '<svg><a href="javascript:alert(1)"><text>click</text></a></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('alert(1)');
    expect(result).toContain('<a');
    expect(result).toContain('click');
  });

  it('strips javascript: URIs in xlink:href', () => {
    const input = '<svg><a xlink:href="javascript:void(0)"><text>x</text></a></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('void(0)');
  });

  it('preserves normal SVG content', () => {
    // DOMPurify's HTML serializer rewrites SVG self-closing syntax
    // (<rect/>) to explicit open/close pairs (<rect></rect>). We assert
    // structural survival of every element + attribute rather than
    // byte-exact equality with the input.
    const input =
      '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="100" height="100"/><circle cx="50" cy="50" r="25"/><text x="10" y="20">Hello</text><path d="M10 10 L90 90"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toContain('<rect');
    expect(out).toContain('x="0"');
    expect(out).toContain('y="0"');
    expect(out).toContain('width="100"');
    expect(out).toContain('height="100"');
    expect(out).toContain('<circle');
    expect(out).toContain('cx="50"');
    expect(out).toContain('cy="50"');
    expect(out).toContain('r="25"');
    expect(out).toContain('<text');
    expect(out).toContain('Hello');
    expect(out).toContain('<path');
    expect(out).toContain('d="M10 10 L90 90"');
    expect(out).not.toContain('<script');
    expect(out).not.toMatch(/\son\w+=/i);
  });

  it('handles empty string input', () => {
    expect(sanitizeSvg('')).toBe('');
  });

  it('passes through SVG with no dangerous content', () => {
    // See "preserves normal SVG content" for the serializer-normalization
    // rationale — assertions are structural, not byte-exact.
    const safe =
      '<svg viewBox="0 0 100 100"><g><rect fill="#f00" width="50" height="50"/></g></svg>';
    const out = sanitizeSvg(safe);
    expect(out).toContain('viewBox="0 0 100 100"');
    expect(out).toContain('<g');
    expect(out).toContain('<rect');
    expect(out).toContain('fill="#f00"');
    expect(out).toContain('width="50"');
    expect(out).toContain('height="50"');
    expect(out).not.toContain('<script');
    expect(out).not.toMatch(/\son\w+=/i);
  });

  it('strips multiple dangerous elements at once', () => {
    const input =
      '<svg><script>bad()</script><rect onclick="evil()" width="10"/><foreignObject><p>xss</p></foreignObject></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('script');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('foreignObject');
    expect(result).toContain('<rect');
    expect(result).toContain('width="10"');
  });
});
