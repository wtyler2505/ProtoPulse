/**
 * Self-Healing Assistant — deterministic ID generator.
 * Split from self-healing.ts.
 */

let idCounter = 0;

export function nextId(prefix: string): string {
  idCounter++;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

/** Reset ID counter (for testing). */
export function resetIdCounter(): void {
  idCounter = 0;
}
