/**
 * Client-side SVG sanitizer — strips dangerous elements and attributes.
 * Mirrors server/component-export.ts sanitizeSvgContent().
 */
export function sanitizeSvg(svgString: string): string {
  let s = svgString;
  // Strip <script> tags
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Strip <foreignObject> tags
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
  // Strip event handler attributes (on*)
  s = s.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Strip javascript: URIs in href/xlink:href
  s = s.replace(/(href\s*=\s*(?:"|'))javascript:[^"']*("|')/gi, '$1#$2');
  return s;
}
