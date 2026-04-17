/**
 * Tests for client/src/lib/csv.ts — CSV escape + build utilities.
 *
 * Addresses audit finding #29 (P0 test gap). The module has no parser
 * (export-only), so "round-trip" tests live against a reference parser.
 * The escape + build surface is small but user-data-facing: any regression
 * would corrupt every BOM/procurement export from the app.
 */
import { describe, it, expect } from 'vitest';
import { escapeCSV, buildCSV } from '../csv';

// ---------------------------------------------------------------------------
// Reference CSV parser — RFC 4180 compliant, used ONLY in tests to verify
// that buildCSV output round-trips through a standard CSV reader. Keep this
// in the test file (don't export) so production code can't depend on it.
// ---------------------------------------------------------------------------
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
      // Skip CRLF pair
      if (ch === '\r' && text[i + 1] === '\n') i += 2;
      else i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Final field/row
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// escapeCSV
// ---------------------------------------------------------------------------
describe('escapeCSV', () => {
  it('returns plain strings unchanged', () => {
    expect(escapeCSV('hello')).toBe('hello');
    expect(escapeCSV('abc123')).toBe('abc123');
  });

  it('coerces numbers to strings', () => {
    expect(escapeCSV(42)).toBe('42');
    expect(escapeCSV(3.14)).toBe('3.14');
    expect(escapeCSV(0)).toBe('0');
    expect(escapeCSV(-1)).toBe('-1');
  });

  it('wraps values containing commas in quotes', () => {
    expect(escapeCSV('a,b')).toBe('"a,b"');
    expect(escapeCSV('LM317T, Voltage Reg')).toBe('"LM317T, Voltage Reg"');
  });

  it('wraps values containing newlines in quotes', () => {
    expect(escapeCSV('line1\nline2')).toBe('"line1\nline2"');
  });

  it('wraps values containing double-quotes in quotes, escaping quotes by doubling', () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCSV('"start')).toBe('""""start"');
    expect(escapeCSV('end"')).toBe('"end"""');
  });

  it('handles mixed special characters', () => {
    expect(escapeCSV('a,"b",c\n')).toBe('"a,""b"",c\n"');
  });

  it('does not quote plain whitespace-free strings with only single-quotes or colons', () => {
    expect(escapeCSV("O'Brien")).toBe("O'Brien");
    expect(escapeCSV('Time: 10:30')).toBe('Time: 10:30');
  });

  it('preserves empty string', () => {
    expect(escapeCSV('')).toBe('');
  });

  it('preserves unicode content', () => {
    expect(escapeCSV('café')).toBe('café');
    expect(escapeCSV('電容器')).toBe('電容器');
    expect(escapeCSV('µF')).toBe('µF');
  });

  it('handles string containing only a comma', () => {
    expect(escapeCSV(',')).toBe('","');
  });

  it('handles string containing only a quote', () => {
    expect(escapeCSV('"')).toBe('""""');
  });
});

// ---------------------------------------------------------------------------
// buildCSV — integration with escapeCSV, produces complete CSV documents
// ---------------------------------------------------------------------------
describe('buildCSV', () => {
  it('builds a simple CSV with headers + one data row', () => {
    const csv = buildCSV(['Name', 'Qty'], [['Resistor', 10]]);
    expect(csv).toBe('Name,Qty\nResistor,10');
  });

  it('builds empty body when no data rows are passed', () => {
    const csv = buildCSV(['Col1', 'Col2'], []);
    expect(csv).toBe('Col1,Col2');
  });

  it('escapes commas in data cells', () => {
    const csv = buildCSV(['Part', 'Desc'], [['LM317', '3-pin, adj. reg']]);
    expect(csv).toBe('Part,Desc\nLM317,"3-pin, adj. reg"');
  });

  it('escapes newlines in data cells', () => {
    const csv = buildCSV(['Part', 'Notes'], [['LM317', 'line1\nline2']]);
    expect(csv).toBe('Part,Notes\nLM317,"line1\nline2"');
  });

  it('escapes commas in headers', () => {
    const csv = buildCSV(['Part,Ref', 'Qty'], [['R1', 10]]);
    expect(csv.split('\n')[0]).toBe('"Part,Ref",Qty');
  });

  it('handles multiple data rows', () => {
    const csv = buildCSV(
      ['MPN', 'Qty'],
      [
        ['LM317T', 1],
        ['NE555', 2],
        ['ATmega328P', 1],
      ],
    );
    expect(csv).toBe('MPN,Qty\nLM317T,1\nNE555,2\nATmega328P,1');
  });

  it('handles mixed number and string cells', () => {
    const csv = buildCSV(['A', 'B', 'C'], [['x', 1, 2.5]]);
    expect(csv).toBe('A,B,C\nx,1,2.5');
  });

  it('handles empty string cells', () => {
    const csv = buildCSV(['A', 'B'], [['', 'x'], ['y', '']]);
    expect(csv).toBe('A,B\n,x\ny,');
  });
});

