import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRecipe,
  hasRecipe,
  getAllRecipes,
  getRecipesByCategory,
  getRecipesByDifficulty,
  searchRecipes,
  createWizardState,
  nextStep,
  prevStep,
  toggleStepComplete,
  goToStep,
  isComplete,
  getProgress,
  getDrcRecipeCount,
  getErcRecipeCount,
} from '../remediation-wizard';
import type { RemediationRecipe, WizardState } from '../remediation-wizard';

// ---------------------------------------------------------------------------
// Recipe registry tests
// ---------------------------------------------------------------------------

describe('remediation-wizard recipe registry', () => {
  it('returns a recipe for min-clearance', () => {
    const recipe = getRecipe('min-clearance');
    expect(recipe).toBeDefined();
    expect(recipe!.id).toBe('min-clearance');
    expect(recipe!.category).toBe('drc');
    expect(recipe!.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('returns undefined for unknown rule type', () => {
    expect(getRecipe('nonexistent-rule')).toBeUndefined();
  });

  it('hasRecipe returns true for known recipes', () => {
    expect(hasRecipe('min-clearance')).toBe(true);
    expect(hasRecipe('courtyard-overlap')).toBe(true);
    expect(hasRecipe('unconnected-pin')).toBe(true);
  });

  it('hasRecipe returns false for unknown rule types', () => {
    expect(hasRecipe('imaginary-rule')).toBe(false);
  });

  it('getAllRecipes returns all recipes', () => {
    const all = getAllRecipes();
    expect(all.length).toBeGreaterThanOrEqual(10);
    // Each recipe should have required fields
    for (const r of all) {
      expect(r.id).toBeTruthy();
      expect(r.title).toBeTruthy();
      expect(r.whyItMatters).toBeTruthy();
      expect(r.steps.length).toBeGreaterThanOrEqual(2);
      expect(['beginner', 'intermediate', 'advanced']).toContain(r.difficulty);
      expect(['drc', 'erc', 'arch']).toContain(r.category);
    }
  });

  it('every recipe has numbered steps starting at 1', () => {
    for (const recipe of getAllRecipes()) {
      recipe.steps.forEach((step, i) => {
        expect(step.number).toBe(i + 1);
        expect(step.instruction).toBeTruthy();
      });
    }
  });

  it('every recipe has at least one verification step', () => {
    for (const recipe of getAllRecipes()) {
      const hasVerification = recipe.steps.some((s) => s.isVerification);
      expect(hasVerification).toBe(true);
    }
  });

  it('recipe IDs are unique', () => {
    const all = getAllRecipes();
    const ids = all.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// Filtering and search
// ---------------------------------------------------------------------------

describe('remediation-wizard filtering', () => {
  it('filters by drc category', () => {
    const drc = getRecipesByCategory('drc');
    expect(drc.length).toBeGreaterThanOrEqual(5);
    for (const r of drc) {
      expect(r.category).toBe('drc');
    }
  });

  it('filters by erc category', () => {
    const erc = getRecipesByCategory('erc');
    expect(erc.length).toBeGreaterThanOrEqual(3);
    for (const r of erc) {
      expect(r.category).toBe('erc');
    }
  });

  it('filters by difficulty', () => {
    const beginner = getRecipesByDifficulty('beginner');
    expect(beginner.length).toBeGreaterThanOrEqual(1);
    for (const r of beginner) {
      expect(r.difficulty).toBe('beginner');
    }

    const advanced = getRecipesByDifficulty('advanced');
    for (const r of advanced) {
      expect(r.difficulty).toBe('advanced');
    }
  });

  it('searchRecipes matches by title', () => {
    const results = searchRecipes('clearance');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.id === 'min-clearance')).toBe(true);
  });

  it('searchRecipes matches by tag', () => {
    const results = searchRecipes('soldering');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('searchRecipes matches by whyItMatters', () => {
    const results = searchRecipes('short circuit');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('searchRecipes returns all recipes for empty query', () => {
    const all = getAllRecipes();
    expect(searchRecipes('').length).toBe(all.length);
    expect(searchRecipes('  ').length).toBe(all.length);
  });

  it('searchRecipes is case-insensitive', () => {
    const lower = searchRecipes('bypass');
    const upper = searchRecipes('BYPASS');
    expect(lower.length).toBe(upper.length);
  });
});

// ---------------------------------------------------------------------------
// Count helpers
// ---------------------------------------------------------------------------

describe('remediation-wizard counts', () => {
  it('getDrcRecipeCount returns count of DRC recipes', () => {
    const count = getDrcRecipeCount();
    const manual = getRecipesByCategory('drc').length;
    expect(count).toBe(manual);
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it('getErcRecipeCount returns count of ERC recipes', () => {
    const count = getErcRecipeCount();
    const manual = getRecipesByCategory('erc').length;
    expect(count).toBe(manual);
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Wizard state machine
// ---------------------------------------------------------------------------

describe('remediation-wizard state machine', () => {
  let recipe: RemediationRecipe;
  let initial: WizardState;

  beforeEach(() => {
    recipe = getRecipe('min-clearance')!;
    initial = createWizardState(recipe, 'Components too close: 0.1mm < 0.2mm required', 'drc-123');
  });

  it('createWizardState initializes correctly', () => {
    expect(initial.currentStep).toBe(0);
    expect(initial.completedSteps.size).toBe(0);
    expect(initial.violationMessage).toBe('Components too close: 0.1mm < 0.2mm required');
    expect(initial.violationId).toBe('drc-123');
    expect(initial.recipe.id).toBe('min-clearance');
  });

  it('nextStep advances and marks current as complete', () => {
    const next = nextStep(initial);
    expect(next).not.toBeNull();
    expect(next!.currentStep).toBe(1);
    expect(next!.completedSteps.has(0)).toBe(true);
  });

  it('nextStep returns null at last step', () => {
    let state = initial;
    for (let i = 0; i < recipe.steps.length - 1; i++) {
      const n = nextStep(state);
      expect(n).not.toBeNull();
      state = n!;
    }
    expect(nextStep(state)).toBeNull();
  });

  it('prevStep goes back', () => {
    const step1 = nextStep(initial)!;
    const backTo0 = prevStep(step1);
    expect(backTo0).not.toBeNull();
    expect(backTo0!.currentStep).toBe(0);
  });

  it('prevStep returns null at step 0', () => {
    expect(prevStep(initial)).toBeNull();
  });

  it('toggleStepComplete toggles on and off', () => {
    const toggled = toggleStepComplete(initial, 2);
    expect(toggled.completedSteps.has(2)).toBe(true);

    const untoggled = toggleStepComplete(toggled, 2);
    expect(untoggled.completedSteps.has(2)).toBe(false);
  });

  it('goToStep jumps to valid step', () => {
    const jumped = goToStep(initial, 2);
    expect(jumped).not.toBeNull();
    expect(jumped!.currentStep).toBe(2);
  });

  it('goToStep returns null for out-of-range', () => {
    expect(goToStep(initial, -1)).toBeNull();
    expect(goToStep(initial, 999)).toBeNull();
  });

  it('isComplete returns false when steps remain', () => {
    expect(isComplete(initial)).toBe(false);
  });

  it('isComplete returns true when all steps are marked done', () => {
    let state = initial;
    for (let i = 0; i < recipe.steps.length; i++) {
      state = toggleStepComplete(state, i);
    }
    expect(isComplete(state)).toBe(true);
  });

  it('getProgress returns 0 for initial state', () => {
    expect(getProgress(initial)).toBe(0);
  });

  it('getProgress returns 1.0 when all steps complete', () => {
    let state = initial;
    for (let i = 0; i < recipe.steps.length; i++) {
      state = toggleStepComplete(state, i);
    }
    expect(getProgress(state)).toBe(1);
  });

  it('getProgress returns correct fraction', () => {
    const state = toggleStepComplete(initial, 0);
    const expected = 1 / recipe.steps.length;
    expect(getProgress(state)).toBeCloseTo(expected);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('remediation-wizard edge cases', () => {
  it('each known DRC rule type has a recipe', () => {
    const expectedDrc = ['min-clearance', 'courtyard-overlap', 'min-trace-width', 'annular-ring', 'silk-overlap', 'via-in-pad', 'thermal-relief', 'pad-size'];
    for (const ruleType of expectedDrc) {
      expect(hasRecipe(ruleType)).toBe(true);
    }
  });

  it('each known ERC rule type with a recipe can be retrieved', () => {
    const expectedErc = ['unconnected-pin', 'floating-input', 'missing-bypass-cap', 'driver-conflict', 'shorted-power'];
    for (const ruleType of expectedErc) {
      expect(hasRecipe(ruleType)).toBe(true);
    }
  });

  it('PCB-level DRC rules have recipes', () => {
    expect(hasRecipe('trace_clearance')).toBe(true);
    expect(hasRecipe('board_edge_clearance')).toBe(true);
    expect(hasRecipe('diff_pair_spacing')).toBe(true);
  });

  it('wizard state is immutable — does not mutate original', () => {
    const recipe = getRecipe('min-clearance')!;
    const original = createWizardState(recipe, 'test', 'id-1');
    const advanced = nextStep(original);
    // Original should be unchanged
    expect(original.currentStep).toBe(0);
    expect(original.completedSteps.size).toBe(0);
    expect(advanced!.currentStep).toBe(1);
  });

  it('toggleStepComplete does not mutate the original completedSteps set', () => {
    const recipe = getRecipe('min-clearance')!;
    const state = createWizardState(recipe, 'test', 'id-2');
    const toggled = toggleStepComplete(state, 0);
    expect(state.completedSteps.has(0)).toBe(false);
    expect(toggled.completedSteps.has(0)).toBe(true);
  });
});
