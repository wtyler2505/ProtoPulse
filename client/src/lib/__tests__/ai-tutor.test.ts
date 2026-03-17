import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  AiTutor,
  TOPIC_QUESTION_BANK,
  generateSocraticQuestion,
  generateHint,
  getTutorResponse,
  classifyUserLevel,
  useTutor,
} from '../ai-tutor';
import type { TutorContext, TutorStyle, UserLevel } from '../ai-tutor';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<TutorContext> = {}): TutorContext {
  return {
    userLevel: overrides.userLevel ?? 'beginner',
    currentTopic: overrides.currentTopic,
    recentErrors: overrides.recentErrors ?? [],
    askCount: overrides.askCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// TOPIC_QUESTION_BANK validation
// ---------------------------------------------------------------------------

describe('TOPIC_QUESTION_BANK', () => {
  it('has at least 30 topics', () => {
    expect(Object.keys(TOPIC_QUESTION_BANK).length).toBeGreaterThanOrEqual(30);
  });

  it('every topic has at least 3 questions', () => {
    for (const [topic, questions] of Object.entries(TOPIC_QUESTION_BANK)) {
      expect(questions.length, `topic "${topic}" should have >= 3 questions`).toBeGreaterThanOrEqual(3);
    }
  });

  it('every question is a non-empty string', () => {
    for (const [topic, questions] of Object.entries(TOPIC_QUESTION_BANK)) {
      for (const q of questions) {
        expect(typeof q, `question in "${topic}" should be a string`).toBe('string');
        expect(q.length, `question in "${topic}" should be non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('every topic key is lowercase kebab-case', () => {
    for (const key of Object.keys(TOPIC_QUESTION_BANK)) {
      expect(key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('contains expected core topics', () => {
    const expected = ['resistors', 'capacitors', 'ohms-law', 'i2c', 'spi', 'uart', 'pwm', 'pcb-design'];
    for (const topic of expected) {
      expect(TOPIC_QUESTION_BANK).toHaveProperty(topic);
    }
  });
});

// ---------------------------------------------------------------------------
// generateSocraticQuestion
// ---------------------------------------------------------------------------

describe('generateSocraticQuestion', () => {
  it('returns a question from the bank for a known topic', () => {
    const ctx = makeContext({ askCount: 0 });
    const question = generateSocraticQuestion(ctx, 'resistors');
    expect(TOPIC_QUESTION_BANK['resistors']).toContain(question);
  });

  it('cycles through questions based on askCount', () => {
    const questions = TOPIC_QUESTION_BANK['resistors'];
    const results = new Set<string>();
    for (let i = 0; i < questions.length; i++) {
      const ctx = makeContext({ askCount: i });
      results.add(generateSocraticQuestion(ctx, 'resistors'));
    }
    // Should produce multiple distinct questions
    expect(results.size).toBeGreaterThanOrEqual(2);
  });

  it('wraps around when askCount exceeds question count', () => {
    const questions = TOPIC_QUESTION_BANK['resistors'];
    const ctxA = makeContext({ askCount: 0 });
    const ctxB = makeContext({ askCount: questions.length });
    expect(generateSocraticQuestion(ctxA, 'resistors')).toBe(
      generateSocraticQuestion(ctxB, 'resistors'),
    );
  });

  it('returns a generic fallback for unknown topics', () => {
    const ctx = makeContext();
    const question = generateSocraticQuestion(ctx, 'quantum-teleportation');
    expect(question).toContain('quantum-teleportation');
    expect(question.length).toBeGreaterThan(10);
  });

  it('normalizes topic names (spaces to dashes, case insensitive)', () => {
    const ctx = makeContext({ askCount: 0 });
    const q1 = generateSocraticQuestion(ctx, 'Ohms Law');
    const q2 = generateSocraticQuestion(ctx, 'ohms-law');
    expect(q1).toBe(q2);
  });

  it('handles empty topic string gracefully', () => {
    const ctx = makeContext();
    const question = generateSocraticQuestion(ctx, '');
    expect(typeof question).toBe('string');
    expect(question.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// generateHint — progressive disclosure
// ---------------------------------------------------------------------------

describe('generateHint', () => {
  it('returns a vague hint at askCount 0', () => {
    const ctx = makeContext({ askCount: 0 });
    const hint = generateHint(ctx, 'short circuit');
    expect(hint.length).toBeGreaterThan(10);
    // At stage 0, hint should be general/vague
    expect(hint).not.toContain('VCC directly to GND');
  });

  it('returns increasingly specific hints as askCount rises', () => {
    const hints: string[] = [];
    for (let i = 0; i <= 3; i++) {
      const ctx = makeContext({ askCount: i });
      hints.push(generateHint(ctx, 'short circuit'));
    }
    // Each hint should be different
    const unique = new Set(hints);
    expect(unique.size).toBe(4);
    // Last hint should be the most specific (longest)
    expect(hints[3].length).toBeGreaterThanOrEqual(hints[0].length);
  });

  it('clamps at stage 3 for askCount > 3', () => {
    const ctx3 = makeContext({ askCount: 3 });
    const ctx10 = makeContext({ askCount: 10 });
    expect(generateHint(ctx3, 'LED not working')).toBe(
      generateHint(ctx10, 'LED not working'),
    );
  });

  it('matches short-circuit pattern', () => {
    const ctx = makeContext({ askCount: 2 });
    const hint = generateHint(ctx, 'I have a short circuit on my board');
    expect(hint).toBeTruthy();
    expect(hint.length).toBeGreaterThan(20);
  });

  it('matches I2C pattern', () => {
    const ctx = makeContext({ askCount: 1 });
    const hint = generateHint(ctx, 'I2C device not responding');
    expect(hint.toLowerCase()).toContain('pull-up');
  });

  it('matches motor pattern', () => {
    const ctx = makeContext({ askCount: 1 });
    const hint = generateHint(ctx, 'motor not spinning');
    expect(hint.toLowerCase()).toMatch(/transistor|h-bridge|driver/);
  });

  it('matches UART pattern', () => {
    const ctx = makeContext({ askCount: 2 });
    const hint = generateHint(ctx, 'serial baud rate issue');
    expect(hint.toLowerCase()).toContain('baud');
  });

  it('matches SPI pattern', () => {
    const ctx = makeContext({ askCount: 1 });
    const hint = generateHint(ctx, 'SPI MOSI not working');
    expect(hint.toLowerCase()).toContain('spi');
  });

  it('matches noise/jitter pattern', () => {
    const ctx = makeContext({ askCount: 0 });
    const hint = generateHint(ctx, 'unstable readings with noise');
    expect(hint.toLowerCase()).toMatch(/decoupling|noise|ground/);
  });

  it('returns generic hint for unrecognized errors', () => {
    const ctx = makeContext({ askCount: 0 });
    const hint = generateHint(ctx, 'something weird happened');
    expect(hint.length).toBeGreaterThan(10);
  });

  it('includes the error text in generic hint at higher askCounts', () => {
    const ctx = makeContext({ askCount: 2 });
    const hint = generateHint(ctx, 'flux capacitor overheating');
    expect(hint).toContain('flux capacitor overheating');
  });
});

// ---------------------------------------------------------------------------
// getTutorResponse
// ---------------------------------------------------------------------------

describe('getTutorResponse', () => {
  it('returns a TutorResponse with the correct style', () => {
    const styles: TutorStyle[] = ['socratic', 'explain', 'challenge', 'hint'];
    for (const style of styles) {
      const ctx = makeContext({ currentTopic: 'resistors' });
      const resp = getTutorResponse(ctx, 'tell me about resistors', style);
      expect(resp.style).toBe(style);
      expect(Array.isArray(resp.conceptsReferenced)).toBe(true);
    }
  });

  it('socratic style includes a question', () => {
    const ctx = makeContext({ currentTopic: 'capacitors' });
    const resp = getTutorResponse(ctx, 'tell me about capacitors', 'socratic');
    expect(resp.question).toBeTruthy();
    expect(resp.question!.length).toBeGreaterThan(0);
  });

  it('socratic style includes a follow-up', () => {
    const ctx = makeContext({ currentTopic: 'resistors', userLevel: 'beginner' });
    const resp = getTutorResponse(ctx, 'what is a resistor', 'socratic');
    expect(resp.followUp).toBeTruthy();
  });

  it('socratic follow-up adapts to user level', () => {
    const beginner = getTutorResponse(
      makeContext({ currentTopic: 'resistors', userLevel: 'beginner' }),
      'resistors',
      'socratic',
    );
    const advanced = getTutorResponse(
      makeContext({ currentTopic: 'resistors', userLevel: 'advanced' }),
      'resistors',
      'socratic',
    );
    expect(beginner.followUp).not.toBe(advanced.followUp);
  });

  it('explain style includes an explanation', () => {
    const ctx = makeContext({ currentTopic: 'ohms-law' });
    const resp = getTutorResponse(ctx, 'explain ohms law', 'explain');
    expect(resp.explanation).toBeTruthy();
    expect(resp.explanation!.length).toBeGreaterThan(0);
  });

  it('explain follow-up references the topic', () => {
    const ctx = makeContext({ currentTopic: 'capacitors' });
    const resp = getTutorResponse(ctx, 'explain capacitors to me', 'explain');
    expect(resp.followUp).toBeTruthy();
    expect(resp.followUp!).toContain('capacitors');
  });

  it('challenge style includes a question', () => {
    const ctx = makeContext({ currentTopic: 'pcb-design' });
    const resp = getTutorResponse(ctx, 'challenge me', 'challenge');
    expect(resp.question).toBeTruthy();
    expect(resp.question!.length).toBeGreaterThan(0);
  });

  it('challenge adapts to user level', () => {
    const beginner = getTutorResponse(
      makeContext({ currentTopic: 'resistors', userLevel: 'beginner' }),
      'challenge me on resistors',
      'challenge',
    );
    const advanced = getTutorResponse(
      makeContext({ currentTopic: 'resistors', userLevel: 'advanced' }),
      'challenge me on resistors',
      'challenge',
    );
    expect(beginner.question).not.toBe(advanced.question);
  });

  it('hint style includes an explanation (the hint)', () => {
    const ctx = makeContext({ recentErrors: ['LED not turning on'], askCount: 1 });
    const resp = getTutorResponse(ctx, 'help with my LED', 'hint');
    expect(resp.explanation).toBeTruthy();
    expect(resp.explanation!.length).toBeGreaterThan(0);
  });

  it('hint uses the most recent error from context', () => {
    const ctx = makeContext({
      recentErrors: ['old error', 'I2C address not found'],
      askCount: 1,
    });
    const resp = getTutorResponse(ctx, 'help', 'hint');
    // The hint should match the I2C pattern, not the generic one
    expect(resp.explanation!.toLowerCase()).toMatch(/pull-up|sda|scl|address|i2c/);
  });

  it('hint follow-up changes at high askCount', () => {
    const low = getTutorResponse(
      makeContext({ recentErrors: ['error'], askCount: 1 }),
      'help',
      'hint',
    );
    const high = getTutorResponse(
      makeContext({ recentErrors: ['error'], askCount: 3 }),
      'help',
      'hint',
    );
    expect(low.followUp).not.toBe(high.followUp);
  });

  it('extracts topics from user message', () => {
    const ctx = makeContext();
    const resp = getTutorResponse(ctx, 'I need help with I2C communication', 'socratic');
    expect(resp.conceptsReferenced).toContain('i2c');
  });

  it('falls back to currentTopic when message has no recognized topics', () => {
    const ctx = makeContext({ currentTopic: 'pwm' });
    const resp = getTutorResponse(ctx, 'tell me more', 'explain');
    expect(resp.conceptsReferenced).toContain('pwm');
  });

  it('returns empty conceptsReferenced when no topic is identifiable', () => {
    const ctx = makeContext();
    const resp = getTutorResponse(ctx, 'hello', 'socratic');
    expect(resp.conceptsReferenced).toEqual([]);
  });

  it('socratic falls back to a generic question when no topic is found', () => {
    const ctx = makeContext();
    const resp = getTutorResponse(ctx, 'help me learn', 'socratic');
    expect(resp.question).toBeTruthy();
    expect(resp.question!).toContain('concept');
  });
});

// ---------------------------------------------------------------------------
// classifyUserLevel
// ---------------------------------------------------------------------------

describe('classifyUserLevel', () => {
  it('returns beginner for empty history', () => {
    expect(classifyUserLevel([])).toBe('beginner');
  });

  it('returns beginner for simple messages', () => {
    const history = ['What is a resistor?', 'How do LEDs work?'];
    expect(classifyUserLevel(history)).toBe('beginner');
  });

  it('returns intermediate for messages with intermediate vocabulary', () => {
    const history = [
      'I need to set up a voltage divider with pull-up resistors',
      'How do I configure PWM duty cycle on the H-bridge driver?',
      'My I2C bus is not responding correctly',
    ];
    expect(classifyUserLevel(history)).toBe('intermediate');
  });

  it('returns advanced for messages with advanced vocabulary', () => {
    const history = [
      'I need to analyze the impedance matching on my transmission line',
      'The eye diagram shows excessive jitter on my differential pair',
      'What is the s-parameters for this return loss measurement?',
    ];
    expect(classifyUserLevel(history)).toBe('advanced');
  });

  it('considers topic breadth for intermediate classification', () => {
    // Mention 5+ distinct topics → intermediate
    const history = [
      'resistors and capacitors',
      'inductors and diodes',
      'transistors and mosfets',
      'op-amps and voltage regulators',
      'pcb design and soldering',
    ];
    expect(classifyUserLevel(history)).toBe('intermediate');
  });

  it('considers message volume for intermediate classification', () => {
    // Many words (>500) without advanced terms → intermediate
    const longHistory = [new Array(200).fill('basic electronics concept').join(' ')];
    expect(classifyUserLevel(longHistory)).toBe('intermediate');
  });

  it('mixed vocabulary with some advanced terms returns advanced', () => {
    const history = [
      'I know about voltage dividers and pull-up resistors',
      'PWM duty cycle and H-bridge configuration',
      'impedance matching for my transmission line design',
      'checking signal integrity on my board',
    ];
    // 1 advanced hit + 5+ intermediate hits → advanced
    expect(classifyUserLevel(history)).toBe('advanced');
  });
});

// ---------------------------------------------------------------------------
// AiTutor singleton
// ---------------------------------------------------------------------------

describe('AiTutor', () => {
  let tutor: AiTutor;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    AiTutor.resetForTesting();
    tutor = AiTutor.getInstance();
  });

  afterEach(() => {
    AiTutor.resetForTesting();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = AiTutor.getInstance();
    const b = AiTutor.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetForTesting', () => {
    tutor.setLevel('advanced');
    AiTutor.resetForTesting();
    const fresh = AiTutor.getInstance();
    // Fresh instance loads from localStorage, so level persists
    expect(fresh.getContext().userLevel).toBe('advanced');
  });

  // -----------------------------------------------------------------------
  // Context management
  // -----------------------------------------------------------------------

  it('starts with default beginner context', () => {
    AiTutor.resetForTesting();
    // Clear localStorage to get true defaults
    mockStorage.clear();
    const fresh = AiTutor.getInstance();
    const ctx = fresh.getContext();
    expect(ctx.userLevel).toBe('beginner');
    expect(ctx.askCount).toBe(0);
    expect(ctx.recentErrors).toEqual([]);
    expect(ctx.currentTopic).toBeUndefined();
  });

  it('setLevel updates the context', () => {
    tutor.setLevel('intermediate');
    expect(tutor.getContext().userLevel).toBe('intermediate');
  });

  it('setTopic updates the context', () => {
    tutor.setTopic('capacitors');
    expect(tutor.getContext().currentTopic).toBe('capacitors');
  });

  it('addError appends to recentErrors', () => {
    tutor.addError('LED not working');
    tutor.addError('motor stalled');
    expect(tutor.getContext().recentErrors).toEqual(['LED not working', 'motor stalled']);
  });

  it('addError caps at 10 errors', () => {
    for (let i = 0; i < 15; i++) {
      tutor.addError(`error-${i}`);
    }
    const errors = tutor.getContext().recentErrors;
    expect(errors.length).toBe(10);
    expect(errors[0]).toBe('error-5');
    expect(errors[9]).toBe('error-14');
  });

  it('resetContext clears everything', () => {
    tutor.setLevel('advanced');
    tutor.setTopic('pcb-design');
    tutor.addError('test error');
    tutor.ask('something', 'explain');
    tutor.resetContext();
    const ctx = tutor.getContext();
    expect(ctx.userLevel).toBe('beginner');
    expect(ctx.askCount).toBe(0);
    expect(ctx.recentErrors).toEqual([]);
    expect(ctx.currentTopic).toBeUndefined();
    expect(tutor.getHistory()).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Tutor operations
  // -----------------------------------------------------------------------

  it('ask() returns a TutorResponse and increments askCount', () => {
    tutor.setTopic('resistors');
    const resp = tutor.ask('tell me about resistors', 'explain');
    expect(resp.style).toBe('explain');
    expect(tutor.getContext().askCount).toBe(1);
  });

  it('ask() records the message in history', () => {
    tutor.ask('first question', 'socratic');
    tutor.ask('second question', 'explain');
    expect(tutor.getHistory()).toEqual(['first question', 'second question']);
  });

  it('socratic() returns a question and increments askCount', () => {
    const question = tutor.socratic('capacitors');
    expect(typeof question).toBe('string');
    expect(question.length).toBeGreaterThan(0);
    expect(tutor.getContext().askCount).toBe(1);
  });

  it('hint() returns a hint string', () => {
    tutor.addError('short circuit on power rail');
    const hint = tutor.hint();
    expect(typeof hint).toBe('string');
    expect(hint.length).toBeGreaterThan(0);
  });

  it('hint() with explicit error overrides context errors', () => {
    tutor.addError('I2C bus error');
    const hint = tutor.hint('motor not spinning');
    expect(hint.toLowerCase()).toMatch(/motor|transistor|driver|h-bridge/);
  });

  it('hint() falls back to "unknown issue" when no errors exist', () => {
    const hint = tutor.hint();
    expect(typeof hint).toBe('string');
    expect(hint.length).toBeGreaterThan(0);
  });

  it('reclassify() updates the user level based on history', () => {
    // Build up intermediate-level history
    tutor.ask('How do I set up a voltage divider with pull-up resistors?', 'explain');
    tutor.ask('I need to configure PWM duty cycle on my H-bridge', 'explain');
    tutor.ask('The I2C bus is not responding', 'explain');
    const level = tutor.reclassify();
    expect(level).toBe('intermediate');
    expect(tutor.getContext().userLevel).toBe('intermediate');
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  it('subscribe notifies on setLevel', () => {
    const callback = vi.fn();
    tutor.subscribe(callback);
    tutor.setLevel('advanced');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('subscribe notifies on ask', () => {
    const callback = vi.fn();
    tutor.subscribe(callback);
    tutor.ask('test', 'explain');
    expect(callback).toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const callback = vi.fn();
    const unsub = tutor.subscribe(callback);
    unsub();
    tutor.setLevel('advanced');
    expect(callback).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  it('persists context to localStorage', () => {
    tutor.setLevel('intermediate');
    tutor.setTopic('pwm');
    expect(mockStorage.setItem).toHaveBeenCalled();
    const lastCall = (mockStorage.setItem as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    expect(lastCall?.[0]).toBe('protopulse-ai-tutor');
    const parsed = JSON.parse(lastCall?.[1] as string) as Record<string, unknown>;
    expect((parsed.context as Record<string, unknown>).userLevel).toBe('intermediate');
    expect((parsed.context as Record<string, unknown>).currentTopic).toBe('pwm');
  });

  it('loads context from localStorage on init', () => {
    tutor.setLevel('advanced');
    tutor.setTopic('i2c');
    tutor.addError('bus error');

    AiTutor.resetForTesting();
    const loaded = AiTutor.getInstance();
    const ctx = loaded.getContext();
    expect(ctx.userLevel).toBe('advanced');
    expect(ctx.currentTopic).toBe('i2c');
    expect(ctx.recentErrors).toContain('bus error');
  });

  it('handles corrupt localStorage gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not valid json{{{');
    AiTutor.resetForTesting();
    const fresh = AiTutor.getInstance();
    // Should not throw; falls back to defaults
    expect(fresh.getContext().userLevel).toBe('beginner');
  });

  it('handles missing localStorage gracefully', () => {
    (mockStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    AiTutor.resetForTesting();
    const fresh = AiTutor.getInstance();
    expect(fresh.getContext().userLevel).toBe('beginner');
  });

  it('getContext returns a copy (not a reference)', () => {
    const ctx1 = tutor.getContext();
    ctx1.userLevel = 'advanced';
    ctx1.recentErrors.push('fake');
    const ctx2 = tutor.getContext();
    expect(ctx2.userLevel).toBe('beginner');
    expect(ctx2.recentErrors).not.toContain('fake');
  });
});

// ---------------------------------------------------------------------------
// useTutor hook
// ---------------------------------------------------------------------------

describe('useTutor', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    AiTutor.resetForTesting();
  });

  afterEach(() => {
    AiTutor.resetForTesting();
    vi.restoreAllMocks();
  });

  it('provides initial beginner context', () => {
    const { result } = renderHook(() => useTutor());
    expect(result.current.context.userLevel).toBe('beginner');
    expect(result.current.context.askCount).toBe(0);
    expect(result.current.history).toEqual([]);
  });

  it('ask() returns a TutorResponse', () => {
    const { result } = renderHook(() => useTutor());
    let response: ReturnType<typeof result.current.ask> | undefined;
    act(() => {
      response = result.current.ask('what is a resistor', 'explain');
    });
    expect(response).toBeDefined();
    expect(response!.style).toBe('explain');
  });

  it('hint() returns a string', () => {
    const { result } = renderHook(() => useTutor());
    let hint: string | undefined;
    act(() => {
      result.current.addError('LED not working');
      hint = result.current.hint();
    });
    expect(typeof hint).toBe('string');
    expect(hint!.length).toBeGreaterThan(0);
  });

  it('socratic() returns a question string', () => {
    const { result } = renderHook(() => useTutor());
    let question: string | undefined;
    act(() => {
      question = result.current.socratic('capacitors');
    });
    expect(typeof question).toBe('string');
    expect(question!.length).toBeGreaterThan(0);
  });

  it('challenge() returns a TutorResponse with challenge style', () => {
    const { result } = renderHook(() => useTutor());
    let response: ReturnType<typeof result.current.challenge> | undefined;
    act(() => {
      response = result.current.challenge('pcb-design');
    });
    expect(response).toBeDefined();
    expect(response!.style).toBe('challenge');
  });

  it('classify() reclassifies and updates context', () => {
    const { result } = renderHook(() => useTutor());
    act(() => {
      // Build intermediate history
      result.current.ask('voltage divider with pull-up resistors', 'explain');
      result.current.ask('PWM duty cycle on H-bridge driver', 'explain');
      result.current.ask('I2C bus configuration and protocol details', 'explain');
    });
    let level: UserLevel | undefined;
    act(() => {
      level = result.current.classify();
    });
    expect(level).toBe('intermediate');
    expect(result.current.context.userLevel).toBe('intermediate');
  });

  it('resetContext() restores defaults', () => {
    const { result } = renderHook(() => useTutor());
    act(() => {
      result.current.setLevel('advanced');
      result.current.setTopic('mosfets');
      result.current.addError('gate voltage too low');
      result.current.ask('question', 'socratic');
    });
    act(() => {
      result.current.resetContext();
    });
    expect(result.current.context.userLevel).toBe('beginner');
    expect(result.current.context.askCount).toBe(0);
    expect(result.current.history).toEqual([]);
  });

  it('setLevel updates context', () => {
    const { result } = renderHook(() => useTutor());
    act(() => {
      result.current.setLevel('advanced');
    });
    expect(result.current.context.userLevel).toBe('advanced');
  });

  it('setTopic updates context', () => {
    const { result } = renderHook(() => useTutor());
    act(() => {
      result.current.setTopic('grounding');
    });
    expect(result.current.context.currentTopic).toBe('grounding');
  });

  it('addError updates recentErrors', () => {
    const { result } = renderHook(() => useTutor());
    act(() => {
      result.current.addError('test error');
    });
    expect(result.current.context.recentErrors).toContain('test error');
  });
});
