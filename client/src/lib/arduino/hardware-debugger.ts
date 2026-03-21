// ---------------------------------------------------------------------------
// Hardware Debugger Integration Framework
// ---------------------------------------------------------------------------
// HardwareDebugManager singleton providing probe profiles (ST-Link, J-Link,
// CMSIS-DAP, Black Magic Probe, FTDI, ESP-Prog), debug session lifecycle,
// breakpoints/watchpoints, variable inspection, peripheral register view,
// call stack management, GDB command generation, and OpenOCD config generation.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported debug probe types. */
export type ProbeType = 'stlink' | 'jlink' | 'cmsis-dap' | 'blackmagic' | 'ftdi' | 'esp-prog';

/** Debug transport protocol. */
export type DebugTransport = 'swd' | 'jtag';

/** Session state machine states. */
export type DebugSessionState = 'idle' | 'connecting' | 'connected' | 'running' | 'halted' | 'error' | 'disconnected';

/** Breakpoint type. */
export type BreakpointType = 'hardware' | 'software';

/** Watchpoint access type. */
export type WatchpointAccess = 'read' | 'write' | 'readwrite';

/** Variable format for display. */
export type VariableFormat = 'decimal' | 'hex' | 'binary' | 'octal';

/** Call stack frame. */
export interface StackFrame {
  level: number;
  address: string;
  function: string;
  file: string;
  line: number;
  args: Record<string, string>;
}

/** Debug probe profile. */
export interface ProbeProfile {
  type: ProbeType;
  name: string;
  vendor: string;
  transports: DebugTransport[];
  defaultTransport: DebugTransport;
  maxBreakpoints: number;
  maxWatchpoints: number;
  supportsSwo: boolean;
  supportsRtt: boolean;
  openocdInterface: string;
  openocdExtraConfig: string[];
  gdbServerPort: number;
  description: string;
}

/** Breakpoint definition. */
export interface Breakpoint {
  id: number;
  file: string;
  line: number;
  type: BreakpointType;
  enabled: boolean;
  condition?: string;
  hitCount: number;
  ignoreCount: number;
}

/** Watchpoint definition. */
export interface Watchpoint {
  id: number;
  expression: string;
  access: WatchpointAccess;
  enabled: boolean;
  size: number;
  hitCount: number;
}

/** Inspected variable. */
export interface InspectedVariable {
  name: string;
  value: string;
  type: string;
  format: VariableFormat;
  address?: string;
  children?: InspectedVariable[];
  isEditable: boolean;
}

/** Peripheral register. */
export interface PeripheralRegister {
  name: string;
  address: string;
  value: string;
  resetValue: string;
  description: string;
  fields: RegisterField[];
}

/** Register field (bit range). */
export interface RegisterField {
  name: string;
  bitOffset: number;
  bitWidth: number;
  value: number;
  description: string;
  access: 'read-only' | 'write-only' | 'read-write';
}

/** Peripheral group. */
export interface PeripheralGroup {
  name: string;
  baseAddress: string;
  description: string;
  registers: PeripheralRegister[];
}

/** Debug target chip. */
export interface DebugTarget {
  name: string;
  arch: string;
  openocdTarget: string;
  flashSize: number;
  ramSize: number;
  peripherals: PeripheralGroup[];
}

/** Debug session configuration. */
export interface DebugSessionConfig {
  probe: ProbeProfile;
  target: DebugTarget;
  transport: DebugTransport;
  elfFile: string;
  resetOnConnect: boolean;
  haltOnConnect: boolean;
  verifyFlash: boolean;
  gdbServerPort: number;
  svdFile?: string;
}

