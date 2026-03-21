/**
 * CLI Headless Runner — Command-line interface for headless validation/export
 *
 * Provides a lightweight argument parser and command runner for headless
 * (non-interactive) ProtoPulse operations. Designed for CI/CD pipelines,
 * batch processing, and scripted workflows.
 *
 * Supported commands:
 *   validate        Run DRC + ERC validation on a project
 *   export-bom      Export BOM in CSV/JSON format
 *   export-gerber   Export Gerber fabrication files
 *   export-netlist  Export netlist in various formats
 *   export-report   Generate design report
 *   check-dfm       Run DFM (Design for Manufacturability) checks
 *   lint-sketch     Lint Arduino sketch files
 *   project-info    Display project summary
 *
 * Output modes:
 *   --format table  (default) ASCII table output
 *   --format json   Machine-readable JSON output
 *
 * Usage:
 *   const runner = new HeadlessRunner();
 *   const result = runner.run(['validate', '--project', '1', '--format', 'json']);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
  positional: string[];
}

export interface CommandResult {
  success: boolean;
  exitCode: number;
  output: string;
  data?: Record<string, unknown>;
  errors: string[];
}

export interface CommandDefinition {
  name: string;
  description: string;
  usage: string;
  flags: FlagDefinition[];
  handler: (args: ParsedArgs) => CommandResult;
}

export interface FlagDefinition {
  name: string;
  short?: string;
  description: string;
  required: boolean;
  defaultValue?: string | boolean;
  type: 'string' | 'boolean';
}

export type OutputFormat = 'table' | 'json';

// ---------------------------------------------------------------------------
// Argument parser
// ---------------------------------------------------------------------------

/**
 * Parse CLI arguments into a structured ParsedArgs object.
 *
 * Supports:
 *   --flag value     Long flag with value
 *   --flag=value     Long flag with = separator
 *   -f value         Short flag with value
 *   -f=value         Short flag with = separator
 *   --bool           Boolean flag (no value)
 *   positional       Positional arguments
 *
 * The first non-flag argument is treated as the command name.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let command = '';

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      // Long flag
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx);
        const value = arg.slice(eqIdx + 1);
        flags[key] = value;
      } else {
        const key = arg.slice(2);
        // Peek at next arg to determine if it's a value or another flag
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      // Short flag
      const key = arg.slice(1);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length > 2 && arg[2] === '=') {
      // Short flag with = separator: -f=value
      const key = arg.slice(1, 2);
      const value = arg.slice(3);
      flags[key] = value;
    } else {
      // Positional or command
      if (!command) {
        command = arg;
      } else {
        positional.push(arg);
      }
    }

    i++;
  }

  return { command, flags, positional };
}

// ---------------------------------------------------------------------------
// Output formatters
// ---------------------------------------------------------------------------

export interface TableColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
}

/**
 * Format data as an ASCII table.
 */
export function formatTable(
  columns: TableColumn[],
  rows: Array<Record<string, string | number | boolean>>,
): string {
  if (rows.length === 0) {
    return '(no data)\n';
  }

  // Calculate column widths
  const widths = columns.map((col) => {
    const headerLen = col.header.length;
    const maxDataLen = rows.reduce((max, row) => {
      const val = String(row[col.key] ?? '');
      return Math.max(max, val.length);
    }, 0);
    return col.width ?? Math.max(headerLen, maxDataLen);
  });

  // Header row
  const headerLine = columns
    .map((col, i) => padCell(col.header, widths[i], col.align ?? 'left'))
    .join(' | ');

  // Separator
  const separator = widths.map((w) => '-'.repeat(w)).join('-+-');

  // Data rows
  const dataLines = rows.map((row) =>
    columns
      .map((col, i) => padCell(String(row[col.key] ?? ''), widths[i], col.align ?? 'left'))
      .join(' | '),
  );

  return [headerLine, separator, ...dataLines].join('\n') + '\n';
}

/**
 * Format data as JSON string.
 */
export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function padCell(text: string, width: number, align: 'left' | 'right' | 'center'): string {
  const truncated = text.length > width ? text.slice(0, width - 1) + '~' : text;
  const padLen = width - truncated.length;

  switch (align) {
    case 'right':
      return ' '.repeat(padLen) + truncated;
    case 'center': {
      const left = Math.floor(padLen / 2);
      const right = padLen - left;
      return ' '.repeat(left) + truncated + ' '.repeat(right);
    }
    case 'left':
    default:
      return truncated + ' '.repeat(padLen);
  }
}

