/**
 * BL-0430 — AI Co-Designer.
 *
 * Multi-option iterative design assistant. The user defines a design brief
 * with constraints, the co-designer generates multiple design options (mocked
 * on the client — real generation is server-side), scores each option against
 * the constraints, builds a comparison matrix, and supports refinement
 * (re-generation with modified constraints).
 *
 * Singleton+subscribe pattern. Manages design sessions with full history
 * of iterations.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single constraint for evaluating design options. */
export interface DesignConstraint {
  id: string;
  name: string;
  /** Weight for scoring (0-1, must sum to ~1 across all constraints). */
  weight: number;
  /** The target or threshold value. */
  target: string;
  /** Unit or dimension (e.g., "mA", "mm", "$"). */
  unit?: string;
}

/** A design brief that drives option generation. */
export interface DesignBrief {
  title: string;
  description: string;
  constraints: DesignConstraint[];
  maxOptions: number;
  /** Optional tags for categorization. */
  tags: string[];
}

/** Score for a single constraint within an option. */
export interface ConstraintScore {
  constraintId: string;
  /** Raw score 0-100. */
  rawScore: number;
  /** Weighted score (rawScore * constraint.weight). */
  weightedScore: number;
  /** Brief justification. */
  rationale: string;
}

/** A generated design option. */
export interface DesignOption {
  id: string;
  /** Option label (e.g., "Option A", "Option B"). */
  label: string;
  /** Human-readable summary of the option. */
  summary: string;
  /** Key characteristics or features. */
  characteristics: Record<string, string>;
  /** Per-constraint scores. */
  scores: ConstraintScore[];
  /** Overall weighted score (0-100). */
  overallScore: number;
  /** Strengths of this option. */
  strengths: string[];
  /** Weaknesses of this option. */
  weaknesses: string[];
  /** Timestamp of generation. */
  createdAt: number;
}

/** A comparison matrix cell (option vs constraint). */
export interface ComparisonCell {
  optionId: string;
  constraintId: string;
  score: number;
  rationale: string;
}

/** Full comparison matrix result. */
export interface ComparisonMatrix {
  options: DesignOption[];
  constraints: DesignConstraint[];
  cells: ComparisonCell[];
  recommendedOptionId: string;
}

/** An iteration in the refinement history. */
export interface DesignIteration {
  iterationNumber: number;
  brief: DesignBrief;
  options: DesignOption[];
  selectedOptionId: string | null;
  feedback: string | null;
  timestamp: number;
}

/** A full design session. */
export interface DesignSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  iterations: DesignIteration[];
  status: 'active' | 'completed' | 'abandoned';
}

