const SAFE_PROTOCOLS = ['https:', 'http:', 'mailto:'];

export function isSafeUrl(url: string): boolean {
  if (!url || !url.trim()) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return SAFE_PROTOCOLS.includes(parsed.protocol);
  } catch {
    // Relative URLs are safe (no protocol to exploit).
    // Explicitly block known dangerous schemes that URL() might not parse.
    const lower = url.trim().toLowerCase();
    return !lower.startsWith('javascript:') && !lower.startsWith('data:') && !lower.startsWith('vbscript:');
  }
}

export function sanitizeUrl(url: string): string {
  return isSafeUrl(url) ? url : '';
}
