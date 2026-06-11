/**
 * Shared CSV utilities.
 * Centralizes escaping and download logic previously duplicated across
 * ProcurementView (handleExportCSV) and ChatPanel (2 export_bom_csv paths).
 *
 * `downloadBlob` is also the first audited workflow chokepoint for the
 * Phase 1 Task 1.2 bridge wiring contract: when running inside Tauri, the
 * download routes through `DesktopAPI.showSaveDialog` + `writeFile` instead
 * of the browser anchor-click trick. Browser/web mode keeps working
 * unchanged.
 */

import { getDesktopAPI, isTauri } from "./tauri-api";

/** Escape a value for CSV: wraps in quotes if it contains comma, quote, or newline. */
export function escapeCSV(val: string | number): string {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * Save a Blob to a file. When running inside Tauri, routes through the
 * native save dialog + writeFile (no in-memory blob URL). In the browser,
 * uses the standard anchor-click download path.
 *
 * Returns a Promise. Browser callers can fire-and-forget; desktop callers
 * should await to know when the user has saved or canceled.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  // Desktop path: Tauri detected AND DesktopAPI is wired up.
  if (isTauri) {
    const api = getDesktopAPI();
    if (api) {
      const result = await api.showSaveDialog({
        defaultPath: filename,
        filters: filenameToFilters(filename),
      });
      if (result.canceled || !result.filePath) {
        return; // User canceled — nothing to do.
      }
      const data = await blob.text();
      await api.writeFile(result.filePath, data);
      return;
    }
    // Defensive: isTauri is true but DesktopAPI is null (init race).
    // Fall through to the browser path so the workflow still completes.
  }

  // Browser path: anchor-click download.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Build a save-dialog filter list from a filename's extension.
 * Returns undefined for filenames with no extension or unrecognized ones —
 * the dialog will accept any file type in that case.
 */
function filenameToFilters(
  filename: string,
): Array<{ name: string; extensions: string[] }> | undefined {
  const match = filename.match(/\.([a-zA-Z0-9]+)$/);
  if (!match) return undefined;
  const ext = match[1].toLowerCase();
  const knownNames: Record<string, string> = {
    csv: 'CSV',
    json: 'JSON',
    txt: 'Text',
    log: 'Log',
    md: 'Markdown',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML',
  };
  const displayName = knownNames[ext] ?? ext.toUpperCase();
  return [{ name: displayName, extensions: [ext] }];
}

/** Build a CSV string from headers and rows, with proper escaping. */
export function buildCSV(headers: string[], rows: (string | number)[][]): string {
  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = rows.map(row => row.map(escapeCSV).join(','));
  return [headerLine, ...dataLines].join('\n');
}
