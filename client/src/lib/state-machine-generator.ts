/**
 * State Machine Code Generator
 *
 * Generates Arduino C++ state machine code from a declarative specification.
 * Supports enum-based states, switch/case dispatch, entry/exit actions,
 * guarded transitions, and optional per-state timeouts. Ships with 4
 * robot-focused presets (line_follower, obstacle_avoider, sumo_bot, maze_solver).
 *
 * Usage:
 *   const code = generateStateMachineCode({
 *     name: 'LineFollower',
 *     states: [{ id: 'IDLE', name: 'Idle' }, ...],
 *     transitions: [{ from: 'IDLE', to: 'FOLLOW', event: 'START' }],
 *     initialState: 'IDLE',
 *   });
 *
 *   const errors = validateSpec(spec);
 *   const table = formatStateTable(spec);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single state in the machine. */
export interface State {
  /** Unique identifier — used as the enum variant name. Must be UPPER_SNAKE_CASE. */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Optional C++ code executed on entering this state. */
  entryAction?: string;
  /** Optional C++ code executed on leaving this state. */
  exitAction?: string;
  /** Optional timeout in milliseconds. When elapsed, fires a `TIMEOUT` event. */
  timeout?: number;
}

/** A transition between two states. */
export interface Transition {
  /** Source state id. */
  from: string;
  /** Target state id. */
  to: string;
  /** Event name that triggers this transition. Must be UPPER_SNAKE_CASE. */
  event: string;
  /** Optional C++ boolean expression used as a guard condition. */
  guard?: string;
}

/** Complete state machine specification. */
export interface StateMachineSpec {
  /** Name of the state machine — used as the enum type name. */
  name: string;
  /** All states in the machine. */
  states: State[];
  /** All transitions between states. */
  transitions: Transition[];
  /** Id of the initial state. Must reference a state in `states`. */
  initialState: string;
}

/** A single validation error. */
export interface ValidationError {
  /** Severity level. */
  level: 'error' | 'warning';
  /** Human-readable message. */
  message: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a StateMachineSpec and return an array of errors/warnings.
 * An empty array means the spec is valid.
 */
export function validateSpec(spec: StateMachineSpec): ValidationError[] {
  const errors: ValidationError[] = [];

  // --- Name checks ---
  if (!spec.name || spec.name.trim().length === 0) {
    errors.push({ level: 'error', message: 'State machine name is required.' });
  }

  // --- State checks ---
  if (spec.states.length === 0) {
    errors.push({ level: 'error', message: 'At least one state is required.' });
  }

  const stateIds = new Set<string>();
  for (const state of spec.states) {
    if (!state.id || state.id.trim().length === 0) {
      errors.push({ level: 'error', message: 'Every state must have a non-empty id.' });
      continue;
    }
    if (stateIds.has(state.id)) {
      errors.push({ level: 'error', message: `Duplicate state id: "${state.id}".` });
    }
    stateIds.add(state.id);

    if (!state.name || state.name.trim().length === 0) {
      errors.push({ level: 'error', message: `State "${state.id}" must have a non-empty name.` });
    }

    if (state.timeout !== undefined && (state.timeout <= 0 || !Number.isFinite(state.timeout))) {
      errors.push({ level: 'error', message: `State "${state.id}" has an invalid timeout: ${String(state.timeout)}.` });
    }
  }

  // --- Initial state ---
  if (!spec.initialState || spec.initialState.trim().length === 0) {
    errors.push({ level: 'error', message: 'Initial state is required.' });
  } else if (!stateIds.has(spec.initialState)) {
    errors.push({
      level: 'error',
      message: `Initial state "${spec.initialState}" does not match any state id.`,
    });
  }

  // --- Transition checks ---
  const eventSet = new Set<string>();
  for (const t of spec.transitions) {
    if (!stateIds.has(t.from)) {
      errors.push({ level: 'error', message: `Transition from unknown state: "${t.from}".` });
    }
    if (!stateIds.has(t.to)) {
      errors.push({ level: 'error', message: `Transition to unknown state: "${t.to}".` });
    }
    if (!t.event || t.event.trim().length === 0) {
      errors.push({ level: 'error', message: `Transition from "${t.from}" to "${t.to}" has no event.` });
    }
    eventSet.add(t.event);
  }

  // --- Warnings: unreachable states ---
  if (spec.states.length > 1) {
    const reachable = new Set<string>([spec.initialState]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const t of spec.transitions) {
        if (reachable.has(t.from) && !reachable.has(t.to)) {
          reachable.add(t.to);
          changed = true;
        }
      }
    }
    for (const state of spec.states) {
      if (!reachable.has(state.id)) {
        errors.push({ level: 'warning', message: `State "${state.id}" is unreachable from the initial state.` });
      }
    }
  }