/** Session summary for listing. */
export interface SessionSummary {
  id: string;
  title: string;
  iterationCount: number;
  bestScore: number;
  status: DesignSession['status'];
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateId(prefix: string): string {
  idCounter++;
  const ts = Date.now().toString(36);
  const count = idCounter.toString(36);
  return `${prefix}-${ts}-${count}`;
}

/** Reset ID counter (for testing). */
export function resetIdCounter(): void {
  idCounter = 0;
}

// ---------------------------------------------------------------------------
// Option label generator
// ---------------------------------------------------------------------------

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function getOptionLabel(index: number): string {
  if (index < OPTION_LABELS.length) {
    return `Option ${OPTION_LABELS[index]}`;
  }
  return `Option ${index + 1}`;
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/**
 * Score a single option against all constraints.
 * This is a client-side heuristic scorer. Real scoring would come from
 * the AI backend. Scores are based on how well the option's characteristics
 * align with constraint targets.
 */
function scoreOption(
  option: Omit<DesignOption, 'scores' | 'overallScore'>,
  constraints: DesignConstraint[],
): { scores: ConstraintScore[]; overallScore: number } {
  const scores: ConstraintScore[] = [];
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const constraint of constraints) {
    const charValue = option.characteristics[constraint.name];
    let rawScore: number;
    let rationale: string;

    if (charValue) {
      // Simple heuristic: longer value strings suggesting more detail → higher score
      // This is a placeholder — real scoring is server-side via AI
      const charNum = parseFloat(charValue);
      const targetNum = parseFloat(constraint.target);

      if (!isNaN(charNum) && !isNaN(targetNum) && targetNum !== 0) {
        // Numeric comparison — closer to target = higher score
        const ratio = charNum / targetNum;
        rawScore = Math.max(0, Math.min(100, 100 - Math.abs(1 - ratio) * 100));
        rationale = `Value ${charValue} vs target ${constraint.target}${constraint.unit ? ' ' + constraint.unit : ''}`;
      } else {
        // Non-numeric — presence-based scoring
        rawScore = 70;
        rationale = `Characteristic "${charValue}" partially meets "${constraint.target}"`;
      }
    } else {
      rawScore = 30;
      rationale = `No specific data for "${constraint.name}"`;
    }

    const weightedScore = rawScore * constraint.weight;
    totalWeightedScore += weightedScore;
    totalWeight += constraint.weight;

    scores.push({
      constraintId: constraint.id,
      rawScore: Math.round(rawScore),
      weightedScore: Math.round(weightedScore * 10) / 10,
      rationale,
    });
  }

  const overallScore = totalWeight > 0
    ? Math.round((totalWeightedScore / totalWeight) * 10) / 10
    : 0;

  return { scores, overallScore };
}

// ---------------------------------------------------------------------------
// AiCoDesigner — singleton + subscribe
// ---------------------------------------------------------------------------

export class AiCoDesigner {
  private static instance: AiCoDesigner | null = null;

  private sessions: Map<string, DesignSession> = new Map();
  private activeSessionId: string | null = null;
  private subscribers = new Set<() => void>();

  private constructor() {}

  static getInstance(): AiCoDesigner {
    if (!AiCoDesigner.instance) {
      AiCoDesigner.instance = new AiCoDesigner();
    }
    return AiCoDesigner.instance;
  }

  /** Reset singleton for testing. */
  static resetInstance(): void {
    if (AiCoDesigner.instance) {
      AiCoDesigner.instance.subscribers.clear();
    }
    AiCoDesigner.instance = null;
    resetIdCounter();
  }

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify(): void {
    this.subscribers.forEach((fn) => fn());
  }

  // -----------------------------------------------------------------------
  // Session management
  // -----------------------------------------------------------------------

  /** Create a new design session. Returns the session ID. */
  createSession(title: string): string {
    const id = generateId('session');
    const now = Date.now();
    const session: DesignSession = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
      iterations: [],
      status: 'active',
    };
    this.sessions.set(id, session);
    this.activeSessionId = id;
    this.notify();
    return id;
  }

  /** Get the active session. */
  getActiveSession(): DesignSession | null {
    if (!this.activeSessionId) {
      return null;
    }
    return this.sessions.get(this.activeSessionId) ?? null;
  }

  /** Set the active session by ID. */
  setActiveSession(sessionId: string): boolean {
    if (!this.sessions.has(sessionId)) {
      return false;
    }
    this.activeSessionId = sessionId;
    this.notify();
    return true;
  }

  /** Get a session by ID. */
  getSession(sessionId: string): DesignSession | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /** Get all sessions as summaries (most recently updated first). */
  listSessions(): SessionSummary[] {
    const summaries: SessionSummary[] = [];
    this.sessions.forEach((session) => {
      let bestScore = 0;
      for (const iteration of session.iterations) {
        for (const option of iteration.options) {
          if (option.overallScore > bestScore) {
            bestScore = option.overallScore;
          }
        }
      }

      summaries.push({
        id: session.id,
        title: session.title,
        iterationCount: session.iterations.length,
        bestScore,
        status: session.status,
        updatedAt: session.updatedAt,
      });
    });

    // Sort by updatedAt descending; tiebreak by createdAt descending (newer first)
    summaries.sort((a, b) => {
      const timeDiff = b.updatedAt - a.updatedAt;
      if (timeDiff !== 0) {
        return timeDiff;
      }
      // When timestamps tie (same ms), use session ID comparison
      // IDs incorporate a counter, so later-created sessions have lexically later IDs
      return b.id.localeCompare(a.id);
    });
    return summaries;
  }

