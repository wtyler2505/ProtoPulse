import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`) });

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) { delete store[k]; } }),
});

import {
  ClassroomManager,
  useClassroom,
} from '../classroom';
import type {
  CreateAssignmentInput,
  SubmitAssignmentInput,
  GradeSubmissionInput,
  RubricCriterion,
} from '../classroom';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<CreateAssignmentInput> = {}): CreateAssignmentInput {
  return {
    title: 'LED Circuit Lab',
    description: 'Build a simple LED circuit',
    instructions: 'Wire an LED with a resistor to a 5V power supply',
    dueDate: Date.now() + 7 * 24 * 60 * 60 * 1000, // 1 week from now
    criteria: [
      { name: 'Circuit Correctness', description: 'LED and resistor wired correctly', type: 'points', maxPoints: 50, weight: 0.5 },
      { name: 'Component Selection', description: 'Proper resistor value chosen', type: 'points', maxPoints: 30, weight: 0.3 },
      { name: 'Documentation', description: 'Clear documentation provided', type: 'points', maxPoints: 20, weight: 0.2 },
    ],
    ...overrides,
  };
}

function makeSubmission(mgr: ClassroomManager, assignmentId: string, overrides: Partial<SubmitAssignmentInput> = {}): SubmitAssignmentInput {
  return {
    assignmentId,
    studentId: 'student-1',
    studentName: 'Alice Johnson',
    projectSnapshot: { nodes: [], edges: [] },
    ...overrides,
  };
}

function publishAndGetAssignment(mgr: ClassroomManager, inputOverrides: Partial<CreateAssignmentInput> = {}) {
  const assignment = mgr.createAssignment(makeInput(inputOverrides));
  return mgr.publishAssignment(assignment.id);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClassroomManager', () => {
  beforeEach(() => {
    ClassroomManager.resetForTesting();
    for (const k of Object.keys(store)) {
      delete store[k];
    }
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('should return the same instance', () => {
      const a = ClassroomManager.getInstance();
      const b = ClassroomManager.getInstance();
      expect(a).toBe(b);
    });

    it('should return a new instance after resetForTesting', () => {
      const a = ClassroomManager.getInstance();
      ClassroomManager.resetForTesting();
      const b = ClassroomManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('subscription', () => {
    it('should notify listeners on state change', () => {
      const mgr = ClassroomManager.getInstance();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.createAssignment(makeInput());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe correctly', () => {
      const mgr = ClassroomManager.getInstance();
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.createAssignment(makeInput());
      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      const mgr = ClassroomManager.getInstance();
      const l1 = vi.fn();
      const l2 = vi.fn();
      mgr.subscribe(l1);
      mgr.subscribe(l2);
      mgr.createAssignment(makeInput());
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  describe('persistence', () => {
    it('should persist assignments to localStorage', () => {
      const mgr = ClassroomManager.getInstance();
      mgr.createAssignment(makeInput());
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should load assignments from localStorage on init', () => {
      const mgr = ClassroomManager.getInstance();
      const assignment = mgr.createAssignment(makeInput());
      ClassroomManager.resetForTesting();
      const mgr2 = ClassroomManager.getInstance();
      const loaded = mgr2.getAssignment(assignment.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.title).toBe('LED Circuit Lab');
    });

    it('should handle corrupted localStorage gracefully', () => {
      store['protopulse:classroom:assignments'] = 'not-json';
      const mgr = ClassroomManager.getInstance();
      expect(mgr.getAllAssignments()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Assignment CRUD
  // -----------------------------------------------------------------------

  describe('assignment CRUD', () => {
    it('should create an assignment with auto-generated IDs', () => {
      const mgr = ClassroomManager.getInstance();
      const a = mgr.createAssignment(makeInput());
      expect(a.id).toBeTruthy();
      expect(a.title).toBe('LED Circuit Lab');
      expect(a.status).toBe('draft');
      expect(a.rubric.criteria).toHaveLength(3);
      expect(a.maxScore).toBe(100);
    });

    it('should get assignment by id', () => {
      const mgr = ClassroomManager.getInstance();
      const a = mgr.createAssignment(makeInput());
      expect(mgr.getAssignment(a.id)).toEqual(a);
    });

    it('should return null for unknown assignment', () => {
      const mgr = ClassroomManager.getInstance();
      expect(mgr.getAssignment('nonexistent')).toBeNull();
    });

    it('should get all assignments', () => {
      const mgr = ClassroomManager.getInstance();
      mgr.createAssignment(makeInput({ title: 'Lab 1' }));
      mgr.createAssignment(makeInput({ title: 'Lab 2' }));
      expect(mgr.getAllAssignments()).toHaveLength(2);
    });

    it('should filter assignments by status', () => {
      const mgr = ClassroomManager.getInstance();
      mgr.createAssignment(makeInput({ title: 'Draft 1' }));
      const a2 = mgr.createAssignment(makeInput({ title: 'Published 1' }));
      mgr.publishAssignment(a2.id);
      expect(mgr.getAssignmentsByStatus('draft')).toHaveLength(1);
      expect(mgr.getAssignmentsByStatus('published')).toHaveLength(1);
    });

    it('should update a draft assignment', () => {
      const mgr = ClassroomManager.getInstance();
      const a = mgr.createAssignment(makeInput());
      const updated = mgr.updateAssignment(a.id, { title: 'Updated Title' });
      expect(updated.title).toBe('Updated Title');
      expect(updated.updatedAt).toBeGreaterThanOrEqual(a.updatedAt);
    });

    it('should throw when updating a non-draft assignment', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      expect(() => mgr.updateAssignment(a.id, { title: 'New' })).toThrow('Can only edit draft');
    });

    it('should throw when updating a nonexistent assignment', () => {
      const mgr = ClassroomManager.getInstance();
      expect(() => mgr.updateAssignment('nope', { title: 'x' })).toThrow('Assignment not found');
    });

    it('should delete an assignment and its submissions', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      mgr.submitAssignment(makeSubmission(mgr, a.id));
      expect(mgr.getSubmissionsForAssignment(a.id)).toHaveLength(1);
      mgr.deleteAssignment(a.id);
      expect(mgr.getAssignment(a.id)).toBeNull();
      expect(mgr.getSubmissionsForAssignment(a.id)).toHaveLength(0);
    });

    it('should throw when deleting a nonexistent assignment', () => {
      const mgr = ClassroomManager.getInstance();
      expect(() => mgr.deleteAssignment('nope')).toThrow('Assignment not found');
    });

    it('should create assignment with defaults', () => {
      const mgr = ClassroomManager.getInstance();
      const a = mgr.createAssignment({
        title: 'Minimal',
        dueDate: Date.now() + 86400000,
      });
      expect(a.description).toBe('');
      expect(a.instructions).toBe('');
      expect(a.allowLateSubmissions).toBe(false);
      expect(a.latePenaltyPerDay).toBe(10);
      expect(a.tags).toEqual([]);
      expect(a.attachments).toEqual([]);
      expect(a.rubric.criteria).toHaveLength(0);
      expect(a.maxScore).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Assignment lifecycle
  // -----------------------------------------------------------------------

  describe('assignment lifecycle', () => {
    it('should publish a draft assignment', () => {
      const mgr = ClassroomManager.getInstance();
      const a = mgr.createAssignment(makeInput());
      const published = mgr.publishAssignment(a.id);
      expect(published.status).toBe('published');
      expect(published.publishedAt).toBeTruthy();
    });

    it('should reject publishing without criteria', () => {
      const mgr = ClassroomManager.getInstance();
      const a = mgr.createAssignment(makeInput({ criteria: [] }));
      expect(() => mgr.publishAssignment(a.id)).toThrow('without rubric criteria');
    });

    it('should reject publishing a non-draft', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      expect(() => mgr.publishAssignment(a.id)).toThrow('Can only publish draft');
    });

    it('should reject publishing a nonexistent assignment', () => {
      const mgr = ClassroomManager.getInstance();
      expect(() => mgr.publishAssignment('nope')).toThrow('Assignment not found');
    });

    it('should close a published assignment', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const closed = mgr.closeAssignment(a.id);
      expect(closed.status).toBe('closed');
      expect(closed.closedAt).toBeTruthy();
    });

    it('should reject closing a non-published assignment', () => {
      const mgr = ClassroomManager.getInstance();
      const a = mgr.createAssignment(makeInput());
      expect(() => mgr.closeAssignment(a.id)).toThrow('Can only close published');
    });

    it('should archive a closed assignment', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      mgr.closeAssignment(a.id);
      const archived = mgr.archiveAssignment(a.id);
      expect(archived.status).toBe('archived');
    });

    it('should reject archiving a non-closed assignment', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      expect(() => mgr.archiveAssignment(a.id)).toThrow('Can only archive closed');
    });

    it('should follow full lifecycle: draft → published → closed → archived', () => {
      const mgr = ClassroomManager.getInstance();
      const a = mgr.createAssignment(makeInput());
      expect(a.status).toBe('draft');
      const pub = mgr.publishAssignment(a.id);
      expect(pub.status).toBe('published');
      const closed = mgr.closeAssignment(a.id);
      expect(closed.status).toBe('closed');
      const archived = mgr.archiveAssignment(a.id);
      expect(archived.status).toBe('archived');
    });
  });

  // -----------------------------------------------------------------------
  // Rubric management
  // -----------------------------------------------------------------------

  describe('rubric management', () => {
    it('should update rubric on a draft assignment', () => {
      const mgr = ClassroomManager.getInstance();
      const a = mgr.createAssignment(makeInput());
      const rubric = mgr.updateRubric(a.id, [
        { name: 'New Criterion', description: 'Test', type: 'points', maxPoints: 100, weight: 1.0 },
      ]);
      expect(rubric.criteria).toHaveLength(1);
      expect(rubric.totalPoints).toBe(100);
    });

    it('should reject rubric update on non-draft', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      expect(() => mgr.updateRubric(a.id, [])).toThrow('Can only edit rubric on draft');
    });

    it('should update maxScore when rubric changes', () => {
      const mgr = ClassroomManager.getInstance();
      const a = mgr.createAssignment(makeInput());
      mgr.updateRubric(a.id, [
        { name: 'A', description: '', type: 'points', maxPoints: 75, weight: 1.0 },
      ]);
      const updated = mgr.getAssignment(a.id);
      expect(updated!.maxScore).toBe(75);
    });
  });

  // -----------------------------------------------------------------------
  // Submissions
  // -----------------------------------------------------------------------

  describe('submissions', () => {
    it('should submit to a published assignment', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      expect(sub.id).toBeTruthy();
      expect(sub.status).toBe('submitted');
      expect(sub.isLate).toBe(false);
      expect(sub.lateDays).toBe(0);
      expect(sub.grade).toBeNull();
    });

    it('should get submission by id', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      expect(mgr.getSubmission(sub.id)).toEqual(sub);
    });

    it('should return null for unknown submission', () => {
      const mgr = ClassroomManager.getInstance();
      expect(mgr.getSubmission('nonexistent')).toBeNull();
    });

    it('should detect late submissions', () => {
      const mgr = ClassroomManager.getInstance();
      const pastDue = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 days ago
      const a = publishAndGetAssignment(mgr, { dueDate: pastDue, allowLateSubmissions: true });
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      expect(sub.isLate).toBe(true);
      expect(sub.lateDays).toBeGreaterThanOrEqual(2);
    });

    it('should reject late submissions when not allowed', () => {
      const mgr = ClassroomManager.getInstance();
      const pastDue = Date.now() - 86400000;
      const a = publishAndGetAssignment(mgr, { dueDate: pastDue, allowLateSubmissions: false });
      expect(() => mgr.submitAssignment(makeSubmission(mgr, a.id))).toThrow('Late submissions are not allowed');
    });

    it('should reject submission to draft assignment', () => {
      const mgr = ClassroomManager.getInstance();
      const a = mgr.createAssignment(makeInput());
      expect(() => mgr.submitAssignment(makeSubmission(mgr, a.id))).toThrow('not accepting submissions');
    });

    it('should reject submission to nonexistent assignment', () => {
      const mgr = ClassroomManager.getInstance();
      expect(() => mgr.submitAssignment(makeSubmission(mgr, 'nope'))).toThrow('Assignment not found');
    });

    it('should mark resubmission correctly', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub1 = mgr.submitAssignment(makeSubmission(mgr, a.id, { studentId: 'stu-1', studentName: 'Bob' }));
      const sub2 = mgr.submitAssignment(makeSubmission(mgr, a.id, { studentId: 'stu-1', studentName: 'Bob' }));
      expect(sub2.status).toBe('resubmitted');
      expect(sub2.resubmissionOf).toBe(sub1.id);
    });

    it('should get submissions for a specific student', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      mgr.submitAssignment(makeSubmission(mgr, a.id, { studentId: 's1', studentName: 'Alice' }));
      mgr.submitAssignment(makeSubmission(mgr, a.id, { studentId: 's2', studentName: 'Bob' }));
      expect(mgr.getSubmissionsForStudent('s1')).toHaveLength(1);
      expect(mgr.getSubmissionsForStudent('s2')).toHaveLength(1);
    });

    it('should get latest submissions per student', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      mgr.submitAssignment(makeSubmission(mgr, a.id, { studentId: 's1', studentName: 'Alice' }));
      mgr.submitAssignment(makeSubmission(mgr, a.id, { studentId: 's1', studentName: 'Alice' }));
      mgr.submitAssignment(makeSubmission(mgr, a.id, { studentId: 's2', studentName: 'Bob' }));
      const latest = mgr.getLatestSubmissions(a.id);
      expect(latest).toHaveLength(2);
    });

    it('should allow submission to closed assignment', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      mgr.closeAssignment(a.id);
      // Closed assignments still accept submissions (for late/makeup work)
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      expect(sub.status).toBe('submitted');
    });
  });

  // -----------------------------------------------------------------------
  // Grading
  // -----------------------------------------------------------------------

  describe('grading', () => {
    it('should grade a submission with rubric criteria', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      const gradeInput: GradeSubmissionInput = {
        submissionId: sub.id,
        criterionGrades: a.rubric.criteria.map((c) => ({
          criterionId: c.id,
          score: c.maxPoints, // perfect score
        })),
        overallFeedback: 'Excellent work!',
      };
      const graded = mgr.gradeSubmission(gradeInput);
      expect(graded.status).toBe('graded');
      expect(graded.grade).not.toBeNull();
      expect(graded.grade!.percentage).toBeCloseTo(100);
      expect(graded.grade!.letterGrade).toBe('A');
      expect(graded.grade!.overallFeedback).toBe('Excellent work!');
    });

    it('should calculate weighted score correctly', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      // 50/50 (w=0.5) + 15/30 (w=0.3) + 10/20 (w=0.2)
      // weighted = (1.0*0.5 + 0.5*0.3 + 0.5*0.2) / 1.0 * 100 = 75
      const graded = mgr.gradeSubmission({
        submissionId: sub.id,
        criterionGrades: [
          { criterionId: a.rubric.criteria[0].id, score: 50 },
          { criterionId: a.rubric.criteria[1].id, score: 15 },
          { criterionId: a.rubric.criteria[2].id, score: 10 },
        ],
      });
      expect(graded.grade!.rawScore).toBeCloseTo(75);
      expect(graded.grade!.percentage).toBeCloseTo(75);
      expect(graded.grade!.letterGrade).toBe('C');
    });

    it('should apply late penalty', () => {
      const mgr = ClassroomManager.getInstance();
      const pastDue = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago
      const a = publishAndGetAssignment(mgr, {
        dueDate: pastDue,
        allowLateSubmissions: true,
        latePenaltyPerDay: 10, // 10% per day
      });
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      expect(sub.isLate).toBe(true);
      expect(sub.lateDays).toBeGreaterThanOrEqual(3);

      const graded = mgr.gradeSubmission({
        submissionId: sub.id,
        criterionGrades: a.rubric.criteria.map((c) => ({
          criterionId: c.id,
          score: c.maxPoints,
        })),
      });
      // 100 raw - (10% of 100 * 3 days) = 100 - 30 = 70
      expect(graded.grade!.rawScore).toBeCloseTo(100);
      expect(graded.grade!.latePenalty).toBeGreaterThan(0);
      expect(graded.grade!.finalScore).toBeLessThan(graded.grade!.rawScore);
    });

    it('should clamp final score to 0', () => {
      const mgr = ClassroomManager.getInstance();
      const pastDue = Date.now() - 20 * 24 * 60 * 60 * 1000; // 20 days ago
      const a = publishAndGetAssignment(mgr, {
        dueDate: pastDue,
        allowLateSubmissions: true,
        latePenaltyPerDay: 10,
      });
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      const graded = mgr.gradeSubmission({
        submissionId: sub.id,
        criterionGrades: a.rubric.criteria.map((c) => ({
          criterionId: c.id,
          score: c.maxPoints * 0.5,
        })),
      });
      expect(graded.grade!.finalScore).toBeGreaterThanOrEqual(0);
    });

    it('should throw for invalid criterion id', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      expect(() => mgr.gradeSubmission({
        submissionId: sub.id,
        criterionGrades: [{ criterionId: 'invalid', score: 10 }],
      })).toThrow('Criterion not found');
    });

    it('should throw for out-of-range score', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      expect(() => mgr.gradeSubmission({
        submissionId: sub.id,
        criterionGrades: [{ criterionId: a.rubric.criteria[0].id, score: 999 }],
      })).toThrow('out of range');
    });

    it('should throw for negative score', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      expect(() => mgr.gradeSubmission({
        submissionId: sub.id,
        criterionGrades: [{ criterionId: a.rubric.criteria[0].id, score: -1 }],
      })).toThrow('out of range');
    });

    it('should throw for nonexistent submission', () => {
      const mgr = ClassroomManager.getInstance();
      expect(() => mgr.gradeSubmission({
        submissionId: 'nope',
        criterionGrades: [],
      })).toThrow('Submission not found');
    });
  });

  // -----------------------------------------------------------------------
  // Return submission
  // -----------------------------------------------------------------------

  describe('returnSubmission', () => {
    it('should return a graded submission', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      mgr.gradeSubmission({
        submissionId: sub.id,
        criterionGrades: a.rubric.criteria.map((c) => ({
          criterionId: c.id,
          score: c.maxPoints,
        })),
      });
      const returned = mgr.returnSubmission(sub.id, 'Please review');
      expect(returned.status).toBe('returned');
      expect(returned.grade!.overallFeedback).toBe('Please review');
    });

    it('should throw when returning ungraded submission', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      expect(() => mgr.returnSubmission(sub.id)).toThrow('Can only return graded');
    });

    it('should throw for nonexistent submission', () => {
      const mgr = ClassroomManager.getInstance();
      expect(() => mgr.returnSubmission('nope')).toThrow('Submission not found');
    });
  });

  // -----------------------------------------------------------------------
  // Letter grades
  // -----------------------------------------------------------------------

  describe('letter grades', () => {
    it('should assign A for 93+', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      const graded = mgr.gradeSubmission({
        submissionId: sub.id,
        criterionGrades: a.rubric.criteria.map((c) => ({
          criterionId: c.id,
          score: c.maxPoints * 0.95,
        })),
      });
      expect(graded.grade!.letterGrade).toBe('A');
    });

    it('should assign F for below 60', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      const graded = mgr.gradeSubmission({
        submissionId: sub.id,
        criterionGrades: a.rubric.criteria.map((c) => ({
          criterionId: c.id,
          score: c.maxPoints * 0.3,
        })),
      });
      expect(graded.grade!.letterGrade).toBe('F');
    });

    it('should assign B+ for 87-89', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      const graded = mgr.gradeSubmission({
        submissionId: sub.id,
        criterionGrades: a.rubric.criteria.map((c) => ({
          criterionId: c.id,
          score: c.maxPoints * 0.88,
        })),
      });
      expect(graded.grade!.letterGrade).toBe('B+');
    });
  });

  // -----------------------------------------------------------------------
  // Statistics
  // -----------------------------------------------------------------------

  describe('statistics', () => {
    function gradeStudent(mgr: ClassroomManager, assignmentId: string, rubric: { criteria: RubricCriterion[] }, studentId: string, studentName: string, scoreMultiplier: number) {
      const sub = mgr.submitAssignment({
        assignmentId,
        studentId,
        studentName,
        projectSnapshot: {},
      });
      mgr.gradeSubmission({
        submissionId: sub.id,
        criterionGrades: rubric.criteria.map((c) => ({
          criterionId: c.id,
          score: c.maxPoints * scoreMultiplier,
        })),
      });
    }

    it('should calculate class stats', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      gradeStudent(mgr, a.id, a.rubric, 's1', 'Alice', 1.0);    // 100%
      gradeStudent(mgr, a.id, a.rubric, 's2', 'Bob', 0.8);      // 80%
      gradeStudent(mgr, a.id, a.rubric, 's3', 'Charlie', 0.6);   // 60%

      const stats = mgr.getClassStats(a.id, 5);
      expect(stats.totalStudents).toBe(5);
      expect(stats.submittedCount).toBe(3);
      expect(stats.gradedCount).toBe(3);
      expect(stats.averageScore).toBeGreaterThan(0);
      expect(stats.highScore).toBeGreaterThan(stats.lowScore);
      expect(stats.submissionRate).toBeCloseTo(0.6);
    });

    it('should calculate median correctly for odd count', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      gradeStudent(mgr, a.id, a.rubric, 's1', 'A', 1.0);
      gradeStudent(mgr, a.id, a.rubric, 's2', 'B', 0.5);
      gradeStudent(mgr, a.id, a.rubric, 's3', 'C', 0.8);

      const stats = mgr.getClassStats(a.id);
      // scores sorted: ~50, ~80, ~100; median = ~80
      expect(stats.medianScore).toBeGreaterThan(0);
    });

    it('should calculate median correctly for even count', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      gradeStudent(mgr, a.id, a.rubric, 's1', 'A', 1.0);
      gradeStudent(mgr, a.id, a.rubric, 's2', 'B', 0.5);
      gradeStudent(mgr, a.id, a.rubric, 's3', 'C', 0.8);
      gradeStudent(mgr, a.id, a.rubric, 's4', 'D', 0.7);

      const stats = mgr.getClassStats(a.id);
      expect(stats.medianScore).toBeGreaterThan(0);
    });

    it('should handle empty stats', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const stats = mgr.getClassStats(a.id);
      expect(stats.submittedCount).toBe(0);
      expect(stats.gradedCount).toBe(0);
      expect(stats.averageScore).toBe(0);
      expect(stats.medianScore).toBe(0);
    });

    it('should calculate standard deviation', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      gradeStudent(mgr, a.id, a.rubric, 's1', 'A', 1.0);
      gradeStudent(mgr, a.id, a.rubric, 's2', 'B', 0.5);
      const stats = mgr.getClassStats(a.id);
      expect(stats.standardDeviation).toBeGreaterThan(0);
    });

    it('should count late submissions', () => {
      const mgr = ClassroomManager.getInstance();
      const pastDue = Date.now() - 86400000;
      const a = publishAndGetAssignment(mgr, { dueDate: pastDue, allowLateSubmissions: true });
      mgr.submitAssignment(makeSubmission(mgr, a.id, { studentId: 's1', studentName: 'A' }));
      mgr.submitAssignment(makeSubmission(mgr, a.id, { studentId: 's2', studentName: 'B' }));
      const stats = mgr.getClassStats(a.id);
      expect(stats.lateCount).toBe(2);
    });

    it('should include score distribution', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      gradeStudent(mgr, a.id, a.rubric, 's1', 'A', 1.0);    // A
      gradeStudent(mgr, a.id, a.rubric, 's2', 'B', 0.3);    // F
      const stats = mgr.getClassStats(a.id);
      expect(Object.keys(stats.scoreDistribution).length).toBeGreaterThan(0);
    });

    it('should throw for nonexistent assignment', () => {
      const mgr = ClassroomManager.getInstance();
      expect(() => mgr.getClassStats('nope')).toThrow('Assignment not found');
    });
  });

  // -----------------------------------------------------------------------
  // CSV Export
  // -----------------------------------------------------------------------

  describe('CSV export', () => {
    it('should export grades as CSV', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      mgr.gradeSubmission({
        submissionId: sub.id,
        criterionGrades: a.rubric.criteria.map((c) => ({
          criterionId: c.id,
          score: c.maxPoints,
        })),
        overallFeedback: 'Great job',
      });
      const csv = mgr.exportGradesToCsv(a.id);
      expect(csv).toContain('Student ID');
      expect(csv).toContain('Final Score');
      expect(csv).toContain('Alice Johnson');
    });

    it('should include letter grades by default', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      mgr.gradeSubmission({
        submissionId: sub.id,
        criterionGrades: a.rubric.criteria.map((c) => ({
          criterionId: c.id,
          score: c.maxPoints,
        })),
      });
      const csv = mgr.exportGradesToCsv(a.id);
      expect(csv).toContain('Letter Grade');
    });

    it('should omit letter grades when disabled', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const csv = mgr.exportGradesToCsv(a.id, { includeLetterGrades: false });
      expect(csv).not.toContain('Letter Grade');
    });

    it('should include feedback when enabled', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id));
      mgr.gradeSubmission({
        submissionId: sub.id,
        criterionGrades: a.rubric.criteria.map((c) => ({
          criterionId: c.id,
          score: c.maxPoints,
        })),
        overallFeedback: 'Well done!',
      });
      const csv = mgr.exportGradesToCsv(a.id, { includeFeedback: true });
      expect(csv).toContain('Feedback');
      expect(csv).toContain('Well done!');
    });

    it('should handle ungraded submissions in CSV', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      mgr.submitAssignment(makeSubmission(mgr, a.id));
      const csv = mgr.exportGradesToCsv(a.id);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(2); // header + 1 row
    });

    it('should escape CSV fields with commas', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      const sub = mgr.submitAssignment(makeSubmission(mgr, a.id, { studentName: 'Last, First' }));
      mgr.gradeSubmission({
        submissionId: sub.id,
        criterionGrades: a.rubric.criteria.map((c) => ({
          criterionId: c.id,
          score: c.maxPoints,
        })),
      });
      const csv = mgr.exportGradesToCsv(a.id);
      expect(csv).toContain('"Last, First"');
    });

    it('should throw for nonexistent assignment', () => {
      const mgr = ClassroomManager.getInstance();
      expect(() => mgr.exportGradesToCsv('nope')).toThrow('Assignment not found');
    });
  });

  // -----------------------------------------------------------------------
  // Student gradebook & overall grade
  // -----------------------------------------------------------------------

  describe('student gradebook', () => {
    it('should return gradebook for a student', () => {
      const mgr = ClassroomManager.getInstance();
      const a1 = publishAndGetAssignment(mgr, { title: 'Lab 1' });
      const a2 = publishAndGetAssignment(mgr, { title: 'Lab 2' });

      const sub1 = mgr.submitAssignment(makeSubmission(mgr, a1.id, { studentId: 's1', studentName: 'Alice' }));
      mgr.gradeSubmission({
        submissionId: sub1.id,
        criterionGrades: a1.rubric.criteria.map((c) => ({
          criterionId: c.id,
          score: c.maxPoints,
        })),
      });

      const gradebook = mgr.getStudentGradebook('s1');
      expect(gradebook).toHaveLength(2);
      expect(gradebook[0].score).toBe(100);
      expect(gradebook[1].submission).toBeNull();
    });

    it('should exclude draft assignments from gradebook', () => {
      const mgr = ClassroomManager.getInstance();
      mgr.createAssignment(makeInput({ title: 'Draft Only' }));
      publishAndGetAssignment(mgr, { title: 'Published' });
      const gradebook = mgr.getStudentGradebook('s1');
      expect(gradebook).toHaveLength(1);
    });

    it('should calculate overall grade', () => {
      const mgr = ClassroomManager.getInstance();
      const a1 = publishAndGetAssignment(mgr, { title: 'Lab 1' });
      const a2 = publishAndGetAssignment(mgr, { title: 'Lab 2' });

      const sub1 = mgr.submitAssignment(makeSubmission(mgr, a1.id, { studentId: 's1', studentName: 'Alice' }));
      mgr.gradeSubmission({
        submissionId: sub1.id,
        criterionGrades: a1.rubric.criteria.map((c) => ({
          criterionId: c.id,
          score: c.maxPoints,
        })),
      });

      const sub2 = mgr.submitAssignment(makeSubmission(mgr, a2.id, { studentId: 's1', studentName: 'Alice' }));
      mgr.gradeSubmission({
        submissionId: sub2.id,
        criterionGrades: a2.rubric.criteria.map((c) => ({
          criterionId: c.id,
          score: c.maxPoints * 0.8,
        })),
      });

      const overall = mgr.calculateOverallGrade('s1');
      expect(overall.percentage).toBeCloseTo(90);
      expect(overall.letterGrade).toBe('A-');
      expect(overall.totalScore).toBeGreaterThan(0);
      expect(overall.maxPossible).toBe(200);
    });

    it('should handle student with no grades', () => {
      const mgr = ClassroomManager.getInstance();
      const overall = mgr.calculateOverallGrade('nobody');
      expect(overall.percentage).toBe(0);
      expect(overall.letterGrade).toBe('F');
      expect(overall.totalScore).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  describe('utility', () => {
    it('should get enrolled student IDs', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      mgr.submitAssignment(makeSubmission(mgr, a.id, { studentId: 's1', studentName: 'A' }));
      mgr.submitAssignment(makeSubmission(mgr, a.id, { studentId: 's2', studentName: 'B' }));
      mgr.submitAssignment(makeSubmission(mgr, a.id, { studentId: 's1', studentName: 'A' })); // dup
      const ids = mgr.getEnrolledStudentIds(a.id);
      expect(ids).toHaveLength(2);
      expect(ids).toContain('s1');
      expect(ids).toContain('s2');
    });

    it('should clear all data', () => {
      const mgr = ClassroomManager.getInstance();
      const a = publishAndGetAssignment(mgr);
      mgr.submitAssignment(makeSubmission(mgr, a.id));
      mgr.clearAll();
      expect(mgr.getAllAssignments()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // React hook
  // -----------------------------------------------------------------------

  describe('useClassroom', () => {
    it('should be exported as a function', () => {
      expect(typeof useClassroom).toBe('function');
    });
  });
});
