import { describe, it, expect } from 'vitest';
import { sanitizeSvg } from '@/lib/svg-sanitize';

describe('sanitizeSvg', () => {
  it('strips <script> tags from SVG', () => {
    const input = '<svg><rect/><script>alert("xss")</script></svg>';
    expect(sanitizeSvg(input)).toBe('<svg><rect/></svg>');
  });

  it('strips <script> tags case-insensitively', () => {
    const input = '<svg><SCRIPT>alert(1)</SCRIPT></svg>';
    expect(sanitizeSvg(input)).toBe('<svg></svg>');
  });

  it('strips <foreignObject> tags', () => {
    const input = '<svg><foreignObject><div>evil</div></foreignObject></svg>';
    expect(sanitizeSvg(input)).toBe('<svg></svg>');
  });

  it('strips onclick event handlers', () => {
    const input = '<svg><rect onclick="alert(1)" width="10"/></svg>';
    expect(sanitizeSvg(input)).toBe('<svg><rect width="10"/></svg>');
  });

  it('strips onload event handlers', () => {
    const input = '<svg onload="alert(1)"><rect/></svg>';
    expect(sanitizeSvg(input)).toBe('<svg><rect/></svg>');
  });

  it('strips onmouseover event handlers', () => {
    const input = '<svg><circle onmouseover="alert(1)" r="5"/></svg>';
    expect(sanitizeSvg(input)).toBe('<svg><circle r="5"/></svg>');
  });

  it('strips javascript: URIs in href', () => {
    const input = '<svg><a href="javascript:alert(1)"><text>click</text></a></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('javascript:');
    expect(result).toContain('href="#"');
  });

  it('strips javascript: URIs in xlink:href', () => {
    const input = '<svg><a xlink:href="javascript:void(0)"><text>x</text></a></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('javascript:');
  });

  it('preserves normal SVG content', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="100" height="100"/><circle cx="50" cy="50" r="25"/><text x="10" y="20">Hello</text><path d="M10 10 L90 90"/></svg>';
    expect(sanitizeSvg(input)).toBe(input);
  });

  it('handles empty string input', () => {
    expect(sanitizeSvg('')).toBe('');
  });

  it('passes through SVG with no dangerous content', () => {
    const safe = '<svg viewBox="0 0 100 100"><g><rect fill="#f00" width="50" height="50"/></g></svg>';
    expect(sanitizeSvg(safe)).toBe(safe);
  });

  it('strips multiple dangerous elements at once', () => {
    const input = '<svg><script>bad()</script><rect onclick="evil()" width="10"/><foreignObject><p>xss</p></foreignObject></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain('script');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('foreignObject');
    expect(result).toContain('<rect');
    expect(result).toContain('width="10"');
  });
});
