/**
 * Shared SVG sanitizer — DOMPurify strict-SVG profile.
 *
 * Used by:
 *   - server/component-export.ts (sanitizeSvgContent FZPZ importer)
 *
 * Kept in sync with client/src/lib/svg-sanitize.ts. Both files use the
 * same DOMPurify config; the client module is a separate copy (not a
 * re-export) to avoid the shared→client import direction being reversed.
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

const MAX_INPUT_BYTES = 512 * 1024;

export class SvgTooLargeError extends Error {
  constructor(
    public size: number,
    public limit: number = MAX_INPUT_BYTES,
  ) {
    super(`SVG input of ${size} bytes exceeds sanitizer limit of ${limit} bytes`);
    this.name = 'SvgTooLargeError';
  }
}

export function sanitizeSvg(svgString: string): string {
  if (!svgString) return '';
  if (svgString.length > MAX_INPUT_BYTES) {
    throw new SvgTooLargeError(svgString.length);
  }
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
