// @vitest-environment jsdom
/**
 * Comprehensive XSS tests for sanitizeSvg.
 *
 * Covers every known SVG XSS attack vector documented at:
 *   - OWASP XSS Filter Evasion Cheat Sheet
 *   - PortSwigger SVG XSS research
 *   - Mario Heiderich's "The innerHTML Apocalypse"
 *
 * Used by: client/src/components/views/StorageManagerPanel.tsx
 *          (renders user-uploaded SVG via dangerouslySetInnerHTML — PRIMARY XSS SURFACE).
 *
 * HISTORY: These tests were originally written against a regex-based
 * sanitizer. 21 of them were marked `it.fails(...)` to document real
 * vulnerabilities in that regex. On 2026-04-14 the sanitizer was
 * replaced with isomorphic-dompurify (see shared/svg-sanitize.ts) and
 * all 21 vulnerabilities are now blocked — those tests are now regular
 * `it(...)` assertions verifying DOMPurify blocks the payload.
 *
 * DOMPurify normalizes output (self-closing tags become `<rect></rect>`,
 * attribute order may shift), so benign-content tests assert on
 * structural/semantic properties (attribute survived, no dangerous
 * substring appeared) rather than byte-exact equality.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeSvg, SvgTooLargeError, MAX_INPUT_BYTES } from '@/lib/svg-sanitize';

// Helper: assert sanitized output contains no common XSS indicators.
const assertNoExecutableRemnant = (out: string, forbidden: RegExp[]): void => {
  for (const pat of forbidden) {
    expect(out).not.toMatch(pat);
  }
};

describe('sanitizeSvg — script injection', () => {
  it('strips <script>alert(1)</script> inside <svg>', () => {
    const input = '<svg><script>alert(1)</script></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips <script> with attributes: <script src="evil.js">', () => {
    const input = '<svg><script src="https://evil.example/x.js"></script></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('evil.example');
  });

  it('strips <script type="module">', () => {
    const input = '<svg><script type="module">import("data:text/javascript,alert(1)")</script></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips <script> with newlines inside content', () => {
    const input = '<svg><script>\n  var x = 1;\n  alert(x);\n</script></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert');
  });

  it('strips case-variants: <SCRIPT>, <Script>, <ScRiPt>', () => {
    for (const variant of ['<SCRIPT>', '<Script>', '<ScRiPt>']) {
      const close = variant.replace('<', '</').toLowerCase();
      const input = `<svg>${variant}alert(1)${close}</svg>`;
      const out = sanitizeSvg(input);
      expect(out.toLowerCase()).not.toContain('<script');
      expect(out).not.toContain('alert(1)');
    }
  });

  it('strips <script> inside <foreignObject>', () => {
    const input = '<svg><foreignObject><script>alert(1)</script></foreignObject></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<script');
    expect(out.toLowerCase()).not.toContain('<foreignobject');
    expect(out).not.toContain('alert(1)');
  });

  it('blocks self-closing <script src="evil.js"/> (previously VULN in regex sanitizer)', () => {
    const input = '<svg><script src="https://evil.example/x.js"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('evil.example');
  });

  it('blocks mutation XSS: <scr<script></script>ipt>alert(1)</script> (previously VULN in regex sanitizer)', () => {
    const input = '<svg><scr<script></script>ipt>alert(1)</script></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });
});

describe('sanitizeSvg — <foreignObject> containment', () => {
  it('strips plain <foreignObject>', () => {
    const input = '<svg><foreignObject><div>xss</div></foreignObject></svg>';
    const out = sanitizeSvg(input);
    expect(out.toLowerCase()).not.toContain('<foreignobject');
    expect(out).not.toContain('<div');
  });

  it('strips <foreignObject> containing <iframe>', () => {
    const input = '<svg><foreignObject><iframe src="https://evil.example"></iframe></foreignObject></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<iframe');
    expect(out).not.toContain('evil.example');
  });

  it('strips <foreignObject> containing <body onload>', () => {
    const input = '<svg><foreignObject><body onload="alert(1)"></body></foreignObject></svg>';
    const out = sanitizeSvg(input);
    expect(out.toLowerCase()).not.toContain('<foreignobject');
    expect(out).not.toContain('onload');
    expect(out).not.toContain('alert(1)');
  });

  it('strips uppercase <FOREIGNOBJECT>', () => {
    const input = '<svg><FOREIGNOBJECT><div>x</div></FOREIGNOBJECT></svg>';
    const out = sanitizeSvg(input);
    expect(out.toLowerCase()).not.toContain('<foreignobject');
  });
});

describe('sanitizeSvg — event handler attributes', () => {
  const handlers = [
    'onload', 'onclick', 'onerror', 'onmouseover', 'onfocus', 'onblur',
    'onanimationend', 'onanimationstart', 'onanimationiteration',
    'ontransitionend', 'onbegin', 'onend', 'onrepeat',
    'oncopy', 'oncut', 'onpaste', 'oninput', 'onkeydown', 'onkeyup',
    'onpointerdown', 'onpointerup', 'onwheel', 'onscroll',
  ];

  for (const handler of handlers) {
    it(`strips ${handler}="..." attribute`, () => {
      const input = `<svg><rect ${handler}="alert(1)" width="10"/></svg>`;
      const out = sanitizeSvg(input);
      expect(out.toLowerCase()).not.toContain(handler);
      expect(out).not.toContain('alert(1)');
      expect(out).toContain('<rect');
      expect(out).toContain('width="10"');
    });
  }

  it('strips uppercase ONLOAD', () => {
    const input = '<svg ONLOAD="alert(1)"><rect/></svg>';
    const out = sanitizeSvg(input);
    expect(out.toLowerCase()).not.toContain('onload');
    expect(out).not.toContain('alert(1)');
  });

  it('strips mixed-case OnClick', () => {
    const input = '<svg><rect OnClick="alert(1)" width="5"/></svg>';
    const out = sanitizeSvg(input);
    expect(out.toLowerCase()).not.toContain('onclick');
    expect(out).not.toContain('alert(1)');
  });

  it('strips ALL-CAPS ONMOUSEOVER', () => {
    const input = '<svg><circle ONMOUSEOVER="alert(1)" r="3"/></svg>';
    const out = sanitizeSvg(input);
    expect(out.toLowerCase()).not.toContain('onmouseover');
    expect(out).not.toContain('alert(1)');
  });

  it('strips handler with single-quoted value', () => {
    const input = "<svg><rect onclick='alert(1)' width='10'/></svg>";
    const out = sanitizeSvg(input);
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('alert(1)');
  });

  it('strips handler with unquoted value', () => {
    const input = '<svg><rect onclick=alert(1) width="10"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('alert(1)');
  });

  it('strips handler with whitespace around equals: onclick = "alert(1)"', () => {
    const input = '<svg><rect onclick  =  "alert(1)" width="10"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('alert(1)');
  });

  it('strips handler with tab/newline around equals', () => {
    const input = '<svg><rect onclick\t=\n"alert(1)" width="10"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('alert(1)');
  });

  it('strips multiple handlers on same element', () => {
    const input = '<svg><rect onclick="a()" onmouseover="b()" onload="c()" width="10"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('onmouseover');
    expect(out).not.toContain('onload');
    expect(out).not.toContain('a()');
    expect(out).not.toContain('b()');
    expect(out).not.toContain('c()');
  });

  it('blocks no-whitespace event handler via slash: <svg/onload="alert(1)"> (previously VULN in regex sanitizer)', () => {
    const input = '<svg/onload="alert(1)"><rect/></svg>';
    const out = sanitizeSvg(input);
    expect(out.toLowerCase()).not.toContain('onload');
    expect(out).not.toContain('alert(1)');
  });
});

describe('sanitizeSvg — URL-based injection', () => {
  it('neutralizes href="javascript:alert(1)" on <a>', () => {
    const input = '<svg><a href="javascript:alert(1)"><text>x</text></a></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('alert(1)');
  });

  it('neutralizes xlink:href="javascript:..." on <a>', () => {
    const input = '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('alert(1)');
  });

  it('neutralizes xlink:href="javascript:..." on <use>', () => {
    const input = '<svg><use xlink:href="javascript:alert(1)"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('alert(1)');
  });

  it('neutralizes JAVASCRIPT: (uppercase) URI', () => {
    const input = '<svg><a href="JAVASCRIPT:alert(1)"><text>x</text></a></svg>';
    const out = sanitizeSvg(input);
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('neutralizes single-quoted javascript: URI', () => {
    const input = "<svg><a href='javascript:alert(1)'><text>x</text></a></svg>";
    const out = sanitizeSvg(input);
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('alert(1)');
  });

  it('blocks data:text/html URI in href (previously VULN in regex sanitizer)', () => {
    const input = '<svg><a href="data:text/html,<script>alert(1)</script>"><text>x</text></a></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('data:text/html');
    expect(out).not.toContain('<script');
  });

  it('blocks base64-encoded javascript: URI (previously VULN in regex sanitizer)', () => {
    // atob('alert(1)') ≈ YWxlcnQoMSk=
    const input = '<svg><a href="data:application/javascript;base64,YWxlcnQoMSk="><text>x</text></a></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toMatch(/data:\s*application\/javascript/i);
  });

  it('blocks vbscript: URI (previously VULN in regex sanitizer)', () => {
    const input = '<svg><a href="vbscript:msgbox(1)"><text>x</text></a></svg>';
    const out = sanitizeSvg(input);
    expect(out.toLowerCase()).not.toContain('vbscript:');
  });
});

describe('sanitizeSvg — animation elements', () => {
  it('blocks <animate attributeName="href" values="javascript:..."> (previously VULN in regex sanitizer)', () => {
    const input = '<svg><a><animate attributeName="href" values="javascript:alert(1)"/><text>x</text></a></svg>';
    const out = sanitizeSvg(input);
    assertNoExecutableRemnant(out, [/javascript:/i, /alert\(1\)/, /<animate/i]);
  });

  it('blocks <set attributeName="onclick" to="alert(1)"> (previously VULN in regex sanitizer)', () => {
    const input = '<svg><rect><set attributeName="onclick" to="alert(1)"/></rect></svg>';
    const out = sanitizeSvg(input);
    assertNoExecutableRemnant(out, [/<set\b/i, /alert\(1\)/]);
  });

  it('blocks <animateTransform> with dangerous values (previously VULN in regex sanitizer)', () => {
    const input = '<svg><animateTransform attributeName="href" values="javascript:alert(1)"/></svg>';
    const out = sanitizeSvg(input);
    expect(out.toLowerCase()).not.toContain('<animatetransform');
    expect(out).not.toContain('javascript:');
  });
});

describe('sanitizeSvg — CDATA / XML tricks', () => {
  it('neutralizes <script> inside CDATA by HTML-encoding (not executable)', () => {
    // HTML parsers don't understand <![CDATA[...]]> — DOMPurify entity-encodes
    // the content as `&lt;script&gt;alert(1)&lt;/script&gt;`. The literal text
    // "alert(1)" survives as harmless text content because it cannot execute
    // (encoded entities are not parsed as tags). The critical invariant is
    // that no real <script> tag reaches the DOM.
    const input = '<svg><![CDATA[<script>alert(1)</script>]]></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('</script>');
    // Encoded form is present and safe:
    expect(out).toContain('&lt;script&gt;');
  });

  it('blocks billion-laughs XML entity expansion (previously VULN in regex sanitizer)', () => {
    const input = `<?xml version="1.0"?>
<!DOCTYPE svg [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
]>
<svg><text>&lol2;</text></svg>`;
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<!ENTITY');
    expect(out).not.toContain('<!DOCTYPE');
  });

  it('blocks external entity reference (XXE) (previously VULN in regex sanitizer)', () => {
    const input = `<?xml version="1.0"?>
<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<svg><text>&xxe;</text></svg>`;
    const out = sanitizeSvg(input);
    expect(out).not.toContain('SYSTEM');
    expect(out).not.toContain('<!ENTITY');
  });
});

describe('sanitizeSvg — HTML-in-SVG', () => {
  it('strips <iframe> inside <foreignObject>', () => {
    const input = '<svg><foreignObject><iframe src="https://evil.example"></iframe></foreignObject></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<iframe');
    expect(out).not.toContain('evil.example');
  });

  it('strips onerror on <image xlink:href>', () => {
    const input = '<svg><image xlink:href="invalid" onerror="alert(1)"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('alert(1)');
    // <image> element itself is allowed (it's a legit SVG element).
    expect(out).toContain('<image');
  });

  it('blocks bare <iframe> outside <foreignObject> (previously VULN in regex sanitizer)', () => {
    const input = '<svg><iframe src="https://evil.example"></iframe></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<iframe');
    expect(out).not.toContain('evil.example');
  });

  it('blocks <embed> element (previously VULN in regex sanitizer)', () => {
    const input = '<svg><embed src="https://evil.example/x.swf"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<embed');
    expect(out).not.toContain('evil.example');
  });

  it('blocks <object data="..."> element (previously VULN in regex sanitizer)', () => {
    const input = '<svg><object data="https://evil.example/x.html"></object></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<object');
    expect(out).not.toContain('evil.example');
  });
});

describe('sanitizeSvg — style-based injection', () => {
  it('blocks <style> block with url(javascript:...) (previously VULN in regex sanitizer)', () => {
    const input = '<svg><style>svg { background: url(javascript:alert(1)); }</style></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<style');
    expect(out).not.toContain('javascript:');
  });

  it('blocks <style> with @import of remote CSS (previously VULN in regex sanitizer)', () => {
    const input = '<svg><style>@import url("https://evil.example/x.css");</style></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('@import');
    expect(out).not.toContain('<style');
  });

  it('blocks inline style="behavior:url(...)" (legacy IE) (previously VULN in regex sanitizer)', () => {
    const input = '<svg><rect style="behavior:url(evil.htc)" width="10"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('behavior:');
    // style attribute itself is forbidden, belt + suspenders.
    expect(out).not.toContain('style=');
  });

  it('blocks inline style with expression(...) (legacy IE) (previously VULN in regex sanitizer)', () => {
    const input = '<svg><rect style="width:expression(alert(1))"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('expression(');
    expect(out).not.toContain('style=');
  });
});

describe('sanitizeSvg — meta/import', () => {
  it('blocks <meta http-equiv="refresh" content="0;url=javascript:..."> (previously VULN in regex sanitizer)', () => {
    const input = '<svg><meta http-equiv="refresh" content="0;url=javascript:alert(1)"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<meta');
    expect(out).not.toContain('javascript:');
  });

  it('blocks <link rel="import"> (previously VULN in regex sanitizer)', () => {
    const input = '<svg><link rel="import" href="https://evil.example/x.html"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<link');
    expect(out).not.toContain('evil.example');
  });
});

describe('sanitizeSvg — benign content passthrough', () => {
  // DOMPurify normalizes output (self-closing → open/close pairs, attr order
  // may shift). These tests verify that benign content SURVIVES sanitization
  // and that no dangerous constructs leak in, without asserting byte-exact
  // string equality.

  it('passes through plain circle', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="25" fill="red"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).toContain('<circle');
    expect(out).toContain('cx="50"');
    expect(out).toContain('cy="50"');
    expect(out).toContain('r="25"');
    expect(out).toContain('fill="red"');
    expect(out).not.toContain('<script');
  });

  it('passes through plain rect', () => {
    const input = '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="#00f"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).toContain('<rect');
    expect(out).toContain('x="10"');
    expect(out).toContain('y="10"');
    expect(out).toContain('width="80"');
    expect(out).toContain('height="80"');
    expect(out).toContain('fill="#00f"');
    expect(out).toContain('viewBox="0 0 100 100"');
  });

  it('passes through plain path', () => {
    const input = '<svg><path d="M10 10 L90 90 Z" stroke="black" fill="none"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).toContain('<path');
    expect(out).toContain('d="M10 10 L90 90 Z"');
    expect(out).toContain('stroke="black"');
    expect(out).toContain('fill="none"');
  });

  it('passes through grouped elements <g>', () => {
    const input = '<svg><g transform="translate(10,10)"><rect width="20" height="20"/><circle r="5"/></g></svg>';
    const out = sanitizeSvg(input);
    expect(out).toContain('<g');
    expect(out).toContain('transform="translate(10,10)"');
    expect(out).toContain('<rect');
    expect(out).toContain('width="20"');
    expect(out).toContain('<circle');
    expect(out).toContain('r="5"');
  });

  it('passes through text with attributes', () => {
    const input = '<svg><text x="10" y="20" font-family="Arial" font-size="14">Hello</text></svg>';
    const out = sanitizeSvg(input);
    expect(out).toContain('<text');
    expect(out).toContain('x="10"');
    expect(out).toContain('y="20"');
    expect(out).toContain('font-family="Arial"');
    expect(out).toContain('font-size="14"');
    expect(out).toContain('Hello');
  });

  it('passes through defs/gradients', () => {
    const input = '<svg><defs><linearGradient id="g"><stop offset="0%" stop-color="red"/><stop offset="100%" stop-color="blue"/></linearGradient></defs><rect fill="url(#g)" width="100" height="100"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).toContain('<defs');
    expect(out).toContain('<linearGradient');
    expect(out).toContain('id="g"');
    expect(out).toContain('offset="0%"');
    expect(out).toContain('stop-color="red"');
    expect(out).toContain('offset="100%"');
    expect(out).toContain('stop-color="blue"');
    expect(out).toContain('fill="url(#g)"');
  });

  it('passes through viewBox and xmlns attributes', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><rect width="200" height="200" fill="white"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toContain('viewBox="0 0 200 200"');
    expect(out).toContain('width="200"');
    expect(out).toContain('height="200"');
    expect(out).toContain('fill="white"');
  });

  it('passes through class and id attributes (not event handlers)', () => {
    const input = '<svg><rect class="my-rect" id="rect-1" width="10" height="10"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).toContain('class="my-rect"');
    expect(out).toContain('id="rect-1"');
    expect(out).toContain('width="10"');
    expect(out).toContain('height="10"');
  });

  it('strips unknown attributes not in DOMPurify allowlist — e.g. "one"', () => {
    // DOMPurify's SVG profile is an allowlist, so any attribute not
    // explicitly allowed (including non-handler names like "one") is
    // stripped. The original concern was that a regex `\s+on\w+=` would
    // over-match "one" — DOMPurify is correct by construction here.
    const input = '<svg><rect one="true" width="10"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('one="true"');
    // Standard SVG attributes still survive.
    expect(out).toContain('width="10"');
  });
});

describe('sanitizeSvg — empty / malformed / edge cases', () => {
  it('handles empty string', () => {
    expect(sanitizeSvg('')).toBe('');
  });

  it('handles whitespace-only input', () => {
    // DOMPurify returns whitespace as-is (it's valid text content).
    const out = sanitizeSvg('   \n  \t  ');
    expect(out).toBe('   \n  \t  ');
  });

  it('handles non-SVG input (plain text)', () => {
    // Plain text is preserved as a text node.
    const out = sanitizeSvg('hello world');
    expect(out).toBe('hello world');
  });

  it('handles unclosed SVG tag', () => {
    const out = sanitizeSvg('<svg><rect');
    expect(typeof out).toBe('string');
  });

  it('handles SVG with only closing tag', () => {
    const out = sanitizeSvg('</svg>');
    expect(typeof out).toBe('string');
    expect(out).not.toContain('<script');
  });

  it('handles deeply nested SVG (stack safety)', () => {
    let s = '';
    for (let i = 0; i < 100; i++) s += '<g>';
    s = '<svg>' + s;
    for (let i = 0; i < 100; i++) s += '</g>';
    s += '</svg>';
    const out = sanitizeSvg(s);
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
    expect(out).toContain('<g>');
  });

  it('does not crash on invalid UTF-8-looking sequences', () => {
    const input = '<svg>\uFFFD\uFFFD<rect/></svg>';
    const out = sanitizeSvg(input);
    expect(out).toContain('<rect');
  });

  it('preserves content when no dangerous constructs are present', () => {
    const input = '<svg><rect width="10" height="10"/></svg>';
    const out = sanitizeSvg(input);
    expect(out).toContain('<rect');
    expect(out).toContain('width="10"');
    expect(out).toContain('height="10"');
  });

  it('rejects input larger than MAX_INPUT_BYTES with SvgTooLargeError', () => {
    const huge = '<svg>' + 'a'.repeat(MAX_INPUT_BYTES + 1) + '</svg>';
    expect(() => sanitizeSvg(huge)).toThrow(SvgTooLargeError);
  });
});

describe('sanitizeSvg — multiple payloads combined', () => {
  it('strips script + event handler + javascript URI simultaneously', () => {
    const input =
      '<svg onload="a()"><script>b()</script>' +
      '<a href="javascript:c()"><text>x</text></a>' +
      '<foreignObject><iframe src="d"></iframe></foreignObject>' +
      '<rect onclick="e()" width="10"/></svg>';
    const out = sanitizeSvg(input);
    assertNoExecutableRemnant(out, [
      /<script/i,
      /<foreignObject/i,
      /onload=/i,
      /onclick=/i,
      /javascript:/i,
    ]);
    // Benign remnants should survive.
    expect(out).toContain('<rect');
    expect(out).toContain('width="10"');
  });
});

describe('sanitizeSvg — performance', () => {
  // Payloads are sized under MAX_INPUT_BYTES (512 KB) to avoid triggering
  // SvgTooLargeError. The original suite tested 1 MB; the new size cap
  // explicitly rejects that, so we benchmark at ~400 KB instead. The
  // SvgTooLargeError path is covered in the edge-cases suite.
  const TARGET_BYTES = 400 * 1024;

  it('sanitizes ~400KB of benign SVG in under 5 seconds', () => {
    const rect = '<rect x="1" y="1" width="5" height="5" fill="red"/>';
    const repeats = Math.ceil(TARGET_BYTES / rect.length);
    const payload = '<svg>' + rect.repeat(repeats) + '</svg>';
    expect(payload.length).toBeGreaterThan(TARGET_BYTES);
    expect(payload.length).toBeLessThanOrEqual(MAX_INPUT_BYTES);

    const t0 = performance.now();
    const out = sanitizeSvg(payload);
    const elapsed = performance.now() - t0;

    expect(out.length).toBeGreaterThan(TARGET_BYTES / 2);
    // jsdom DOMPurify is fast; 5s is generous but catches regressions.
    expect(elapsed).toBeLessThan(5000);
  });

  it('sanitizes ~400KB of malicious SVG (mixed script/handlers) without hang', () => {
    const chunk = '<script>a</script><rect onclick="b" width="1"/>';
    const repeats = Math.ceil(TARGET_BYTES / chunk.length);
    const payload = '<svg>' + chunk.repeat(repeats) + '</svg>';
    expect(payload.length).toBeLessThanOrEqual(MAX_INPUT_BYTES);

    const t0 = performance.now();
    const out = sanitizeSvg(payload);
    const elapsed = performance.now() - t0;

    expect(out).not.toContain('<script');
    expect(out).not.toContain('onclick');
    expect(elapsed).toBeLessThan(5000);
  });
});
