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
 * Tests marked `it.fails(...)` represent REAL vulnerabilities in the current
 * regex-based sanitizer. They are documented here so Tyler can harden the
 * sanitizer (recommendation: replace with DOMPurify or an AST-based approach).
 */

import { describe, it, expect } from 'vitest';
import { sanitizeSvg } from '@/lib/svg-sanitize';

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
    expect(out).not.toContain('<foreignObject');
    expect(out).not.toContain('alert(1)');
  });

  it.fails(
    'VULN: self-closing <script src="evil.js"/> passes through regex (requires </script>)',
    () => {
      const input = '<svg><script src="https://evil.example/x.js"/></svg>';
      const out = sanitizeSvg(input);
      // We want ZERO <script in the output, but the regex demands a closing </script>.
      expect(out).not.toContain('<script');
    }
  );

  it.fails(
    'VULN: mutation XSS — nested <script> reforms after single-pass regex',
    () => {
      // After stripping the inner <script></script>, the outer tag reforms into
      // <script>alert(1)</script> which the single-pass regex does not re-process.
      const input = '<svg><scr<script></script>ipt>alert(1)</script></svg>';
      const out = sanitizeSvg(input);
      expect(out).not.toContain('<script');
      expect(out).not.toContain('alert(1)');
    }
  );
});

