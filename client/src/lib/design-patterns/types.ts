/**
 * Design pattern library type definitions.
 *
 * Each DesignPattern is a curated, educational circuit building block
 * that explains not just WHAT to build but WHY it works — aimed at
 * makers and learners who are new to electronics.
 */

/** Functional categories for circuit design patterns. */
export type PatternCategory =
  | 'power'
  | 'signal'
  | 'communication'
  | 'protection'
  | 'motor'
  | 'sensor'
  | 'digital';

/** Difficulty tier for a design pattern. */
export type PatternDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** A single component required by a design pattern. */
export interface PatternComponent {
  /** Human-readable name (e.g. "Decoupling capacitor"). */
  name: string;
  /** Component type / footprint (e.g. "ceramic capacitor", "MOSFET"). */
  type: string;
  /** Typical value or part number (e.g. "100 nF", "IRLZ44N"). */
  value?: string;
  /** Extra context for the learner. */
  notes?: string;
}

/** A single connection between components in a pattern. */
export interface PatternConnection {
  /** Source component or pin (e.g. "C1 terminal 1"). */
  from: string;
  /** Destination component or pin (e.g. "IC VCC pin"). */
  to: string;
  /** Plain-English description of the connection's purpose. */
  description: string;
}

/** A complete, educational circuit design pattern. */
export interface DesignPattern {
  /** Unique kebab-case identifier (e.g. "decoupling-network"). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Functional category for filtering. */
  category: PatternCategory;
  /** Skill level required to understand and apply this pattern. */
  difficulty: PatternDifficulty;
  /** 1-2 sentence summary of what this pattern does. */
  description: string;
  /** 2-4 sentences explaining the underlying electronics principle. */
  whyItWorks: string;
  /** Components needed to implement this pattern. */
  components: PatternComponent[];
  /** How the components connect together. */
  connections: PatternConnection[];
  /** Practical tips for successful implementation. */
  tips: string[];
  /** Mistakes beginners commonly make with this pattern. */
  commonMistakes: string[];
  /** IDs of related patterns the learner should explore next. */
  relatedPatterns: string[];
  /** Search keywords (name + description are also searched). */
  tags: string[];
}
