/**
 * Shared CSV utilities.
 * Centralizes escaping and download logic previously duplicated across
 * ProcurementView (handleExportCSV) and ChatPanel (2 export_bom_csv paths).
 */

/** Escape a value for CSV: wraps in quotes if it contains comma, quote, or newline. */
export function escapeCSV(val: string | number): string {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Trigger a browser file download from a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Build a CSV string from headers and rows, with proper escaping. */
export function buildCSV(headers: string[], rows: (string | number)[][]): string {
  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = rows.map(row => row.map(escapeCSV).join(','));
  return [headerLine, ...dataLines].join('\n');
}
