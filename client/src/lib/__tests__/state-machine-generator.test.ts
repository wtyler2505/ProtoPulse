import { describe, it, expect } from 'vitest';
import {
  generateStateMachineCode,
  validateSpec,
  formatStateTable,
  ROBOT_PRESETS,
} from '../state-machine-generator';
import type { State, Transition, StateMachineSpec, ValidationError } from '../state-machine-generator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpec(overrides?: Partial<StateMachineSpec>): StateMachineSpec {
  return {
    name: 'TestMachine',
    states: [
      { id: 'IDLE', name: 'Idle' },
      { id: 'RUNNING', name: 'Running' },
    ],
    transitions: [
      { from: 'IDLE', to: 'RUNNING', event: 'START' },
      { from: 'RUNNING', to: 'IDLE', event: 'STOP' },
    ],
    initialState: 'IDLE',
    ...overrides,
  };
}

function makeState(overrides?: Partial<State>): State {
  return { id: 'S1', name: 'State One', ...overrides };
}

function makeTransition(overrides?: Partial<Transition>): Transition {
  return { from: 'IDLE', to: 'RUNNING', event: 'GO', ...overrides };
}

function errorsOnly(errors: ValidationError[]): ValidationError[] {
  return errors.filter((e) => e.level === 'error');
}

function warningsOnly(errors: ValidationError[]): ValidationError[] {
  return errors.filter((e) => e.level === 'warning');
}

// ---------------------------------------------------------------------------
// validateSpec
// ---------------------------------------------------------------------------

