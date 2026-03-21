import { describe, it, expect, beforeEach } from 'vitest';
import {
  DECISION_TREE,
  SYMPTOM_LABELS,
  BoardDoctor,
  getNodeById,
  getRootNodeId,
  getAllCategories,
  getAllLeafNodes,
  getNodesForCategory,
  matchSymptom,
  matchBestCategory,
} from '../board-doctor';
import type {
  DecisionNode,
  QuestionNode,
  LeafNode,
  SymptomCategory,
  DiagnosticResult,
  DiagnosticSession,
  DiagnosticSeverity,
} from '../board-doctor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Walk a path through the decision tree, answering questions. */
function walkTree(
  startId: string,
  answers: ('yes' | 'no')[],
): { visited: string[]; finalNode: DecisionNode | undefined } {
  const visited: string[] = [];
  let currentId = startId;

  for (const answer of answers) {
    visited.push(currentId);
    const node = getNodeById(currentId);
    if (!node || node.type !== 'question') {
      return { visited, finalNode: node };
    }
    currentId = answer === 'yes' ? node.yesNext : node.noNext;
  }

  visited.push(currentId);
  return { visited, finalNode: getNodeById(currentId) };
}

/** Run a BoardDoctor session to completion with given answers. */
function runSession(
  doctor: BoardDoctor,
  category: SymptomCategory,
  answers: ('yes' | 'no')[],
): DiagnosticSession {
  doctor.startSession(category);
  let session = doctor.getSession()!;
  for (const answer of answers) {
    if (session.isComplete) {
      break;
    }
    session = doctor.answer(answer);
  }
  return session;
}

// ---------------------------------------------------------------------------
// Decision Tree Structure Tests
// ---------------------------------------------------------------------------