describe('sanitizeSvg — <foreignObject> containment', () => {
  it('strips plain <foreignObject>', () => {
    const input = '<svg><foreignObject><div>xss</div></foreignObject></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<foreignObject');
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
    expect(out).not.toContain('<foreignObject');
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
      expect(out).not.toContain(handler);
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

  it.fails(
    'VULN: no-whitespace event handler via slash: <svg/onload="alert(1)">',
    () => {
      // HTML parsers accept /attr as an attribute delimiter. The regex requires \s+.
      const input = '<svg/onload="alert(1)"><rect/></svg>';
      const out = sanitizeSvg(input);
      expect(out.toLowerCase()).not.toContain('onload');
      expect(out).not.toContain('alert(1)');
    }
  );
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

  it.fails(
    'VULN: data:text/html URI in href is NOT stripped',
    () => {
      const input = '<svg><a href="data:text/html,<script>alert(1)</script>"><text>x</text></a></svg>';
      const out = sanitizeSvg(input);
      // data:text/html with inline HTML is equivalent to javascript: for XSS.
      expect(out).not.toContain('data:text/html');
    }
  );

  it.fails(
    'VULN: base64-encoded javascript: URI is NOT detected (data:application/javascript;base64,...)',
    () => {
      // atob('alert(1)') ≈ YWxlcnQoMSk=
      const input = '<svg><a href="data:application/javascript;base64,YWxlcnQoMSk="><text>x</text></a></svg>';
      const out = sanitizeSvg(input);
      expect(out).not.toMatch(/data:\s*application\/javascript/i);
    }
  );

  it.fails(
    'VULN: vbscript: URI is NOT detected',
    () => {
      // Legacy IE, but still a risk if SVG is piped to embedded browsers.
      const input = '<svg><a href="vbscript:msgbox(1)"><text>x</text></a></svg>';
      const out = sanitizeSvg(input);
      expect(out.toLowerCase()).not.toContain('vbscript:');
    }
  );
});

describe('sanitizeSvg — animation elements', () => {
  it.fails(
    'VULN: <animate attributeName="href" values="javascript:..."> is NOT stripped',
    () => {
      const input = '<svg><a><animate attributeName="href" values="javascript:alert(1)"/><text>x</text></a></svg>';
      const out = sanitizeSvg(input);
      assertNoExecutableRemnant(out, [/javascript:/i, /alert\(1\)/]);
    }
  );

  it.fails(
    'VULN: <set attributeName="onclick" to="alert(1)"> is NOT stripped',
    () => {
      const input = '<svg><rect><set attributeName="onclick" to="alert(1)"/></rect></svg>';
      const out = sanitizeSvg(input);
      assertNoExecutableRemnant(out, [/<set\b/i, /alert\(1\)/]);
    }
  );

  it.fails(
    'VULN: <animateTransform> with dangerous values is NOT stripped',
    () => {
      const input = '<svg><animateTransform attributeName="href" values="javascript:alert(1)"/></svg>';
      const out = sanitizeSvg(input);
      expect(out.toLowerCase()).not.toContain('<animatetransform');
    }
  );
});

describe('sanitizeSvg — CDATA / XML tricks', () => {
  it('strips <script> inside CDATA', () => {
    // The regex for <script>...</script> matches across CDATA boundaries.
    const input = '<svg><![CDATA[<script>alert(1)</script>]]></svg>';
    const out = sanitizeSvg(input);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it.fails(
    'VULN: billion-laughs XML entity expansion is NOT detected',
    () => {
      const input = `<?xml version="1.0"?>
<!DOCTYPE svg [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
]>
<svg><text>&lol2;</text></svg>`;
      const out = sanitizeSvg(input);
      expect(out).not.toContain('<!ENTITY');
      expect(out).not.toContain('<!DOCTYPE');
    }
  );

  it.fails(
    'VULN: external entity reference (XXE) is NOT detected',
    () => {
      const input = `<?xml version="1.0"?>
<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<svg><text>&xxe;</text></svg>`;
      const out = sanitizeSvg(input);
      expect(out).not.toContain('SYSTEM');
      expect(out).not.toContain('<!ENTITY');
    }
  );
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
  });

  it.fails(
    'VULN: bare <iframe> outside <foreignObject> is NOT stripped',
    () => {
      const input = '<svg><iframe src="https://evil.example"></iframe></svg>';
      const out = sanitizeSvg(input);
      expect(out).not.toContain('<iframe');
    }
  );

  it.fails(
    'VULN: <embed> element is NOT stripped',
    () => {
      const input = '<svg><embed src="https://evil.example/x.swf"/></svg>';
      const out = sanitizeSvg(input);
      expect(out).not.toContain('<embed');
    }
  );

  it.fails(
    'VULN: <object data="..."> element is NOT stripped',
    () => {
      const input = '<svg><object data="https://evil.example/x.html"></object></svg>';
      const out = sanitizeSvg(input);
      expect(out).not.toContain('<object');
    }
  );
});

describe('sanitizeSvg — style-based injection', () => {
  it.fails(
    'VULN: <style> block with url(javascript:...) is NOT stripped',
    () => {
      const input = '<svg><style>svg { background: url(javascript:alert(1)); }</style></svg>';
      const out = sanitizeSvg(input);
      expect(out).not.toContain('<style');
      expect(out).not.toContain('javascript:');
    }
  );

  it.fails(
    'VULN: <style> with @import of remote CSS is NOT stripped',
    () => {
      const input = '<svg><style>@import url("https://evil.example/x.css");</style></svg>';
      const out = sanitizeSvg(input);
      expect(out).not.toContain('@import');
    }
  );

  it.fails(
    'VULN: inline style="behavior:url(...)" (legacy IE) is NOT stripped',
    () => {
      const input = '<svg><rect style="behavior:url(evil.htc)" width="10"/></svg>';
      const out = sanitizeSvg(input);
      expect(out).not.toContain('behavior:');
    }
  );

  it.fails(
    'VULN: inline style with expression(...) (legacy IE) is NOT stripped',
    () => {
      const input = '<svg><rect style="width:expression(alert(1))"/></svg>';
      const out = sanitizeSvg(input);
      expect(out).not.toContain('expression(');
    }
  );
});

describe('sanitizeSvg — meta/import', () => {
  it.fails(
    'VULN: <meta http-equiv="refresh" content="0;url=javascript:..."> is NOT stripped',
    () => {
      const input = '<svg><meta http-equiv="refresh" content="0;url=javascript:alert(1)"/></svg>';
      const out = sanitizeSvg(input);
      expect(out).not.toContain('<meta');
      expect(out).not.toContain('javascript:');
    }
  );

  it.fails(
    'VULN: <link rel="import"> is NOT stripped',
    () => {
      const input = '<svg><link rel="import" href="https://evil.example/x.html"/></svg>';
      const out = sanitizeSvg(input);
      expect(out).not.toContain('<link');
    }
  );
});

describe('sanitizeSvg — benign content passthrough', () => {
  it('passes through plain circle', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="25" fill="red"/></svg>';
    expect(sanitizeSvg(input)).toBe(input);
  });

  it('passes through plain rect', () => {
    const input = '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="#00f"/></svg>';
    expect(sanitizeSvg(input)).toBe(input);
  });

  it('passes through plain path', () => {
    const input = '<svg><path d="M10 10 L90 90 Z" stroke="black" fill="none"/></svg>';
    expect(sanitizeSvg(input)).toBe(input);
  });

  it('passes through grouped elements <g>', () => {
    const input = '<svg><g transform="translate(10,10)"><rect width="20" height="20"/><circle r="5"/></g></svg>';
    expect(sanitizeSvg(input)).toBe(input);
  });

  it('passes through text with attributes', () => {
    const input = '<svg><text x="10" y="20" font-family="Arial" font-size="14">Hello</text></svg>';
    expect(sanitizeSvg(input)).toBe(input);
  });

  it('passes through defs/gradients', () => {
    const input = '<svg><defs><linearGradient id="g"><stop offset="0%" stop-color="red"/><stop offset="100%" stop-color="blue"/></linearGradient></defs><rect fill="url(#g)" width="100" height="100"/></svg>';
    expect(sanitizeSvg(input)).toBe(input);
  });

  it('passes through viewBox and xmlns attributes', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><rect width="200" height="200" fill="white"/></svg>';
    expect(sanitizeSvg(input)).toBe(input);
  });

  it('passes through class and id attributes (not event handlers)', () => {
    const input = '<svg><rect class="my-rect" id="rect-1" width="10" height="10"/></svg>';
    expect(sanitizeSvg(input)).toBe(input);
  });

  it('does NOT strip attributes that start with "on" but are not handlers — e.g. "one"', () => {
    // Edge case: the regex is \s+on\w+\s*= which WILL match any attribute
    // starting with "on". If we had an attribute named "once" it would be stripped.
    // This test documents current (over-strict) behavior.
    const input = '<svg><rect one="true" width="10"/></svg>';
    const out = sanitizeSvg(input);
    // The sanitizer strips this due to overly-broad regex — documenting behavior.
    expect(out).not.toContain('one="true"');
  });
});

