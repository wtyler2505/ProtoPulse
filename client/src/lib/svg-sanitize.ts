/**
 * Client-side SVG sanitizer — DOMPurify strict-SVG profile.
 *
 * Previous implementation was a 16-line regex that 20 known XSS vectors
 * bypassed (see client/src/lib/__tests__/svg-sanitize.test.ts for the
 * original it.fails suite). Replaced with isomorphic-dompurify 2026-04-14.
 *
 * Mirror: server/component-export.ts sanitizeSvgContent() — must stay in
 * sync with the same profile (imports sanitizeSvg from @shared/svg-sanitize).
 */
export { sanitizeSvg, SvgTooLargeError, MAX_INPUT_BYTES } from '@shared/svg-sanitize';