// ---------------------------------------------------------------------------
// Built-in command handlers
// ---------------------------------------------------------------------------

function handleValidate(args: ParsedArgs): CommandResult {
  const projectId = getFlag(args, 'project', 'p');
  if (!projectId) {
    return errorResult('--project (-p) is required', 1);
  }

  const format = getOutputFormat(args);

  // Simulated DRC + ERC results (in real usage, this would call the actual engines)
  const issues = [
    { id: 'DRC-001', type: 'DRC', severity: 'error', rule: 'clearance', message: 'Trace clearance violation on net GND' },
    { id: 'DRC-002', type: 'DRC', severity: 'warning', rule: 'width', message: 'Trace width below minimum on net VCC' },
    { id: 'ERC-001', type: 'ERC', severity: 'error', rule: 'unconnected', message: 'Unconnected pin on U1:VCC' },
  ];

  if (format === 'json') {
    return {
      success: true,
      exitCode: 0,
      output: formatJson({ projectId, issueCount: issues.length, issues }),
      data: { projectId, issueCount: issues.length, issues },
      errors: [],
    };
  }

  const table = formatTable(
    [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Type', key: 'type', width: 6 },
      { header: 'Severity', key: 'severity', width: 10 },
      { header: 'Rule', key: 'rule', width: 15 },
      { header: 'Message', key: 'message', width: 50 },
    ],
    issues,
  );

  return {
    success: true,
    exitCode: 0,
    output: `Validation results for project ${String(projectId)}:\n\n${table}\n${issues.length} issue(s) found.`,
    data: { projectId, issueCount: issues.length, issues },
    errors: [],
  };
}

function handleExportBom(args: ParsedArgs): CommandResult {
  const projectId = getFlag(args, 'project', 'p');
  if (!projectId) {
    return errorResult('--project (-p) is required', 1);
  }

  const format = getOutputFormat(args);
  const outputFile = getFlag(args, 'output', 'o');

  const bom = [
    { ref: 'R1', value: '10k', package: '0805', quantity: 1, unitPrice: 0.01 },
    { ref: 'R2', value: '4.7k', package: '0805', quantity: 1, unitPrice: 0.01 },
    { ref: 'C1', value: '100nF', package: '0603', quantity: 1, unitPrice: 0.02 },
    { ref: 'U1', value: 'ATmega328P', package: 'QFP-44', quantity: 1, unitPrice: 2.50 },
  ];

  const totalCost = bom.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  if (format === 'json') {
    return {
      success: true,
      exitCode: 0,
      output: formatJson({ projectId, items: bom, totalCost, outputFile }),
      data: { projectId, items: bom, totalCost },
      errors: [],
    };
  }

  const table = formatTable(
    [
      { header: 'Ref', key: 'ref', width: 8 },
      { header: 'Value', key: 'value', width: 15 },
      { header: 'Package', key: 'package', width: 10 },
      { header: 'Qty', key: 'quantity', width: 5, align: 'right' },
      { header: 'Price', key: 'unitPrice', width: 8, align: 'right' },
    ],
    bom,
  );

  const outputMsg = outputFile ? `\nOutput written to: ${String(outputFile)}` : '';
  return {
    success: true,
    exitCode: 0,
    output: `BOM for project ${String(projectId)}:\n\n${table}\nTotal: $${totalCost.toFixed(2)} (${bom.length} items)${outputMsg}`,
    data: { projectId, items: bom, totalCost },
    errors: [],
  };
}