describe('DECISION_TREE', () => {
  it('has at least 20 nodes', () => {
    expect(DECISION_TREE.length).toBeGreaterThanOrEqual(20);
  });

  it('every node has a unique ID', () => {
    const ids = DECISION_TREE.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every node has a valid type (question or leaf)', () => {
    for (const node of DECISION_TREE) {
      expect(['question', 'leaf']).toContain(node.type);
    }
  });

  it('every node has a valid category', () => {
    const validCategories = new Set(getAllCategories());
    for (const node of DECISION_TREE) {
      expect(validCategories.has(node.category)).toBe(true);
    }
  });

  it('all 7 symptom categories have at least one node', () => {
    const categories = getAllCategories();
    expect(categories).toHaveLength(7);
    for (const cat of categories) {
      const nodes = getNodesForCategory(cat);
      expect(nodes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every question node references existing yesNext and noNext nodes', () => {
    for (const node of DECISION_TREE) {
      if (node.type === 'question') {
        expect(getNodeById(node.yesNext)).toBeDefined();
        expect(getNodeById(node.noNext)).toBeDefined();
      }
    }
  });

  it('every leaf node has diagnosis, causes, solutions, and severity', () => {
    const leafNodes = getAllLeafNodes();
    expect(leafNodes.length).toBeGreaterThanOrEqual(10);
    for (const leaf of leafNodes) {
      expect(leaf.diagnosis).toBeTruthy();
      expect(leaf.causes.length).toBeGreaterThanOrEqual(1);
      expect(leaf.solutions.length).toBeGreaterThanOrEqual(1);
      expect(['critical', 'warning', 'info']).toContain(leaf.severity);
    }
  });

  it('question nodes have question text and non-empty yesNext/noNext', () => {
    for (const node of DECISION_TREE) {
      if (node.type === 'question') {
        expect(node.question).toBeTruthy();
        expect(node.yesNext).toBeTruthy();
        expect(node.noNext).toBeTruthy();
      }
    }
  });

  it('no node references itself (no self-loops)', () => {
    for (const node of DECISION_TREE) {
      if (node.type === 'question') {
        expect(node.yesNext).not.toBe(node.id);
        expect(node.noNext).not.toBe(node.id);
      }
    }
  });

  it('every root node exists and is a question node', () => {
    const categories = getAllCategories();
    for (const cat of categories) {
      const rootId = getRootNodeId(cat);
      const node = getNodeById(rootId);
      expect(node).toBeDefined();
      expect(node!.type).toBe('question');
    }
  });

  it('every path through the tree terminates at a leaf node (no cycles)', () => {
    const categories = getAllCategories();
    for (const cat of categories) {
      const rootId = getRootNodeId(cat);
      const visited = new Set<string>();
      const queue: string[] = [rootId];

      while (queue.length > 0) {
        const id = queue.shift()!;
        if (visited.has(id)) {
          // Cycle detected — fail
          expect(visited.has(id)).toBe(false);
          continue;
        }
        visited.add(id);
        const node = getNodeById(id);
        expect(node).toBeDefined();
        if (node!.type === 'question') {
          queue.push(node!.type === 'question' ? (node as QuestionNode).yesNext : '');
          queue.push(node!.type === 'question' ? (node as QuestionNode).noNext : '');
        }
        // Leaf nodes are terminal — no further traversal
      }
    }
  });
});

// ---------------------------------------------------------------------------
// SYMPTOM_LABELS
// ---------------------------------------------------------------------------

describe('SYMPTOM_LABELS', () => {
  it('has a label for every category', () => {
    const categories = getAllCategories();
    for (const cat of categories) {
      expect(SYMPTOM_LABELS[cat]).toBeTruthy();
    }
  });

  it('every label is a non-empty string', () => {
    const categories = getAllCategories();
    for (const cat of categories) {
      expect(typeof SYMPTOM_LABELS[cat]).toBe('string');
      expect(SYMPTOM_LABELS[cat].length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Node Accessors
// ---------------------------------------------------------------------------

describe('getNodeById', () => {
  it('returns the correct node for a valid ID', () => {
    const node = getNodeById('bnd-root');
    expect(node).toBeDefined();
    expect(node!.id).toBe('bnd-root');
    expect(node!.type).toBe('question');
  });

  it('returns undefined for an invalid ID', () => {
    expect(getNodeById('nonexistent-node')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getNodeById('')).toBeUndefined();
  });
});

describe('getRootNodeId', () => {
  it('returns a valid root ID for each category', () => {
    const categories = getAllCategories();
    for (const cat of categories) {
      const rootId = getRootNodeId(cat);
      expect(rootId).toBeTruthy();
      expect(getNodeById(rootId)).toBeDefined();
    }
  });
});

describe('getAllCategories', () => {
  it('returns exactly 7 categories', () => {
    expect(getAllCategories()).toHaveLength(7);
  });

  it('includes all expected categories', () => {
    const cats = getAllCategories();
    expect(cats).toContain('board_not_detected');
    expect(cats).toContain('upload_fails');
    expect(cats).toContain('serial_garbled');
    expect(cats).toContain('program_crashes');
    expect(cats).toContain('sensor_wrong_values');
    expect(cats).toContain('motor_not_spinning');
    expect(cats).toContain('wifi_wont_connect');
  });
});

describe('getAllLeafNodes', () => {
  it('returns only leaf nodes', () => {
    const leaves = getAllLeafNodes();
    for (const leaf of leaves) {
      expect(leaf.type).toBe('leaf');
    }
  });

  it('has at least one leaf per category', () => {
    const leaves = getAllLeafNodes();
    const categories = new Set(leaves.map((l) => l.category));
    for (const cat of getAllCategories()) {
      expect(categories.has(cat)).toBe(true);
    }
  });
});

describe('getNodesForCategory', () => {
  it('returns only nodes belonging to the requested category', () => {
    const nodes = getNodesForCategory('board_not_detected');
    for (const node of nodes) {
      expect(node.category).toBe('board_not_detected');
    }
  });

  it('returns both question and leaf nodes', () => {
    const nodes = getNodesForCategory('upload_fails');
    const types = new Set(nodes.map((n) => n.type));
    expect(types.has('question')).toBe(true);
    expect(types.has('leaf')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Decision Tree Traversal Tests — per category
// ---------------------------------------------------------------------------

describe('board_not_detected paths', () => {
  it('reaches "Board has no power" via no-power path', () => {
    const { finalNode } = walkTree('bnd-root', ['no']);
    expect(finalNode).toBeDefined();
    expect(finalNode!.type).toBe('leaf');
    expect((finalNode as LeafNode).diagnosis).toBe('Board has no power');
  });

  it('reaches "Missing USB-to-serial driver" via driver path', () => {
    const { finalNode } = walkTree('bnd-root', ['yes', 'no']);
    expect(finalNode).toBeDefined();
    expect(finalNode!.type).toBe('leaf');
    expect((finalNode as LeafNode).diagnosis).toBe('Missing USB-to-serial driver');
  });

  it('reaches "Port is busy" via port-busy path', () => {
    const { finalNode } = walkTree('bnd-root', ['yes', 'yes']);
    expect(finalNode).toBeDefined();
    expect(finalNode!.type).toBe('leaf');
    expect((finalNode as LeafNode).diagnosis).toBe('Port is busy or locked by another application');
  });
});

describe('upload_fails paths', () => {
  it('reaches "ESP board not entering download mode"', () => {
    const { finalNode } = walkTree('uf-root', ['no', 'yes']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toBe('ESP board not entering download mode');
  });

  it('reaches "Bootloader sync failure"', () => {
    const { finalNode } = walkTree('uf-root', ['no', 'no']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toBe('Bootloader sync failure');
  });

  it('reaches "Flash verification failure"', () => {
    const { finalNode } = walkTree('uf-root', ['yes', 'yes']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toBe('Flash verification failure');
  });

  it('reaches "Sketch too large or compilation error"', () => {
    const { finalNode } = walkTree('uf-root', ['yes', 'no']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toBe('Sketch too large or compilation error');
  });
});

describe('serial_garbled paths', () => {
  it('reaches "Baud rate mismatch"', () => {
    const { finalNode } = walkTree('sg-root', ['yes']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toBe('Baud rate mismatch');
  });

  it('reaches "Electrical noise on serial line"', () => {
    const { finalNode } = walkTree('sg-root', ['no', 'yes']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toBe('Electrical noise on serial line');
  });

  it('reaches "Character encoding or line ending mismatch"', () => {
    const { finalNode } = walkTree('sg-root', ['no', 'no']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toBe('Character encoding or line ending mismatch');
  });
});

describe('program_crashes paths', () => {
  it('reaches "Stack overflow or watchdog timeout at boot"', () => {
    const { finalNode } = walkTree('pc-root', ['no', 'yes']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toContain('Stack overflow');
  });

  it('reaches "Initialization failure"', () => {
    const { finalNode } = walkTree('pc-root', ['no', 'no']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toContain('Initialization failure');
  });

  it('reaches "Crash triggered by specific operation"', () => {
    const { finalNode } = walkTree('pc-root', ['yes', 'yes']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toBe('Crash triggered by specific operation');
  });

  it('reaches "Memory exhaustion"', () => {
    const { finalNode } = walkTree('pc-root', ['yes', 'no']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toContain('Memory exhaustion');
  });
});

describe('sensor_wrong_values paths', () => {
  it('reaches "Floating or disconnected analog pin"', () => {
    const { finalNode } = walkTree('swv-root', ['yes', 'yes']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toBe('Floating or disconnected analog pin');
  });

  it('reaches "Wrong pin or incorrect ADC configuration"', () => {
    const { finalNode } = walkTree('swv-root', ['yes', 'no']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toContain('Wrong pin');
  });

  it('reaches "Noisy sensor readings"', () => {
    const { finalNode } = walkTree('swv-root', ['no', 'yes']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toContain('Noisy sensor');
  });

  it('reaches "Sensor needs calibration"', () => {
    const { finalNode } = walkTree('swv-root', ['no', 'no']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toContain('calibration');
  });
});

describe('motor_not_spinning paths', () => {
  it('reaches "Motor connected directly to Arduino pin"', () => {
    const { finalNode } = walkTree('mns-root', ['no']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toContain('directly');
    expect((finalNode as LeafNode).severity).toBe('critical');
  });

  it('reaches "Motor driver has no separate power supply"', () => {
    const { finalNode } = walkTree('mns-root', ['yes', 'no']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toContain('no separate power');
  });

  it('reaches "Speed control pin is not PWM-capable"', () => {
    const { finalNode } = walkTree('mns-root', ['yes', 'yes', 'no']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toContain('PWM');
  });

  it('reaches "Motor driver wiring or code logic issue"', () => {
    const { finalNode } = walkTree('mns-root', ['yes', 'yes', 'yes']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toContain('wiring or code');
  });
});

describe('wifi_wont_connect paths', () => {
  it('reaches "Board does not have WiFi capability"', () => {
    const { finalNode } = walkTree('wwc-root', ['no']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toContain('does not have WiFi');
  });

  it('reaches "WiFi credentials incorrect"', () => {
    const { finalNode } = walkTree('wwc-root', ['yes', 'no']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toContain('credentials');
  });

  it('reaches "Network is 5GHz only"', () => {
    const { finalNode } = walkTree('wwc-root', ['yes', 'yes', 'no']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toContain('5GHz');
  });

  it('reaches "WiFi signal too weak"', () => {
    const { finalNode } = walkTree('wwc-root', ['yes', 'yes', 'yes']);
    expect(finalNode).toBeDefined();
    expect((finalNode as LeafNode).diagnosis).toContain('signal too weak');
  });
});

// ---------------------------------------------------------------------------
// Fuzzy Symptom Matching
// ---------------------------------------------------------------------------

describe('matchSymptom', () => {
  it('returns empty array for empty input', () => {
    expect(matchSymptom('')).toEqual([]);
  });

  it('returns empty array for gibberish input', () => {
    expect(matchSymptom('x y z')).toEqual([]);
  });

  it('matches "board not detected" for "my board is not showing up"', () => {
    const matches = matchSymptom('my board is not showing up');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].category).toBe('board_not_detected');
  });

  it('matches "upload_fails" for "upload failed avrdude sync error"', () => {
    const matches = matchSymptom('upload failed avrdude sync error');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].category).toBe('upload_fails');
  });

  it('matches "serial_garbled" for "serial monitor showing garbage characters"', () => {
    const matches = matchSymptom('serial monitor showing garbage characters');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].category).toBe('serial_garbled');
  });

  it('matches "program_crashes" for "program keeps crashing and resetting"', () => {
    const matches = matchSymptom('program keeps crashing and resetting');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].category).toBe('program_crashes');
  });

  it('matches "sensor_wrong_values" for "sensor reading wrong temperature"', () => {
    const matches = matchSymptom('sensor reading wrong temperature');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].category).toBe('sensor_wrong_values');
  });

  it('matches "motor_not_spinning" for "motor not spinning with L298N"', () => {
    const matches = matchSymptom('motor not spinning with L298N');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].category).toBe('motor_not_spinning');
  });

  it('matches "wifi_wont_connect" for "ESP32 wifi not connecting to router"', () => {
    const matches = matchSymptom('ESP32 wifi not connecting to router');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].category).toBe('wifi_wont_connect');
  });

  it('returns matches sorted by score descending', () => {
    const matches = matchSymptom('upload failed');
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].score).toBeLessThanOrEqual(matches[i - 1].score);
    }
  });

  it('includes label in match results', () => {
    const matches = matchSymptom('motor not moving');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].label).toBe(SYMPTOM_LABELS[matches[0].category]);
  });

  it('scores are between 0 and 1', () => {
    const matches = matchSymptom('wifi motor sensor upload serial crash board');
    for (const m of matches) {
      expect(m.score).toBeGreaterThan(0);
      expect(m.score).toBeLessThanOrEqual(1);
    }
  });
});

describe('matchBestCategory', () => {
  it('returns null for empty input', () => {
    expect(matchBestCategory('')).toBeNull();
  });

  it('returns null for unrecognizable input', () => {
    expect(matchBestCategory('the sky is blue')).toBeNull();
  });

  it('returns the best matching category', () => {
    expect(matchBestCategory('baud rate garbled serial output')).toBe('serial_garbled');
  });

  it('handles mixed case input', () => {
    expect(matchBestCategory('WIFI WONT CONNECT ESP32')).toBe('wifi_wont_connect');
  });

  it('handles input with punctuation', () => {
    expect(matchBestCategory("my motor isn't spinning!")).toBe('motor_not_spinning');
  });
});

// ---------------------------------------------------------------------------
// BoardDoctor Singleton
// ---------------------------------------------------------------------------

describe('BoardDoctor', () => {
  let doctor: BoardDoctor;

  beforeEach(() => {
    BoardDoctor.resetInstance();
    doctor = BoardDoctor.getInstance();
  });

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = BoardDoctor.getInstance();
      const b = BoardDoctor.getInstance();
      expect(a).toBe(b);
    });

    it('resetInstance creates a new instance', () => {
      const a = BoardDoctor.getInstance();
      BoardDoctor.resetInstance();
      const b = BoardDoctor.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('subscribe', () => {
    it('notifies listeners on session start', () => {
      let notified = false;
      doctor.subscribe(() => { notified = true; });
      doctor.startSession('board_not_detected');
      expect(notified).toBe(true);
    });

    it('notifies listeners on answer', () => {
      doctor.startSession('serial_garbled');
      let count = 0;
      doctor.subscribe(() => { count++; });
      doctor.answer('yes');
      expect(count).toBe(1);
    });

    it('unsubscribe stops notifications', () => {
      let count = 0;
      const unsub = doctor.subscribe(() => { count++; });
      doctor.startSession('board_not_detected');
      expect(count).toBe(1);
      unsub();
      doctor.answer('no');
      expect(count).toBe(1);
    });

    it('notifies on cancelSession', () => {
      doctor.startSession('board_not_detected');
      let notified = false;
      doctor.subscribe(() => { notified = true; });
      doctor.cancelSession();
      expect(notified).toBe(true);
    });

    it('notifies on clearHistory', () => {
      runSession(doctor, 'serial_garbled', ['yes']);
      let notified = false;
      doctor.subscribe(() => { notified = true; });
      doctor.clearHistory();
      expect(notified).toBe(true);
    });
  });

  describe('startSession', () => {
    it('creates a session with the correct category', () => {
      const session = doctor.startSession('upload_fails');
      expect(session.category).toBe('upload_fails');
      expect(session.isComplete).toBe(false);
      expect(session.result).toBeNull();
      expect(session.answers).toHaveLength(0);
    });

    it('sets the current node to the category root', () => {
      const session = doctor.startSession('motor_not_spinning');
      expect(session.currentNodeId).toBe(getRootNodeId('motor_not_spinning'));
    });

    it('generates unique session IDs', () => {
      const s1 = doctor.startSession('board_not_detected');
      BoardDoctor.resetInstance();
      const d2 = BoardDoctor.getInstance();
      const s2 = d2.startSession('board_not_detected');
      expect(s1.id).not.toBe(s2.id);
    });

    it('has a valid startedAt timestamp', () => {
      const before = Date.now();
      const session = doctor.startSession('wifi_wont_connect');
      const after = Date.now();
      expect(session.startedAt).toBeGreaterThanOrEqual(before);
      expect(session.startedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('startSessionFromDescription', () => {
    it('starts a session from a matching description', () => {
      const session = doctor.startSessionFromDescription('my board is not detected');
      expect(session).not.toBeNull();
      expect(session!.category).toBe('board_not_detected');
    });

    it('returns null for unrecognizable description', () => {
      const session = doctor.startSessionFromDescription('the weather is nice today');
      expect(session).toBeNull();
    });

    it('starts motor session from motor-related text', () => {
      const session = doctor.startSessionFromDescription('the servo motor wont move');
      expect(session).not.toBeNull();
      expect(session!.category).toBe('motor_not_spinning');
    });
  });

  describe('answer', () => {
    it('advances to the next question on "yes"', () => {
      doctor.startSession('board_not_detected');
      const session = doctor.answer('yes');
      expect(session.currentNodeId).toBe('bnd-driver');
      expect(session.answers).toHaveLength(1);
      expect(session.answers[0].answer).toBe('yes');
    });

    it('advances to the leaf on "no" from root', () => {
      doctor.startSession('board_not_detected');
      const session = doctor.answer('no');
      expect(session.isComplete).toBe(true);
      expect(session.result).not.toBeNull();
      expect(session.result!.diagnosis).toBe('Board has no power');
    });

    it('records answer timestamps', () => {
      doctor.startSession('serial_garbled');
      const before = Date.now();
      const session = doctor.answer('yes');
      const after = Date.now();
      expect(session.answers[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(session.answers[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('throws when no active session', () => {
      expect(() => doctor.answer('yes')).toThrow('No active diagnostic session');
    });

    it('throws when session is already complete', () => {
      doctor.startSession('serial_garbled');
      doctor.answer('yes'); // reaches leaf
      expect(() => doctor.answer('yes')).toThrow('No active diagnostic session');
    });

    it('produces a DiagnosticResult with correct fields on completion', () => {
      doctor.startSession('board_not_detected');
      const session = doctor.answer('no');
      const result = session.result!;
      expect(result.nodeId).toBe('bnd-no-power');
      expect(result.category).toBe('board_not_detected');
      expect(result.diagnosis).toBeTruthy();
      expect(result.causes.length).toBeGreaterThanOrEqual(1);
      expect(result.solutions.length).toBeGreaterThanOrEqual(1);
      expect(result.severity).toBe('critical');
      expect(result.path).toHaveLength(1);
      expect(result.path[0]).toBe('bnd-root');
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('builds the full answer path through multiple questions', () => {
      doctor.startSession('motor_not_spinning');
      doctor.answer('yes'); // has driver? yes
      doctor.answer('yes'); // separate power? yes
      const session = doctor.answer('yes'); // PWM pin? yes → leaf
      expect(session.isComplete).toBe(true);
      expect(session.result!.path).toHaveLength(3);
    });
  });

  describe('getCurrentQuestion', () => {
    it('returns the current question node', () => {
      doctor.startSession('board_not_detected');
      const q = doctor.getCurrentQuestion();
      expect(q).not.toBeNull();
      expect(q!.id).toBe('bnd-root');
      expect(q!.question).toBeTruthy();
    });

    it('returns null when no session', () => {
      expect(doctor.getCurrentQuestion()).toBeNull();
    });

    it('returns null when session is complete', () => {
      doctor.startSession('serial_garbled');
      doctor.answer('yes');
      expect(doctor.getCurrentQuestion()).toBeNull();
    });
  });

  describe('getCurrentResult', () => {
    it('returns null before session completes', () => {
      doctor.startSession('upload_fails');
      expect(doctor.getCurrentResult()).toBeNull();
    });

    it('returns the result after session completes', () => {
      doctor.startSession('serial_garbled');
      doctor.answer('yes');
      const result = doctor.getCurrentResult();
      expect(result).not.toBeNull();
      expect(result!.diagnosis).toBe('Baud rate mismatch');
    });

    it('returns null when no session', () => {
      expect(doctor.getCurrentResult()).toBeNull();
    });
  });

  describe('hasActiveSession', () => {
    it('returns false when no session', () => {
      expect(doctor.hasActiveSession()).toBe(false);
    });

    it('returns true during active session', () => {
      doctor.startSession('board_not_detected');
      expect(doctor.hasActiveSession()).toBe(true);
    });

    it('returns false after session completes', () => {
      doctor.startSession('serial_garbled');
      doctor.answer('yes');
      expect(doctor.hasActiveSession()).toBe(false);
    });
  });

  describe('cancelSession', () => {
    it('clears the current session', () => {
      doctor.startSession('board_not_detected');
      expect(doctor.hasActiveSession()).toBe(true);
      doctor.cancelSession();
      expect(doctor.hasActiveSession()).toBe(false);
      expect(doctor.getSession()).toBeNull();
    });

    it('does not add to history when cancelled', () => {
      doctor.startSession('upload_fails');
      doctor.cancelSession();
      expect(doctor.getHistory()).toHaveLength(0);
    });

    it('is safe to call when no session exists', () => {
      expect(() => doctor.cancelSession()).not.toThrow();
    });
  });

  describe('session history', () => {
    it('starts with empty history', () => {
      expect(doctor.getHistory()).toHaveLength(0);
    });

    it('records completed sessions', () => {
      runSession(doctor, 'serial_garbled', ['yes']);
      expect(doctor.getHistory()).toHaveLength(1);
    });

    it('records multiple sessions', () => {
      runSession(doctor, 'serial_garbled', ['yes']);
      runSession(doctor, 'board_not_detected', ['no']);
      expect(doctor.getHistory()).toHaveLength(2);
    });

    it('getLastResult returns the most recent result', () => {
      runSession(doctor, 'serial_garbled', ['yes']);
      runSession(doctor, 'board_not_detected', ['no']);
      const last = doctor.getLastResult();
      expect(last).not.toBeNull();
      expect(last!.diagnosis).toBe('Board has no power');
    });

    it('getLastResult returns null when no history', () => {
      expect(doctor.getLastResult()).toBeNull();
    });

    it('getHistoryByCategory filters correctly', () => {
      runSession(doctor, 'serial_garbled', ['yes']);
      runSession(doctor, 'board_not_detected', ['no']);
      runSession(doctor, 'serial_garbled', ['no', 'yes']);

      const serialHistory = doctor.getHistoryByCategory('serial_garbled');
      expect(serialHistory).toHaveLength(2);
      for (const r of serialHistory) {
        expect(r.category).toBe('serial_garbled');
      }

      const boardHistory = doctor.getHistoryByCategory('board_not_detected');
      expect(boardHistory).toHaveLength(1);
    });

    it('clearHistory empties all history', () => {
      runSession(doctor, 'serial_garbled', ['yes']);
      runSession(doctor, 'board_not_detected', ['no']);
      expect(doctor.getHistory()).toHaveLength(2);
      doctor.clearHistory();
      expect(doctor.getHistory()).toHaveLength(0);
      expect(doctor.getLastResult()).toBeNull();
    });

    it('getCompletedCount tracks completions', () => {
      expect(doctor.getCompletedCount()).toBe(0);
      runSession(doctor, 'serial_garbled', ['yes']);
      expect(doctor.getCompletedCount()).toBe(1);
      runSession(doctor, 'board_not_detected', ['no']);
      expect(doctor.getCompletedCount()).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Full scenario tests — complete diagnostic flows
  // -----------------------------------------------------------------------

  describe('full diagnostic scenarios', () => {
    it('diagnoses a motor without driver as critical', () => {
      const session = runSession(doctor, 'motor_not_spinning', ['no']);
      expect(session.isComplete).toBe(true);
      expect(session.result!.severity).toBe('critical');
      expect(session.result!.diagnosis).toContain('directly');
    });

    it('diagnoses WiFi 5GHz issue', () => {
      const session = runSession(doctor, 'wifi_wont_connect', ['yes', 'yes', 'no']);
      expect(session.isComplete).toBe(true);
      expect(session.result!.diagnosis).toContain('5GHz');
      expect(session.result!.severity).toBe('warning');
    });

    it('diagnoses program crash from memory leak', () => {
      const session = runSession(doctor, 'program_crashes', ['yes', 'no']);
      expect(session.isComplete).toBe(true);
      expect(session.result!.diagnosis).toContain('Memory exhaustion');
      expect(session.result!.solutions.length).toBeGreaterThanOrEqual(3);
    });

    it('diagnoses sensor calibration issue', () => {
      const session = runSession(doctor, 'sensor_wrong_values', ['no', 'no']);
      expect(session.isComplete).toBe(true);
      expect(session.result!.diagnosis).toContain('calibration');
    });

    it('diagnoses upload ESP boot mode issue', () => {
      const session = runSession(doctor, 'upload_fails', ['no', 'yes']);
      expect(session.isComplete).toBe(true);
      expect(session.result!.diagnosis).toContain('ESP');
    });

    it('multi-session: diagnose then start a new session', () => {
      runSession(doctor, 'serial_garbled', ['yes']);
      expect(doctor.getHistory()).toHaveLength(1);

      const session2 = runSession(doctor, 'board_not_detected', ['yes', 'yes']);
      expect(session2.isComplete).toBe(true);
      expect(doctor.getHistory()).toHaveLength(2);
    });

    it('cancelled session followed by completed session', () => {
      doctor.startSession('upload_fails');
      doctor.answer('no');
      // still in progress — cancel
      doctor.cancelSession();
      expect(doctor.getHistory()).toHaveLength(0);

      runSession(doctor, 'serial_garbled', ['yes']);
      expect(doctor.getHistory()).toHaveLength(1);
    });
  });
});