  // --- Warnings: dead-end states (no outgoing transitions except self) ---
  for (const state of spec.states) {
    const outgoing = spec.transitions.filter((t) => t.from === state.id && t.to !== state.id);
    if (outgoing.length === 0 && spec.states.length > 1) {
      errors.push({ level: 'warning', message: `State "${state.id}" has no outgoing transitions (dead-end).` });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

/** Sanitize an identifier for C++ (replace non-alnum with underscore). */
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

/** Collect all unique events from transitions. */
function collectEvents(transitions: Transition[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of transitions) {
    const ev = sanitizeId(t.event);
    if (!seen.has(ev)) {
      seen.add(ev);
      result.push(ev);
    }
  }
  return result;
}

/**
 * Generate Arduino C++ source code implementing the state machine.
 *
 * Output structure:
 * - `enum <Name>State { ... };` for states
 * - `enum <Name>Event { ... };` for events
 * - State variable + timeout tracking variables
 * - `void <name>_enter(state)` — entry action dispatcher
 * - `void <name>_exit(state)` — exit action dispatcher
 * - `void <name>_transition(event)` — main switch/case transition handler
 * - `void <name>_update()` — timeout checker, called from `loop()`
 * - `void setup()` — initialises the machine
 * - `void loop()` — calls update
 */
export function generateStateMachineCode(spec: StateMachineSpec): string {
  const safeName = sanitizeId(spec.name);
  const lowerName = safeName.toLowerCase();
  const stateEnumName = `${safeName}State`;
  const eventEnumName = `${safeName}Event`;

  const stateIds = spec.states.map((s) => sanitizeId(s.id));
  const events = collectEvents(spec.transitions);
  const hasTimeouts = spec.states.some((s) => s.timeout !== undefined && s.timeout > 0);

  const lines: string[] = [];

  // --- Header ---
  lines.push(`// State Machine: ${spec.name}`);
  lines.push(`// Generated by ProtoPulse State Machine Generator`);
  lines.push(`// States: ${spec.states.length}, Transitions: ${spec.transitions.length}`);
  lines.push('');

  // --- State enum ---
  lines.push(`enum ${stateEnumName} {`);
  for (let i = 0; i < stateIds.length; i++) {
    const comma = i < stateIds.length - 1 ? ',' : '';
    lines.push(`  STATE_${stateIds[i]}${comma}`);
  }
  lines.push('};');
  lines.push('');

  // --- Event enum ---
  if (events.length > 0) {
    lines.push(`enum ${eventEnumName} {`);
    for (let i = 0; i < events.length; i++) {
      const comma = i < events.length - 1 ? ',' : '';
      lines.push(`  EVT_${events[i]}${comma}`);
    }
    lines.push('};');
    lines.push('');
  }

  // --- State variable ---
  lines.push(`${stateEnumName} ${lowerName}_state = STATE_${sanitizeId(spec.initialState)};`);
  if (hasTimeouts) {
    lines.push(`unsigned long ${lowerName}_state_entered_at = 0;`);
  }
  lines.push('');

  // --- Entry action function ---
  lines.push(`void ${lowerName}_enter(${stateEnumName} state) {`);
  lines.push('  switch (state) {');
  for (const state of spec.states) {
    const sid = sanitizeId(state.id);
    lines.push(`    case STATE_${sid}:`);
    if (state.entryAction) {
      for (const line of state.entryAction.split('\n')) {
        lines.push(`      ${line}`);
      }
    }
    lines.push('      break;');
  }
  lines.push('  }');
  if (hasTimeouts) {
    lines.push(`  ${lowerName}_state_entered_at = millis();`);
  }
  lines.push('}');
  lines.push('');

  // --- Exit action function ---
  lines.push(`void ${lowerName}_exit(${stateEnumName} state) {`);
  lines.push('  switch (state) {');
  for (const state of spec.states) {
    const sid = sanitizeId(state.id);
    lines.push(`    case STATE_${sid}:`);
    if (state.exitAction) {
      for (const line of state.exitAction.split('\n')) {
        lines.push(`      ${line}`);
      }
    }
    lines.push('      break;');
  }
  lines.push('  }');
  lines.push('}');
  lines.push('');

  // --- Transition function ---
  lines.push(`void ${lowerName}_transition(${eventEnumName} event) {`);
  lines.push(`  ${stateEnumName} next = ${lowerName}_state;`);
  lines.push(`  switch (${lowerName}_state) {`);

  // Group transitions by source state
  const transitionsBySource = new Map<string, Transition[]>();
  for (const t of spec.transitions) {
    const key = sanitizeId(t.from);
    const list = transitionsBySource.get(key) ?? [];
    list.push(t);
    transitionsBySource.set(key, list);
  }

  for (const state of spec.states) {
    const sid = sanitizeId(state.id);
    const stateTransitions = transitionsBySource.get(sid) ?? [];
    lines.push(`    case STATE_${sid}:`);
    if (stateTransitions.length === 0) {
      lines.push('      break;');
    } else {
      for (const t of stateTransitions) {
        const evtName = `EVT_${sanitizeId(t.event)}`;
        const targetName = `STATE_${sanitizeId(t.to)}`;
        if (t.guard) {
          lines.push(`      if (event == ${evtName} && (${t.guard})) { next = ${targetName}; }`);
        } else {
          lines.push(`      if (event == ${evtName}) { next = ${targetName}; }`);
        }
      }
      lines.push('      break;');
    }
  }

  lines.push('  }');
  lines.push(`  if (next != ${lowerName}_state) {`);
  lines.push(`    ${lowerName}_exit(${lowerName}_state);`);
  lines.push(`    ${lowerName}_state = next;`);
  lines.push(`    ${lowerName}_enter(next);`);
  lines.push('  }');
  lines.push('}');
  lines.push('');

  // --- Update function (timeout checker) ---
  lines.push(`void ${lowerName}_update() {`);
  if (hasTimeouts) {
    lines.push(`  unsigned long elapsed = millis() - ${lowerName}_state_entered_at;`);
    lines.push(`  switch (${lowerName}_state) {`);
    for (const state of spec.states) {
      if (state.timeout !== undefined && state.timeout > 0) {
        const sid = sanitizeId(state.id);
        lines.push(`    case STATE_${sid}:`);
        lines.push(`      if (elapsed >= ${state.timeout}UL) { ${lowerName}_transition(EVT_TIMEOUT); }`);
        lines.push('      break;');
      }
    }
    lines.push('    default:');
    lines.push('      break;');
    lines.push('  }');
  }
  lines.push('}');
  lines.push('');

  // --- setup() ---
  lines.push('void setup() {');
  lines.push('  Serial.begin(9600);');
  lines.push(`  ${lowerName}_enter(${lowerName}_state);`);
  lines.push('}');
  lines.push('');

  // --- loop() ---
  lines.push('void loop() {');
  lines.push(`  ${lowerName}_update();`);
  lines.push('}');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Human-readable state table
// ---------------------------------------------------------------------------

/**
 * Format the spec as a human-readable ASCII table.
 *
 * Columns: State | Entry Action | Exit Action | Timeout (ms)
 * Followed by a transitions table: From | To | Event | Guard
 */
export function formatStateTable(spec: StateMachineSpec): string {
  const lines: string[] = [];

  // --- Title ---
  lines.push(`State Machine: ${spec.name}`);
  lines.push(`Initial State: ${spec.initialState}`);
  lines.push('');

  // --- States table ---
  const stateHeaders = ['State', 'Name', 'Entry Action', 'Exit Action', 'Timeout (ms)'];
  const stateRows = spec.states.map((s) => [
    s.id,
    s.name,
    s.entryAction ? truncate(s.entryAction.replace(/\n/g, '; '), 30) : '-',
    s.exitAction ? truncate(s.exitAction.replace(/\n/g, '; '), 30) : '-',
    s.timeout !== undefined ? String(s.timeout) : '-',
  ]);
  lines.push(formatTable(stateHeaders, stateRows));

  lines.push('');

  // --- Transitions table ---
  const transHeaders = ['From', 'To', 'Event', 'Guard'];
  const transRows = spec.transitions.map((t) => [t.from, t.to, t.event, t.guard ?? '-']);
  lines.push(formatTable(transHeaders, transRows));

  return lines.join('\n');
}

/** Truncate a string to maxLen characters, appending "..." if needed. */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str;
  }
  return str.slice(0, maxLen - 3) + '...';
}

/** Format data as a simple ASCII table with column alignment. */
function formatTable(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );

  const separator = colWidths.map((w) => '-'.repeat(w + 2)).join('+');
  const formatRow = (cells: string[]): string =>
    cells.map((cell, i) => ` ${cell.padEnd(colWidths[i])} `).join('|');

  const lines: string[] = [];
  lines.push(formatRow(headers));
  lines.push(separator);
  for (const row of rows) {
    lines.push(formatRow(row));
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Robot presets
// ---------------------------------------------------------------------------

/** Built-in robot state machine presets for common beginner projects. */
export const ROBOT_PRESETS: StateMachineSpec[] = [
  // -- LINE FOLLOWER --
  {
    name: 'LineFollower',
    initialState: 'IDLE',
    states: [
      { id: 'IDLE', name: 'Idle', entryAction: 'digitalWrite(LED_PIN, LOW);' },
      { id: 'FOLLOW_LINE', name: 'Follow Line', entryAction: 'setMotors(BASE_SPEED, BASE_SPEED);' },
      {
        id: 'ADJUST_LEFT',
        name: 'Adjust Left',
        entryAction: 'setMotors(BASE_SPEED - CORRECTION, BASE_SPEED + CORRECTION);',
      },
      {
        id: 'ADJUST_RIGHT',
        name: 'Adjust Right',
        entryAction: 'setMotors(BASE_SPEED + CORRECTION, BASE_SPEED - CORRECTION);',
      },
      { id: 'LINE_LOST', name: 'Line Lost', entryAction: 'setMotors(0, 0);', timeout: 3000 },
    ],
    transitions: [
      { from: 'IDLE', to: 'FOLLOW_LINE', event: 'START' },
      { from: 'FOLLOW_LINE', to: 'ADJUST_LEFT', event: 'DRIFT_LEFT' },
      { from: 'FOLLOW_LINE', to: 'ADJUST_RIGHT', event: 'DRIFT_RIGHT' },
      { from: 'FOLLOW_LINE', to: 'LINE_LOST', event: 'NO_LINE' },
      { from: 'ADJUST_LEFT', to: 'FOLLOW_LINE', event: 'CENTERED' },
      { from: 'ADJUST_LEFT', to: 'LINE_LOST', event: 'NO_LINE' },
      { from: 'ADJUST_RIGHT', to: 'FOLLOW_LINE', event: 'CENTERED' },
      { from: 'ADJUST_RIGHT', to: 'LINE_LOST', event: 'NO_LINE' },
      { from: 'LINE_LOST', to: 'FOLLOW_LINE', event: 'LINE_FOUND' },
      { from: 'LINE_LOST', to: 'IDLE', event: 'TIMEOUT' },
      { from: 'FOLLOW_LINE', to: 'IDLE', event: 'STOP' },
      { from: 'ADJUST_LEFT', to: 'IDLE', event: 'STOP' },
      { from: 'ADJUST_RIGHT', to: 'IDLE', event: 'STOP' },
    ],
  },

  // -- OBSTACLE AVOIDER --
  {
    name: 'ObstacleAvoider',
    initialState: 'IDLE',
    states: [
      { id: 'IDLE', name: 'Idle', entryAction: 'setMotors(0, 0);' },
      { id: 'DRIVE_FORWARD', name: 'Drive Forward', entryAction: 'setMotors(SPEED, SPEED);' },
      {
        id: 'REVERSE',
        name: 'Reverse',
        entryAction: 'setMotors(-SPEED, -SPEED);',
        timeout: 500,
      },
      {
        id: 'TURN',
        name: 'Turn Away',
        entryAction: 'setMotors(SPEED, -SPEED);',
        timeout: 800,
      },
      { id: 'SCAN', name: 'Scan', entryAction: 'servo.write(0);', timeout: 1500 },
    ],
    transitions: [
      { from: 'IDLE', to: 'DRIVE_FORWARD', event: 'START' },
      { from: 'DRIVE_FORWARD', to: 'REVERSE', event: 'OBSTACLE_NEAR', guard: 'distance < MIN_DISTANCE' },
      { from: 'REVERSE', to: 'SCAN', event: 'TIMEOUT' },
      { from: 'SCAN', to: 'TURN', event: 'TIMEOUT' },
      { from: 'TURN', to: 'DRIVE_FORWARD', event: 'TIMEOUT' },
      { from: 'DRIVE_FORWARD', to: 'IDLE', event: 'STOP' },
    ],
  },

  // -- SUMO BOT --
  {
    name: 'SumoBot',
    initialState: 'WAIT',
    states: [
      { id: 'WAIT', name: 'Wait for Start', entryAction: 'setMotors(0, 0);', timeout: 5000 },
      { id: 'SEARCH', name: 'Search', entryAction: 'setMotors(SEARCH_SPEED, -SEARCH_SPEED);' },
      { id: 'CHARGE', name: 'Charge', entryAction: 'setMotors(MAX_SPEED, MAX_SPEED);' },
      {
        id: 'EDGE_RETREAT',
        name: 'Edge Retreat',
        entryAction: 'setMotors(-MAX_SPEED, -MAX_SPEED);',
        timeout: 400,
      },
      {
        id: 'EDGE_TURN',
        name: 'Edge Turn',
        entryAction: 'setMotors(MAX_SPEED, -MAX_SPEED);',
        timeout: 600,
      },
    ],
    transitions: [
      { from: 'WAIT', to: 'SEARCH', event: 'TIMEOUT' },
      { from: 'SEARCH', to: 'CHARGE', event: 'OPPONENT_DETECTED' },
      { from: 'SEARCH', to: 'EDGE_RETREAT', event: 'EDGE_DETECTED' },
      { from: 'CHARGE', to: 'SEARCH', event: 'OPPONENT_LOST' },
      { from: 'CHARGE', to: 'EDGE_RETREAT', event: 'EDGE_DETECTED' },
      { from: 'EDGE_RETREAT', to: 'EDGE_TURN', event: 'TIMEOUT' },
      { from: 'EDGE_TURN', to: 'SEARCH', event: 'TIMEOUT' },
    ],
  },

  // -- MAZE SOLVER --
  {
    name: 'MazeSolver',
    initialState: 'IDLE',
    states: [
      { id: 'IDLE', name: 'Idle', entryAction: 'setMotors(0, 0);' },
      { id: 'DRIVE', name: 'Drive Forward', entryAction: 'setMotors(MAZE_SPEED, MAZE_SPEED);' },
      {
        id: 'TURN_LEFT',
        name: 'Turn Left',
        entryAction: 'setMotors(-MAZE_SPEED, MAZE_SPEED);',
        timeout: 700,
      },
      {
        id: 'TURN_RIGHT',
        name: 'Turn Right',
        entryAction: 'setMotors(MAZE_SPEED, -MAZE_SPEED);',
        timeout: 700,
      },
      {
        id: 'U_TURN',
        name: 'U-Turn',
        entryAction: 'setMotors(MAZE_SPEED, -MAZE_SPEED);',
        timeout: 1400,
      },
      { id: 'SOLVED', name: 'Solved', entryAction: 'setMotors(0, 0);\ndigitalWrite(LED_PIN, HIGH);' },
    ],
    transitions: [
      { from: 'IDLE', to: 'DRIVE', event: 'START' },
      { from: 'DRIVE', to: 'TURN_LEFT', event: 'WALL_FRONT', guard: '!wallLeft' },
      { from: 'DRIVE', to: 'TURN_RIGHT', event: 'WALL_FRONT', guard: 'wallLeft && !wallRight' },
      { from: 'DRIVE', to: 'U_TURN', event: 'WALL_FRONT', guard: 'wallLeft && wallRight' },
      { from: 'DRIVE', to: 'TURN_LEFT', event: 'OPEN_LEFT' },
      { from: 'TURN_LEFT', to: 'DRIVE', event: 'TIMEOUT' },
      { from: 'TURN_RIGHT', to: 'DRIVE', event: 'TIMEOUT' },
      { from: 'U_TURN', to: 'DRIVE', event: 'TIMEOUT' },
      { from: 'DRIVE', to: 'SOLVED', event: 'GOAL_REACHED' },
    ],
  },
];