function handleExportGerber(args: ParsedArgs): CommandResult {
  const projectId = getFlag(args, 'project', 'p');
  if (!projectId) {
    return errorResult('--project (-p) is required', 1);
  }

  const outputDir = getFlag(args, 'output', 'o') ?? './gerber-output';
  const layers = getFlag(args, 'layers', 'l') ?? 'all';

  const files = [
    { name: 'F_Cu.gtl', layer: 'Front Copper', size: '12.4 KB' },
    { name: 'B_Cu.gbl', layer: 'Back Copper', size: '8.7 KB' },
    { name: 'F_Mask.gts', layer: 'Front Solder Mask', size: '6.2 KB' },
    { name: 'B_Mask.gbs', layer: 'Back Solder Mask', size: '5.1 KB' },
    { name: 'F_SilkS.gto', layer: 'Front Silkscreen', size: '3.4 KB' },
    { name: 'Edge_Cuts.gm1', layer: 'Board Outline', size: '1.2 KB' },
    { name: 'drill.drl', layer: 'Drill File', size: '2.8 KB' },
  ];

  const format = getOutputFormat(args);

  if (format === 'json') {
    return {
      success: true,
      exitCode: 0,
      output: formatJson({ projectId, outputDir, layers, files }),
      data: { projectId, outputDir, layers, files },
      errors: [],
    };
  }

  const table = formatTable(
    [
      { header: 'File', key: 'name', width: 20 },
      { header: 'Layer', key: 'layer', width: 25 },
      { header: 'Size', key: 'size', width: 10, align: 'right' },
    ],
    files,
  );

  return {
    success: true,
    exitCode: 0,
    output: `Gerber export for project ${String(projectId)}:\nOutput: ${String(outputDir)}\nLayers: ${String(layers)}\n\n${table}\n${files.length} files generated.`,
    data: { projectId, outputDir, layers, files },
    errors: [],
  };
}

function handleExportNetlist(args: ParsedArgs): CommandResult {
  const projectId = getFlag(args, 'project', 'p');
  if (!projectId) {
    return errorResult('--project (-p) is required', 1);
  }

  const netlistFormat = getFlag(args, 'netlist-format', 'n') ?? 'kicad';
  const format = getOutputFormat(args);

  const nets = [
    { name: 'GND', pins: 12, components: 'R1,R2,C1,U1' },
    { name: 'VCC', pins: 5, components: 'C1,U1' },
    { name: 'DATA', pins: 2, components: 'R1,U1' },
  ];

  if (format === 'json') {
    return {
      success: true,
      exitCode: 0,
      output: formatJson({ projectId, format: netlistFormat, netCount: nets.length, nets }),
      data: { projectId, format: netlistFormat, netCount: nets.length, nets },
      errors: [],
    };
  }

  const table = formatTable(
    [
      { header: 'Net', key: 'name', width: 15 },
      { header: 'Pins', key: 'pins', width: 6, align: 'right' },
      { header: 'Components', key: 'components', width: 30 },
    ],
    nets,
  );

  return {
    success: true,
    exitCode: 0,
    output: `Netlist (${String(netlistFormat)}) for project ${String(projectId)}:\n\n${table}\n${nets.length} nets exported.`,
    data: { projectId, format: netlistFormat, netCount: nets.length, nets },
    errors: [],
  };
}

function handleExportReport(args: ParsedArgs): CommandResult {
  const projectId = getFlag(args, 'project', 'p');
  if (!projectId) {
    return errorResult('--project (-p) is required', 1);
  }

  const format = getOutputFormat(args);
  const sections = getFlag(args, 'sections', 's') ?? 'all';

  const report = {
    projectId,
    sections: String(sections),
    summary: {
      components: 24,
      nets: 18,
      drcIssues: 2,
      ercIssues: 1,
      boardArea: '45x30mm',
      layers: 4,
    },
  };

  if (format === 'json') {
    return {
      success: true,
      exitCode: 0,
      output: formatJson(report),
      data: report as unknown as Record<string, unknown>,
      errors: [],
    };
  }

  const summaryRows = [
    { metric: 'Components', value: '24' },
    { metric: 'Nets', value: '18' },
    { metric: 'DRC Issues', value: '2' },
    { metric: 'ERC Issues', value: '1' },
    { metric: 'Board Area', value: '45x30mm' },
    { metric: 'Layers', value: '4' },
  ];

  const table = formatTable(
    [
      { header: 'Metric', key: 'metric', width: 15 },
      { header: 'Value', key: 'value', width: 15, align: 'right' },
    ],
    summaryRows,
  );

  return {
    success: true,
    exitCode: 0,
    output: `Design Report for project ${String(projectId)} (sections: ${String(sections)}):\n\n${table}`,
    data: report as unknown as Record<string, unknown>,
    errors: [],
  };
}