describe('validateSpec', () => {
  it('returns no errors for a valid minimal spec', () => {
    const spec = makeSpec();
    const result = validateSpec(spec);
    expect(errorsOnly(result)).toHaveLength(0);
  });

  it('returns error when name is empty', () => {
    const spec = makeSpec({ name: '' });
    const result = validateSpec(spec);
    expect(errorsOnly(result).some((e) => e.message.includes('name is required'))).toBe(true);
  });

  it('returns error when states array is empty', () => {
    const spec = makeSpec({ states: [], transitions: [], initialState: '' });
    const result = validateSpec(spec);
    expect(errorsOnly(result).some((e) => e.message.includes('At least one state'))).toBe(true);
  });

  it('returns error for duplicate state ids', () => {
    const spec = makeSpec({
      states: [
        { id: 'IDLE', name: 'Idle' },
        { id: 'IDLE', name: 'Idle 2' },
      ],
    });
    const result = validateSpec(spec);
    expect(errorsOnly(result).some((e) => e.message.includes('Duplicate state id'))).toBe(true);
  });

  it('returns error for state with empty id', () => {
    const spec = makeSpec({
      states: [
        { id: '', name: 'No ID' },
        { id: 'RUNNING', name: 'Running' },
      ],
    });
    const result = validateSpec(spec);
    expect(errorsOnly(result).some((e) => e.message.includes('non-empty id'))).toBe(true);
  });

  it('returns error for state with empty name', () => {
    const spec = makeSpec({
      states: [
        { id: 'IDLE', name: '' },
        { id: 'RUNNING', name: 'Running' },
      ],
    });
    const result = validateSpec(spec);
    expect(errorsOnly(result).some((e) => e.message.includes('non-empty name'))).toBe(true);
  });

  it('returns error for negative timeout', () => {
    const spec = makeSpec({
      states: [
        { id: 'IDLE', name: 'Idle', timeout: -100 },
        { id: 'RUNNING', name: 'Running' },
      ],
    });
    const result = validateSpec(spec);
    expect(errorsOnly(result).some((e) => e.message.includes('invalid timeout'))).toBe(true);
  });

  it('returns error for zero timeout', () => {
    const spec = makeSpec({
      states: [
        { id: 'IDLE', name: 'Idle', timeout: 0 },
        { id: 'RUNNING', name: 'Running' },
      ],
    });
    const result = validateSpec(spec);
    expect(errorsOnly(result).some((e) => e.message.includes('invalid timeout'))).toBe(true);
  });

  it('returns error for non-finite timeout', () => {
    const spec = makeSpec({
      states: [
        { id: 'IDLE', name: 'Idle', timeout: Infinity },
        { id: 'RUNNING', name: 'Running' },
      ],
    });
    const result = validateSpec(spec);
    expect(errorsOnly(result).some((e) => e.message.includes('invalid timeout'))).toBe(true);
  });

  it('returns error when initialState is empty', () => {
    const spec = makeSpec({ initialState: '' });
    const result = validateSpec(spec);
    expect(errorsOnly(result).some((e) => e.message.includes('Initial state is required'))).toBe(true);
  });

  it('returns error when initialState references unknown state', () => {
    const spec = makeSpec({ initialState: 'NONEXISTENT' });
    const result = validateSpec(spec);
    expect(errorsOnly(result).some((e) => e.message.includes('does not match any state'))).toBe(true);
  });

  it('returns error for transition from unknown state', () => {
    const spec = makeSpec({
      transitions: [{ from: 'NOWHERE', to: 'IDLE', event: 'GO' }],
    });
    const result = validateSpec(spec);
    expect(errorsOnly(result).some((e) => e.message.includes('unknown state: "NOWHERE"'))).toBe(true);
  });

  it('returns error for transition to unknown state', () => {
    const spec = makeSpec({
      transitions: [{ from: 'IDLE', to: 'NOWHERE', event: 'GO' }],
    });
    const result = validateSpec(spec);
    expect(errorsOnly(result).some((e) => e.message.includes('unknown state: "NOWHERE"'))).toBe(true);
  });

  it('returns error for transition with empty event', () => {
    const spec = makeSpec({
      transitions: [{ from: 'IDLE', to: 'RUNNING', event: '' }],
    });
    const result = validateSpec(spec);
    expect(errorsOnly(result).some((e) => e.message.includes('no event'))).toBe(true);
  });

  it('returns warning for unreachable state', () => {
    const spec = makeSpec({
      states: [
        { id: 'IDLE', name: 'Idle' },
        { id: 'RUNNING', name: 'Running' },
        { id: 'ISOLATED', name: 'Isolated' },
      ],
    });
    const result = validateSpec(spec);
    expect(warningsOnly(result).some((e) => e.message.includes('"ISOLATED" is unreachable'))).toBe(true);
  });

  it('returns warning for dead-end state', () => {
    const spec = makeSpec({
      states: [
        { id: 'IDLE', name: 'Idle' },
        { id: 'RUNNING', name: 'Running' },
        { id: 'DONE', name: 'Done' },
      ],
      transitions: [
        { from: 'IDLE', to: 'RUNNING', event: 'START' },
        { from: 'RUNNING', to: 'DONE', event: 'FINISH' },
      ],
    });
    const result = validateSpec(spec);
    expect(warningsOnly(result).some((e) => e.message.includes('"DONE"') && e.message.includes('dead-end'))).toBe(
      true,
    );
  });

  it('accepts valid timeout', () => {
    const spec = makeSpec({
      states: [
        { id: 'IDLE', name: 'Idle', timeout: 1000 },
        { id: 'RUNNING', name: 'Running' },
      ],
    });
    const result = validateSpec(spec);
    expect(errorsOnly(result)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// generateStateMachineCode
// ---------------------------------------------------------------------------

describe('generateStateMachineCode', () => {
  it('generates code containing the state enum', () => {
    const code = generateStateMachineCode(makeSpec());
    expect(code).toContain('enum TestMachineState');
    expect(code).toContain('STATE_IDLE');
    expect(code).toContain('STATE_RUNNING');
  });

  it('generates code containing the event enum', () => {
    const code = generateStateMachineCode(makeSpec());
    expect(code).toContain('enum TestMachineEvent');
    expect(code).toContain('EVT_START');
    expect(code).toContain('EVT_STOP');
  });

  it('initializes state variable to initial state', () => {
    const code = generateStateMachineCode(makeSpec());
    expect(code).toContain('testmachine_state = STATE_IDLE');
  });

  it('generates entry action function', () => {
    const spec = makeSpec({
      states: [
        { id: 'IDLE', name: 'Idle', entryAction: 'digitalWrite(LED, LOW);' },
        { id: 'RUNNING', name: 'Running' },
      ],
    });
    const code = generateStateMachineCode(spec);
    expect(code).toContain('void testmachine_enter(');
    expect(code).toContain('digitalWrite(LED, LOW);');
  });

  it('generates exit action function', () => {
    const spec = makeSpec({
      states: [
        { id: 'IDLE', name: 'Idle', exitAction: 'Serial.println("leaving idle");' },
        { id: 'RUNNING', name: 'Running' },
      ],
    });
    const code = generateStateMachineCode(spec);
    expect(code).toContain('void testmachine_exit(');
    expect(code).toContain('Serial.println("leaving idle");');
  });

  it('generates transition function with switch/case', () => {
    const code = generateStateMachineCode(makeSpec());
    expect(code).toContain('void testmachine_transition(');
    expect(code).toContain('case STATE_IDLE:');
    expect(code).toContain('case STATE_RUNNING:');
    expect(code).toContain('EVT_START');
  });

  it('includes guard condition in transition', () => {
    const spec = makeSpec({
      transitions: [
        { from: 'IDLE', to: 'RUNNING', event: 'START', guard: 'sensorReady' },
        { from: 'RUNNING', to: 'IDLE', event: 'STOP' },
      ],
    });
    const code = generateStateMachineCode(spec);
    expect(code).toContain('(sensorReady)');
  });

  it('generates timeout tracking when states have timeouts', () => {
    const spec = makeSpec({
      states: [
        { id: 'IDLE', name: 'Idle', timeout: 2000 },
        { id: 'RUNNING', name: 'Running' },
      ],
    });
    const code = generateStateMachineCode(spec);
    expect(code).toContain('state_entered_at');
    expect(code).toContain('millis()');
    expect(code).toContain('2000UL');
    expect(code).toContain('EVT_TIMEOUT');
  });

  it('does not generate timeout tracking when no states have timeouts', () => {
    const spec = makeSpec();
    const code = generateStateMachineCode(spec);
    expect(code).not.toContain('state_entered_at');
  });

  it('generates setup() and loop() functions', () => {
    const code = generateStateMachineCode(makeSpec());
    expect(code).toContain('void setup()');
    expect(code).toContain('Serial.begin(9600)');
    expect(code).toContain('void loop()');
    expect(code).toContain('testmachine_update()');
  });

  it('generates header comment with machine name', () => {
    const code = generateStateMachineCode(makeSpec());
    expect(code).toContain('// State Machine: TestMachine');
    expect(code).toContain('// Generated by ProtoPulse');
  });

  it('generates header comment with state and transition counts', () => {
    const code = generateStateMachineCode(makeSpec());
    expect(code).toContain('States: 2');
    expect(code).toContain('Transitions: 2');
  });

  it('calls exit then enter on state change', () => {
    const code = generateStateMachineCode(makeSpec());
    const exitIdx = code.indexOf('testmachine_exit(testmachine_state)');
    const enterIdx = code.indexOf('testmachine_enter(next)');
    expect(exitIdx).toBeGreaterThan(-1);
    expect(enterIdx).toBeGreaterThan(-1);
    expect(exitIdx).toBeLessThan(enterIdx);
  });

  it('handles multi-line entry actions', () => {
    const spec = makeSpec({
      states: [
        {
          id: 'IDLE',
          name: 'Idle',
          entryAction: 'setMotors(0, 0);\ndigitalWrite(LED, HIGH);',
        },
        { id: 'RUNNING', name: 'Running' },
      ],
    });
    const code = generateStateMachineCode(spec);
    expect(code).toContain('setMotors(0, 0);');
    expect(code).toContain('digitalWrite(LED, HIGH);');
  });

  it('sanitizes special characters in identifiers', () => {
    const spec = makeSpec({
      name: 'My-Machine',
      states: [
        { id: 'STATE-A', name: 'State A' },
        { id: 'STATE_B', name: 'State B' },
      ],
      transitions: [{ from: 'STATE-A', to: 'STATE_B', event: 'GO-NOW' }],
      initialState: 'STATE-A',
    });
    const code = generateStateMachineCode(spec);
    expect(code).toContain('STATE_STATE_A');
    expect(code).toContain('STATE_STATE_B');
    expect(code).toContain('EVT_GO_NOW');
    expect(code).toContain('My_MachineState');
  });

  it('handles states with no outgoing transitions gracefully', () => {
    const spec = makeSpec({
      states: [
        { id: 'IDLE', name: 'Idle' },
        { id: 'DONE', name: 'Done' },
      ],
      transitions: [{ from: 'IDLE', to: 'DONE', event: 'FINISH' }],
    });
    const code = generateStateMachineCode(spec);
    // Should still compile — DONE case just has `break;`
    expect(code).toContain('case STATE_DONE:');
    expect(code).toContain('break;');
  });
});

// ---------------------------------------------------------------------------
// formatStateTable
// ---------------------------------------------------------------------------

describe('formatStateTable', () => {
  it('includes machine name and initial state in header', () => {
    const table = formatStateTable(makeSpec());
    expect(table).toContain('State Machine: TestMachine');
    expect(table).toContain('Initial State: IDLE');
  });

  it('includes all state ids', () => {
    const table = formatStateTable(makeSpec());
    expect(table).toContain('IDLE');
    expect(table).toContain('RUNNING');
  });

  it('includes all state names', () => {
    const table = formatStateTable(makeSpec());
    expect(table).toContain('Idle');
    expect(table).toContain('Running');
  });

  it('includes transition info', () => {
    const table = formatStateTable(makeSpec());
    expect(table).toContain('START');
    expect(table).toContain('STOP');
  });

  it('shows dash for missing optional fields', () => {
    const table = formatStateTable(makeSpec());
    // States without entry/exit/timeout should show "-"
    expect(table).toContain('-');
  });

  it('shows guard in transition table', () => {
    const spec = makeSpec({
      transitions: [
        { from: 'IDLE', to: 'RUNNING', event: 'START', guard: 'isReady' },
        { from: 'RUNNING', to: 'IDLE', event: 'STOP' },
      ],
    });
    const table = formatStateTable(spec);
    expect(table).toContain('isReady');
  });

  it('shows timeout value', () => {
    const spec = makeSpec({
      states: [
        { id: 'IDLE', name: 'Idle', timeout: 5000 },
        { id: 'RUNNING', name: 'Running' },
      ],
    });
    const table = formatStateTable(spec);
    expect(table).toContain('5000');
  });

  it('truncates long entry actions', () => {
    const spec = makeSpec({
      states: [
        {
          id: 'IDLE',
          name: 'Idle',
          entryAction: 'this_is_a_very_long_entry_action_that_should_get_truncated_for_readability();',
        },
        { id: 'RUNNING', name: 'Running' },
      ],
    });
    const table = formatStateTable(spec);
    expect(table).toContain('...');
  });

  it('has aligned column separators', () => {
    const table = formatStateTable(makeSpec());
    // Table separator line with dashes and plus signs
    expect(table).toMatch(/-+\+-+/);
  });
});

// ---------------------------------------------------------------------------
// ROBOT_PRESETS
// ---------------------------------------------------------------------------

describe('ROBOT_PRESETS', () => {
  it('contains exactly 4 presets', () => {
    expect(ROBOT_PRESETS).toHaveLength(4);
  });

  it('includes line_follower preset', () => {
    const preset = ROBOT_PRESETS.find((p) => p.name === 'LineFollower');
    expect(preset).toBeDefined();
    expect(preset!.states.length).toBeGreaterThanOrEqual(3);
    expect(preset!.initialState).toBe('IDLE');
  });

  it('includes obstacle_avoider preset', () => {
    const preset = ROBOT_PRESETS.find((p) => p.name === 'ObstacleAvoider');
    expect(preset).toBeDefined();
    expect(preset!.states.length).toBeGreaterThanOrEqual(3);
  });

  it('includes sumo_bot preset', () => {
    const preset = ROBOT_PRESETS.find((p) => p.name === 'SumoBot');
    expect(preset).toBeDefined();
    expect(preset!.states.length).toBeGreaterThanOrEqual(3);
  });

  it('includes maze_solver preset', () => {
    const preset = ROBOT_PRESETS.find((p) => p.name === 'MazeSolver');
    expect(preset).toBeDefined();
    expect(preset!.states.length).toBeGreaterThanOrEqual(4);
  });

  it('all presets pass validation without errors', () => {
    for (const preset of ROBOT_PRESETS) {
      const errors = errorsOnly(validateSpec(preset));
      expect(errors).toHaveLength(0);
    }
  });

  it('all presets generate valid code', () => {
    for (const preset of ROBOT_PRESETS) {
      const code = generateStateMachineCode(preset);
      expect(code.length).toBeGreaterThan(100);
      expect(code).toContain('void setup()');
      expect(code).toContain('void loop()');
    }
  });

  it('all presets produce a state table', () => {
    for (const preset of ROBOT_PRESETS) {
      const table = formatStateTable(preset);
      expect(table).toContain(preset.name);
      expect(table).toContain(preset.initialState);
    }
  });

  it('line_follower has LINE_LOST state with timeout', () => {
    const preset = ROBOT_PRESETS.find((p) => p.name === 'LineFollower')!;
    const lineLost = preset.states.find((s) => s.id === 'LINE_LOST');
    expect(lineLost).toBeDefined();
    expect(lineLost!.timeout).toBe(3000);
  });

  it('obstacle_avoider uses guard conditions', () => {
    const preset = ROBOT_PRESETS.find((p) => p.name === 'ObstacleAvoider')!;
    const guarded = preset.transitions.filter((t) => t.guard);
    expect(guarded.length).toBeGreaterThan(0);
  });

  it('maze_solver has multiple guarded transitions from DRIVE', () => {
    const preset = ROBOT_PRESETS.find((p) => p.name === 'MazeSolver')!;
    const driveGuarded = preset.transitions.filter((t) => t.from === 'DRIVE' && t.guard);
    expect(driveGuarded.length).toBeGreaterThanOrEqual(2);
  });

  it('sumo_bot starts with a wait timeout', () => {
    const preset = ROBOT_PRESETS.find((p) => p.name === 'SumoBot')!;
    const wait = preset.states.find((s) => s.id === 'WAIT');
    expect(wait).toBeDefined();
    expect(wait!.timeout).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Integration: roundtrip spec → validate → generate → table
// ---------------------------------------------------------------------------

describe('integration', () => {
  it('validates, generates, and formats a custom spec end-to-end', () => {
    const spec: StateMachineSpec = {
      name: 'TrafficLight',
      initialState: 'RED',
      states: [
        { id: 'RED', name: 'Red Light', entryAction: 'setRed();', timeout: 5000 },
        { id: 'GREEN', name: 'Green Light', entryAction: 'setGreen();', timeout: 4000 },
        { id: 'YELLOW', name: 'Yellow Light', entryAction: 'setYellow();', timeout: 1500 },
      ],
      transitions: [
        { from: 'RED', to: 'GREEN', event: 'TIMEOUT' },
        { from: 'GREEN', to: 'YELLOW', event: 'TIMEOUT' },
        { from: 'YELLOW', to: 'RED', event: 'TIMEOUT' },
      ],
    };

    const errors = validateSpec(spec);
    expect(errorsOnly(errors)).toHaveLength(0);

    const code = generateStateMachineCode(spec);
    expect(code).toContain('enum TrafficLightState');
    expect(code).toContain('STATE_RED');
    expect(code).toContain('STATE_GREEN');
    expect(code).toContain('STATE_YELLOW');
    expect(code).toContain('5000UL');
    expect(code).toContain('4000UL');
    expect(code).toContain('1500UL');
    expect(code).toContain('setRed();');
    expect(code).toContain('setGreen();');
    expect(code).toContain('setYellow();');

    const table = formatStateTable(spec);
    expect(table).toContain('TrafficLight');
    expect(table).toContain('RED');
    expect(table).toContain('GREEN');
    expect(table).toContain('YELLOW');
    expect(table).toContain('5000');
  });

  it('single-state machine is valid and generates code', () => {
    const spec: StateMachineSpec = {
      name: 'Blinker',
      initialState: 'BLINK',
      states: [{ id: 'BLINK', name: 'Blink', entryAction: 'toggleLED();', timeout: 500 }],
      transitions: [{ from: 'BLINK', to: 'BLINK', event: 'TIMEOUT' }],
    };

    const errors = validateSpec(spec);
    expect(errorsOnly(errors)).toHaveLength(0);

    const code = generateStateMachineCode(spec);
    expect(code).toContain('STATE_BLINK');
    expect(code).toContain('500UL');
  });
});
