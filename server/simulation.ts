/**
 * Server-Side Simulation Engine (Phase 13.4)
 *
 * For circuits that exceed the client-side MNA solver's capabilities,
 * this module runs ngspice as a child process and parses the results.
 *
 * If ngspice is not installed, falls back to a basic server-side MNA solver
 * (same algorithm as client, but runs in Node.js for larger matrices).
 */

import { spawn } from 'child_process';
import { writeFile, readFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SimulationRequest {
  netlist: string;
  analysisType: 'op' | 'tran' | 'ac' | 'dc';
  timeout?: number;  // ms, default 30000
}

export interface SimulationTrace {
  name: string;
  unit: string;
  data: number[];
}

export interface SimulationOutput {
  success: boolean;
  analysisType: string;
  traces: SimulationTrace[];
  nodeVoltages?: Record<string, number>;   // For DC OP
  branchCurrents?: Record<string, number>; // For DC OP
  stdout: string;
  stderr: string;
  error?: string;
  engineUsed: 'ngspice' | 'mna-server';
  elapsedMs: number;
}

// ---------------------------------------------------------------------------
// ngspice detection
// ---------------------------------------------------------------------------

let ngspiceAvailable: boolean | null = null;

async function isNgspiceAvailable(): Promise<boolean> {
  if (ngspiceAvailable !== null) return ngspiceAvailable;

  return new Promise((resolve) => {
    const proc = spawn('ngspice', ['--version'], {
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.on('close', (code) => {
      ngspiceAvailable = code === 0;
      resolve(ngspiceAvailable);
    });

    proc.on('error', () => {
      ngspiceAvailable = false;
      resolve(false);
    });
  });
}

// ---------------------------------------------------------------------------
// ngspice execution
// ---------------------------------------------------------------------------

async function runNgspice(request: SimulationRequest): Promise<SimulationOutput> {
  const startTime = Date.now();
  const timeout = request.timeout ?? 30000;

  // Create temp directory for simulation files
  const tmpDir = await mkdtemp(join(tmpdir(), 'protopulse-sim-'));
  const inputPath = join(tmpDir, 'circuit.cir');
  const outputPath = join(tmpDir, 'output.raw');

  // Modify netlist to write raw output
  let netlist = request.netlist;

  // Insert write command before .ENDC
  const writeCmd = `write ${outputPath} all`;
  netlist = netlist.replace('.ENDC', `${writeCmd}\n.ENDC`);

  // Remove interactive commands (plot, print) since we're running in batch
  netlist = netlist.replace(/^plot\s+.*$/gm, '');

  await writeFile(inputPath, netlist, 'utf-8');

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const proc = spawn('ngspice', ['-b', inputPath], {
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: tmpDir,
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', async (code) => {
      clearTimeout(timer);
      const elapsedMs = Date.now() - startTime;

      if (killed) {
        cleanup(tmpDir, inputPath, outputPath);
        resolve({
          success: false,
          analysisType: request.analysisType,
          traces: [],
          stdout,
          stderr,
          error: `Simulation timed out after ${timeout}ms`,
          engineUsed: 'ngspice',
          elapsedMs,
        });
        return;
      }

      if (code !== 0 && code !== null) {
        cleanup(tmpDir, inputPath, outputPath);
        resolve({
          success: false,
          analysisType: request.analysisType,
          traces: [],
          stdout,
          stderr,
          error: `ngspice exited with code ${code}`,
          engineUsed: 'ngspice',
          elapsedMs,
        });
        return;
      }

      // Parse output
      try {
        const result = await parseNgspiceOutput(
          outputPath,
          stdout,
          request.analysisType,
        );

        cleanup(tmpDir, inputPath, outputPath);

        resolve({
          success: true,
          ...result,
          stdout,
          stderr,
          engineUsed: 'ngspice',
          elapsedMs,
        });
      } catch (err) {
        cleanup(tmpDir, inputPath, outputPath);
        resolve({
          success: false,
          analysisType: request.analysisType,
          traces: [],
          stdout,
          stderr,
          error: `Failed to parse ngspice output: ${err instanceof Error ? err.message : String(err)}`,
          engineUsed: 'ngspice',
          elapsedMs,
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      cleanup(tmpDir, inputPath, outputPath);
      resolve({
        success: false,
        analysisType: request.analysisType,
        traces: [],
        stdout,
        stderr,
        error: `Failed to start ngspice: ${err.message}`,
        engineUsed: 'ngspice',
        elapsedMs: Date.now() - startTime,
      });
    });
  });
}

async function cleanup(dir: string, ...files: string[]) {
  for (const f of files) {
    try { await unlink(f); } catch { /* ignore */ }
  }
  try {
    const { rmdir } = await import('fs/promises');
    await rmdir(dir);
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// ngspice raw file parser
// ---------------------------------------------------------------------------

interface ParsedOutput {
  analysisType: string;
  traces: SimulationTrace[];
  nodeVoltages?: Record<string, number>;
  branchCurrents?: Record<string, number>;
}

async function parseNgspiceOutput(
  rawPath: string,
  stdout: string,
  analysisType: string,
): Promise<ParsedOutput> {
  // Try to read the raw binary file first
  try {
    const rawData = await readFile(rawPath);
    return parseRawFile(rawData, analysisType);
  } catch {
    // Fall back to parsing stdout for .OP results
    return parseStdout(stdout, analysisType);
  }
}

/**
 * Parse ngspice binary raw file format.
 *
 * Raw file format:
 *   Title: ...
 *   Date: ...
 *   Plotname: ...
 *   Flags: real|complex
 *   No. Variables: N
 *   No. Points: P
 *   Variables:
 *     0 time seconds
 *     1 v(1) voltage
 *     ...
 *   Binary:
 *   <binary data: N*P doubles>
 */
function parseRawFile(data: Buffer, analysisType: string): ParsedOutput {
  const text = data.toString('utf-8');

  // Find header-body boundary
  const binaryIdx = text.indexOf('Binary:\n');
  if (binaryIdx === -1) {
    // ASCII format — parse as text
    return parseRawAscii(text, analysisType);
  }

  const header = text.slice(0, binaryIdx);

  // Parse header
  const numVarsMatch = /No\. Variables:\s*(\d+)/i.exec(header);
  const numPointsMatch = /No\. Points:\s*(\d+)/i.exec(header);
  const flagsMatch = /Flags:\s*(\S+)/i.exec(header);

  if (!numVarsMatch || !numPointsMatch) {
    throw new Error('Invalid raw file header');
  }

  const numVars = parseInt(numVarsMatch[1], 10);
  const numPoints = parseInt(numPointsMatch[1], 10);
  const isComplex = flagsMatch && flagsMatch[1].toLowerCase() === 'complex';

  // Parse variable names
  const varsSection = header.slice(header.indexOf('Variables:'));
  const varLines = varsSection.split('\n').slice(1, numVars + 1);
  const variables: Array<{ name: string; unit: string }> = [];

  for (const line of varLines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) {
      variables.push({ name: parts[1], unit: parts[2] });
    }
  }

  // Parse binary data
  const headerBytes = Buffer.byteLength(header + 'Binary:\n', 'utf-8');
  const binaryData = data.subarray(headerBytes);
  const bytesPerValue = isComplex ? 16 : 8; // complex = 2 doubles
  const expectedBytes = numVars * numPoints * bytesPerValue;

  const traces: SimulationTrace[] = [];
  for (const v of variables) {
    traces.push({ name: v.name, unit: v.unit, data: [] });
  }

  // Read binary doubles
  let offset = 0;
  for (let p = 0; p < numPoints && offset + numVars * bytesPerValue <= binaryData.length; p++) {
    for (let v = 0; v < numVars; v++) {
      if (offset + 8 <= binaryData.length) {
        const value = binaryData.readDoubleLE(offset);
        traces[v].data.push(value);
        offset += 8;
        if (isComplex) offset += 8; // Skip imaginary part for now
      }
    }
  }

  // For DC OP, extract node voltages and branch currents
  if (analysisType === 'op' && numPoints === 1) {
    const nodeVoltages: Record<string, number> = {};
    const branchCurrents: Record<string, number> = {};

    for (const trace of traces) {
      if (trace.data.length > 0) {
        const val = trace.data[0];
        if (trace.name.startsWith('v(')) {
          nodeVoltages[trace.name] = val;
        } else if (trace.name.startsWith('i(') || trace.name.includes('#branch')) {
          branchCurrents[trace.name] = val;
        }
      }
    }

    return { analysisType, traces, nodeVoltages, branchCurrents };
  }

  return { analysisType, traces };
}

function parseRawAscii(text: string, analysisType: string): ParsedOutput {
  const lines = text.split('\n');

  // Find "Values:" section
  const valuesIdx = lines.findIndex(l => l.trim() === 'Values:');
  if (valuesIdx === -1) {
    return { analysisType, traces: [] };
  }

  // Parse variable names from header
  const numVarsMatch = /No\. Variables:\s*(\d+)/i.exec(text);
  const numVars = numVarsMatch ? parseInt(numVarsMatch[1], 10) : 0;

  const varsIdx = lines.findIndex(l => l.trim().startsWith('Variables:'));
  const variables: Array<{ name: string; unit: string }> = [];

  if (varsIdx >= 0) {
    for (let i = varsIdx + 1; i < varsIdx + 1 + numVars && i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length >= 3) {
        variables.push({ name: parts[1], unit: parts[2] });
      }
    }
  }

  const traces: SimulationTrace[] = variables.map(v => ({
    name: v.name,
    unit: v.unit,
    data: [],
  }));

  // Parse values
  let varIdx = 0;
  for (let i = valuesIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Data point index line: "0  1.234e+00"
    const match = /^(\d+)\s+(.+)$/.exec(line);
    if (match) {
      varIdx = 0;
      const val = parseFloat(match[2]);
      if (traces[0] && !isNaN(val)) traces[0].data.push(val);
      varIdx = 1;
    } else {
      // Continuation value
      const val = parseFloat(line);
      if (varIdx < traces.length && !isNaN(val)) {
        traces[varIdx].data.push(val);
      }
      varIdx++;
    }
  }

  return { analysisType, traces };
}

/**
 * Parse DC OP results from ngspice stdout.
 */
function parseStdout(stdout: string, analysisType: string): ParsedOutput {
  const nodeVoltages: Record<string, number> = {};
  const branchCurrents: Record<string, number> = {};

  // Parse lines like "v(1) = 3.300000e+00" or "vcc#branch = -1.500000e-03"
  const lines = stdout.split('\n');
  for (const line of lines) {
    const voltageMatch = /^(v\([^)]+\))\s*=\s*([-\d.eE+]+)/i.exec(line.trim());
    if (voltageMatch) {
      nodeVoltages[voltageMatch[1]] = parseFloat(voltageMatch[2]);
      continue;
    }

    const currentMatch = /^([a-zA-Z]\S*#branch)\s*=\s*([-\d.eE+]+)/i.exec(line.trim());
    if (currentMatch) {
      branchCurrents[currentMatch[1]] = parseFloat(currentMatch[2]);
    }
  }

  return { analysisType, traces: [], nodeVoltages, branchCurrents };
}

// ---------------------------------------------------------------------------
// Server-side MNA solver (fallback when ngspice not available)
// ---------------------------------------------------------------------------

interface MNAComponent {
  id: string;
  type: 'R' | 'C' | 'L' | 'V' | 'I';
  value: number;
  nodePlus: number;
  nodeMinus: number;
}

function parseNetlistToComponents(netlist: string): { components: MNAComponent[]; maxNode: number } {
  const components: MNAComponent[] = [];
  let maxNode = 0;

  const lines = netlist.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith('.')) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) continue;

    const id = parts[0];
    const firstChar = id[0].toUpperCase();
    const n1 = parseInt(parts[1], 10);
    const n2 = parseInt(parts[2], 10);

    if (isNaN(n1) || isNaN(n2)) continue;

    maxNode = Math.max(maxNode, n1, n2);

    let type: MNAComponent['type'];
    switch (firstChar) {
      case 'R': type = 'R'; break;
      case 'C': type = 'C'; break;
      case 'L': type = 'L'; break;
      case 'V': type = 'V'; break;
      case 'I': type = 'I'; break;
      default: continue; // Skip unsupported
    }

    // Parse value — handle "DC 5" format for sources
    let valueStr = parts[3];
    if (valueStr.toUpperCase() === 'DC' && parts[4]) {
      valueStr = parts[4];
    }

    const value = parseSimpleValue(valueStr);

    components.push({ id, type, value, nodePlus: n1, nodeMinus: n2 });
  }

  return { components, maxNode };
}

function parseSimpleValue(s: string): number {
  const cleaned = s.trim().toUpperCase();
  const match = /^([-\d.eE+]+)([A-Z]*)/.exec(cleaned);
  if (!match) return parseFloat(s) || 0;

  const num = parseFloat(match[1]);
  const suffix = match[2];

  const multipliers: Record<string, number> = {
    T: 1e12, G: 1e9, MEG: 1e6, K: 1e3,
    M: 1e-3, U: 1e-6, N: 1e-9, P: 1e-12,
  };

  return num * (multipliers[suffix] ?? 1);
}

/**
 * Simple Gaussian elimination (same as client-side but in Node.js).
 */
function solveSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxVal = Math.abs(aug[col][col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(aug[row][col]);
      if (val > maxVal) { maxVal = val; maxRow = row; }
    }
    if (maxVal < 1e-15) return null;
    if (maxRow !== col) { const tmp = aug[col]; aug[col] = aug[maxRow]; aug[maxRow] = tmp; }

    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = aug[row][n];
    for (let col = row + 1; col < n; col++) sum -= aug[row][col] * x[col];
    if (Math.abs(aug[row][row]) < 1e-15) return null;
    x[row] = sum / aug[row][row];
  }
  return x;
}