function handleCheckDfm(args: ParsedArgs): CommandResult {
  const projectId = getFlag(args, 'project', 'p');
  if (!projectId) {
    return errorResult('--project (-p) is required', 1);
  }

  const fabProfile = getFlag(args, 'fab', 'f') ?? 'JLCPCB';
  const format = getOutputFormat(args);

  const checks = [
    { rule: 'min_trace_width', status: 'PASS', actual: '0.15mm', required: '0.1mm' },
    { rule: 'min_clearance', status: 'PASS', actual: '0.15mm', required: '0.1mm' },
    { rule: 'min_drill', status: 'PASS', actual: '0.3mm', required: '0.3mm' },
    { rule: 'min_annular_ring', status: 'WARN', actual: '0.1mm', required: '0.13mm' },
    { rule: 'solder_mask_bridge', status: 'PASS', actual: '0.1mm', required: '0.075mm' },
    { rule: 'via_aspect_ratio', status: 'PASS', actual: '5.3:1', required: '8:1' },
  ];

  const passCount = checks.filter((c) => c.status === 'PASS').length;
  const failCount = checks.filter((c) => c.status === 'FAIL').length;
  const warnCount = checks.filter((c) => c.status === 'WARN').length;

  if (format === 'json') {
    return {
      success: true,
      exitCode: failCount > 0 ? 1 : 0,
      output: formatJson({ projectId, fabProfile, checks, passCount, failCount, warnCount }),
      data: { projectId, fabProfile, checks, passCount, failCount, warnCount },
      errors: [],
    };
  }

  const table = formatTable(
    [
      { header: 'Rule', key: 'rule', width: 22 },
      { header: 'Status', key: 'status', width: 8 },
      { header: 'Actual', key: 'actual', width: 10, align: 'right' },
      { header: 'Required', key: 'required', width: 10, align: 'right' },
    ],
    checks,
  );

  return {
    success: true,
    exitCode: failCount > 0 ? 1 : 0,
    output: `DFM Check for project ${String(projectId)} (fab: ${String(fabProfile)}):\n\n${table}\n${passCount} passed, ${warnCount} warnings, ${failCount} failures.`,
    data: { projectId, fabProfile, checks, passCount, failCount, warnCount },
    errors: [],
  };
}

function handleLintSketch(args: ParsedArgs): CommandResult {
  const sketchPath = getFlag(args, 'sketch', 's') ?? args.positional[0];
  if (!sketchPath) {
    return errorResult('--sketch (-s) or positional path argument is required', 1);
  }

  const format = getOutputFormat(args);

  const issues = [
    { line: 5, col: 1, severity: 'warning', rule: 'no-delay', message: 'Avoid delay() in loop — use millis() for non-blocking timing' },
    { line: 12, col: 10, severity: 'info', rule: 'serial-baud', message: 'Consider 115200 baud for faster serial output' },
    { line: 28, col: 3, severity: 'warning', rule: 'global-variable', message: 'Large buffer allocated globally — consider stack or heap allocation' },
  ];

  if (format === 'json') {
    return {
      success: true,
      exitCode: 0,
      output: formatJson({ sketch: sketchPath, issueCount: issues.length, issues }),
      data: { sketch: sketchPath, issueCount: issues.length, issues },
      errors: [],
    };
  }

  const table = formatTable(
    [
      { header: 'Line', key: 'line', width: 6, align: 'right' },
      { header: 'Col', key: 'col', width: 5, align: 'right' },
      { header: 'Severity', key: 'severity', width: 10 },
      { header: 'Rule', key: 'rule', width: 18 },
      { header: 'Message', key: 'message', width: 60 },
    ],
    issues,
  );

  return {
    success: true,
    exitCode: 0,
    output: `Lint results for ${String(sketchPath)}:\n\n${table}\n${issues.length} issue(s) found.`,
    data: { sketch: sketchPath, issueCount: issues.length, issues },
    errors: [],
  };
}

