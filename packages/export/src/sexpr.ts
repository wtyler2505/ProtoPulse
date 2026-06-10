/**
 * S-expression escaping for KiCad emitters: backslashes and double
 * quotes escaped inside quoted values. (Same rules as the legacy
 * server/export/kicad/sexpr.ts, which pcbnew accepts.)
 */
export function escapeKicad(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