describe('sanitizeSvg — empty / malformed / edge cases', () => {
  it('handles empty string', () => {
    expect(sanitizeSvg('')).toBe('');
  });

  it('handles whitespace-only input', () => {
    expect(sanitizeSvg('   \n  \t  ')).toBe('   \n  \t  ');
  });

  it('handles non-SVG input (plain text)', () => {
    expect(sanitizeSvg('hello world')).toBe('hello world');
  });

  it('handles unclosed SVG tag', () => {
    // Should not throw; output is whatever regex passes through.
    const out = sanitizeSvg('<svg><rect');
    expect(typeof out).toBe('string');
  });

  it('handles SVG with only closing tag', () => {
    const out = sanitizeSvg('</svg>');
    expect(typeof out).toBe('string');
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
  });

  it('does not crash on invalid UTF-8-looking sequences', () => {
    const input = '<svg>\uFFFD\uFFFD<rect/></svg>';
    const out = sanitizeSvg(input);
    expect(out).toContain('<rect');
  });

  it('preserves content when no dangerous constructs are present', () => {
    const input = '<svg><rect width="10" height="10"/></svg>';
    expect(sanitizeSvg(input)).toBe(input);
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
  it('sanitizes 1MB of benign SVG in under 2 seconds', () => {
    // Build a ~1MB string of repeated <rect> elements.
    const rect = '<rect x="1" y="1" width="5" height="5" fill="red"/>';
    const repeats = Math.ceil((1024 * 1024) / rect.length);
    const payload = '<svg>' + rect.repeat(repeats) + '</svg>';
    expect(payload.length).toBeGreaterThan(1024 * 1024);

    const t0 = performance.now();
    const out = sanitizeSvg(payload);
    const elapsed = performance.now() - t0;

    expect(out.length).toBeGreaterThan(1024 * 1024);
    // Guard against catastrophic backtracking. 2000ms is generous.
    expect(elapsed).toBeLessThan(2000);
  });

  it('sanitizes 1MB of malicious SVG (mixed script/handlers) without hang', () => {
    const chunk = '<script>a</script><rect onclick="b" width="1"/>';
    const repeats = Math.ceil((1024 * 1024) / chunk.length);
    const payload = '<svg>' + chunk.repeat(repeats) + '</svg>';

    const t0 = performance.now();
    const out = sanitizeSvg(payload);
    const elapsed = performance.now() - t0;

    expect(out).not.toContain('<script');
    expect(out).not.toContain('onclick');
    expect(elapsed).toBeLessThan(2000);
  });
});