// ---------------------------------------------------------------------------
// Round-trip integrity — buildCSV output survives parse by RFC 4180 reader
// ---------------------------------------------------------------------------
describe('buildCSV round-trip integrity', () => {
  it('plain ASCII rows round-trip losslessly', () => {
    const input = [
      ['Part', 'Description', 'Qty', 'Supplier'],
      ['LM317T', 'Adjustable linear regulator', '10', 'Digi-Key'],
      ['NE555', '555 timer IC', '20', 'Mouser'],
    ];
    const csv = buildCSV(input[0], input.slice(1));
    expect(parseCSV(csv)).toEqual(input);
  });

  it('rows with embedded commas round-trip', () => {
    const input = [
      ['Part', 'Description'],
      ['LM317', '3-pin, adjustable regulator'],
    ];
    const csv = buildCSV(input[0], input.slice(1));
    expect(parseCSV(csv)).toEqual(input);
  });

  it('rows with embedded newlines round-trip', () => {
    const input = [
      ['Part', 'Notes'],
      ['LM317', 'first line\nsecond line'],
    ];
    const csv = buildCSV(input[0], input.slice(1));
    expect(parseCSV(csv)).toEqual(input);
  });

  it('rows with embedded double-quotes round-trip', () => {
    const input = [
      ['Part', 'Note'],
      ['LM317', 'said "hi"'],
    ];
    const csv = buildCSV(input[0], input.slice(1));
    expect(parseCSV(csv)).toEqual(input);
  });

  it('rows with ALL three special chars round-trip', () => {
    const input = [
      ['A', 'B'],
      ['comma, quote "x", newline\ntext', 'plain'],
    ];
    const csv = buildCSV(input[0], input.slice(1));
    expect(parseCSV(csv)).toEqual(input);
  });

  it('unicode content round-trips', () => {
    const input = [
      ['Part', 'Description'],
      ['電容器', 'Ceramic capacitor café µF ±10%'],
    ];
    const csv = buildCSV(input[0], input.slice(1));
    expect(parseCSV(csv)).toEqual(input);
  });

  it('number cells round-trip as strings (expected — parse returns strings)', () => {
    const csv = buildCSV(['A'], [[42]]);
    expect(parseCSV(csv)).toEqual([['A'], ['42']]);
  });

  it('empty cells round-trip', () => {
    const input = [
      ['A', 'B', 'C'],
      ['', 'x', ''],
      ['y', '', 'z'],
    ];
    const csv = buildCSV(input[0], input.slice(1));
    expect(parseCSV(csv)).toEqual(input);
  });

  it('headers-only (no data rows) round-trips to just the header row', () => {
    const csv = buildCSV(['A', 'B', 'C'], []);
    expect(parseCSV(csv)).toEqual([['A', 'B', 'C']]);
  });
});

// ---------------------------------------------------------------------------
// Regression / edge cases
// ---------------------------------------------------------------------------
describe('CSV edge cases (regression guards)', () => {
  it('cell containing only a quote does not break parsing', () => {
    const csv = buildCSV(['A'], [['"']]);
    // `""""` — outer quote delims + two chars (escaped quote)
    expect(csv).toBe('A\n""""');
    expect(parseCSV(csv)).toEqual([['A'], ['"']]);
  });

  it('cell with leading/trailing whitespace is preserved (no implicit trim)', () => {
    const csv = buildCSV(['A'], [['  padded  ']]);
    expect(parseCSV(csv)).toEqual([['A'], ['  padded  ']]);
  });

  it('cell that looks like a number does not lose leading zeros when stringified', () => {
    const csv = buildCSV(['Code'], [['007']]);
    expect(parseCSV(csv)).toEqual([['Code'], ['007']]);
  });

  it('CRLF in data cell round-trips', () => {
    const input = [
      ['A'],
      ['first\r\nsecond'],
    ];
    const csv = buildCSV(input[0], input.slice(1));
    expect(parseCSV(csv)).toEqual(input);
  });

  it('column count is preserved even when a cell is empty', () => {
    const csv = buildCSV(['A', 'B', 'C', 'D'], [['', '', '', '']]);
    const rows = parseCSV(csv);
    expect(rows[0]).toHaveLength(4);
    expect(rows[1]).toHaveLength(4);
    expect(rows[1]).toEqual(['', '', '', '']);
  });
});