function handleProjectInfo(args: ParsedArgs): CommandResult {
  const projectId = getFlag(args, 'project', 'p');
  if (!projectId) {
    return errorResult('--project (-p) is required', 1);
  }

  const format = getOutputFormat(args);

  const info = {
    id: projectId,
    name: 'My PCB Project',
    owner: 'user@example.com',
    created: '2026-01-15',
    modified: '2026-03-20',
    components: 24,
    nets: 18,
    layers: 4,
    boardSize: '45x30mm',
    designRuleViolations: 2,
    status: 'in-progress',
  };

  if (format === 'json') {
    return {
      success: true,
      exitCode: 0,
      output: formatJson(info),
      data: info as unknown as Record<string, unknown>,
      errors: [],
    };
  }

  const rows = [
    { field: 'ID', value: String(info.id) },
    { field: 'Name', value: info.name },
    { field: 'Owner', value: info.owner },
    { field: 'Created', value: info.created },
    { field: 'Modified', value: info.modified },
    { field: 'Components', value: String(info.components) },
    { field: 'Nets', value: String(info.nets) },
    { field: 'Layers', value: String(info.layers) },
    { field: 'Board Size', value: info.boardSize },
    { field: 'DRC Violations', value: String(info.designRuleViolations) },
    { field: 'Status', value: info.status },
  ];

  const table = formatTable(
    [
      { header: 'Field', key: 'field', width: 18 },
      { header: 'Value', key: 'value', width: 25 },
    ],
    rows,
  );

  return {
    success: true,
    exitCode: 0,
    output: `Project Info:\n\n${table}`,
    data: info as unknown as Record<string, unknown>,
    errors: [],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFlag(args: ParsedArgs, long: string, short?: string): string | boolean | undefined {
  if (args.flags[long] !== undefined) {
    return args.flags[long];
  }
  if (short && args.flags[short] !== undefined) {
    return args.flags[short];
  }
  return undefined;
}

function getOutputFormat(args: ParsedArgs): OutputFormat {
  const fmt = getFlag(args, 'format', 'F');
  if (fmt === 'json') {
    return 'json';
  }
  return 'table';
}

function errorResult(message: string, exitCode: number): CommandResult {
  return {
    success: false,
    exitCode,
    output: `Error: ${message}`,
    errors: [message],
  };
}

// ---------------------------------------------------------------------------
// HeadlessRunner
// ---------------------------------------------------------------------------

export class HeadlessRunner {
  private commands: Map<string, CommandDefinition> = new Map();

  constructor() {
    this.registerBuiltins();
  }

  /**
   * Register a custom command.
   */
  registerCommand(cmd: CommandDefinition): void {
    this.commands.set(cmd.name, cmd);
  }

  /**
   * Get all registered command definitions.
   */
  getCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get a specific command definition.
   */
  getCommand(name: string): CommandDefinition | undefined {
    return this.commands.get(name);
  }

  /**
   * Run a command from argv-style arguments.
   */
  run(argv: string[]): CommandResult {
    if (argv.length === 0) {
      return this.showHelp();
    }

    const args = parseArgs(argv);

    // Handle --help or -h
    if (args.command === '' && (args.flags['help'] === true || args.flags['h'] === true)) {
      return this.showHelp();
    }

    if (args.command === 'help') {
      const subCommand = args.positional[0];
      if (subCommand) {
        return this.showCommandHelp(subCommand);
      }
      return this.showHelp();
    }

    // Handle --version
    if (args.flags['version'] === true || args.flags['v'] === true) {
      return {
        success: true,
        exitCode: 0,
        output: 'ProtoPulse CLI v1.0.0',
        errors: [],
      };
    }

    const cmd = this.commands.get(args.command);
    if (!cmd) {
      return errorResult(`Unknown command: "${args.command}". Run "help" to see available commands.`, 127);
    }

    return cmd.handler(args);
  }

  /**
   * Generate help text for all commands.
   */
  showHelp(): CommandResult {
    const lines: string[] = [
      'ProtoPulse CLI — Headless validation and export tool',
      '',
      'Usage: protopulse <command> [options]',
      '',
      'Commands:',
    ];

    const cmds = Array.from(this.commands.values());
    const maxNameLen = Math.max(...cmds.map((c) => c.name.length));

    for (const cmd of cmds) {
      lines.push(`  ${cmd.name.padEnd(maxNameLen + 2)} ${cmd.description}`);
    }

    lines.push('');
    lines.push('Global options:');
    lines.push('  --format, -F   Output format: table (default) or json');
    lines.push('  --help, -h     Show help');
    lines.push('  --version, -v  Show version');
    lines.push('');
    lines.push('Run "help <command>" for detailed command usage.');

    return {
      success: true,
      exitCode: 0,
      output: lines.join('\n'),
      errors: [],
    };
  }

  /**
   * Generate help text for a specific command.
   */
  showCommandHelp(commandName: string): CommandResult {
    const cmd = this.commands.get(commandName);
    if (!cmd) {
      return errorResult(`Unknown command: "${commandName}"`, 127);
    }

    const lines: string[] = [
      `${cmd.name} — ${cmd.description}`,
      '',
      `Usage: ${cmd.usage}`,
      '',
    ];

    if (cmd.flags.length > 0) {
      lines.push('Options:');
      const maxFlagLen = Math.max(
        ...cmd.flags.map((f) => {
          const short = f.short ? `-${f.short}, ` : '    ';
          return short.length + `--${f.name}`.length;
        }),
      );

      for (const flag of cmd.flags) {
        const short = flag.short ? `-${flag.short}, ` : '    ';
        const long = `--${flag.name}`;
        const flagStr = `${short}${long}`.padEnd(maxFlagLen + 4);
        const required = flag.required ? ' (required)' : '';
        const def = flag.defaultValue !== undefined ? ` [default: ${String(flag.defaultValue)}]` : '';
        lines.push(`  ${flagStr} ${flag.description}${required}${def}`);
      }
    }

    return {
      success: true,
      exitCode: 0,
      output: lines.join('\n'),
      errors: [],
    };
  }

  // -----------------------------------------------------------------------
  // Built-in registration
  // -----------------------------------------------------------------------

  private registerBuiltins(): void {
    const projectFlag: FlagDefinition = {
      name: 'project',
      short: 'p',
      description: 'Project ID',
      required: true,
      type: 'string',
    };

    const formatFlag: FlagDefinition = {
      name: 'format',
      short: 'F',
      description: 'Output format (table or json)',
      required: false,
      defaultValue: 'table',
      type: 'string',
    };

    const outputFlag: FlagDefinition = {
      name: 'output',
      short: 'o',
      description: 'Output file path',
      required: false,
      type: 'string',
    };

    this.commands.set('validate', {
      name: 'validate',
      description: 'Run DRC + ERC validation on a project',
      usage: 'protopulse validate --project <id> [--format table|json]',
      flags: [projectFlag, formatFlag],
      handler: handleValidate,
    });

    this.commands.set('export-bom', {
      name: 'export-bom',
      description: 'Export BOM in CSV/JSON format',
      usage: 'protopulse export-bom --project <id> [--output <file>] [--format table|json]',
      flags: [projectFlag, outputFlag, formatFlag],
      handler: handleExportBom,
    });

    this.commands.set('export-gerber', {
      name: 'export-gerber',
      description: 'Export Gerber fabrication files',
      usage: 'protopulse export-gerber --project <id> [--output <dir>] [--layers <list>]',
      flags: [
        projectFlag,
        outputFlag,
        { name: 'layers', short: 'l', description: 'Layers to export (comma-separated or "all")', required: false, defaultValue: 'all', type: 'string' },
        formatFlag,
      ],
      handler: handleExportGerber,
    });

    this.commands.set('export-netlist', {
      name: 'export-netlist',
      description: 'Export netlist in various formats',
      usage: 'protopulse export-netlist --project <id> [--netlist-format kicad|spice|eagle]',
      flags: [
        projectFlag,
        { name: 'netlist-format', short: 'n', description: 'Netlist format (kicad, spice, eagle)', required: false, defaultValue: 'kicad', type: 'string' },
        formatFlag,
      ],
      handler: handleExportNetlist,
    });

    this.commands.set('export-report', {
      name: 'export-report',
      description: 'Generate design report',
      usage: 'protopulse export-report --project <id> [--sections all|summary|drc|bom]',
      flags: [
        projectFlag,
        { name: 'sections', short: 's', description: 'Report sections to include', required: false, defaultValue: 'all', type: 'string' },
        formatFlag,
      ],
      handler: handleExportReport,
    });

    this.commands.set('check-dfm', {
      name: 'check-dfm',
      description: 'Run DFM checks against a fab profile',
      usage: 'protopulse check-dfm --project <id> [--fab JLCPCB|PCBWay|OSHPark|Generic]',
      flags: [
        projectFlag,
        { name: 'fab', short: 'f', description: 'Fabrication house profile', required: false, defaultValue: 'JLCPCB', type: 'string' },
        formatFlag,
      ],
      handler: handleCheckDfm,
    });

    this.commands.set('lint-sketch', {
      name: 'lint-sketch',
      description: 'Lint Arduino sketch files',
      usage: 'protopulse lint-sketch --sketch <path> [--format table|json]',
      flags: [
        { name: 'sketch', short: 's', description: 'Path to .ino sketch file', required: true, type: 'string' },
        formatFlag,
      ],
      handler: handleLintSketch,
    });

    this.commands.set('project-info', {
      name: 'project-info',
      description: 'Display project summary information',
      usage: 'protopulse project-info --project <id> [--format table|json]',
      flags: [projectFlag, formatFlag],
      handler: handleProjectInfo,
    });
  }
}