  /** Complete a session (marks it as finished). */
  completeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    session.status = 'completed';
    session.updatedAt = Date.now();
    this.notify();
    return true;
  }

  /** Abandon a session. */
  abandonSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    session.status = 'abandoned';
    session.updatedAt = Date.now();
    this.notify();
    return true;
  }

  /** Delete a session entirely. */
  deleteSession(sessionId: string): boolean {
    if (!this.sessions.has(sessionId)) {
      return false;
    }
    this.sessions.delete(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
    this.notify();
    return true;
  }

  /** Get session count. */
  getSessionCount(): number {
    return this.sessions.size;
  }

  // -----------------------------------------------------------------------
  // Option generation
  // -----------------------------------------------------------------------

  /**
   * Generate design options for a brief in the active session.
   * Creates a new iteration with scored options.
   * In production, this would call the AI backend — here we generate
   * placeholder options for the UI to display.
   */
  generateOptions(brief: DesignBrief): DesignIteration | null {
    const session = this.getActiveSession();
    if (!session || session.status !== 'active') {
      return null;
    }

    const optionCount = Math.min(brief.maxOptions, 8);
    const options: DesignOption[] = [];

    for (let i = 0; i < optionCount; i++) {
      const characteristics: Record<string, string> = {};
      for (const constraint of brief.constraints) {
        // Generate a placeholder characteristic value
        const targetNum = parseFloat(constraint.target);
        if (!isNaN(targetNum)) {
          // Vary around the target value
          const variance = targetNum * (0.7 + Math.random() * 0.6);
          characteristics[constraint.name] = variance.toFixed(2);
        } else {
          characteristics[constraint.name] = constraint.target;
        }
      }

      const baseOption = {
        id: generateId('option'),
        label: getOptionLabel(i),
        summary: `Design option ${getOptionLabel(i)} for "${brief.title}"`,
        characteristics,
        strengths: [`Addresses "${brief.description}"`],
        weaknesses: [],
        createdAt: Date.now(),
      };

      const { scores, overallScore } = scoreOption(baseOption, brief.constraints);
      options.push({ ...baseOption, scores, overallScore });
    }

    // Sort by score descending
    options.sort((a, b) => b.overallScore - a.overallScore);

    // Mark strengths/weaknesses based on ranking
    if (options.length > 0) {
      options[0].strengths.push('Highest overall score');
    }
    if (options.length > 1) {
      options[options.length - 1].weaknesses.push('Lowest overall score');
    }

    const iteration: DesignIteration = {
      iterationNumber: session.iterations.length + 1,
      brief: { ...brief },
      options,
      selectedOptionId: null,
      feedback: null,
      timestamp: Date.now(),
    };

    session.iterations.push(iteration);
    session.updatedAt = Date.now();
    this.notify();
    return iteration;
  }

  // -----------------------------------------------------------------------
  // Option selection & refinement
  // -----------------------------------------------------------------------

  /** Select an option in the current iteration of the active session. */
  selectOption(optionId: string): boolean {
    const session = this.getActiveSession();
    if (!session || session.iterations.length === 0) {
      return false;
    }

    const currentIteration = session.iterations[session.iterations.length - 1];
    const optionExists = currentIteration.options.some((o) => o.id === optionId);
    if (!optionExists) {
      return false;
    }

    currentIteration.selectedOptionId = optionId;
    session.updatedAt = Date.now();
    this.notify();
    return true;
  }

  /** Add feedback to the current iteration for refinement. */
  addFeedback(feedback: string): boolean {
    const session = this.getActiveSession();
    if (!session || session.iterations.length === 0) {
      return false;
    }

    const currentIteration = session.iterations[session.iterations.length - 1];
    currentIteration.feedback = feedback;
    session.updatedAt = Date.now();
    this.notify();
    return true;
  }

  /**
   * Refine: generate a new iteration based on the selected option and
   * feedback from the current iteration. Adjusts constraints based on feedback.
   */
  refine(updatedBrief?: Partial<DesignBrief>): DesignIteration | null {
    const session = this.getActiveSession();
    if (!session || session.iterations.length === 0 || session.status !== 'active') {
      return null;
    }

    const currentIteration = session.iterations[session.iterations.length - 1];
    const baseBrief = currentIteration.brief;

    const refinedBrief: DesignBrief = {
      title: updatedBrief?.title ?? baseBrief.title,
      description: updatedBrief?.description ?? baseBrief.description,
      constraints: updatedBrief?.constraints ?? baseBrief.constraints,
      maxOptions: updatedBrief?.maxOptions ?? baseBrief.maxOptions,
      tags: updatedBrief?.tags ?? baseBrief.tags,
    };

    return this.generateOptions(refinedBrief);
  }

  // -----------------------------------------------------------------------
  // Comparison matrix
  // -----------------------------------------------------------------------

  /**
   * Build a comparison matrix for the current iteration's options.
   * Returns null if no active session or no iterations.
   */
  buildComparisonMatrix(iterationIndex?: number): ComparisonMatrix | null {
    const session = this.getActiveSession();
    if (!session || session.iterations.length === 0) {
      return null;
    }

    const idx = iterationIndex ?? session.iterations.length - 1;
    if (idx < 0 || idx >= session.iterations.length) {
      return null;
    }

    const iteration = session.iterations[idx];
    const { options, brief } = iteration;

    const cells: ComparisonCell[] = [];
    for (const option of options) {
      for (const score of option.scores) {
        cells.push({
          optionId: option.id,
          constraintId: score.constraintId,
          score: score.rawScore,
          rationale: score.rationale,
        });
      }
    }

    // Find best option
    let recommendedOptionId = '';
    let bestScore = -1;
    for (const option of options) {
      if (option.overallScore > bestScore) {
        bestScore = option.overallScore;
        recommendedOptionId = option.id;
      }
    }

    return {
      options: [...options],
      constraints: [...brief.constraints],
      cells,
      recommendedOptionId,
    };
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Get the current iteration of the active session. */
  getCurrentIteration(): DesignIteration | null {
    const session = this.getActiveSession();
    if (!session || session.iterations.length === 0) {
      return null;
    }
    return session.iterations[session.iterations.length - 1];
  }

  /** Get a specific iteration by number (1-based). */
  getIteration(iterationNumber: number): DesignIteration | null {
    const session = this.getActiveSession();
    if (!session) {
      return null;
    }
    return session.iterations[iterationNumber - 1] ?? null;
  }

  /** Get the selected option from the current iteration. */
  getSelectedOption(): DesignOption | null {
    const iteration = this.getCurrentIteration();
    if (!iteration || !iteration.selectedOptionId) {
      return null;
    }
    return iteration.options.find((o) => o.id === iteration.selectedOptionId) ?? null;
  }

  /** Get the best option (highest score) from the current iteration. */
  getBestOption(): DesignOption | null {
    const iteration = this.getCurrentIteration();
    if (!iteration || iteration.options.length === 0) {
      return null;
    }
    return iteration.options.reduce((best, option) =>
      option.overallScore > best.overallScore ? option : best,
    );
  }

  /** Get iteration count for the active session. */
  getIterationCount(): number {
    const session = this.getActiveSession();
    return session ? session.iterations.length : 0;
  }

  /** Get all options from all iterations (for history). */
  getAllOptions(): DesignOption[] {
    const session = this.getActiveSession();
    if (!session) {
      return [];
    }
    const result: DesignOption[] = [];
    for (const iteration of session.iterations) {
      result.push(...iteration.options);
    }
    return result;
  }

  /** Search options by summary text. */
  searchOptions(query: string): DesignOption[] {
    const lower = query.toLowerCase();
    return this.getAllOptions().filter((o) =>
      o.summary.toLowerCase().includes(lower) ||
      o.label.toLowerCase().includes(lower),
    );
  }
}
