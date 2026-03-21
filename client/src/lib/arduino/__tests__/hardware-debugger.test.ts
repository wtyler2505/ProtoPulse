import { describe, it, expect, beforeEach } from 'vitest';
import {
  HardwareDebugManager,
  PROBE_PROFILES,
  COMMON_TARGETS,
  generateBreakpointCommand,
  generateWatchpointCommand,
  generateInspectCommand,
  generateMemoryReadCommand,
  generateSessionStartCommands,
  generateDebugCommand,
  generateOpenOcdConfig,
  parseBacktrace,
  parseVariableOutput,
} from '../hardware-debugger';
import type {
  ProbeType,
  DebugTransport,
  Breakpoint,
  Watchpoint,
  DebugSessionConfig,
  DebugEvent,
  VariableFormat,
  StackFrame,
} from '../hardware-debugger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<DebugSessionConfig>): DebugSessionConfig {
  return {
    probe: PROBE_PROFILES.stlink,
    target: COMMON_TARGETS[0], // STM32F103C8
    transport: 'swd',
    elfFile: 'build/firmware.elf',
    resetOnConnect: true,
    haltOnConnect: true,
    verifyFlash: false,
    gdbServerPort: 3333,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PROBE_PROFILES
// ---------------------------------------------------------------------------

describe('PROBE_PROFILES', () => {
  it('contains 6 probe types', () => {
    const keys = Object.keys(PROBE_PROFILES);
    expect(keys).toHaveLength(6);
    expect(keys).toContain('stlink');
    expect(keys).toContain('jlink');
    expect(keys).toContain('cmsis-dap');
    expect(keys).toContain('blackmagic');
    expect(keys).toContain('ftdi');
    expect(keys).toContain('esp-prog');
  });

  it('each probe has required fields', () => {
    for (const [key, profile] of Object.entries(PROBE_PROFILES)) {
      expect(profile.type).toBe(key);
      expect(profile.name.length).toBeGreaterThan(0);
      expect(profile.vendor.length).toBeGreaterThan(0);
      expect(profile.transports.length).toBeGreaterThan(0);
      expect(profile.transports).toContain(profile.defaultTransport);
      expect(profile.maxBreakpoints).toBeGreaterThan(0);
      expect(profile.maxWatchpoints).toBeGreaterThan(0);
      expect(profile.openocdInterface.length).toBeGreaterThan(0);
      expect(profile.description.length).toBeGreaterThan(0);
    }
  });

  it('ST-Link defaults to SWD with SWO support', () => {
    const stlink = PROBE_PROFILES.stlink;
    expect(stlink.defaultTransport).toBe('swd');
    expect(stlink.supportsSwo).toBe(true);
    expect(stlink.supportsRtt).toBe(false);
  });

  it('J-Link supports both SWO and RTT', () => {
    const jlink = PROBE_PROFILES.jlink;
    expect(jlink.supportsSwo).toBe(true);
    expect(jlink.supportsRtt).toBe(true);
    expect(jlink.maxBreakpoints).toBe(8);
  });

  it('Black Magic Probe has gdbServerPort 0 (native GDB)', () => {
    const bmp = PROBE_PROFILES.blackmagic;
    expect(bmp.gdbServerPort).toBe(0);
  });

  it('ESP-Prog only supports JTAG', () => {
    const esp = PROBE_PROFILES['esp-prog'];
    expect(esp.transports).toEqual(['jtag']);
    expect(esp.defaultTransport).toBe('jtag');
    expect(esp.maxBreakpoints).toBe(2);
  });

  it('FTDI defaults to JTAG', () => {
    const ftdi = PROBE_PROFILES.ftdi;
    expect(ftdi.defaultTransport).toBe('jtag');
  });

  it('CMSIS-DAP has adapter speed in extra config', () => {
    const cmsis = PROBE_PROFILES['cmsis-dap'];
    expect(cmsis.openocdExtraConfig.some((l) => l.includes('adapter speed'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// COMMON_TARGETS
// ---------------------------------------------------------------------------

describe('COMMON_TARGETS', () => {
  it('contains at least 3 targets', () => {
    expect(COMMON_TARGETS.length).toBeGreaterThanOrEqual(3);
  });

  it('each target has name, arch, openocdTarget, flash, RAM', () => {
    for (const target of COMMON_TARGETS) {
      expect(target.name.length).toBeGreaterThan(0);
      expect(target.arch.length).toBeGreaterThan(0);
      expect(target.openocdTarget.length).toBeGreaterThan(0);
      expect(target.flashSize).toBeGreaterThan(0);
      expect(target.ramSize).toBeGreaterThan(0);
    }
  });

  it('STM32F103 has GPIOA and RCC peripherals', () => {
    const stm32 = COMMON_TARGETS.find((t) => t.name === 'STM32F103C8');
    expect(stm32).toBeDefined();
    const peripheralNames = stm32!.peripherals.map((p) => p.name);
    expect(peripheralNames).toContain('GPIOA');
    expect(peripheralNames).toContain('RCC');
  });

  it('ESP32 has GPIO peripheral', () => {
    const esp32 = COMMON_TARGETS.find((t) => t.name === 'ESP32');
    expect(esp32).toBeDefined();
    expect(esp32!.arch).toBe('xtensa-lx6');
    expect(esp32!.peripherals.some((p) => p.name === 'GPIO')).toBe(true);
  });

  it('nRF52840 uses cortex-m4f architecture', () => {
    const nrf = COMMON_TARGETS.find((t) => t.name === 'nRF52840');
    expect(nrf).toBeDefined();
    expect(nrf!.arch).toBe('cortex-m4f');
  });

  it('peripheral registers have fields with valid access types', () => {
    for (const target of COMMON_TARGETS) {
      for (const periph of target.peripherals) {
        for (const reg of periph.registers) {
          for (const field of reg.fields) {
            expect(['read-only', 'write-only', 'read-write']).toContain(field.access);
            expect(field.bitWidth).toBeGreaterThan(0);
            expect(field.bitOffset).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// GDB Command Generation
// ---------------------------------------------------------------------------

describe('generateBreakpointCommand', () => {
  it('generates software breakpoint', () => {
    const bp: Breakpoint = {
      id: 1, file: 'main.c', line: 42, type: 'software',
      enabled: true, hitCount: 0, ignoreCount: 0,
    };
    expect(generateBreakpointCommand(bp)).toBe('break main.c:42');
  });

  it('generates hardware breakpoint', () => {
    const bp: Breakpoint = {
      id: 1, file: 'main.c', line: 10, type: 'hardware',
      enabled: true, hitCount: 0, ignoreCount: 0,
    };
    expect(generateBreakpointCommand(bp)).toBe('hbreak main.c:10');
  });

  it('adds condition', () => {
    const bp: Breakpoint = {
      id: 1, file: 'main.c', line: 42, type: 'software',
      enabled: true, condition: 'x > 5', hitCount: 0, ignoreCount: 0,
    };
    expect(generateBreakpointCommand(bp)).toContain('if x > 5');
  });

  it('adds ignore count', () => {
    const bp: Breakpoint = {
      id: 2, file: 'main.c', line: 42, type: 'software',
      enabled: true, hitCount: 0, ignoreCount: 10,
    };
    const cmd = generateBreakpointCommand(bp);
    expect(cmd).toContain('ignore 2 10');
  });

  it('adds disable command when not enabled', () => {
    const bp: Breakpoint = {
      id: 3, file: 'main.c', line: 42, type: 'software',
      enabled: false, hitCount: 0, ignoreCount: 0,
    };
    const cmd = generateBreakpointCommand(bp);
    expect(cmd).toContain('disable 3');
  });
});

describe('generateWatchpointCommand', () => {
  it('generates write watchpoint', () => {
    const wp: Watchpoint = { id: 1, expression: 'counter', access: 'write', enabled: true, size: 4, hitCount: 0 };
    expect(generateWatchpointCommand(wp)).toBe('watch counter');
  });

  it('generates read watchpoint', () => {
    const wp: Watchpoint = { id: 1, expression: 'flag', access: 'read', enabled: true, size: 1, hitCount: 0 };
    expect(generateWatchpointCommand(wp)).toBe('rwatch flag');
  });

  it('generates readwrite watchpoint', () => {
    const wp: Watchpoint = { id: 1, expression: 'buf', access: 'readwrite', enabled: true, size: 4, hitCount: 0 };
    expect(generateWatchpointCommand(wp)).toBe('awatch buf');
  });
});

describe('generateInspectCommand', () => {
  it('generates decimal inspect', () => {
    expect(generateInspectCommand('counter', 'decimal')).toBe('print/d counter');
  });

  it('generates hex inspect', () => {
    expect(generateInspectCommand('ptr', 'hex')).toBe('print/x ptr');
  });

  it('generates binary inspect', () => {
    expect(generateInspectCommand('flags', 'binary')).toBe('print/t flags');
  });

  it('generates octal inspect', () => {
    expect(generateInspectCommand('mode', 'octal')).toBe('print/o mode');
  });
});

describe('generateMemoryReadCommand', () => {
  it('generates hex memory read', () => {
    expect(generateMemoryReadCommand('0x20000000', 16)).toBe('x/16x 0x20000000');
  });

  it('generates decimal memory read', () => {
    expect(generateMemoryReadCommand('0x08000000', 4, 'decimal')).toBe('x/4d 0x08000000');
  });
});

describe('generateDebugCommand', () => {
  it('generates continue', () => {
    expect(generateDebugCommand('continue')).toBe('continue');
  });

  it('generates step', () => {
    expect(generateDebugCommand('step')).toBe('step');
  });

  it('generates step-over as next', () => {
    expect(generateDebugCommand('step-over')).toBe('next');
  });

  it('generates step-out as finish', () => {
    expect(generateDebugCommand('step-out')).toBe('finish');
  });

  it('generates halt as interrupt', () => {
    expect(generateDebugCommand('halt')).toBe('interrupt');
  });

  it('generates reset', () => {
    expect(generateDebugCommand('reset')).toBe('monitor reset halt');
  });

  it('generates backtrace', () => {
    expect(generateDebugCommand('backtrace')).toBe('backtrace full');
  });

  it('generates registers', () => {
    expect(generateDebugCommand('registers')).toBe('info registers');
  });
});

describe('generateSessionStartCommands', () => {
  it('generates standard OpenOCD session start', () => {
    const config = makeConfig();
    const cmds = generateSessionStartCommands(config);
    expect(cmds[0]).toBe('target extended-remote :3333');
    expect(cmds).toContain('file build/firmware.elf');
    expect(cmds).toContain('load');
  });

  it('generates Black Magic Probe session start with serial', () => {
    const config = makeConfig({ probe: PROBE_PROFILES.blackmagic });
    const cmds = generateSessionStartCommands(config);
    expect(cmds[0]).toBe('target extended-remote /dev/ttyBmpGdb');
    expect(cmds).toContain('monitor swdp_scan');
    expect(cmds).toContain('attach 1');
  });

  it('includes compare-sections when verifyFlash is true', () => {
    const config = makeConfig({ verifyFlash: true });
    const cmds = generateSessionStartCommands(config);
    expect(cmds).toContain('compare-sections');
  });

  it('uses reset run when haltOnConnect is false', () => {
    const config = makeConfig({ haltOnConnect: false });
    const cmds = generateSessionStartCommands(config);
    expect(cmds[cmds.length - 1]).toBe('monitor reset run');
  });

  it('uses custom gdbServerPort', () => {
    const config = makeConfig({ gdbServerPort: 4444 });
    const cmds = generateSessionStartCommands(config);
    expect(cmds[0]).toBe('target extended-remote :4444');
  });
});

// ---------------------------------------------------------------------------
// OpenOCD Config Generation
// ---------------------------------------------------------------------------

describe('generateOpenOcdConfig', () => {
  it('includes interface source', () => {
    const config = makeConfig();
    const ocd = generateOpenOcdConfig(config);
    expect(ocd).toContain('source [find interface/stlink.cfg]');
  });

  it('includes target source', () => {
    const config = makeConfig();
    const ocd = generateOpenOcdConfig(config);
    expect(ocd).toContain('source [find target/stm32f1x.cfg]');
  });

  it('includes gdb_port', () => {
    const config = makeConfig({ gdbServerPort: 4444 });
    const ocd = generateOpenOcdConfig(config);
    expect(ocd).toContain('gdb_port 4444');
  });

  it('includes reset halt event when resetOnConnect', () => {
    const config = makeConfig({ resetOnConnect: true });
    const ocd = generateOpenOcdConfig(config);
    expect(ocd).toContain('gdb-attach');
    expect(ocd).toContain('reset halt');
  });

  it('includes init command', () => {
    const config = makeConfig();
    const ocd = generateOpenOcdConfig(config);
    expect(ocd).toContain('init');
  });

  it('overrides transport when different from default', () => {
    const config = makeConfig({ transport: 'jtag' }); // stlink default is swd
    const ocd = generateOpenOcdConfig(config);
    expect(ocd).toContain('transport select jtag');
  });

  it('omits gdb_port when port is 0', () => {
    const config = makeConfig({
      probe: PROBE_PROFILES.blackmagic,
      gdbServerPort: 0,
    });
    const ocd = generateOpenOcdConfig(config);
    expect(ocd).not.toContain('gdb_port');
  });
});

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

describe('parseBacktrace', () => {
  it('parses a standard GDB backtrace', () => {
    const output = `#0  0x080012a4 in main () at src/main.c:42
#1  0x08000f10 in Reset_Handler () at startup.s:100`;
    const frames = parseBacktrace(output);
    expect(frames).toHaveLength(2);
    expect(frames[0].level).toBe(0);
    expect(frames[0].address).toBe('0x080012a4');
    expect(frames[0].function).toBe('main');
    expect(frames[0].file).toBe('src/main.c');
    expect(frames[0].line).toBe(42);
  });

  it('parses frames with function arguments', () => {
    const output = '#0  0x08001000 in process (x=42, y=100) at lib.c:10';
    const frames = parseBacktrace(output);
    expect(frames).toHaveLength(1);
    expect(frames[0].args).toEqual({ x: '42', y: '100' });
  });

  it('returns empty array for non-backtrace output', () => {
    expect(parseBacktrace('some random output')).toHaveLength(0);
  });

  it('handles frames without file info', () => {
    const output = '#0  0x08001000 in __libc_start ()';
    const frames = parseBacktrace(output);
    expect(frames).toHaveLength(1);
    expect(frames[0].file).toBe('<unknown>');
    expect(frames[0].line).toBe(0);
  });
});

describe('parseVariableOutput', () => {
  it('parses scalar value', () => {
    const result = parseVariableOutput('$1 = 42', 'counter');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('counter');
    expect(result!.value).toBe('42');
    expect(result!.type).toBe('scalar');
  });

  it('parses struct value', () => {
    const result = parseVariableOutput('$1 = {x = 10, y = 20}', 'point');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('struct');
    expect(result!.children).toHaveLength(2);
    expect(result!.children![0].name).toBe('point.x');
    expect(result!.children![0].value).toBe('10');
    expect(result!.children![1].name).toBe('point.y');
    expect(result!.children![1].value).toBe('20');
  });

  it('parses hex value', () => {
    const result = parseVariableOutput('$1 = 0xff', 'reg');
    expect(result).not.toBeNull();
    expect(result!.value).toBe('0xff');
  });

  it('returns null for invalid output', () => {
    expect(parseVariableOutput('error: no such variable', 'x')).toBeNull();
  });

  it('handles empty struct', () => {
    const result = parseVariableOutput('$1 = {}', 'empty');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('struct');
    expect(result!.children).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// HardwareDebugManager — singleton
// ---------------------------------------------------------------------------

describe('HardwareDebugManager', () => {
  let mgr: HardwareDebugManager;

  beforeEach(() => {
    HardwareDebugManager.resetInstance();
    mgr = HardwareDebugManager.getInstance();
  });

  it('is a singleton', () => {
    const mgr2 = HardwareDebugManager.getInstance();
    expect(mgr).toBe(mgr2);
  });

  it('starts in idle state', () => {
    expect(mgr.getState()).toBe('idle');
  });

  // -- Session lifecycle ---

  describe('session lifecycle', () => {
    it('transitions idle → connecting → connected on startSession', () => {
      const events: DebugEvent[] = [];
      mgr.subscribe((e) => events.push(e));

      const result = mgr.startSession(makeConfig());
      expect(result.success).toBe(true);
      expect(result.commands.length).toBeGreaterThan(0);
      expect(mgr.getState()).toBe('connected');
      expect(events).toHaveLength(2);
      expect(events[0].data.to).toBe('connecting');
      expect(events[1].data.to).toBe('connected');
    });

    it('returns openocdConfig for non-BMP probes', () => {
      const result = mgr.startSession(makeConfig());
      expect(result.openocdConfig.length).toBeGreaterThan(0);
      expect(result.openocdConfig).toContain('stlink');
    });

    it('returns empty openocdConfig for Black Magic Probe', () => {
      const result = mgr.startSession(makeConfig({ probe: PROBE_PROFILES.blackmagic }));
      expect(result.openocdConfig).toBe('');
    });

    it('rejects startSession when already connected', () => {
      mgr.startSession(makeConfig());
      const result = mgr.startSession(makeConfig());
      expect(result.success).toBe(false);
    });

    it('stopSession transitions to disconnected', () => {
      mgr.startSession(makeConfig());
      expect(mgr.stopSession()).toBe(true);
      expect(mgr.getState()).toBe('disconnected');
    });

    it('stopSession returns false when idle', () => {
      expect(mgr.stopSession()).toBe(false);
    });

    it('resetSession halts and clears state', () => {
      mgr.startSession(makeConfig());
      mgr.resume();
      expect(mgr.resetSession()).toBe(true);
      expect(mgr.getState()).toBe('halted');
    });

    it('resetSession returns false when idle', () => {
      expect(mgr.resetSession()).toBe(false);
    });

    it('can restart after disconnect', () => {
      mgr.startSession(makeConfig());
      mgr.stopSession();
      const result = mgr.startSession(makeConfig());
      expect(result.success).toBe(true);
    });

    it('can restart after error', () => {
      mgr.startSession(makeConfig());
      mgr.reportError('test error');
      const result = mgr.startSession(makeConfig());
      expect(result.success).toBe(true);
    });
  });

  // -- Execution control ---

  describe('execution control', () => {
    beforeEach(() => {
      mgr.startSession(makeConfig());
    });

    it('resume returns continue command from connected state', () => {
      const cmd = mgr.resume();
      expect(cmd).toBe('continue');
      expect(mgr.getState()).toBe('running');
    });

    it('halt returns interrupt command from running state', () => {
      mgr.resume();
      const cmd = mgr.halt();
      expect(cmd).toBe('interrupt');
      expect(mgr.getState()).toBe('halted');
    });

    it('halt returns null when not running', () => {
      expect(mgr.halt()).toBeNull();
    });

    it('step returns step command when halted', () => {
      mgr.resume();
      mgr.halt();
      expect(mgr.step()).toBe('step');
    });

    it('step returns null when not halted', () => {
      mgr.resume();
      expect(mgr.step()).toBeNull();
    });

    it('stepOver returns next command', () => {
      mgr.resume();
      mgr.halt();
      expect(mgr.stepOver()).toBe('next');
    });

    it('stepOut returns finish command', () => {
      mgr.resume();
      mgr.halt();
      expect(mgr.stepOut()).toBe('finish');
    });

    it('resume returns null when idle', () => {
      HardwareDebugManager.resetInstance();
      mgr = HardwareDebugManager.getInstance();
      expect(mgr.resume()).toBeNull();
    });
  });

  // -- Breakpoints ---

  describe('breakpoints', () => {
    it('adds a breakpoint with defaults', () => {
      const bp = mgr.addBreakpoint('main.c', 42);
      expect(bp.id).toBe(1);
      expect(bp.file).toBe('main.c');
      expect(bp.line).toBe(42);
      expect(bp.type).toBe('software');
      expect(bp.enabled).toBe(true);
      expect(bp.hitCount).toBe(0);
    });

    it('adds a hardware breakpoint with condition', () => {
      const bp = mgr.addBreakpoint('main.c', 10, {
        type: 'hardware',
        condition: 'i == 99',
      });
      expect(bp.type).toBe('hardware');
      expect(bp.condition).toBe('i == 99');
    });

    it('assigns incrementing IDs', () => {
      const bp1 = mgr.addBreakpoint('a.c', 1);
      const bp2 = mgr.addBreakpoint('b.c', 2);
      expect(bp2.id).toBe(bp1.id + 1);
    });

    it('removes a breakpoint', () => {
      const bp = mgr.addBreakpoint('main.c', 42);
      expect(mgr.removeBreakpoint(bp.id)).toBe(true);
      expect(mgr.getBreakpoints()).toHaveLength(0);
    });

    it('removeBreakpoint returns false for unknown ID', () => {
      expect(mgr.removeBreakpoint(999)).toBe(false);
    });

    it('toggles a breakpoint', () => {
      const bp = mgr.addBreakpoint('main.c', 42);
      expect(mgr.toggleBreakpoint(bp.id)).toBe(true);
      expect(mgr.getBreakpoints()[0].enabled).toBe(false);
      mgr.toggleBreakpoint(bp.id);
      expect(mgr.getBreakpoints()[0].enabled).toBe(true);
    });

    it('toggleBreakpoint returns false for unknown ID', () => {
      expect(mgr.toggleBreakpoint(999)).toBe(false);
    });

    it('updates breakpoint condition', () => {
      const bp = mgr.addBreakpoint('main.c', 42);
      mgr.updateBreakpointCondition(bp.id, 'x > 10');
      expect(mgr.getBreakpoints()[0].condition).toBe('x > 10');
    });

    it('updateBreakpointCondition returns false for unknown ID', () => {
      expect(mgr.updateBreakpointCondition(999, 'x')).toBe(false);
    });

    it('clears all breakpoints', () => {
      mgr.addBreakpoint('a.c', 1);
      mgr.addBreakpoint('b.c', 2);
      mgr.clearAllBreakpoints();
      expect(mgr.getBreakpoints()).toHaveLength(0);
    });

    it('records breakpoint hit and emits event', () => {
      mgr.startSession(makeConfig());
      mgr.resume();
      const bp = mgr.addBreakpoint('main.c', 42);

      const events: DebugEvent[] = [];
      mgr.subscribe((e) => events.push(e));

      mgr.recordBreakpointHit(bp.id);
      expect(mgr.getBreakpoints()[0].hitCount).toBe(1);
      expect(mgr.getState()).toBe('halted');
      expect(events[0].type).toBe('breakpoint-hit');
    });

    it('generates all breakpoint commands (enabled only)', () => {
      mgr.addBreakpoint('main.c', 1);
      const bp2 = mgr.addBreakpoint('main.c', 2);
      mgr.toggleBreakpoint(bp2.id);
      mgr.addBreakpoint('main.c', 3);

      const cmds = mgr.generateAllBreakpointCommands();
      expect(cmds).toHaveLength(2);
    });

    it('adds breakpoint with ignoreCount', () => {
      const bp = mgr.addBreakpoint('main.c', 10, { ignoreCount: 5 });
      expect(bp.ignoreCount).toBe(5);
    });
  });

  // -- Watchpoints ---

  describe('watchpoints', () => {
    it('adds a write watchpoint', () => {
      const wp = mgr.addWatchpoint('counter', 'write');
      expect(wp.id).toBe(1);
      expect(wp.expression).toBe('counter');
      expect(wp.access).toBe('write');
      expect(wp.size).toBe(4);
      expect(wp.enabled).toBe(true);
    });

    it('adds watchpoint with custom size', () => {
      const wp = mgr.addWatchpoint('byte_val', 'read', 1);
      expect(wp.size).toBe(1);
    });

    it('removes a watchpoint', () => {
      const wp = mgr.addWatchpoint('x', 'write');
      expect(mgr.removeWatchpoint(wp.id)).toBe(true);
      expect(mgr.getWatchpoints()).toHaveLength(0);
    });

    it('removeWatchpoint returns false for unknown ID', () => {
      expect(mgr.removeWatchpoint(999)).toBe(false);
    });

    it('toggles a watchpoint', () => {
      const wp = mgr.addWatchpoint('x', 'write');
      mgr.toggleWatchpoint(wp.id);
      expect(mgr.getWatchpoints()[0].enabled).toBe(false);
    });

    it('toggleWatchpoint returns false for unknown ID', () => {
      expect(mgr.toggleWatchpoint(999)).toBe(false);
    });

    it('records watchpoint hit and emits event', () => {
      mgr.startSession(makeConfig());
      mgr.resume();
      const wp = mgr.addWatchpoint('flag', 'write');

      const events: DebugEvent[] = [];
      mgr.subscribe((e) => events.push(e));

      mgr.recordWatchpointHit(wp.id);
      expect(mgr.getWatchpoints()[0].hitCount).toBe(1);
      expect(mgr.getState()).toBe('halted');
      expect(events[0].type).toBe('watchpoint-hit');
    });

    it('clears all watchpoints', () => {
      mgr.addWatchpoint('a', 'write');
      mgr.addWatchpoint('b', 'read');
      mgr.clearAllWatchpoints();
      expect(mgr.getWatchpoints()).toHaveLength(0);
    });

    it('generates all watchpoint commands (enabled only)', () => {
      mgr.addWatchpoint('a', 'write');
      const wp2 = mgr.addWatchpoint('b', 'read');
      mgr.toggleWatchpoint(wp2.id);
      mgr.addWatchpoint('c', 'readwrite');

      const cmds = mgr.generateAllWatchpointCommands();
      expect(cmds).toHaveLength(2);
    });
  });

  // -- Variable inspection ---

  describe('variable inspection', () => {
    it('inspects a variable and stores it', () => {
      const result = mgr.inspectVariable('counter', '$1 = 42');
      expect(result).not.toBeNull();
      expect(mgr.getVariables()).toHaveLength(1);
      expect(mgr.getVariables()[0].name).toBe('counter');
    });

    it('returns null for invalid GDB output', () => {
      const result = mgr.inspectVariable('x', 'error');
      expect(result).toBeNull();
    });

    it('sets variable format', () => {
      mgr.inspectVariable('reg', '$1 = 255');
      expect(mgr.setVariableFormat('reg', 'hex')).toBe(true);
      expect(mgr.getVariables()[0].format).toBe('hex');
    });

    it('setVariableFormat returns false for unknown variable', () => {
      expect(mgr.setVariableFormat('unknown', 'hex')).toBe(false);
    });

    it('removes a variable', () => {
      mgr.inspectVariable('x', '$1 = 1');
      expect(mgr.removeVariable('x')).toBe(true);
      expect(mgr.getVariables()).toHaveLength(0);
    });

    it('removeVariable returns false for unknown variable', () => {
      expect(mgr.removeVariable('unknown')).toBe(false);
    });
  });

  // -- Call stack ---

  describe('call stack', () => {
    it('updates call stack from GDB output', () => {
      const output = '#0  0x08001000 in main () at main.c:10\n#1  0x08000100 in _start ()';
      const frames = mgr.updateCallStack(output);
      expect(frames).toHaveLength(2);
      expect(mgr.getCallStack()).toHaveLength(2);
    });

    it('clears call stack on stop', () => {
      mgr.startSession(makeConfig());
      mgr.updateCallStack('#0  0x08001000 in main () at main.c:10');
      mgr.stopSession();
      expect(mgr.getCallStack()).toHaveLength(0);
    });
  });

  // -- Peripheral registers ---

  describe('peripheral registers', () => {
    beforeEach(() => {
      mgr.startSession(makeConfig());
    });

    it('reads a peripheral register', () => {
      const reg = mgr.readPeripheralRegister('GPIOA', 'CRL');
      expect(reg).not.toBeNull();
      expect(reg!.name).toBe('CRL');
      expect(reg!.address).toBe('0x40010800');
    });

    it('returns null for unknown peripheral', () => {
      expect(mgr.readPeripheralRegister('UNKNOWN', 'CRL')).toBeNull();
    });

    it('returns null for unknown register', () => {
      expect(mgr.readPeripheralRegister('GPIOA', 'UNKNOWN')).toBeNull();
    });

    it('returns null when no session', () => {
      HardwareDebugManager.resetInstance();
      mgr = HardwareDebugManager.getInstance();
      expect(mgr.readPeripheralRegister('GPIOA', 'CRL')).toBeNull();
    });

    it('lists peripherals', () => {
      const periphs = mgr.listPeripherals();
      expect(periphs.length).toBeGreaterThan(0);
      expect(periphs.map((p) => p.name)).toContain('GPIOA');
    });

    it('lists empty when no session', () => {
      HardwareDebugManager.resetInstance();
      mgr = HardwareDebugManager.getInstance();
      expect(mgr.listPeripherals()).toHaveLength(0);
    });

    it('updates register value and recalculates fields', () => {
      const result = mgr.updateRegisterValue('GPIOA', 'ODR', '0x0001');
      expect(result).toBe(true);
      const reg = mgr.readPeripheralRegister('GPIOA', 'ODR');
      expect(reg!.value).toBe('0x0001');
      expect(reg!.fields[0].value).toBe(1);
    });

    it('updateRegisterValue returns false for unknown peripheral', () => {
      expect(mgr.updateRegisterValue('UNKNOWN', 'ODR', '0x0001')).toBe(false);
    });

    it('updateRegisterValue returns false for unknown register', () => {
      expect(mgr.updateRegisterValue('GPIOA', 'UNKNOWN', '0x0001')).toBe(false);
    });

    it('updateRegisterValue returns false with no session', () => {
      HardwareDebugManager.resetInstance();
      mgr = HardwareDebugManager.getInstance();
      expect(mgr.updateRegisterValue('GPIOA', 'ODR', '0x0001')).toBe(false);
    });
  });

  // -- Probe queries ---

  describe('probe queries', () => {
    it('getProbeProfile returns the correct profile', () => {
      expect(mgr.getProbeProfile('jlink').name).toBe('SEGGER J-Link');
    });

    it('listProbes returns all 6 probes', () => {
      expect(mgr.listProbes()).toHaveLength(6);
    });

    it('isTransportSupported returns true for valid transport', () => {
      expect(mgr.isTransportSupported('stlink', 'swd')).toBe(true);
      expect(mgr.isTransportSupported('stlink', 'jtag')).toBe(true);
    });

    it('isTransportSupported returns false for unsupported transport', () => {
      expect(mgr.isTransportSupported('esp-prog', 'swd')).toBe(false);
    });
  });

  // -- Subscribe / events ---

  describe('subscribe', () => {
    it('notifies listeners on events', () => {
      const events: DebugEvent[] = [];
      mgr.subscribe((e) => events.push(e));
      mgr.startSession(makeConfig());
      expect(events.length).toBeGreaterThan(0);
    });

    it('unsubscribe stops notifications', () => {
      const events: DebugEvent[] = [];
      const unsub = mgr.subscribe((e) => events.push(e));
      unsub();
      mgr.startSession(makeConfig());
      expect(events).toHaveLength(0);
    });

    it('getEventLog returns all events', () => {
      mgr.startSession(makeConfig());
      expect(mgr.getEventLog().length).toBeGreaterThan(0);
    });
  });

  // -- Error handling ---

  describe('error handling', () => {
    it('reportError sets state to error and emits event', () => {
      mgr.startSession(makeConfig());
      const events: DebugEvent[] = [];
      mgr.subscribe((e) => events.push(e));

      mgr.reportError('Connection lost', { port: '/dev/ttyACM0' });
      expect(mgr.getState()).toBe('error');
      const errEvent = events.find((e) => e.type === 'error');
      expect(errEvent).toBeDefined();
      expect(errEvent!.data.message).toBe('Connection lost');
      expect(errEvent!.data.port).toBe('/dev/ttyACM0');
    });
  });

  // -- Serialization ---

  describe('serialization', () => {
    it('exports breakpoints and watchpoints', () => {
      mgr.addBreakpoint('main.c', 42);
      mgr.addBreakpoint('lib.c', 10, { condition: 'x > 0' });
      mgr.addWatchpoint('counter', 'write');

      const exported = mgr.exportBreakpoints();
      expect(exported.breakpoints).toHaveLength(2);
      expect(exported.watchpoints).toHaveLength(1);
    });

    it('imports breakpoints and watchpoints', () => {
      const data = {
        breakpoints: [
          { id: 5, file: 'a.c', line: 1, type: 'software' as const, enabled: true, hitCount: 0, ignoreCount: 0 },
          { id: 10, file: 'b.c', line: 2, type: 'hardware' as const, enabled: false, hitCount: 3, ignoreCount: 0 },
        ],
        watchpoints: [
          { id: 7, expression: 'buf', access: 'readwrite' as const, enabled: true, size: 4, hitCount: 1 },
        ],
      };

      mgr.importBreakpoints(data);
      expect(mgr.getBreakpoints()).toHaveLength(2);
      expect(mgr.getWatchpoints()).toHaveLength(1);
    });

    it('import resets ID counters properly', () => {
      mgr.importBreakpoints({
        breakpoints: [
          { id: 5, file: 'a.c', line: 1, type: 'software', enabled: true, hitCount: 0, ignoreCount: 0 },
        ],
        watchpoints: [],
      });

      const newBp = mgr.addBreakpoint('new.c', 99);
      expect(newBp.id).toBeGreaterThan(5);
    });
  });

  // -- getConfig ---

  describe('getConfig', () => {
    it('returns null when no session', () => {
      expect(mgr.getConfig()).toBeNull();
    });

    it('returns config after session start', () => {
      const config = makeConfig();
      mgr.startSession(config);
      expect(mgr.getConfig()).toBe(config);
    });
  });
});
