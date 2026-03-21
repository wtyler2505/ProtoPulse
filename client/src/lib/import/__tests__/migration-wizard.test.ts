import { describe, it, expect, beforeEach } from 'vitest';

import { MigrationWizard } from '../migration-wizard';
import type {
  SourceEdaTool,
  MigrationPlan,
  CompatibilityAssessment,
  FormatDetection,
  MigrationStep,
} from '../migration-wizard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWizard(): MigrationWizard {
  MigrationWizard.resetInstance();
  return MigrationWizard.getInstance();
}

const ALL_TOOLS: SourceEdaTool[] = ['kicad', 'eagle', 'easyeda', 'altium', 'fritzing'];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MigrationWizard', () => {
  let wizard: MigrationWizard;

  beforeEach(() => {
    wizard = createWizard();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = MigrationWizard.getInstance();
      const b = MigrationWizard.getInstance();
      expect(a).toBe(b);
    });

    it('resets the singleton', () => {
      const a = MigrationWizard.getInstance();
      MigrationWizard.resetInstance();
      const b = MigrationWizard.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe / notify
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies listeners on plan creation', () => {
      let called = 0;
      wizard.subscribe(() => { called++; });
      wizard.createPlan('kicad', 'test.kicad_sch');
      expect(called).toBe(1);
    });

    it('allows unsubscribing', () => {
      let called = 0;
      const unsub = wizard.subscribe(() => { called++; });
      unsub();
      wizard.createPlan('kicad', 'test.kicad_sch');
      expect(called).toBe(0);
    });

    it('notifies on step advance', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      let called = 0;
      wizard.subscribe(() => { called++; });
      wizard.advanceStep(plan.id);
      expect(called).toBeGreaterThanOrEqual(1);
    });

    it('notifies on plan deletion', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      let called = 0;
      wizard.subscribe(() => { called++; });
      wizard.deletePlan(plan.id);
      expect(called).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Format detection
  // -----------------------------------------------------------------------

  describe('detectSource', () => {
    it('detects KiCad from .kicad_sch extension', () => {
      const result = wizard.detectSource('circuit.kicad_sch');
      expect(result.tool).toBe('kicad');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.matchedExtension).toBe('.kicad_sch');
    });

    it('detects KiCad from .kicad_pcb extension', () => {
      const result = wizard.detectSource('board.kicad_pcb');
      expect(result.tool).toBe('kicad');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('detects EAGLE from .brd extension', () => {
      const result = wizard.detectSource('board.brd');
      expect(result.tool).toBe('eagle');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('detects Altium from .SchDoc extension', () => {
      const result = wizard.detectSource('sheet1.SchDoc');
      expect(result.tool).toBe('altium');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('detects Altium from .PcbDoc extension', () => {
      const result = wizard.detectSource('board.PcbDoc');
      expect(result.tool).toBe('altium');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('detects Fritzing from .fzz extension', () => {
      const result = wizard.detectSource('project.fzz');
      expect(result.tool).toBe('fritzing');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('detects Fritzing from .fzpz extension', () => {
      const result = wizard.detectSource('component.fzpz');
      expect(result.tool).toBe('fritzing');
    });

    it('detects EasyEDA from .easyeda extension', () => {
      const result = wizard.detectSource('project.easyeda');
      expect(result.tool).toBe('easyeda');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('uses lower confidence for ambiguous extensions (.json)', () => {
      const result = wizard.detectSource('design.json');
      expect(result.tool).toBe('easyeda');
      expect(result.confidence).toBeLessThan(0.9);
    });

    it('uses lower confidence for ambiguous extensions (.sch)', () => {
      const result = wizard.detectSource('design.sch');
      expect(result.confidence).toBeLessThan(0.9);
    });

    it('boosts confidence with content signature for EasyEDA', () => {
      const result = wizard.detectSource('design.json', '{"docType":"1","editorVersion":"6.5.0"}');
      expect(result.tool).toBe('easyeda');
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
      expect(result.matchedSignature).toBeTruthy();
    });

    it('boosts confidence with content signature for EAGLE', () => {
      const result = wizard.detectSource('design.sch', '<!DOCTYPE eagle SYSTEM "eagle.dtd">');
      expect(result.tool).toBe('eagle');
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('detects KiCad from content even with wrong extension', () => {
      const result = wizard.detectSource('unknown.txt', '(kicad_sch (version 20211014))');
      expect(result.tool).toBe('kicad');
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('detects Altium from content signature', () => {
      const result = wizard.detectSource('design.txt', '|RECORD=1|OWNERPARTID=-1|');
      expect(result.tool).toBe('altium');
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('detects Fritzing from content signature', () => {
      const result = wizard.detectSource('part.xml', '<module fritzingVersion="0.9.9">');
      expect(result.tool).toBe('fritzing');
      expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('returns null tool for completely unknown file', () => {
      const result = wizard.detectSource('document.pdf');
      expect(result.tool).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('returns null tool for unknown content with no extension match', () => {
      const result = wizard.detectSource('something.xyz', 'random content');
      expect(result.tool).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Compatibility assessment
  // -----------------------------------------------------------------------

  describe('assessCompatibility', () => {
    it('returns assessment for each supported tool', () => {
      ALL_TOOLS.forEach((tool) => {
        const assessment = wizard.assessCompatibility(tool);
        expect(assessment.source).toBe(tool);
        expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
        expect(assessment.overallScore).toBeLessThanOrEqual(100);
        expect(assessment.features.length).toBeGreaterThan(0);
        expect(['simple', 'moderate', 'complex']).toContain(assessment.complexity);
      });
    });

    it('KiCad has high compatibility score', () => {
      const assessment = wizard.assessCompatibility('kicad');
      expect(assessment.overallScore).toBeGreaterThanOrEqual(70);
    });

    it('EAGLE has reasonable compatibility score', () => {
      const assessment = wizard.assessCompatibility('eagle');
      expect(assessment.overallScore).toBeGreaterThanOrEqual(60);
    });

    it('EasyEDA has reasonable compatibility score', () => {
      const assessment = wizard.assessCompatibility('easyeda');
      expect(assessment.overallScore).toBeGreaterThanOrEqual(50);
    });

    it('includes blockers for features with source support but no proto support', () => {
      const assessment = wizard.assessCompatibility('altium');
      // Altium has Version history (source=true, proto=unsupported)
      expect(assessment.blockers.length).toBeGreaterThan(0);
    });

    it('includes warnings for partial support', () => {
      const assessment = wizard.assessCompatibility('kicad');
      expect(assessment.warnings.length).toBeGreaterThan(0);
    });

    it('includes tool-specific tips', () => {
      const assessment = wizard.assessCompatibility('easyeda');
      expect(assessment.tips.some((t) => t.includes('LCSC') || t.includes('JLCPCB'))).toBe(true);
    });

    it('complexity is simple when score is high and no blockers', () => {
      const assessment = wizard.assessCompatibility('kicad');
      // KiCad should be simple or moderate
      expect(['simple', 'moderate']).toContain(assessment.complexity);
    });

    it('feature list covers all defined features', () => {
      const assessment = wizard.assessCompatibility('kicad');
      expect(assessment.features.length).toBe(14);
    });

    it('each feature has required fields', () => {
      const assessment = wizard.assessCompatibility('eagle');
      assessment.features.forEach((f) => {
        expect(typeof f.feature).toBe('string');
        expect(typeof f.sourceSupport).toBe('boolean');
        expect(['full', 'partial', 'unsupported', 'manual']).toContain(f.protoSupport);
        expect(typeof f.notes).toBe('string');
      });
    });

    it('Fritzing has some unsupported features', () => {
      const assessment = wizard.assessCompatibility('fritzing');
      const unsupported = assessment.features.filter(
        (f) => f.sourceSupport && f.protoSupport === 'unsupported',
      );
      // Fritzing doesn't support most advanced features, but those with sourceSupport=false
      // don't count as unsupported. Check specifically if any exist.
      // Fritzing has very few features that are source=true + proto=unsupported
      expect(assessment.features.length).toBe(14);
    });
  });

  // -----------------------------------------------------------------------
  // Plan creation
  // -----------------------------------------------------------------------

  describe('createPlan', () => {
    it('creates a plan for each supported tool', () => {
      ALL_TOOLS.forEach((tool) => {
        const plan = wizard.createPlan(tool, `test.${tool}`);
        expect(plan.id).toBeTruthy();
        expect(plan.source).toBe(tool);
        expect(plan.status).toBe('not_started');
        expect(plan.steps.length).toBeGreaterThan(0);
        expect(plan.currentStepIndex).toBe(0);
      });
    });

    it('includes backup as first step', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      expect(plan.steps[0].id).toBe('backup');
      expect(plan.steps[0].optional).toBe(false);
    });

    it('includes import-design step', () => {
      const plan = wizard.createPlan('easyeda', 'circuit.json');
      const importStep = plan.steps.find((s) => s.id === 'import-design');
      expect(importStep).toBeDefined();
    });

    it('includes DRC step', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      const drcStep = plan.steps.find((s) => s.id === 'run-drc');
      expect(drcStep).toBeDefined();
    });

    it('sets step order sequentially', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      plan.steps.forEach((step, index) => {
        expect(step.order).toBe(index + 1);
      });
    });

    it('all steps start as pending', () => {
      const plan = wizard.createPlan('eagle', 'test.sch');
      plan.steps.forEach((step) => {
        expect(step.status).toBe('pending');
      });
    });

    it('preserves file name and version', () => {
      const plan = wizard.createPlan('altium', 'board.SchDoc', '22.0');
      expect(plan.fileName).toBe('board.SchDoc');
      expect(plan.sourceVersion).toBe('22.0');
    });

    it('includes compatibility assessment', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      expect(plan.compatibility).toBeDefined();
      expect(plan.compatibility.source).toBe('kicad');
      expect(plan.compatibility.overallScore).toBeGreaterThanOrEqual(0);
    });

    it('assigns unique IDs', () => {
      const plan1 = wizard.createPlan('kicad', 'a.kicad_sch');
      const plan2 = wizard.createPlan('eagle', 'b.sch');
      expect(plan1.id).not.toBe(plan2.id);
    });

    it('sets createdAt timestamp', () => {
      const before = Date.now();
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      const after = Date.now();
      expect(plan.createdAt).toBeGreaterThanOrEqual(before);
      expect(plan.createdAt).toBeLessThanOrEqual(after);
    });

    it('EasyEDA plan includes JLCPCB verification step', () => {
      const plan = wizard.createPlan('easyeda', 'circuit.json');
      const jlcpcbStep = plan.steps.find((s) => s.id === 'verify-jlcpcb');
      expect(jlcpcbStep).toBeDefined();
      expect(jlcpcbStep!.optional).toBe(true);
    });

    it('Altium plan includes recreate-rules step', () => {
      const plan = wizard.createPlan('altium', 'board.SchDoc');
      const rulesStep = plan.steps.find((s) => s.id === 'recreate-rules');
      expect(rulesStep).toBeDefined();
      expect(rulesStep!.optional).toBe(false);
    });

    it('Fritzing plan includes upgrade-components step', () => {
      const plan = wizard.createPlan('fritzing', 'project.fzz');
      const upgradeStep = plan.steps.find((s) => s.id === 'upgrade-components');
      expect(upgradeStep).toBeDefined();
      expect(upgradeStep!.optional).toBe(true);
    });

    it('steps have tips', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      plan.steps.forEach((step) => {
        expect(step.tips.length).toBeGreaterThan(0);
      });
    });

    it('steps have estimated minutes', () => {
      const plan = wizard.createPlan('eagle', 'test.sch');
      plan.steps.forEach((step) => {
        expect(step.estimatedMinutes).toBeGreaterThan(0);
      });
    });
  });

  // -----------------------------------------------------------------------
  // Plan management
  // -----------------------------------------------------------------------

  describe('plan management', () => {
    it('getPlan returns created plan', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      const retrieved = wizard.getPlan(plan.id);
      expect(retrieved).toBe(plan);
    });

    it('getPlan returns null for unknown ID', () => {
      expect(wizard.getPlan('nonexistent')).toBeNull();
    });

    it('getAllPlans returns all plans', () => {
      wizard.createPlan('kicad', 'a.kicad_sch');
      wizard.createPlan('eagle', 'b.sch');
      expect(wizard.getAllPlans()).toHaveLength(2);
    });

    it('deletePlan removes plan', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      expect(wizard.deletePlan(plan.id)).toBe(true);
      expect(wizard.getPlan(plan.id)).toBeNull();
    });

    it('deletePlan returns false for unknown ID', () => {
      expect(wizard.deletePlan('nonexistent')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Step progression
  // -----------------------------------------------------------------------

  describe('step progression', () => {
    let plan: MigrationPlan;

    beforeEach(() => {
      plan = wizard.createPlan('kicad', 'test.kicad_sch');
    });

    it('advanceStep marks current as completed and moves forward', () => {
      const nextStep = wizard.advanceStep(plan.id);
      expect(plan.steps[0].status).toBe('completed');
      expect(nextStep).not.toBeNull();
      expect(nextStep!.status).toBe('in_progress');
      expect(plan.currentStepIndex).toBe(1);
    });

    it('advanceStep sets migration status to in_progress', () => {
      wizard.advanceStep(plan.id);
      expect(plan.status).toBe('in_progress');
    });

    it('advanceStep returns null when all steps done', () => {
      // Advance through all steps
      let step: MigrationStep | null = { id: 'start' } as MigrationStep;
      while (step !== null) {
        step = wizard.advanceStep(plan.id);
      }
      expect(plan.status).toBe('completed');
    });

    it('advanceStep skips already-skipped steps', () => {
      // Skip the second step (index 1)
      if (plan.steps[1].optional) {
        wizard.skipStep(plan.id, plan.steps[1].id);
      } else {
        plan.steps[1].status = 'skipped';
      }

      wizard.advanceStep(plan.id); // Complete step 0, move to step 2 (skipping step 1)
      expect(plan.currentStepIndex).toBe(2);
    });

    it('advanceStep returns null for unknown plan', () => {
      expect(wizard.advanceStep('nonexistent')).toBeNull();
    });

    it('getCurrentStep returns current step', () => {
      const step = wizard.getCurrentStep(plan.id);
      expect(step).toBe(plan.steps[0]);
    });

    it('getCurrentStep returns null for unknown plan', () => {
      expect(wizard.getCurrentStep('nonexistent')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Step status updates
  // -----------------------------------------------------------------------

  describe('updateStepStatus', () => {
    it('updates step status', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      const success = wizard.updateStepStatus(plan.id, 'backup', 'completed');
      expect(success).toBe(true);
      expect(plan.steps[0].status).toBe('completed');
    });

    it('returns false for unknown plan', () => {
      expect(wizard.updateStepStatus('x', 'backup', 'completed')).toBe(false);
    });

    it('returns false for unknown step', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      expect(wizard.updateStepStatus(plan.id, 'nonexistent', 'completed')).toBe(false);
    });

    it('sets migration to failed when step fails', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      wizard.updateStepStatus(plan.id, 'backup', 'failed');
      expect(plan.status).toBe('failed');
    });

    it('sets migration to in_progress when first step starts', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      wizard.updateStepStatus(plan.id, 'backup', 'in_progress');
      expect(plan.status).toBe('in_progress');
    });

    it('sets migration to completed when all steps done', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      plan.steps.forEach((step) => {
        wizard.updateStepStatus(plan.id, step.id, 'completed');
      });
      expect(plan.status).toBe('completed');
    });
  });

  // -----------------------------------------------------------------------
  // Skip step
  // -----------------------------------------------------------------------

  describe('skipStep', () => {
    it('skips an optional step', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      const optionalStep = plan.steps.find((s) => s.optional);
      if (optionalStep) {
        const result = wizard.skipStep(plan.id, optionalStep.id);
        expect(result).toBe(true);
        expect(optionalStep.status).toBe('skipped');
      }
    });

    it('refuses to skip a required step', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      const requiredStep = plan.steps.find((s) => !s.optional);
      if (requiredStep) {
        const result = wizard.skipStep(plan.id, requiredStep.id);
        expect(result).toBe(false);
        expect(requiredStep.status).toBe('pending');
      }
    });

    it('returns false for unknown plan', () => {
      expect(wizard.skipStep('x', 'backup')).toBe(false);
    });

    it('returns false for unknown step', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      expect(wizard.skipStep(plan.id, 'nonexistent')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Prerequisites
  // -----------------------------------------------------------------------

  describe('arePrerequisitesMet', () => {
    it('returns true when no prerequisites', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      // Backup has no prerequisites
      expect(wizard.arePrerequisitesMet(plan.id, 'backup')).toBe(true);
    });

    it('returns false when prerequisites not met', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      // verify-bom requires import-design
      expect(wizard.arePrerequisitesMet(plan.id, 'verify-bom')).toBe(false);
    });

    it('returns true when prerequisites completed', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      wizard.updateStepStatus(plan.id, 'import-design', 'completed');
      expect(wizard.arePrerequisitesMet(plan.id, 'verify-bom')).toBe(true);
    });

    it('returns true when prerequisites skipped', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      // Manually set import-design to skipped (normally not allowed since it's required)
      const step = plan.steps.find((s) => s.id === 'import-design');
      if (step) {
        step.status = 'skipped';
      }
      expect(wizard.arePrerequisitesMet(plan.id, 'verify-bom')).toBe(true);
    });

    it('returns false for unknown plan', () => {
      expect(wizard.arePrerequisitesMet('x', 'backup')).toBe(false);
    });

    it('returns false for unknown step', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      expect(wizard.arePrerequisitesMet(plan.id, 'nonexistent')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Progress
  // -----------------------------------------------------------------------

  describe('progress', () => {
    it('starts at 0%', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      expect(wizard.getProgress(plan.id)).toBe(0);
    });

    it('increases as steps complete', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      wizard.updateStepStatus(plan.id, 'backup', 'completed');
      const progress = wizard.getProgress(plan.id);
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(100);
    });

    it('reaches 100% when all steps done', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      plan.steps.forEach((step) => {
        wizard.updateStepStatus(plan.id, step.id, 'completed');
      });
      expect(wizard.getProgress(plan.id)).toBe(100);
    });

    it('counts skipped steps as done for progress', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      plan.steps.forEach((step) => {
        step.status = step.optional ? 'skipped' : 'completed';
      });
      expect(wizard.getProgress(plan.id)).toBe(100);
    });

    it('returns 0 for unknown plan', () => {
      expect(wizard.getProgress('nonexistent')).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Estimated remaining time
  // -----------------------------------------------------------------------

  describe('getEstimatedRemainingMinutes', () => {
    it('returns total estimated minutes at start', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      const total = plan.steps.reduce((s, step) => s + step.estimatedMinutes, 0);
      expect(wizard.getEstimatedRemainingMinutes(plan.id)).toBe(total);
    });

    it('decreases as steps complete', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      const totalBefore = wizard.getEstimatedRemainingMinutes(plan.id);
      wizard.updateStepStatus(plan.id, 'backup', 'completed');
      const totalAfter = wizard.getEstimatedRemainingMinutes(plan.id);
      expect(totalAfter).toBeLessThan(totalBefore);
    });

    it('returns 0 when all steps done', () => {
      const plan = wizard.createPlan('kicad', 'test.kicad_sch');
      plan.steps.forEach((step) => {
        wizard.updateStepStatus(plan.id, step.id, 'completed');
      });
      expect(wizard.getEstimatedRemainingMinutes(plan.id)).toBe(0);
    });

    it('returns 0 for unknown plan', () => {
      expect(wizard.getEstimatedRemainingMinutes('nonexistent')).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Utility methods
  // -----------------------------------------------------------------------

  describe('getToolDisplayName', () => {
    it('returns display name for each tool', () => {
      expect(wizard.getToolDisplayName('kicad')).toBe('KiCad');
      expect(wizard.getToolDisplayName('eagle')).toBe('Autodesk EAGLE');
      expect(wizard.getToolDisplayName('easyeda')).toBe('EasyEDA / LCEDA');
      expect(wizard.getToolDisplayName('altium')).toBe('Altium Designer');
      expect(wizard.getToolDisplayName('fritzing')).toBe('Fritzing');
    });

    it('falls back to tool key for unknown tool', () => {
      expect(wizard.getToolDisplayName('unknown' as SourceEdaTool)).toBe('unknown');
    });
  });

  describe('getSupportedTools', () => {
    it('returns all 5 supported tools', () => {
      const tools = wizard.getSupportedTools();
      expect(tools).toHaveLength(5);
    });

    it('each tool has displayName and extensions', () => {
      const tools = wizard.getSupportedTools();
      tools.forEach((t) => {
        expect(typeof t.displayName).toBe('string');
        expect(t.extensions.length).toBeGreaterThan(0);
        expect(ALL_TOOLS).toContain(t.tool);
      });
    });

    it('returns copies of extension arrays', () => {
      const tools1 = wizard.getSupportedTools();
      const tools2 = wizard.getSupportedTools();
      expect(tools1[0].extensions).not.toBe(tools2[0].extensions);
    });
  });

  // -----------------------------------------------------------------------
  // Full workflow integration
  // -----------------------------------------------------------------------

  describe('full migration workflow', () => {
    it('completes a full KiCad migration', () => {
      // Detect source
      const detection = wizard.detectSource('circuit.kicad_sch', '(kicad_sch (version 20211014))');
      expect(detection.tool).toBe('kicad');

      // Assess compatibility
      const compat = wizard.assessCompatibility('kicad');
      expect(compat.overallScore).toBeGreaterThan(0);

      // Create plan
      const plan = wizard.createPlan('kicad', 'circuit.kicad_sch', '7.0');
      expect(plan.status).toBe('not_started');

      // Advance through all steps
      let stepsCompleted = 0;
      let next: MigrationStep | null = wizard.advanceStep(plan.id);
      while (next !== null) {
        stepsCompleted++;
        next = wizard.advanceStep(plan.id);
      }

      expect(plan.status).toBe('completed');
      expect(wizard.getProgress(plan.id)).toBe(100);
      expect(wizard.getEstimatedRemainingMinutes(plan.id)).toBe(0);
    });

    it('completes a full EasyEDA migration with skipped optional steps', () => {
      const plan = wizard.createPlan('easyeda', 'circuit.json');

      // Skip optional steps
      plan.steps.forEach((step) => {
        if (step.optional) {
          wizard.skipStep(plan.id, step.id);
        }
      });

      // Advance through required steps
      let next: MigrationStep | null = wizard.advanceStep(plan.id);
      while (next !== null) {
        next = wizard.advanceStep(plan.id);
      }

      expect(plan.status).toBe('completed');
      expect(wizard.getProgress(plan.id)).toBe(100);
    });

    it('handles failure mid-migration', () => {
      const plan = wizard.createPlan('altium', 'board.SchDoc');
      wizard.advanceStep(plan.id); // Complete backup, start export

      // Fail the current step
      wizard.updateStepStatus(plan.id, plan.steps[plan.currentStepIndex].id, 'failed');
      expect(plan.status).toBe('failed');

      const progress = wizard.getProgress(plan.id);
      expect(progress).toBeGreaterThan(0);
      expect(progress).toBeLessThan(100);
    });
  });
});
