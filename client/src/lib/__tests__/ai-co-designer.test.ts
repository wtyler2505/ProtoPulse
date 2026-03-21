import { describe, it, expect, beforeEach } from 'vitest';
import {
  AiCoDesigner,
  type DesignBrief,
  type DesignConstraint,
} from '../ai-co-designer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConstraint(
  id: string,
  name: string,
  target: string,
  weight = 0.5,
  unit?: string,
): DesignConstraint {
  return { id, name, target, weight, unit };
}

function makeBrief(overrides?: Partial<DesignBrief>): DesignBrief {
  return {
    title: 'Power Supply Design',
    description: 'A 5V regulated power supply for an Arduino project',
    constraints: [
      makeConstraint('c1', 'Output Voltage', '5.0', 0.4, 'V'),
      makeConstraint('c2', 'Max Current', '1.0', 0.3, 'A'),
      makeConstraint('c3', 'Cost', '5.00', 0.3, '$'),
    ],
    maxOptions: 3,
    tags: ['power', 'arduino'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AiCoDesigner', () => {
  let designer: AiCoDesigner;

  beforeEach(() => {
    AiCoDesigner.resetInstance();
    designer = AiCoDesigner.getInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = AiCoDesigner.getInstance();
      const b = AiCoDesigner.getInstance();
      expect(a).toBe(b);
    });

    it('resets to a fresh instance', () => {
      const first = AiCoDesigner.getInstance();
      AiCoDesigner.resetInstance();
      const second = AiCoDesigner.getInstance();
      expect(first).not.toBe(second);
    });
  });

  // -----------------------------------------------------------------------
  // Session management
  // -----------------------------------------------------------------------

  describe('session management', () => {
    it('creates a new session', () => {
      const id = designer.createSession('Test Session');
      expect(id).toBeTruthy();
      expect(designer.getActiveSession()).not.toBeNull();
      expect(designer.getActiveSession()!.title).toBe('Test Session');
    });

    it('sets the new session as active', () => {
      const id = designer.createSession('Active');
      expect(designer.getActiveSession()!.id).toBe(id);
    });

    it('getSession retrieves by ID', () => {
      const id = designer.createSession('Find Me');
      const session = designer.getSession(id);
      expect(session).not.toBeNull();
      expect(session!.title).toBe('Find Me');
    });

    it('getSession returns null for unknown ID', () => {
      expect(designer.getSession('nonexistent')).toBeNull();
    });

    it('setActiveSession switches active session', () => {
      const id1 = designer.createSession('First');
      const id2 = designer.createSession('Second');
      expect(designer.getActiveSession()!.id).toBe(id2);

      designer.setActiveSession(id1);
      expect(designer.getActiveSession()!.id).toBe(id1);
    });

    it('setActiveSession returns false for unknown ID', () => {
      expect(designer.setActiveSession('nope')).toBe(false);
    });

    it('getActiveSession returns null when no sessions exist', () => {
      expect(designer.getActiveSession()).toBeNull();
    });

    it('listSessions returns summaries sorted by updatedAt', () => {
      designer.createSession('Old');
      designer.createSession('New');
      const list = designer.listSessions();
      expect(list.length).toBe(2);
      expect(list[0].title).toBe('New');
    });

    it('completeSession marks it as completed', () => {
      const id = designer.createSession('Complete');
      expect(designer.completeSession(id)).toBe(true);
      expect(designer.getSession(id)!.status).toBe('completed');
    });

    it('completeSession returns false for unknown ID', () => {
      expect(designer.completeSession('nope')).toBe(false);
    });

    it('abandonSession marks it as abandoned', () => {
      const id = designer.createSession('Abandon');
      expect(designer.abandonSession(id)).toBe(true);
      expect(designer.getSession(id)!.status).toBe('abandoned');
    });

    it('abandonSession returns false for unknown ID', () => {
      expect(designer.abandonSession('nope')).toBe(false);
    });

    it('deleteSession removes the session entirely', () => {
      const id = designer.createSession('Delete Me');
      expect(designer.deleteSession(id)).toBe(true);
      expect(designer.getSession(id)).toBeNull();
      expect(designer.getSessionCount()).toBe(0);
    });

    it('deleteSession clears activeSessionId if deleted', () => {
      const id = designer.createSession('Active Delete');
      designer.deleteSession(id);
      expect(designer.getActiveSession()).toBeNull();
    });

    it('deleteSession returns false for unknown ID', () => {
      expect(designer.deleteSession('nope')).toBe(false);
    });

    it('getSessionCount returns correct count', () => {
      expect(designer.getSessionCount()).toBe(0);
      designer.createSession('A');
      designer.createSession('B');
      expect(designer.getSessionCount()).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Option generation
  // -----------------------------------------------------------------------

  describe('option generation', () => {
    it('generates options for a brief', () => {
      designer.createSession('Gen Test');
      const brief = makeBrief();
      const iteration = designer.generateOptions(brief);

      expect(iteration).not.toBeNull();
      expect(iteration!.options.length).toBe(3);
      expect(iteration!.iterationNumber).toBe(1);
    });

    it('returns null when no active session', () => {
      expect(designer.generateOptions(makeBrief())).toBeNull();
    });

    it('returns null when session is completed', () => {
      const id = designer.createSession('Completed');
      designer.completeSession(id);
      expect(designer.generateOptions(makeBrief())).toBeNull();
    });

    it('generates up to maxOptions options', () => {
      designer.createSession('Max Test');
      const brief = makeBrief({ maxOptions: 5 });
      const iteration = designer.generateOptions(brief);
      expect(iteration!.options.length).toBe(5);
    });

    it('caps at 8 options maximum', () => {
      designer.createSession('Cap Test');
      const brief = makeBrief({ maxOptions: 20 });
      const iteration = designer.generateOptions(brief);
      expect(iteration!.options.length).toBeLessThanOrEqual(8);
    });

    it('assigns labels to options', () => {
      designer.createSession('Label Test');
      const brief = makeBrief({ maxOptions: 3 });
      const iteration = designer.generateOptions(brief);
      const labels = iteration!.options.map((o) => o.label);
      expect(labels).toContain('Option A');
      expect(labels).toContain('Option B');
      expect(labels).toContain('Option C');
    });

    it('scores each option against constraints', () => {
      designer.createSession('Score Test');
      const brief = makeBrief();
      const iteration = designer.generateOptions(brief);

      for (const option of iteration!.options) {
        expect(option.scores.length).toBe(brief.constraints.length);
        expect(option.overallScore).toBeGreaterThanOrEqual(0);
        expect(option.overallScore).toBeLessThanOrEqual(100);
      }
    });

    it('sorts options by score descending', () => {
      designer.createSession('Sort Test');
      const iteration = designer.generateOptions(makeBrief());
      const scores = iteration!.options.map((o) => o.overallScore);
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
      }
    });

    it('each option has unique ID', () => {
      designer.createSession('ID Test');
      const iteration = designer.generateOptions(makeBrief({ maxOptions: 5 }));
      const ids = iteration!.options.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('increments iteration number', () => {
      designer.createSession('Iter Test');
      const first = designer.generateOptions(makeBrief());
      const second = designer.generateOptions(makeBrief());
      expect(first!.iterationNumber).toBe(1);
      expect(second!.iterationNumber).toBe(2);
    });

    it('options have characteristics matching constraints', () => {
      designer.createSession('Char Test');
      const brief = makeBrief();
      const iteration = designer.generateOptions(brief);

      for (const option of iteration!.options) {
        for (const constraint of brief.constraints) {
          expect(option.characteristics[constraint.name]).toBeDefined();
        }
      }
    });

    it('handles non-numeric constraint targets', () => {
      designer.createSession('NonNum Test');
      const brief = makeBrief({
        constraints: [
          makeConstraint('c1', 'Topology', 'buck converter', 0.5),
          makeConstraint('c2', 'Package', 'through-hole', 0.5),
        ],
      });
      const iteration = designer.generateOptions(brief);
      expect(iteration).not.toBeNull();
      expect(iteration!.options.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Option selection & feedback
  // -----------------------------------------------------------------------

  describe('selection and feedback', () => {
    it('selectOption marks the chosen option', () => {
      designer.createSession('Select');
      const iteration = designer.generateOptions(makeBrief());
      const optionId = iteration!.options[0].id;

      expect(designer.selectOption(optionId)).toBe(true);
      expect(designer.getCurrentIteration()!.selectedOptionId).toBe(optionId);
    });

    it('selectOption returns false for unknown option ID', () => {
      designer.createSession('Select Fail');
      designer.generateOptions(makeBrief());
      expect(designer.selectOption('nonexistent')).toBe(false);
    });

    it('selectOption returns false when no iterations exist', () => {
      designer.createSession('No Iter');
      expect(designer.selectOption('any')).toBe(false);
    });

    it('addFeedback stores feedback on current iteration', () => {
      designer.createSession('Feedback');
      designer.generateOptions(makeBrief());
      expect(designer.addFeedback('Lower the cost')).toBe(true);
      expect(designer.getCurrentIteration()!.feedback).toBe('Lower the cost');
    });

    it('addFeedback returns false when no iterations exist', () => {
      designer.createSession('No Iter');
      expect(designer.addFeedback('feedback')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Refinement
  // -----------------------------------------------------------------------

  describe('refinement', () => {
    it('creates a new iteration with refined brief', () => {
      designer.createSession('Refine');
      designer.generateOptions(makeBrief());
      designer.addFeedback('Increase current capacity');

      const refined = designer.refine({
        constraints: [
          makeConstraint('c1', 'Output Voltage', '5.0', 0.4, 'V'),
          makeConstraint('c2', 'Max Current', '2.0', 0.3, 'A'),
          makeConstraint('c3', 'Cost', '8.00', 0.3, '$'),
        ],
      });

      expect(refined).not.toBeNull();
      expect(refined!.iterationNumber).toBe(2);
      expect(designer.getIterationCount()).toBe(2);
    });

    it('uses previous brief values when not overridden', () => {
      designer.createSession('Refine Merge');
      const brief = makeBrief({ title: 'Original Title' });
      designer.generateOptions(brief);

      const refined = designer.refine({ description: 'Updated description' });
      expect(refined!.brief.title).toBe('Original Title');
      expect(refined!.brief.description).toBe('Updated description');
    });

    it('returns null when session is completed', () => {
      const id = designer.createSession('Refine Done');
      designer.generateOptions(makeBrief());
      designer.completeSession(id);
      expect(designer.refine()).toBeNull();
    });

    it('returns null when no iterations exist', () => {
      designer.createSession('Refine Empty');
      expect(designer.refine()).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Comparison matrix
  // -----------------------------------------------------------------------

  describe('comparison matrix', () => {
    it('builds a comparison matrix for current iteration', () => {
      designer.createSession('Matrix');
      designer.generateOptions(makeBrief());

      const matrix = designer.buildComparisonMatrix();
      expect(matrix).not.toBeNull();
      expect(matrix!.options.length).toBe(3);
      expect(matrix!.constraints.length).toBe(3);
      expect(matrix!.cells.length).toBe(9); // 3 options * 3 constraints
    });

    it('recommends the highest-scoring option', () => {
      designer.createSession('Recommend');
      designer.generateOptions(makeBrief());

      const matrix = designer.buildComparisonMatrix();
      const recommended = matrix!.options.find((o) => o.id === matrix!.recommendedOptionId);
      expect(recommended).toBeDefined();

      // Should be the highest-scoring option
      for (const option of matrix!.options) {
        expect(recommended!.overallScore).toBeGreaterThanOrEqual(option.overallScore);
      }
    });

    it('each cell has optionId, constraintId, score, and rationale', () => {
      designer.createSession('Cell');
      designer.generateOptions(makeBrief());

      const matrix = designer.buildComparisonMatrix();
      for (const cell of matrix!.cells) {
        expect(cell.optionId).toBeTruthy();
        expect(cell.constraintId).toBeTruthy();
        expect(typeof cell.score).toBe('number');
        expect(cell.rationale).toBeTruthy();
      }
    });

    it('returns null when no active session', () => {
      expect(designer.buildComparisonMatrix()).toBeNull();
    });

    it('returns null when no iterations exist', () => {
      designer.createSession('Empty');
      expect(designer.buildComparisonMatrix()).toBeNull();
    });

    it('accepts a specific iteration index', () => {
      designer.createSession('Index');
      designer.generateOptions(makeBrief({ maxOptions: 2 }));
      designer.generateOptions(makeBrief({ maxOptions: 4 }));

      const first = designer.buildComparisonMatrix(0);
      const second = designer.buildComparisonMatrix(1);
      expect(first!.options.length).toBe(2);
      expect(second!.options.length).toBe(4);
    });

    it('returns null for out-of-range iteration index', () => {
      designer.createSession('OOB');
      designer.generateOptions(makeBrief());
      expect(designer.buildComparisonMatrix(5)).toBeNull();
      expect(designer.buildComparisonMatrix(-1)).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  describe('queries', () => {
    it('getCurrentIteration returns the latest iteration', () => {
      designer.createSession('Query');
      designer.generateOptions(makeBrief());
      designer.generateOptions(makeBrief());

      const current = designer.getCurrentIteration();
      expect(current).not.toBeNull();
      expect(current!.iterationNumber).toBe(2);
    });

    it('getCurrentIteration returns null when no iterations', () => {
      designer.createSession('Empty');
      expect(designer.getCurrentIteration()).toBeNull();
    });

    it('getCurrentIteration returns null when no session', () => {
      expect(designer.getCurrentIteration()).toBeNull();
    });

    it('getIteration returns by 1-based number', () => {
      designer.createSession('GetIter');
      designer.generateOptions(makeBrief());
      designer.generateOptions(makeBrief());

      expect(designer.getIteration(1)!.iterationNumber).toBe(1);
      expect(designer.getIteration(2)!.iterationNumber).toBe(2);
      expect(designer.getIteration(3)).toBeNull();
    });

    it('getSelectedOption returns the selected option', () => {
      designer.createSession('Selected');
      const iteration = designer.generateOptions(makeBrief());
      designer.selectOption(iteration!.options[1].id);

      const selected = designer.getSelectedOption();
      expect(selected).not.toBeNull();
      expect(selected!.id).toBe(iteration!.options[1].id);
    });

    it('getSelectedOption returns null when nothing selected', () => {
      designer.createSession('NoSelect');
      designer.generateOptions(makeBrief());
      expect(designer.getSelectedOption()).toBeNull();
    });

    it('getBestOption returns the highest-scoring option', () => {
      designer.createSession('Best');
      designer.generateOptions(makeBrief());

      const best = designer.getBestOption();
      expect(best).not.toBeNull();
      // It should be the first (sorted descending)
      expect(best!.id).toBe(designer.getCurrentIteration()!.options[0].id);
    });

    it('getBestOption returns null when no iterations', () => {
      designer.createSession('NoBest');
      expect(designer.getBestOption()).toBeNull();
    });

    it('getIterationCount returns correct count', () => {
      designer.createSession('Count');
      expect(designer.getIterationCount()).toBe(0);
      designer.generateOptions(makeBrief());
      expect(designer.getIterationCount()).toBe(1);
      designer.generateOptions(makeBrief());
      expect(designer.getIterationCount()).toBe(2);
    });

    it('getAllOptions returns options from all iterations', () => {
      designer.createSession('AllOpts');
      designer.generateOptions(makeBrief({ maxOptions: 2 }));
      designer.generateOptions(makeBrief({ maxOptions: 3 }));

      const all = designer.getAllOptions();
      expect(all.length).toBe(5); // 2 + 3
    });

    it('getAllOptions returns empty when no session', () => {
      expect(designer.getAllOptions()).toHaveLength(0);
    });

    it('searchOptions finds by summary text', () => {
      designer.createSession('Search');
      designer.generateOptions(makeBrief({ title: 'Amplifier Circuit' }));

      const results = designer.searchOptions('Amplifier');
      expect(results.length).toBeGreaterThan(0);
    });

    it('searchOptions finds by label', () => {
      designer.createSession('Search Label');
      designer.generateOptions(makeBrief());

      const results = designer.searchOptions('Option A');
      expect(results.length).toBeGreaterThan(0);
    });

    it('searchOptions is case-insensitive', () => {
      designer.createSession('Case');
      designer.generateOptions(makeBrief({ title: 'Motor Driver' }));

      const results = designer.searchOptions('motor');
      expect(results.length).toBeGreaterThan(0);
    });

    it('searchOptions returns empty for no match', () => {
      designer.createSession('NoMatch');
      designer.generateOptions(makeBrief());
      expect(designer.searchOptions('xyznonexistent')).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe / notify
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies on createSession', () => {
      let called = 0;
      designer.subscribe(() => { called++; });
      designer.createSession('Notify');
      expect(called).toBe(1);
    });

    it('notifies on generateOptions', () => {
      designer.createSession('Gen');
      let called = 0;
      designer.subscribe(() => { called++; });
      designer.generateOptions(makeBrief());
      expect(called).toBe(1);
    });

    it('notifies on selectOption', () => {
      designer.createSession('Sel');
      const iteration = designer.generateOptions(makeBrief());
      let called = 0;
      designer.subscribe(() => { called++; });
      designer.selectOption(iteration!.options[0].id);
      expect(called).toBe(1);
    });

    it('notifies on addFeedback', () => {
      designer.createSession('FB');
      designer.generateOptions(makeBrief());
      let called = 0;
      designer.subscribe(() => { called++; });
      designer.addFeedback('test');
      expect(called).toBe(1);
    });

    it('notifies on completeSession', () => {
      const id = designer.createSession('Comp');
      let called = 0;
      designer.subscribe(() => { called++; });
      designer.completeSession(id);
      expect(called).toBe(1);
    });

    it('notifies on abandonSession', () => {
      const id = designer.createSession('Aband');
      let called = 0;
      designer.subscribe(() => { called++; });
      designer.abandonSession(id);
      expect(called).toBe(1);
    });

    it('notifies on deleteSession', () => {
      const id = designer.createSession('Del');
      let called = 0;
      designer.subscribe(() => { called++; });
      designer.deleteSession(id);
      expect(called).toBe(1);
    });

    it('notifies on setActiveSession', () => {
      const id1 = designer.createSession('A');
      designer.createSession('B');
      let called = 0;
      designer.subscribe(() => { called++; });
      designer.setActiveSession(id1);
      expect(called).toBe(1);
    });

    it('unsubscribe stops notifications', () => {
      let called = 0;
      const unsub = designer.subscribe(() => { called++; });
      unsub();
      designer.createSession('Silent');
      expect(called).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Scoring edge cases
  // -----------------------------------------------------------------------

  describe('scoring edge cases', () => {
    it('handles zero-weight constraints', () => {
      designer.createSession('ZeroWeight');
      const brief = makeBrief({
        constraints: [
          makeConstraint('c1', 'Voltage', '5.0', 0),
          makeConstraint('c2', 'Current', '1.0', 1.0),
        ],
      });
      const iteration = designer.generateOptions(brief);
      expect(iteration).not.toBeNull();
      for (const option of iteration!.options) {
        expect(option.overallScore).toBeGreaterThanOrEqual(0);
      }
    });

    it('handles single constraint', () => {
      designer.createSession('SingleConstraint');
      const brief = makeBrief({
        constraints: [makeConstraint('c1', 'Voltage', '3.3', 1.0, 'V')],
        maxOptions: 2,
      });
      const iteration = designer.generateOptions(brief);
      expect(iteration!.options.length).toBe(2);
      for (const option of iteration!.options) {
        expect(option.scores.length).toBe(1);
      }
    });

    it('handles empty constraints list', () => {
      designer.createSession('NoConstraints');
      const brief = makeBrief({ constraints: [] });
      const iteration = designer.generateOptions(brief);
      expect(iteration).not.toBeNull();
      for (const option of iteration!.options) {
        expect(option.scores.length).toBe(0);
        expect(option.overallScore).toBe(0);
      }
    });

    it('overall score is bounded 0-100', () => {
      designer.createSession('Bounds');
      const brief = makeBrief({
        constraints: [
          makeConstraint('c1', 'Extreme Low', '0.001', 0.5),
          makeConstraint('c2', 'Extreme High', '99999', 0.5),
        ],
        maxOptions: 5,
      });
      const iteration = designer.generateOptions(brief);
      for (const option of iteration!.options) {
        expect(option.overallScore).toBeGreaterThanOrEqual(0);
        expect(option.overallScore).toBeLessThanOrEqual(100);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Session listing
  // -----------------------------------------------------------------------

  describe('session listing', () => {
    it('listSessions includes iteration count and best score', () => {
      designer.createSession('Listed');
      designer.generateOptions(makeBrief());

      const list = designer.listSessions();
      expect(list.length).toBe(1);
      expect(list[0].iterationCount).toBe(1);
      expect(list[0].bestScore).toBeGreaterThan(0);
    });

    it('listSessions shows zero iterations for empty session', () => {
      designer.createSession('Empty');
      const list = designer.listSessions();
      expect(list[0].iterationCount).toBe(0);
      expect(list[0].bestScore).toBe(0);
    });

    it('listSessions includes status', () => {
      const id = designer.createSession('Statusful');
      expect(designer.listSessions()[0].status).toBe('active');
      designer.completeSession(id);
      expect(designer.listSessions()[0].status).toBe('completed');
    });
  });
});