function runMNASolver(netlist: string, analysisType: string): SimulationOutput {
  const startTime = Date.now();

  const { components, maxNode } = parseNetlistToComponents(netlist);

  if (maxNode === 0 || components.length === 0) {
    return {
      success: false,
      analysisType,
      traces: [],
      stdout: '',
      stderr: '',
      error: 'No valid components found in netlist',
      engineUsed: 'mna-server',
      elapsedMs: Date.now() - startTime,
    };
  }

  // Only DC OP supported in the server-side fallback
  const voltageSources = components.filter(c => c.type === 'V');
  const matrixSize = maxNode + voltageSources.length;

  const G: number[][] = Array.from({ length: matrixSize }, () => new Array(matrixSize).fill(0));
  const b = new Array(matrixSize).fill(0);

  const vsMap = new Map<string, number>();
  let vsIdx = maxNode;
  for (const vs of voltageSources) vsMap.set(vs.id, vsIdx++);

  for (const comp of components) {
    const np = comp.nodePlus;
    const nm = comp.nodeMinus;

    switch (comp.type) {
      case 'R': {
        if (comp.value === 0) break;
        const g = 1 / comp.value;
        if (np > 0) G[np - 1][np - 1] += g;
        if (nm > 0) G[nm - 1][nm - 1] += g;
        if (np > 0 && nm > 0) { G[np - 1][nm - 1] -= g; G[nm - 1][np - 1] -= g; }
        break;
      }
      case 'V': {
        const idx = vsMap.get(comp.id);
        if (idx !== undefined) {
          if (np > 0) { G[np - 1][idx] += 1; G[idx][np - 1] += 1; }
          if (nm > 0) { G[nm - 1][idx] -= 1; G[idx][nm - 1] -= 1; }
          b[idx] = comp.value;
        }
        break;
      }
      case 'I': {
        if (np > 0) b[np - 1] += comp.value;
        if (nm > 0) b[nm - 1] -= comp.value;
        break;
      }
      // C and L treated as open/short for DC
    }
  }

  const solution = solveSystem(G, b);

  if (!solution) {
    return {
      success: false,
      analysisType,
      traces: [],
      stdout: '',
      stderr: '',
      error: 'Singular matrix — check for floating nodes or shorted voltage sources',
      engineUsed: 'mna-server',
      elapsedMs: Date.now() - startTime,
    };
  }

  const nodeVoltages: Record<string, number> = { 'v(0)': 0 };
  for (let i = 0; i < maxNode; i++) {
    nodeVoltages[`v(${i + 1})`] = solution[i];
  }

  const branchCurrents: Record<string, number> = {};
  vsMap.forEach((idx, id) => {
    branchCurrents[`${id.toLowerCase()}#branch`] = solution[idx];
  });

  for (const comp of components) {
    if (comp.type === 'R' && comp.value > 0) {
      const v1 = comp.nodePlus > 0 ? solution[comp.nodePlus - 1] : 0;
      const v2 = comp.nodeMinus > 0 ? solution[comp.nodeMinus - 1] : 0;
      branchCurrents[`${comp.id.toLowerCase()}#branch`] = (v1 - v2) / comp.value;
    }
  }

  return {
    success: true,
    analysisType,
    traces: [],
    nodeVoltages,
    branchCurrents,
    stdout: `MNA solver: ${maxNode} nodes, ${components.length} components`,
    stderr: '',
    engineUsed: 'mna-server',
    elapsedMs: Date.now() - startTime,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a circuit simulation.
 * Tries ngspice first, falls back to server-side MNA solver.
 */
export async function runSimulation(request: SimulationRequest): Promise<SimulationOutput> {
  // Resource limits
  if (request.netlist.length > 1_000_000) {
    return {
      success: false,
      analysisType: request.analysisType,
      traces: [],
      stdout: '',
      stderr: '',
      error: 'Netlist exceeds maximum size (1MB)',
      engineUsed: 'mna-server',
      elapsedMs: 0,
    };
  }

  const hasNgspice = await isNgspiceAvailable();

  if (hasNgspice) {
    return runNgspice(request);
  }

  // Fallback to server-side MNA
  // Only DC OP is supported without ngspice
  if (request.analysisType !== 'op') {
    return {
      success: false,
      analysisType: request.analysisType,
      traces: [],
      stdout: '',
      stderr: '',
      error: `ngspice not installed — server-side solver only supports DC operating point analysis. Install ngspice for ${request.analysisType} analysis, or use SPICE export.`,
      engineUsed: 'mna-server',
      elapsedMs: 0,
    };
  }

  return runMNASolver(request.netlist, request.analysisType);
}

/**
 * Check if the simulation engine is available and what capabilities it has.
 */
export async function getSimulationCapabilities(): Promise<{
  engine: 'ngspice' | 'mna-server';
  analyses: string[];
  maxNodes: number;
}> {
  const hasNgspice = await isNgspiceAvailable();

  if (hasNgspice) {
    return {
      engine: 'ngspice',
      analyses: ['op', 'tran', 'ac', 'dc'],
      maxNodes: 10000,
    };
  }

  return {
    engine: 'mna-server',
    analyses: ['op'],
    maxNodes: 100,
  };
}
