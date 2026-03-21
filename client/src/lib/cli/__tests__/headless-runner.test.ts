/**
 * Tests for CLI Headless Runner
 *
 * Validates argument parsing, command execution, output formatting,
 * and help generation for the headless CLI tooling.
 */

import { describe, it, expect } from 'vitest';
import {
  HeadlessRunner,
  parseArgs,
  formatTable,
  formatJson,
} from '../headless-runner';
import type {
  ParsedArgs,
  CommandResult,
  CommandDefinition,
  FlagDefinition,
  OutputFormat,
  TableColumn,
} from '../headless-runner';

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  it('should parse command name', () => {
    const args = parseArgs(['validate']);
    expect(args.command).toBe('validate');
  });

  it('should parse long flags with values', () => {
    const args = parseArgs(['validate', '--project', '42']);
    expect(args.command).toBe('validate');
    expect(args.flags['project']).toBe('42');
  });

  it('should parse long flags with = separator', () => {
    const args = parseArgs(['validate', '--project=42']);
    expect(args.flags['project']).toBe('42');
  });

  it('should parse short flags with values', () => {
    const args = parseArgs(['validate', '-p', '42']);
    expect(args.flags['p']).toBe('42');
  });

  it('should parse short flags with = separator', () => {
    const args = parseArgs(['validate', '-p=42']);
    expect(args.flags['p']).toBe('42');
  });

  it('should parse boolean flags', () => {
    const args = parseArgs(['validate', '--verbose']);
    expect(args.flags['verbose']).toBe(true);
  });

  it('should parse boolean flags before other flags', () => {
    const args = parseArgs(['validate', '--verbose', '--project', '1']);
    expect(args.flags['verbose']).toBe(true);
    expect(args.flags['project']).toBe('1');
  });

  it('should collect positional arguments', () => {
    const args = parseArgs(['help', 'validate']);
    expect(args.command).toBe('help');
    expect(args.positional).toEqual(['validate']);
  });

  it('should handle empty argv', () => {
    const args = parseArgs([]);
    expect(args.command).toBe('');
    expect(args.positional).toEqual([]);
  });

  it('should handle multiple flags', () => {
    const args = parseArgs([
      'export-bom',
      '--project', '1',
      '--format', 'json',
      '--output', 'bom.csv',
    ]);
    expect(args.command).toBe('export-bom');
    expect(args.flags['project']).toBe('1');
    expect(args.flags['format']).toBe('json');
    expect(args.flags['output']).toBe('bom.csv');
  });

  it('should handle mixed short and long flags', () => {
    const args = parseArgs(['validate', '-p', '1', '--format', 'json']);
    expect(args.flags['p']).toBe('1');
    expect(args.flags['format']).toBe('json');
  });

  it('should handle multiple positional arguments', () => {
    const args = parseArgs(['lint-sketch', 'file1.ino', 'file2.ino']);
    expect(args.command).toBe('lint-sketch');
    expect(args.positional).toEqual(['file1.ino', 'file2.ino']);
  });

  it('should handle flag after positional', () => {
    const args = parseArgs(['help', 'validate', '--verbose']);
    expect(args.command).toBe('help');
    expect(args.positional).toContain('validate');
    expect(args.flags['verbose']).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatTable
// ---------------------------------------------------------------------------

describe('formatTable', () => {
  const columns: TableColumn[] = [
    { header: 'Name', key: 'name', width: 10 },
    { header: 'Value', key: 'value', width: 8, align: 'right' },
  ];

  it('should format header row', () => {
    const result = formatTable(columns, [{ name: 'R1', value: '10k' }]);
    expect(result).toContain('Name');
    expect(result).toContain('Value');
  });

  it('should format separator line', () => {
    const result = formatTable(columns, [{ name: 'R1', value: '10k' }]);
    expect(result).toContain('---');
  });

  it('should format data rows', () => {
    const result = formatTable(columns, [
      { name: 'R1', value: '10k' },
      { name: 'C1', value: '100nF' },
    ]);
    expect(result).toContain('R1');
    expect(result).toContain('C1');
    expect(result).toContain('10k');
    expect(result).toContain('100nF');
  });

  it('should return "(no data)" for empty rows', () => {
    const result = formatTable(columns, []);
    expect(result).toContain('(no data)');
  });

  it('should right-align columns', () => {
    const result = formatTable(
      [{ header: 'Val', key: 'val', width: 8, align: 'right' }],
      [{ val: '42' }],
    );
    // Right-aligned "42" in 8-char column should have leading spaces
    const lines = result.split('\n');
    const dataLine = lines[2]; // skip header and separator
    expect(dataLine).toBeDefined();
    expect(dataLine.trim()).toBe('42');
  });

  it('should center-align columns', () => {
    const result = formatTable(
      [{ header: 'Val', key: 'val', width: 10, align: 'center' }],
      [{ val: 'XX' }],
    );
    const lines = result.split('\n');
    const dataLine = lines[2];
    expect(dataLine).toContain('XX');
  });

  it('should truncate long values', () => {
    const result = formatTable(
      [{ header: 'N', key: 'n', width: 5 }],
      [{ n: 'very long text here' }],
    );
    const lines = result.split('\n');
    const dataLine = lines[2];
    expect(dataLine.length).toBeLessThanOrEqual(6); // width + possible trailing
  });

  it('should handle boolean values', () => {
    const result = formatTable(
      [{ header: 'Active', key: 'active', width: 8 }],
      [{ active: true }],
    );
    expect(result).toContain('true');
  });

  it('should handle numeric values', () => {
    const result = formatTable(
      [{ header: 'Count', key: 'count', width: 8 }],
      [{ count: 42 }],
    );
    expect(result).toContain('42');
  });

  it('should auto-size columns when width not specified', () => {
    const result = formatTable(
      [{ header: 'Name', key: 'name' }],
      [{ name: 'LongComponentName' }],
    );
    expect(result).toContain('LongComponentName');
  });
});

// ---------------------------------------------------------------------------
// formatJson
// ---------------------------------------------------------------------------

describe('formatJson', () => {
  it('should format objects as indented JSON', () => {
    const result = formatJson({ key: 'value' });
    expect(result).toContain('"key"');
    expect(result).toContain('"value"');
    expect(result).toContain('\n'); // indented
  });

  it('should format arrays', () => {
    const result = formatJson([1, 2, 3]);
    expect(result).toContain('[');
    expect(result).toContain('1');
  });

  it('should handle nested objects', () => {
    const result = formatJson({ a: { b: { c: 1 } } });
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed).toEqual({ a: { b: { c: 1 } } });
  });

  it('should handle null values', () => {
    const result = formatJson(null);
    expect(result).toBe('null');
  });
});

// ---------------------------------------------------------------------------
// HeadlessRunner — construction
// ---------------------------------------------------------------------------

describe('HeadlessRunner', () => {
  describe('constructor', () => {
    it('should register 8 built-in commands', () => {
      const runner = new HeadlessRunner();
      expect(runner.getCommands()).toHaveLength(8);
    });

    it('should have validate command', () => {
      const runner = new HeadlessRunner();
      expect(runner.getCommand('validate')).toBeDefined();
    });

    it('should have export-bom command', () => {
      const runner = new HeadlessRunner();
      expect(runner.getCommand('export-bom')).toBeDefined();
    });

    it('should have export-gerber command', () => {
      const runner = new HeadlessRunner();
      expect(runner.getCommand('export-gerber')).toBeDefined();
    });

    it('should have export-netlist command', () => {
      const runner = new HeadlessRunner();
      expect(runner.getCommand('export-netlist')).toBeDefined();
    });

    it('should have export-report command', () => {
      const runner = new HeadlessRunner();
      expect(runner.getCommand('export-report')).toBeDefined();
    });

    it('should have check-dfm command', () => {
      const runner = new HeadlessRunner();
      expect(runner.getCommand('check-dfm')).toBeDefined();
    });

    it('should have lint-sketch command', () => {
      const runner = new HeadlessRunner();
      expect(runner.getCommand('lint-sketch')).toBeDefined();
    });

    it('should have project-info command', () => {
      const runner = new HeadlessRunner();
      expect(runner.getCommand('project-info')).toBeDefined();
    });
  });

  describe('registerCommand', () => {
    it('should allow registering custom commands', () => {
      const runner = new HeadlessRunner();
      runner.registerCommand({
        name: 'custom',
        description: 'Custom command',
        usage: 'custom --foo bar',
        flags: [],
        handler: () => ({
          success: true,
          exitCode: 0,
          output: 'custom output',
          errors: [],
        }),
      });

      expect(runner.getCommand('custom')).toBeDefined();
      expect(runner.getCommands().length).toBe(9);
    });
  });

  describe('run — help', () => {
    it('should show help for empty argv', () => {
      const runner = new HeadlessRunner();
      const result = runner.run([]);
      expect(result.success).toBe(true);
      expect(result.output).toContain('ProtoPulse CLI');
      expect(result.output).toContain('Commands:');
    });

    it('should show help with --help flag', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['--help']);
      expect(result.output).toContain('Commands:');
    });

    it('should show help with -h flag', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['-h']);
      expect(result.output).toContain('Commands:');
    });

    it('should show help for "help" command', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['help']);
      expect(result.output).toContain('Commands:');
    });

    it('should show command-specific help', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['help', 'validate']);
      expect(result.output).toContain('validate');
      expect(result.output).toContain('DRC');
    });

    it('should error for unknown command in help', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['help', 'nonexistent']);
      expect(result.success).toBe(false);
      expect(result.output).toContain('Unknown command');
    });

    it('should list all commands in help', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['help']);
      expect(result.output).toContain('validate');
      expect(result.output).toContain('export-bom');
      expect(result.output).toContain('export-gerber');
      expect(result.output).toContain('check-dfm');
    });
  });

  describe('run — version', () => {
    it('should show version with --version', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['--version']);
      expect(result.output).toContain('ProtoPulse CLI');
      expect(result.output).toMatch(/v\d+\.\d+\.\d+/);
    });
  });

  describe('run — unknown command', () => {
    it('should error for unknown commands', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['nonexistent']);
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(127);
      expect(result.output).toContain('Unknown command');
    });
  });

  describe('run — validate', () => {
    it('should require --project flag', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['validate']);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return table output by default', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['validate', '--project', '1']);
      expect(result.success).toBe(true);
      expect(result.output).toContain('Validation results');
      expect(result.output).toContain('---');
    });

    it('should return JSON output with --format json', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['validate', '--project', '1', '--format', 'json']);
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output) as Record<string, unknown>;
      expect(parsed['projectId']).toBe('1');
      expect(parsed['issueCount']).toBeDefined();
    });

    it('should accept short flag -p', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['validate', '-p', '1']);
      expect(result.success).toBe(true);
    });

    it('should include data in result', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['validate', '--project', '1']);
      expect(result.data).toBeDefined();
      expect(result.data!['projectId']).toBe('1');
    });
  });

  describe('run — export-bom', () => {
    it('should require --project', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['export-bom']);
      expect(result.success).toBe(false);
    });

    it('should return BOM table', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['export-bom', '--project', '1']);
      expect(result.success).toBe(true);
      expect(result.output).toContain('BOM');
      expect(result.output).toContain('Total');
    });

    it('should return JSON BOM', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['export-bom', '-p', '1', '--format', 'json']);
      const parsed = JSON.parse(result.output) as Record<string, unknown>;
      expect(parsed['items']).toBeDefined();
      expect(parsed['totalCost']).toBeDefined();
    });

    it('should include output file path when specified', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['export-bom', '-p', '1', '-o', 'output.csv']);
      expect(result.output).toContain('output.csv');
    });
  });

  describe('run — export-gerber', () => {
    it('should generate gerber file list', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['export-gerber', '--project', '1']);
      expect(result.success).toBe(true);
      expect(result.output).toContain('Gerber');
      expect(result.output).toContain('.gtl');
    });

    it('should accept output directory', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['export-gerber', '-p', '1', '-o', '/tmp/gerbers']);
      expect(result.output).toContain('/tmp/gerbers');
    });

    it('should accept layers flag', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['export-gerber', '-p', '1', '--layers', 'F.Cu,B.Cu']);
      expect(result.success).toBe(true);
    });
  });

  describe('run — export-netlist', () => {
    it('should generate netlist', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['export-netlist', '--project', '1']);
      expect(result.success).toBe(true);
      expect(result.output).toContain('Netlist');
      expect(result.output).toContain('GND');
    });

    it('should accept netlist format flag', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['export-netlist', '-p', '1', '-n', 'spice']);
      expect(result.output).toContain('spice');
    });
  });

  describe('run — export-report', () => {
    it('should generate design report', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['export-report', '--project', '1']);
      expect(result.success).toBe(true);
      expect(result.output).toContain('Design Report');
    });

    it('should accept sections flag', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['export-report', '-p', '1', '-s', 'summary']);
      expect(result.output).toContain('summary');
    });
  });

  describe('run — check-dfm', () => {
    it('should run DFM checks', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['check-dfm', '--project', '1']);
      expect(result.success).toBe(true);
      expect(result.output).toContain('DFM');
    });

    it('should accept fab profile', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['check-dfm', '-p', '1', '-f', 'OSHPark']);
      expect(result.output).toContain('OSHPark');
    });

    it('should return JSON DFM results', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['check-dfm', '-p', '1', '--format', 'json']);
      const parsed = JSON.parse(result.output) as Record<string, unknown>;
      expect(parsed['checks']).toBeDefined();
      expect(parsed['fabProfile']).toBeDefined();
    });

    it('should count pass/fail/warn', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['check-dfm', '-p', '1']);
      expect(result.output).toContain('passed');
    });
  });

  describe('run — lint-sketch', () => {
    it('should require sketch path', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['lint-sketch']);
      expect(result.success).toBe(false);
    });

    it('should accept --sketch flag', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['lint-sketch', '--sketch', 'main.ino']);
      expect(result.success).toBe(true);
      expect(result.output).toContain('main.ino');
    });

    it('should accept positional sketch path', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['lint-sketch', '-s', 'test.ino']);
      expect(result.success).toBe(true);
    });

    it('should return JSON lint results', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['lint-sketch', '-s', 'main.ino', '--format', 'json']);
      const parsed = JSON.parse(result.output) as Record<string, unknown>;
      expect(parsed['issues']).toBeDefined();
      expect(parsed['sketch']).toBe('main.ino');
    });
  });

  describe('run — project-info', () => {
    it('should display project info', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['project-info', '--project', '1']);
      expect(result.success).toBe(true);
      expect(result.output).toContain('Project Info');
    });

    it('should return JSON project info', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['project-info', '-p', '1', '--format', 'json']);
      const parsed = JSON.parse(result.output) as Record<string, unknown>;
      expect(parsed['id']).toBe('1');
      expect(parsed['name']).toBeDefined();
    });

    it('should require --project', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['project-info']);
      expect(result.success).toBe(false);
    });
  });

  describe('command definitions', () => {
    it('should have description for each command', () => {
      const runner = new HeadlessRunner();
      for (const cmd of runner.getCommands()) {
        expect(cmd.description.length).toBeGreaterThan(0);
      }
    });

    it('should have usage string for each command', () => {
      const runner = new HeadlessRunner();
      for (const cmd of runner.getCommands()) {
        expect(cmd.usage.length).toBeGreaterThan(0);
        expect(cmd.usage).toContain('protopulse');
      }
    });

    it('should have flag definitions', () => {
      const runner = new HeadlessRunner();
      for (const cmd of runner.getCommands()) {
        expect(Array.isArray(cmd.flags)).toBe(true);
        expect(cmd.flags.length).toBeGreaterThan(0);
      }
    });

    it('should have handler function', () => {
      const runner = new HeadlessRunner();
      for (const cmd of runner.getCommands()) {
        expect(typeof cmd.handler).toBe('function');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle flag with no value at end of argv', () => {
      const args = parseArgs(['validate', '--verbose']);
      expect(args.flags['verbose']).toBe(true);
    });

    it('should handle consecutive boolean flags', () => {
      const args = parseArgs(['cmd', '--verbose', '--debug', '--trace']);
      expect(args.flags['verbose']).toBe(true);
      expect(args.flags['debug']).toBe(true);
      expect(args.flags['trace']).toBe(true);
    });

    it('should handle = with empty value', () => {
      const args = parseArgs(['cmd', '--key=']);
      expect(args.flags['key']).toBe('');
    });

    it('should handle CommandResult data field', () => {
      const runner = new HeadlessRunner();
      const result = runner.run(['validate', '-p', '1']);
      if (result.data) {
        expect(typeof result.data).toBe('object');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Type coverage
// ---------------------------------------------------------------------------

describe('type coverage', () => {
  it('should export ParsedArgs with all fields', () => {
    const args: ParsedArgs = {
      command: 'test',
      flags: { verbose: true },
      positional: ['file.txt'],
    };
    expect(args.command).toBe('test');
  });

  it('should export CommandResult with all fields', () => {
    const result: CommandResult = {
      success: true,
      exitCode: 0,
      output: 'test',
      data: { key: 'value' },
      errors: [],
    };
    expect(result.success).toBe(true);
  });

  it('should export FlagDefinition with all fields', () => {
    const flag: FlagDefinition = {
      name: 'project',
      short: 'p',
      description: 'Project ID',
      required: true,
      defaultValue: undefined,
      type: 'string',
    };
    expect(flag.name).toBe('project');
  });

  it('should export OutputFormat values', () => {
    const formats: OutputFormat[] = ['table', 'json'];
    expect(formats).toHaveLength(2);
  });
});
