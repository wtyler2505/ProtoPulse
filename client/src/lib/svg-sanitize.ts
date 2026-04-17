/**
 * Client-side SVG sanitizer — DOMPurify strict-SVG profile.
 *
 * Previous implementation was a 16-line regex that 20 known XSS vectors
 * bypassed (see client/src/lib/__tests__/svg-sanitize.test.ts for the
 * original it.fails suite). Replaced with isomorphic-dompurify 2026-04-14.
 *
 * Mirror: server/component-export.ts sanitizeSvgContent() — must stay in
 * sync with the same profile.
 */
import DOMPurify from 'isomorphic-dompurify';

/**
 * Config: SVG+svgFilters profile with strict tag/attribute allowlist.
 *
 * - `USE_PROFILES.svg: true` — baseline SVG element allowlist
 * - `USE_PROFILES.svgFilters: true` — allow filter primitives (feGaussianBlur, etc.)
 * - `FORBID_TAGS` — explicitly ban every tag with known XSS vectors
 * - `FORBID_ATTR` — ban event handlers and known-bad attributes
 * - `WHOLE_DOCUMENT: false` — strip any DOCTYPE/entity declarations (blocks
 *    billion-laughs + XXE)
 * - `SANITIZE_DOM: true` — default, removes DOM-clobbering tricks
 * - `ALLOWED_URI_REGEXP` — only `#fragment`, `https?:`, `data:image/*` URIs
 */
const FORBID_TAGS = [
  'script',
  'foreignObject',
  'iframe',
  'embed',
  'object',
  'meta',
  'link',
  'style',
  'animate',
  'set',
  'animateTransform',
  'animateMotion',
  'audio',
  'video',
  'source',
  'track',
] as const;

const FORBID_ATTR = [
  // Legacy IE attack surface
  'behavior',
  // srcdoc on frames/iframes (already forbidden by tag, belt+suspenders)
  'srcdoc',
  // Form submission inside SVG
  'formaction',
  'action',
  // Image fallback onerror (handled by profile already, explicit for clarity)
  'onerror',
  'onload',
  'onclick',
  'onmouseover',
  'onfocus',
  'onanimationend',
  'onpointerdown',
] as const;

// Only allow safe URI schemes: fragments (#id), https/http, and inline image
// data URIs. Blocks javascript:, vbscript:, data:text/*, data:application/*.
const ALLOWED_URI_REGEXP = /^(?:(?:#|https?:)|(?:data:image\/(?:png|jpeg|gif|svg\+xml|webp);base64,))/i;

export function sanitizeSvg(svgString: string): string {
  if (!svgString) return '';
  return DOMPurify.sanitize(svgString, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: [...FORBID_TAGS],
    FORBID_ATTR: [...FORBID_ATTR],
    WHOLE_DOCUMENT: false,
    ALLOWED_URI_REGEXP,
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: false,
  });
}
