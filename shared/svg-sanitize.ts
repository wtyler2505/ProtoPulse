/**
 * Shared SVG sanitizer — DOMPurify strict-SVG profile.
 *
 * Used by:
 *   - client/src/lib/svg-sanitize.ts (re-exports sanitizeSvg)
 *   - server/component-export.ts (sanitizeSvgContent FZPZ importer)
 *
 * Previous implementations were regex-based and 20+ known XSS vectors
 * bypassed them. Replaced with isomorphic-dompurify 2026-04-14.
 */
import DOMPurify from 'isomorphic-dompurify';

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
  'behavior',
  'srcdoc',
  'formaction',
  'action',
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
const ALLOWED_URI_REGEXP =
  /^(?:(?:#|https?:)|(?:data:image\/(?:png|jpeg|gif|svg\+xml|webp);base64,))/i;

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