/** Debug event. */
export interface DebugEvent {
  type: 'state-change' | 'breakpoint-hit' | 'watchpoint-hit' | 'error' | 'output';
  timestamp: number;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Probe profiles
// ---------------------------------------------------------------------------

export const PROBE_PROFILES: Record<ProbeType, ProbeProfile> = {
  stlink: {
    type: 'stlink',
    name: 'ST-Link V2/V3',
    vendor: 'STMicroelectronics',
    transports: ['swd', 'jtag'],
    defaultTransport: 'swd',
    maxBreakpoints: 6,
    maxWatchpoints: 4,
    supportsSwo: true,
    supportsRtt: false,
    openocdInterface: 'interface/stlink.cfg',
    openocdExtraConfig: ['transport select hla_swd'],
    gdbServerPort: 3333,
    description: 'STMicroelectronics debug probe, widely used with STM32. Affordable and reliable for SWD debugging.',
  },
  jlink: {
    type: 'jlink',
    name: 'SEGGER J-Link',
    vendor: 'SEGGER',
    transports: ['swd', 'jtag'],
    defaultTransport: 'swd',
    maxBreakpoints: 8,
    maxWatchpoints: 4,
    supportsSwo: true,
    supportsRtt: true,
    openocdInterface: 'interface/jlink.cfg',
    openocdExtraConfig: ['transport select swd'],
    gdbServerPort: 3333,
    description: 'Professional-grade probe supporting SWD/JTAG, SWO trace, and RTT. Fastest flash download speeds.',
  },
  'cmsis-dap': {
    type: 'cmsis-dap',
    name: 'CMSIS-DAP',
    vendor: 'ARM',
    transports: ['swd', 'jtag'],
    defaultTransport: 'swd',
    maxBreakpoints: 6,
    maxWatchpoints: 4,
    supportsSwo: true,
    supportsRtt: false,
    openocdInterface: 'interface/cmsis-dap.cfg',
    openocdExtraConfig: ['transport select swd', 'adapter speed 10000'],
    gdbServerPort: 3333,
    description:
      'ARM open standard debug interface. Implemented by many low-cost probes including DAPLink and Raspberry Pi Debug Probe.',
  },
  blackmagic: {
    type: 'blackmagic',
    name: 'Black Magic Probe',
    vendor: '1BitSquared',
    transports: ['swd', 'jtag'],
    defaultTransport: 'swd',
    maxBreakpoints: 6,
    maxWatchpoints: 4,
    supportsSwo: true,
    supportsRtt: true,
    openocdInterface: 'interface/cmsis-dap.cfg',
    openocdExtraConfig: [],
    gdbServerPort: 0,
    description:
      'Embeds its own GDB server — connect GDB directly to the probe serial port. No OpenOCD needed. Supports SWD and JTAG.',
  },
  ftdi: {
    type: 'ftdi',
    name: 'FTDI-based Adapter',
    vendor: 'FTDI',
    transports: ['swd', 'jtag'],
    defaultTransport: 'jtag',
    maxBreakpoints: 6,
    maxWatchpoints: 4,
    supportsSwo: false,
    supportsRtt: false,
    openocdInterface: 'interface/ftdi/tumpa.cfg',
    openocdExtraConfig: ['adapter speed 6000'],
    gdbServerPort: 3333,
    description: 'Generic FTDI FT2232H-based JTAG/SWD adapter. Versatile and widely available. Many board variants.',
  },
  'esp-prog': {
    type: 'esp-prog',
    name: 'ESP-Prog',
    vendor: 'Espressif',
    transports: ['jtag'],
    defaultTransport: 'jtag',
    maxBreakpoints: 2,
    maxWatchpoints: 2,
    supportsSwo: false,
    supportsRtt: false,
    openocdInterface: 'interface/ftdi/esp32_devkitj_v1.cfg',
    openocdExtraConfig: ['adapter speed 20000'],
    gdbServerPort: 3333,
    description: 'Espressif official JTAG debugger for ESP32 chips. Also provides a USB-to-serial bridge for flashing.',
  },
};

// ---------------------------------------------------------------------------
// Common debug targets
// ---------------------------------------------------------------------------

export const COMMON_TARGETS: DebugTarget[] = [
  {
    name: 'STM32F103C8',
    arch: 'cortex-m3',
    openocdTarget: 'target/stm32f1x.cfg',
    flashSize: 65536,
    ramSize: 20480,
    peripherals: [
      {
        name: 'GPIOA',
        baseAddress: '0x40010800',
        description: 'General purpose I/O port A',
        registers: [
          {
            name: 'CRL',
            address: '0x40010800',
            value: '0x44444444',
            resetValue: '0x44444444',
            description: 'Port configuration register low',
            fields: [
              { name: 'MODE0', bitOffset: 0, bitWidth: 2, value: 0, description: 'Port mode bits', access: 'read-write' },
              { name: 'CNF0', bitOffset: 2, bitWidth: 2, value: 1, description: 'Port configuration bits', access: 'read-write' },
            ],
          },
          {
            name: 'CRH',
            address: '0x40010804',
            value: '0x44444444',
            resetValue: '0x44444444',
            description: 'Port configuration register high',
            fields: [
              { name: 'MODE8', bitOffset: 0, bitWidth: 2, value: 0, description: 'Port mode bits', access: 'read-write' },
              { name: 'CNF8', bitOffset: 2, bitWidth: 2, value: 1, description: 'Port configuration bits', access: 'read-write' },
            ],
          },
          {
            name: 'IDR',
            address: '0x40010808',
            value: '0x00000000',
            resetValue: '0x00000000',
            description: 'Port input data register',
            fields: [
              { name: 'IDR0', bitOffset: 0, bitWidth: 1, value: 0, description: 'Port input data bit 0', access: 'read-only' },
            ],
          },
          {
            name: 'ODR',
            address: '0x4001080C',
            value: '0x00000000',
            resetValue: '0x00000000',
            description: 'Port output data register',
            fields: [
              { name: 'ODR0', bitOffset: 0, bitWidth: 1, value: 0, description: 'Port output data bit 0', access: 'read-write' },
            ],
          },
        ],
      },
      {
        name: 'RCC',
        baseAddress: '0x40021000',
        description: 'Reset and clock control',
        registers: [
          {
            name: 'CR',
            address: '0x40021000',
            value: '0x00000083',
            resetValue: '0x00000083',
            description: 'Clock control register',
            fields: [
              { name: 'HSION', bitOffset: 0, bitWidth: 1, value: 1, description: 'Internal high-speed clock enable', access: 'read-write' },
              { name: 'HSIRDY', bitOffset: 1, bitWidth: 1, value: 1, description: 'Internal high-speed clock ready flag', access: 'read-only' },
              { name: 'PLLON', bitOffset: 24, bitWidth: 1, value: 0, description: 'PLL enable', access: 'read-write' },
              { name: 'PLLRDY', bitOffset: 25, bitWidth: 1, value: 0, description: 'PLL clock ready flag', access: 'read-only' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'ESP32',
    arch: 'xtensa-lx6',
    openocdTarget: 'target/esp32.cfg',
    flashSize: 4194304,
    ramSize: 520192,
    peripherals: [
      {
        name: 'GPIO',
        baseAddress: '0x3FF44000',
        description: 'GPIO peripheral',
        registers: [
          {
            name: 'GPIO_OUT_REG',
            address: '0x3FF44004',
            value: '0x00000000',
            resetValue: '0x00000000',
            description: 'GPIO output register',
            fields: [
              { name: 'GPIO_OUT_DATA', bitOffset: 0, bitWidth: 32, value: 0, description: 'GPIO output data', access: 'read-write' },
            ],
          },
          {
            name: 'GPIO_IN_REG',
            address: '0x3FF4403C',
            value: '0x00000000',
            resetValue: '0x00000000',
            description: 'GPIO input register',
            fields: [
              { name: 'GPIO_IN_DATA', bitOffset: 0, bitWidth: 32, value: 0, description: 'GPIO input data', access: 'read-only' },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'nRF52840',
    arch: 'cortex-m4f',
    openocdTarget: 'target/nrf52.cfg',
    flashSize: 1048576,
    ramSize: 262144,
    peripherals: [
      {
        name: 'P0',
        baseAddress: '0x50000000',
        description: 'GPIO port 0',
        registers: [
          {
            name: 'OUT',
            address: '0x50000504',
            value: '0x00000000',
            resetValue: '0x00000000',
            description: 'Write GPIO port',
            fields: [
              { name: 'PIN0', bitOffset: 0, bitWidth: 1, value: 0, description: 'Pin 0', access: 'read-write' },
            ],
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// GDB Command Generation
// ---------------------------------------------------------------------------

/**
 * Generate a GDB command to set a breakpoint.
 */
export function generateBreakpointCommand(bp: Breakpoint): string {
  const location = `${bp.file}:${bp.line}`;
  let cmd = bp.type === 'hardware' ? `hbreak ${location}` : `break ${location}`;
  if (bp.condition) {
    cmd += ` if ${bp.condition}`;
  }
  if (bp.ignoreCount > 0) {
    cmd += `\nignore ${bp.id} ${bp.ignoreCount}`;
  }
  if (!bp.enabled) {
    cmd += `\ndisable ${bp.id}`;
  }
  return cmd;
}

/**
 * Generate a GDB command to set a watchpoint.
 */
export function generateWatchpointCommand(wp: Watchpoint): string {
  switch (wp.access) {
    case 'read':
      return `rwatch ${wp.expression}`;
    case 'write':
      return `watch ${wp.expression}`;
    case 'readwrite':
      return `awatch ${wp.expression}`;
  }
}

/**
 * Generate a GDB command to inspect a variable.
 */
export function generateInspectCommand(varName: string, format: VariableFormat): string {
  const formatChar = FORMAT_CHARS[format];
  return `print/${formatChar} ${varName}`;
}

const FORMAT_CHARS: Record<VariableFormat, string> = {
  decimal: 'd',
  hex: 'x',
  binary: 't',
  octal: 'o',
};

/**
 * Generate a GDB command to read a memory address.
 */
export function generateMemoryReadCommand(address: string, size: number, format: VariableFormat = 'hex'): string {
  const formatChar = FORMAT_CHARS[format];
  return `x/${size}${formatChar} ${address}`;
}

/**
 * Generate GDB commands for a debug session startup sequence.
 */
export function generateSessionStartCommands(config: DebugSessionConfig): string[] {
  const cmds: string[] = [];

  // Connect to GDB server (unless Black Magic which has native GDB)
  if (config.probe.type === 'blackmagic') {
    cmds.push('target extended-remote /dev/ttyBmpGdb');
    cmds.push('monitor swdp_scan');
    cmds.push('attach 1');
  } else {
    cmds.push(`target extended-remote :${config.gdbServerPort}`);
  }

  // Load the ELF
  cmds.push(`file ${config.elfFile}`);

  if (config.resetOnConnect) {
    cmds.push('monitor reset halt');
  }

  if (config.verifyFlash) {
    cmds.push('load');
    cmds.push('compare-sections');
  } else {
    cmds.push('load');
  }

  if (config.haltOnConnect) {
    cmds.push('monitor reset halt');
  } else {
    cmds.push('monitor reset run');
  }

  return cmds;
}

/**
 * Generate GDB commands for common debug operations.
 */
export function generateDebugCommand(
  operation: 'continue' | 'step' | 'step-over' | 'step-out' | 'halt' | 'reset' | 'backtrace' | 'registers',
): string {
  switch (operation) {
    case 'continue':
      return 'continue';
    case 'step':
      return 'step';
    case 'step-over':
      return 'next';
    case 'step-out':
      return 'finish';
    case 'halt':
      return 'interrupt';
    case 'reset':
      return 'monitor reset halt';
    case 'backtrace':
      return 'backtrace full';
    case 'registers':
      return 'info registers';
  }
}

// ---------------------------------------------------------------------------
// OpenOCD Config Generation
// ---------------------------------------------------------------------------

/**
 * Generate a complete OpenOCD configuration file for a debug session.
 */
export function generateOpenOcdConfig(config: DebugSessionConfig): string {
  const lines: string[] = [];

  lines.push('# Auto-generated by ProtoPulse Hardware Debugger');
  lines.push(`# Probe: ${config.probe.name}`);
  lines.push(`# Target: ${config.target.name}`);
  lines.push('');

  // Interface
  lines.push(`source [find ${config.probe.openocdInterface}]`);

  // Extra interface config
  for (const extra of config.probe.openocdExtraConfig) {
    lines.push(extra);
  }

  // Transport override if different from default
  if (config.transport !== config.probe.defaultTransport) {
    lines.push(`transport select ${config.transport}`);
  }

  lines.push('');

  // Target
  lines.push(`source [find ${config.target.openocdTarget}]`);

  lines.push('');

  // GDB server port
  if (config.gdbServerPort > 0) {
    lines.push(`gdb_port ${config.gdbServerPort}`);
  }

  // Reset config
  if (config.resetOnConnect) {
    lines.push('');
    lines.push('$_TARGETNAME configure -event gdb-attach {');
    lines.push('  reset halt');
    lines.push('}');
  }

  // Init
  lines.push('');
  lines.push('init');

  if (config.haltOnConnect) {
    lines.push('reset halt');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

/**
 * Parse a GDB backtrace response into structured stack frames.
 */
export function parseBacktrace(gdbOutput: string): StackFrame[] {
  const frames: StackFrame[] = [];
  const lines = gdbOutput.split('\n');

  for (const line of lines) {
    // Match: #0  0x08001234 in functionName (arg1=val1, arg2=val2) at file.c:42
    const match = /^#(\d+)\s+(?:0x([0-9a-fA-F]+)\s+in\s+)?(\S+)\s*\(([^)]*)\)(?:\s+at\s+(\S+):(\d+))?/.exec(line);
    if (match) {
      const args: Record<string, string> = {};
      if (match[4]) {
        const argParts = match[4].split(',');
        for (const part of argParts) {
          const eqIdx = part.indexOf('=');
          if (eqIdx !== -1) {
            const key = part.slice(0, eqIdx).trim();
            const val = part.slice(eqIdx + 1).trim();
            args[key] = val;
          }
        }
      }

      frames.push({
        level: parseInt(match[1], 10),
        address: match[2] ? `0x${match[2]}` : '0x00000000',
        function: match[3],
        file: match[5] ?? '<unknown>',
        line: match[6] ? parseInt(match[6], 10) : 0,
        args,
      });
    }
  }

  return frames;
}

/**
 * Parse a GDB variable print response.
 */
export function parseVariableOutput(gdbOutput: string, varName: string): InspectedVariable | null {
  // Match: $N = VALUE or $N = {field = val, ...}
  const match = /^\$\d+\s*=\s*(.+)$/m.exec(gdbOutput);
  if (!match) {
    return null;
  }

  const value = match[1].trim();
  const isStruct = value.startsWith('{');

  const variable: InspectedVariable = {
    name: varName,
    value,
    type: isStruct ? 'struct' : 'scalar',
    format: 'decimal',
    isEditable: true,
  };

  // Parse struct children
  if (isStruct) {
    variable.children = parseStructFields(value, varName);
  }

  return variable;
}

/**
 * Parse struct field notation from GDB output.
 */
function parseStructFields(structStr: string, parentName: string): InspectedVariable[] {
  const children: InspectedVariable[] = [];
  // Remove outer braces
  const inner = structStr.slice(1, -1).trim();
  if (!inner) {
    return children;
  }

  // Split on top-level commas (not inside nested braces)
  const fields = splitTopLevel(inner);

  for (const field of fields) {
    const eqIdx = field.indexOf('=');
    if (eqIdx === -1) {
      continue;
    }
    const name = field.slice(0, eqIdx).trim();
    const val = field.slice(eqIdx + 1).trim();

    children.push({
      name: `${parentName}.${name}`,
      value: val,
      type: val.startsWith('{') ? 'struct' : 'scalar',
      format: 'decimal',
      isEditable: true,
    });
  }

  return children;
}

/**
 * Split a string by commas, respecting nested braces.
 */
function splitTopLevel(str: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
    }

    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

// ---------------------------------------------------------------------------
// HardwareDebugManager — singleton + subscribe
// ---------------------------------------------------------------------------

export type DebugListener = (event: DebugEvent) => void;

export class HardwareDebugManager {
  private static instance: HardwareDebugManager | null = null;

  private state: DebugSessionState = 'idle';
  private config: DebugSessionConfig | null = null;
  private breakpoints: Map<number, Breakpoint> = new Map();
  private watchpoints: Map<number, Watchpoint> = new Map();
  private callStack: StackFrame[] = [];
  private variables: Map<string, InspectedVariable> = new Map();
  private nextBreakpointId = 1;
  private nextWatchpointId = 1;
  private listeners: Set<DebugListener> = new Set();
  private eventLog: DebugEvent[] = [];

  private constructor() {
    // singleton
  }

  static getInstance(): HardwareDebugManager {
    if (!HardwareDebugManager.instance) {
      HardwareDebugManager.instance = new HardwareDebugManager();
    }
    return HardwareDebugManager.instance;
  }

  static resetInstance(): void {
    HardwareDebugManager.instance = null;
  }

  // -- Subscribe / unsubscribe ---

  subscribe(listener: DebugListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: DebugEvent): void {
    this.eventLog.push(event);
    this.listeners.forEach((listener) => listener(event));
  }

  // -- Getters ---

  getState(): DebugSessionState {
    return this.state;
  }

  getConfig(): DebugSessionConfig | null {
    return this.config;
  }

  getBreakpoints(): Breakpoint[] {
    return Array.from(this.breakpoints.values());
  }

  getWatchpoints(): Watchpoint[] {
    return Array.from(this.watchpoints.values());
  }

  getCallStack(): StackFrame[] {
    return [...this.callStack];
  }

  getVariables(): InspectedVariable[] {
    return Array.from(this.variables.values());
  }

  getEventLog(): DebugEvent[] {
    return [...this.eventLog];
  }

  // -- Session lifecycle ---

  startSession(config: DebugSessionConfig): { success: boolean; commands: string[]; openocdConfig: string } {
    if (this.state !== 'idle' && this.state !== 'disconnected' && this.state !== 'error') {
      return { success: false, commands: [], openocdConfig: '' };
    }

    this.config = config;
    this.state = 'connecting';
    this.emit({
      type: 'state-change',
      timestamp: Date.now(),
      data: { from: 'idle', to: 'connecting' },
    });

    const commands = generateSessionStartCommands(config);
    const openocdConfig = config.probe.type === 'blackmagic' ? '' : generateOpenOcdConfig(config);

    this.state = 'connected';
    this.emit({
      type: 'state-change',
      timestamp: Date.now(),
      data: { from: 'connecting', to: 'connected' },
    });

    return { success: true, commands, openocdConfig };
  }

  stopSession(): boolean {
    if (this.state === 'idle') {
      return false;
    }

    const prevState = this.state;
    this.state = 'disconnected';
    this.callStack = [];
    this.variables.clear();
    this.emit({
      type: 'state-change',
      timestamp: Date.now(),
      data: { from: prevState, to: 'disconnected' },
    });

    return true;
  }

  resetSession(): boolean {
    if (this.state === 'idle' || this.state === 'disconnected') {
      return false;
    }

    this.state = 'halted';
    this.callStack = [];
    this.variables.clear();
    this.emit({
      type: 'state-change',
      timestamp: Date.now(),
      data: { action: 'reset', to: 'halted' },
    });

    return true;
  }

  // -- Execution control ---

  resume(): string | null {
    if (this.state !== 'halted' && this.state !== 'connected') {
      return null;
    }
    this.state = 'running';
    this.emit({
      type: 'state-change',
      timestamp: Date.now(),
      data: { to: 'running' },
    });
    return generateDebugCommand('continue');
  }

  halt(): string | null {
    if (this.state !== 'running') {
      return null;
    }
    this.state = 'halted';
    this.emit({
      type: 'state-change',
      timestamp: Date.now(),
      data: { to: 'halted' },
    });
    return generateDebugCommand('halt');
  }

  step(): string | null {
    if (this.state !== 'halted') {
      return null;
    }
    return generateDebugCommand('step');
  }

  stepOver(): string | null {
    if (this.state !== 'halted') {
      return null;
    }
    return generateDebugCommand('step-over');
  }

  stepOut(): string | null {
    if (this.state !== 'halted') {
      return null;
    }
    return generateDebugCommand('step-out');
  }

  // -- Breakpoints ---

  addBreakpoint(file: string, line: number, options?: {
    type?: BreakpointType;
    condition?: string;
    ignoreCount?: number;
  }): Breakpoint {
    const bp: Breakpoint = {
      id: this.nextBreakpointId++,
      file,
      line,
      type: options?.type ?? 'software',
      enabled: true,
      condition: options?.condition,
      hitCount: 0,
      ignoreCount: options?.ignoreCount ?? 0,
    };

    this.breakpoints.set(bp.id, bp);
    return bp;
  }

  removeBreakpoint(id: number): boolean {
    return this.breakpoints.delete(id);
  }

  toggleBreakpoint(id: number): boolean {
    const bp = this.breakpoints.get(id);
    if (!bp) {
      return false;
    }
    bp.enabled = !bp.enabled;
    return true;
  }

  updateBreakpointCondition(id: number, condition: string | undefined): boolean {
    const bp = this.breakpoints.get(id);
    if (!bp) {
      return false;
    }
    bp.condition = condition;
    return true;
  }

  clearAllBreakpoints(): void {
    this.breakpoints.clear();
    this.nextBreakpointId = 1;
  }

  recordBreakpointHit(id: number): void {
    const bp = this.breakpoints.get(id);
    if (bp) {
      bp.hitCount++;
      this.state = 'halted';
      this.emit({
        type: 'breakpoint-hit',
        timestamp: Date.now(),
        data: { breakpointId: id, file: bp.file, line: bp.line, hitCount: bp.hitCount },
      });
    }
  }

  // -- Watchpoints ---

  addWatchpoint(expression: string, access: WatchpointAccess, size: number = 4): Watchpoint {
    const wp: Watchpoint = {
      id: this.nextWatchpointId++,
      expression,
      access,
      enabled: true,
      size,
      hitCount: 0,
    };

    this.watchpoints.set(wp.id, wp);
    return wp;
  }

  removeWatchpoint(id: number): boolean {
    return this.watchpoints.delete(id);
  }

  toggleWatchpoint(id: number): boolean {
    const wp = this.watchpoints.get(id);
    if (!wp) {
      return false;
    }
    wp.enabled = !wp.enabled;
    return true;
  }

  recordWatchpointHit(id: number): void {
    const wp = this.watchpoints.get(id);
    if (wp) {
      wp.hitCount++;
      this.state = 'halted';
      this.emit({
        type: 'watchpoint-hit',
        timestamp: Date.now(),
        data: { watchpointId: id, expression: wp.expression, hitCount: wp.hitCount },
      });
    }
  }

  clearAllWatchpoints(): void {
    this.watchpoints.clear();
    this.nextWatchpointId = 1;
  }

  // -- Variable inspection ---

  inspectVariable(name: string, gdbOutput: string): InspectedVariable | null {
    const variable = parseVariableOutput(gdbOutput, name);
    if (variable) {
      this.variables.set(name, variable);
    }
    return variable;
  }

  setVariableFormat(name: string, format: VariableFormat): boolean {
    const variable = this.variables.get(name);
    if (!variable) {
      return false;
    }
    variable.format = format;
    return true;
  }

  removeVariable(name: string): boolean {
    return this.variables.delete(name);
  }

  // -- Call stack ---

  updateCallStack(gdbOutput: string): StackFrame[] {
    this.callStack = parseBacktrace(gdbOutput);
    return this.callStack;
  }

  // -- Peripheral registers ---

  readPeripheralRegister(peripheralName: string, registerName: string): PeripheralRegister | null {
    if (!this.config) {
      return null;
    }

    for (const periph of this.config.target.peripherals) {
      if (periph.name === peripheralName) {
        const reg = periph.registers.find((r) => r.name === registerName);
        return reg ?? null;
      }
    }

    return null;
  }

  listPeripherals(): PeripheralGroup[] {
    if (!this.config) {
      return [];
    }
    return this.config.target.peripherals;
  }

  updateRegisterValue(peripheralName: string, registerName: string, newValue: string): boolean {
    if (!this.config) {
      return false;
    }

    for (const periph of this.config.target.peripherals) {
      if (periph.name === peripheralName) {
        const reg = periph.registers.find((r) => r.name === registerName);
        if (reg) {
          reg.value = newValue;
          // Update field values from the new register value
          const numericValue = parseInt(newValue, 16) || parseInt(newValue, 10) || 0;
          for (const field of reg.fields) {
            const mask = ((1 << field.bitWidth) - 1) << field.bitOffset;
            field.value = (numericValue & mask) >>> field.bitOffset;
          }
          return true;
        }
      }
    }

    return false;
  }

  // -- Probe queries ---

  getProbeProfile(probeType: ProbeType): ProbeProfile {
    return PROBE_PROFILES[probeType];
  }

  listProbes(): ProbeProfile[] {
    return Object.values(PROBE_PROFILES);
  }

  isTransportSupported(probeType: ProbeType, transport: DebugTransport): boolean {
    return PROBE_PROFILES[probeType].transports.includes(transport);
  }

  // -- Generate all breakpoint/watchpoint commands ---

  generateAllBreakpointCommands(): string[] {
    const commands: string[] = [];
    Array.from(this.breakpoints.values())
      .filter((bp) => bp.enabled)
      .forEach((bp) => {
        commands.push(generateBreakpointCommand(bp));
      });
    return commands;
  }

  generateAllWatchpointCommands(): string[] {
    const commands: string[] = [];
    Array.from(this.watchpoints.values())
      .filter((wp) => wp.enabled)
      .forEach((wp) => {
        commands.push(generateWatchpointCommand(wp));
      });
    return commands;
  }

  // -- Error handling ---

  reportError(message: string, details?: Record<string, unknown>): void {
    this.state = 'error';
    this.emit({
      type: 'error',
      timestamp: Date.now(),
      data: { message, ...details },
    });
  }

  // -- Serialization ---

  exportBreakpoints(): { breakpoints: Breakpoint[]; watchpoints: Watchpoint[] } {
    return {
      breakpoints: Array.from(this.breakpoints.values()),
      watchpoints: Array.from(this.watchpoints.values()),
    };
  }

  importBreakpoints(data: { breakpoints: Breakpoint[]; watchpoints: Watchpoint[] }): void {
    this.breakpoints.clear();
    this.watchpoints.clear();

    for (const bp of data.breakpoints) {
      this.breakpoints.set(bp.id, bp);
      if (bp.id >= this.nextBreakpointId) {
        this.nextBreakpointId = bp.id + 1;
      }
    }

    for (const wp of data.watchpoints) {
      this.watchpoints.set(wp.id, wp);
      if (wp.id >= this.nextWatchpointId) {
        this.nextWatchpointId = wp.id + 1;
      }
    }
  }
}
