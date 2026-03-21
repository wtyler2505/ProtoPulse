/**
 * Classroom Mode — Teacher Dashboard + Student Submissions
 *
 * Manages classroom assignments, student submissions, rubric-based grading,
 * grade calculation, late detection, class statistics, and CSV grade export.
 * Singleton with localStorage persistence and subscription-based reactivity.
 *
 * Usage:
 *   const mgr = ClassroomManager.getInstance();
 *   const assignment = mgr.createAssignment({ title: 'LED Circuit', ... });
 *   mgr.publishAssignment(assignment.id);
 *   mgr.submitAssignment({ assignmentId: assignment.id, studentId: 's1', projectSnapshot: {...} });
 *
 * React hook:
 *   const { assignments, submissions, createAssignment, gradeSubmission } = useClassroom();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export type AssignmentStatus = 'draft' | 'published' | 'closed' | 'archived';
export type SubmissionStatus = 'submitted' | 'graded' | 'returned' | 'resubmitted';
export type RubricCriterionType = 'points' | 'pass-fail' | 'scale';

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  type: RubricCriterionType;
  maxPoints: number;
  weight: number; // 0-1, all weights in a rubric should sum to 1
}

export interface Rubric {
  id: string;
  name: string;
  criteria: RubricCriterion[];
  totalPoints: number;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  instructions: string;
  rubric: Rubric;
  status: AssignmentStatus;
  dueDate: number; // epoch ms
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
  closedAt: number | null;
  allowLateSubmissions: boolean;
  latePenaltyPerDay: number; // percentage points deducted per day late (0-100)
  maxScore: number;
  tags: string[];
  attachments: string[]; // file references / URLs
}

export interface CriterionGrade {
  criterionId: string;
  score: number; // 0 to criterion.maxPoints
  feedback: string;
}

export interface SubmissionGrade {
  criterionGrades: CriterionGrade[];
  rawScore: number; // before late penalty
  latePenalty: number; // deducted points
  finalScore: number; // after penalty, clamped to 0
  percentage: number; // 0-100
  letterGrade: string;
  overallFeedback: string;
  gradedAt: number;
  gradedBy: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  status: SubmissionStatus;
  submittedAt: number;
  projectSnapshot: Record<string, unknown>;
  grade: SubmissionGrade | null;
  isLate: boolean;
  lateDays: number;
  resubmissionOf: string | null; // ID of prior submission
  notes: string;
}

export interface ClassStats {
  assignmentId: string;
  totalStudents: number;
  submittedCount: number;
  gradedCount: number;
  averageScore: number;
  medianScore: number;
  highScore: number;
  lowScore: number;
  standardDeviation: number;
  submissionRate: number; // 0-1
  lateCount: number;
  scoreDistribution: Record<string, number>; // letter grade → count
}

export interface CreateAssignmentInput {
  title: string;
  description?: string;
  instructions?: string;
  rubricName?: string;
  criteria?: Array<Omit<RubricCriterion, 'id'>>;
  dueDate: number;
  allowLateSubmissions?: boolean;
  latePenaltyPerDay?: number;
  tags?: string[];
  attachments?: string[];
}

export interface SubmitAssignmentInput {
  assignmentId: string;
  studentId: string;
  studentName: string;
  projectSnapshot: Record<string, unknown>;
  notes?: string;
}

export interface GradeSubmissionInput {
  submissionId: string;
  criterionGrades: Array<Omit<CriterionGrade, 'feedback'> & { feedback?: string }>;
  overallFeedback?: string;
  gradedBy?: string;
}

export interface CsvExportOptions {
  includeLetterGrades?: boolean;
  includeFeedback?: boolean;
  includeLatePenalty?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_ASSIGNMENTS = 'protopulse:classroom:assignments';
const STORAGE_KEY_SUBMISSIONS = 'protopulse:classroom:submissions';

const LETTER_GRADE_THRESHOLDS: Array<{ min: number; grade: string }> = [
  { min: 93, grade: 'A' },
  { min: 90, grade: 'A-' },
  { min: 87, grade: 'B+' },
  { min: 83, grade: 'B' },
  { min: 80, grade: 'B-' },
  { min: 77, grade: 'C+' },
  { min: 73, grade: 'C' },
  { min: 70, grade: 'C-' },
  { min: 67, grade: 'D+' },
  { min: 63, grade: 'D' },
  { min: 60, grade: 'D-' },
  { min: 0, grade: 'F' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function percentageToLetterGrade(percentage: number): string {
  for (const { min, grade } of LETTER_GRADE_THRESHOLDS) {
    if (percentage >= min) {
      return grade;
    }
  }
  return 'F';
}

function computeLateDays(submittedAt: number, dueDate: number): number {
  if (submittedAt <= dueDate) {
    return 0;
  }
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((submittedAt - dueDate) / msPerDay);
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function standardDeviation(values: number[], mean: number): number {
  if (values.length < 2) {
    return 0;
  }
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ---------------------------------------------------------------------------
// ClassroomManager
// ---------------------------------------------------------------------------

export class ClassroomManager {
  private static instance: ClassroomManager | null = null;

  private assignments: Assignment[] = [];
  private submissions: Submission[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  static getInstance(): ClassroomManager {
    if (!ClassroomManager.instance) {
      ClassroomManager.instance = new ClassroomManager();
    }
    return ClassroomManager.instance;
  }

  static resetForTesting(): void {
    ClassroomManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private load(): void {
    try {
      const assignmentsJson = localStorage.getItem(STORAGE_KEY_ASSIGNMENTS);
      if (assignmentsJson) {
        this.assignments = JSON.parse(assignmentsJson) as Assignment[];
      }
      const submissionsJson = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
      if (submissionsJson) {
        this.submissions = JSON.parse(submissionsJson) as Submission[];
      }
    } catch {
      // Corrupted storage — start fresh
      this.assignments = [];
      this.submissions = [];
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY_ASSIGNMENTS, JSON.stringify(this.assignments));
    localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(this.submissions));
  }

  // -----------------------------------------------------------------------
  // Assignments — CRUD
  // -----------------------------------------------------------------------

  createAssignment(input: CreateAssignmentInput): Assignment {
    const now = Date.now();
    const criteria: RubricCriterion[] = (input.criteria ?? []).map((c) => ({
      ...c,
      id: crypto.randomUUID(),
    }));
    const totalPoints = criteria.reduce((sum, c) => sum + c.maxPoints, 0);
    const rubric: Rubric = {
      id: crypto.randomUUID(),
      name: input.rubricName ?? `${input.title} Rubric`,
      criteria,
      totalPoints,
    };

    const assignment: Assignment = {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description ?? '',
      instructions: input.instructions ?? '',
      rubric,
      status: 'draft',
      dueDate: input.dueDate,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      closedAt: null,
      allowLateSubmissions: input.allowLateSubmissions ?? false,
      latePenaltyPerDay: input.latePenaltyPerDay ?? 10,
      maxScore: totalPoints,
      tags: input.tags ?? [],
      attachments: input.attachments ?? [],
    };

    this.assignments.push(assignment);
    this.save();
    this.notify();
    return assignment;
  }

  getAssignment(id: string): Assignment | null {
    return this.assignments.find((a) => a.id === id) ?? null;
  }

  getAllAssignments(): Assignment[] {
    return [...this.assignments];
  }

  getAssignmentsByStatus(status: AssignmentStatus): Assignment[] {
    return this.assignments.filter((a) => a.status === status);
  }

  updateAssignment(id: string, updates: Partial<Pick<Assignment, 'title' | 'description' | 'instructions' | 'dueDate' | 'allowLateSubmissions' | 'latePenaltyPerDay' | 'tags' | 'attachments'>>): Assignment {
    const idx = this.assignments.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new Error(`Assignment not found: ${id}`);
    }
    const assignment = this.assignments[idx];
    if (assignment.status !== 'draft') {
      throw new Error('Can only edit draft assignments');
    }
    this.assignments[idx] = {
      ...assignment,
      ...updates,
      updatedAt: Date.now(),
    };
    this.save();
    this.notify();
    return this.assignments[idx];
  }

  deleteAssignment(id: string): void {
    const idx = this.assignments.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new Error(`Assignment not found: ${id}`);
    }
    this.assignments.splice(idx, 1);
    // Remove associated submissions
    this.submissions = this.submissions.filter((s) => s.assignmentId !== id);
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Assignment lifecycle
  // -----------------------------------------------------------------------

  publishAssignment(id: string): Assignment {
    const idx = this.assignments.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new Error(`Assignment not found: ${id}`);
    }
    const assignment = this.assignments[idx];
    if (assignment.status !== 'draft') {
      throw new Error('Can only publish draft assignments');
    }
    if (assignment.rubric.criteria.length === 0) {
      throw new Error('Cannot publish assignment without rubric criteria');
    }
    this.assignments[idx] = {
      ...assignment,
      status: 'published',
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.save();
    this.notify();
    return this.assignments[idx];
  }

  closeAssignment(id: string): Assignment {
    const idx = this.assignments.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new Error(`Assignment not found: ${id}`);
    }
    const assignment = this.assignments[idx];
    if (assignment.status !== 'published') {
      throw new Error('Can only close published assignments');
    }
    this.assignments[idx] = {
      ...assignment,
      status: 'closed',
      closedAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.save();
    this.notify();
    return this.assignments[idx];
  }

  archiveAssignment(id: string): Assignment {
    const idx = this.assignments.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new Error(`Assignment not found: ${id}`);
    }
    const assignment = this.assignments[idx];
    if (assignment.status !== 'closed') {
      throw new Error('Can only archive closed assignments');
    }
    this.assignments[idx] = {
      ...assignment,
      status: 'archived',
      updatedAt: Date.now(),
    };
    this.save();
    this.notify();
    return this.assignments[idx];
  }

  // -----------------------------------------------------------------------
  // Rubric management
  // -----------------------------------------------------------------------

  updateRubric(assignmentId: string, criteria: Array<Omit<RubricCriterion, 'id'>>): Rubric {
    const idx = this.assignments.findIndex((a) => a.id === assignmentId);
    if (idx === -1) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }
    const assignment = this.assignments[idx];
    if (assignment.status !== 'draft') {
      throw new Error('Can only edit rubric on draft assignments');
    }
    const newCriteria: RubricCriterion[] = criteria.map((c) => ({
      ...c,
      id: crypto.randomUUID(),
    }));
    const totalPoints = newCriteria.reduce((sum, c) => sum + c.maxPoints, 0);
    const rubric: Rubric = {
      ...assignment.rubric,
      criteria: newCriteria,
      totalPoints,
    };
    this.assignments[idx] = {
      ...assignment,
      rubric,
      maxScore: totalPoints,
      updatedAt: Date.now(),
    };
    this.save();
    this.notify();
    return rubric;
  }

  // -----------------------------------------------------------------------
  // Submissions
  // -----------------------------------------------------------------------

  submitAssignment(input: SubmitAssignmentInput): Submission {
    const assignment = this.getAssignment(input.assignmentId);
    if (!assignment) {
      throw new Error(`Assignment not found: ${input.assignmentId}`);
    }
    if (assignment.status !== 'published' && assignment.status !== 'closed') {
      throw new Error('Assignment is not accepting submissions');
    }

    const now = Date.now();
    const isLate = now > assignment.dueDate;
    const lateDays = computeLateDays(now, assignment.dueDate);

    if (isLate && !assignment.allowLateSubmissions && assignment.status === 'published') {
      throw new Error('Late submissions are not allowed for this assignment');
    }

    // Check for existing submission from this student
    const existingSubmission = this.submissions.find(
      (s) => s.assignmentId === input.assignmentId && s.studentId === input.studentId && s.status !== 'returned',
    );

    const submission: Submission = {
      id: crypto.randomUUID(),
      assignmentId: input.assignmentId,
      studentId: input.studentId,
      studentName: input.studentName,
      status: existingSubmission ? 'resubmitted' : 'submitted',
      submittedAt: now,
      projectSnapshot: input.projectSnapshot,
      grade: null,
      isLate,
      lateDays,
      resubmissionOf: existingSubmission?.id ?? null,
      notes: input.notes ?? '',
    };

    this.submissions.push(submission);
    this.save();
    this.notify();
    return submission;
  }

  getSubmission(id: string): Submission | null {
    return this.submissions.find((s) => s.id === id) ?? null;
  }

  getSubmissionsForAssignment(assignmentId: string): Submission[] {
    return this.submissions.filter((s) => s.assignmentId === assignmentId);
  }

  getSubmissionsForStudent(studentId: string): Submission[] {
    return this.submissions.filter((s) => s.studentId === studentId);
  }

  getLatestSubmissions(assignmentId: string): Submission[] {
    const all = this.getSubmissionsForAssignment(assignmentId);
    const latestByStudent = new Map<string, Submission>();
    all.forEach((s) => {
      const existing = latestByStudent.get(s.studentId);
      if (!existing || s.submittedAt > existing.submittedAt) {
        latestByStudent.set(s.studentId, s);
      }
    });
    return Array.from(latestByStudent.values());
  }

  // -----------------------------------------------------------------------
  // Grading
  // -----------------------------------------------------------------------

  gradeSubmission(input: GradeSubmissionInput): Submission {
    const subIdx = this.submissions.findIndex((s) => s.id === input.submissionId);
    if (subIdx === -1) {
      throw new Error(`Submission not found: ${input.submissionId}`);
    }
    const submission = this.submissions[subIdx];
    const assignment = this.getAssignment(submission.assignmentId);
    if (!assignment) {
      throw new Error(`Assignment not found: ${submission.assignmentId}`);
    }

    // Validate criterion grades
    const criterionGrades: CriterionGrade[] = input.criterionGrades.map((cg) => {
      const criterion = assignment.rubric.criteria.find((c) => c.id === cg.criterionId);
      if (!criterion) {
        throw new Error(`Criterion not found: ${cg.criterionId}`);
      }
      if (cg.score < 0 || cg.score > criterion.maxPoints) {
        throw new Error(`Score ${cg.score} out of range [0, ${criterion.maxPoints}] for criterion "${criterion.name}"`);
      }
      return {
        criterionId: cg.criterionId,
        score: cg.score,
        feedback: cg.feedback ?? '',
      };
    });

    // Calculate weighted raw score
    const rawScore = this.calculateWeightedScore(criterionGrades, assignment.rubric);

    // Calculate late penalty
    let latePenalty = 0;
    if (submission.isLate && assignment.latePenaltyPerDay > 0) {
      latePenalty = Math.min(
        rawScore,
        (assignment.latePenaltyPerDay / 100) * assignment.maxScore * submission.lateDays,
      );
    }

    const finalScore = Math.max(0, rawScore - latePenalty);
    const percentage = assignment.maxScore > 0 ? (finalScore / assignment.maxScore) * 100 : 0;
    const letterGrade = percentageToLetterGrade(percentage);

    const grade: SubmissionGrade = {
      criterionGrades,
      rawScore,
      latePenalty,
      finalScore,
      percentage,
      letterGrade,
      overallFeedback: input.overallFeedback ?? '',
      gradedAt: Date.now(),
      gradedBy: input.gradedBy ?? 'instructor',
    };

    this.submissions[subIdx] = {
      ...submission,
      grade,
      status: 'graded',
    };
    this.save();
    this.notify();
    return this.submissions[subIdx];
  }

  returnSubmission(submissionId: string, feedback?: string): Submission {
    const subIdx = this.submissions.findIndex((s) => s.id === submissionId);
    if (subIdx === -1) {
      throw new Error(`Submission not found: ${submissionId}`);
    }
    const submission = this.submissions[subIdx];
    if (submission.status !== 'graded') {
      throw new Error('Can only return graded submissions');
    }
    this.submissions[subIdx] = {
      ...submission,
      status: 'returned',
      grade: submission.grade
        ? {
            ...submission.grade,
            overallFeedback: feedback ?? submission.grade.overallFeedback,
          }
        : null,
    };
    this.save();
    this.notify();
    return this.submissions[subIdx];
  }

  private calculateWeightedScore(criterionGrades: CriterionGrade[], rubric: Rubric): number {
    let totalWeight = 0;
    let weightedSum = 0;
    criterionGrades.forEach((cg) => {
      const criterion = rubric.criteria.find((c) => c.id === cg.criterionId);
      if (criterion) {
        totalWeight += criterion.weight;
        weightedSum += (cg.score / criterion.maxPoints) * criterion.weight;
      }
    });
    if (totalWeight === 0) {
      return 0;
    }
    // Normalize and scale to maxPoints
    return (weightedSum / totalWeight) * rubric.totalPoints;
  }

  // -----------------------------------------------------------------------
  // Statistics
  // -----------------------------------------------------------------------

  getClassStats(assignmentId: string, totalStudents?: number): ClassStats {
    const assignment = this.getAssignment(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }

    const latestSubmissions = this.getLatestSubmissions(assignmentId);
    const gradedSubmissions = latestSubmissions.filter((s) => s.grade !== null);
    const scores = gradedSubmissions.map((s) => s.grade!.finalScore);
    const percentages = gradedSubmissions.map((s) => s.grade!.percentage);

    const submittedCount = latestSubmissions.length;
    const actualTotalStudents = totalStudents ?? submittedCount;
    const gradedCount = gradedSubmissions.length;

    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const medianScore = median(scores);
    const highScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowScore = scores.length > 0 ? Math.min(...scores) : 0;
    const stdDev = standardDeviation(scores, averageScore);
    const lateCount = latestSubmissions.filter((s) => s.isLate).length;

    // Score distribution by letter grade
    const scoreDistribution: Record<string, number> = {};
    percentages.forEach((p) => {
      const letter = percentageToLetterGrade(p);
      scoreDistribution[letter] = (scoreDistribution[letter] ?? 0) + 1;
    });

    return {
      assignmentId,
      totalStudents: actualTotalStudents,
      submittedCount,
      gradedCount,
      averageScore,
      medianScore,
      highScore,
      lowScore,
      standardDeviation: stdDev,
      submissionRate: actualTotalStudents > 0 ? submittedCount / actualTotalStudents : 0,
      lateCount,
      scoreDistribution,
    };
  }

  // -----------------------------------------------------------------------
  // CSV Export
  // -----------------------------------------------------------------------

  exportGradesToCsv(assignmentId: string, options: CsvExportOptions = {}): string {
    const assignment = this.getAssignment(assignmentId);
    if (!assignment) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }

    const includeLetterGrades = options.includeLetterGrades ?? true;
    const includeFeedback = options.includeFeedback ?? false;
    const includeLatePenalty = options.includeLatePenalty ?? true;

    // Build header
    const headers: string[] = ['Student ID', 'Student Name', 'Submitted At', 'Late'];
    assignment.rubric.criteria.forEach((c) => {
      headers.push(escapeCsvField(c.name));
    });
    headers.push('Raw Score');
    if (includeLatePenalty) {
      headers.push('Late Penalty', 'Late Days');
    }
    headers.push('Final Score', 'Percentage');
    if (includeLetterGrades) {
      headers.push('Letter Grade');
    }
    if (includeFeedback) {
      headers.push('Feedback');
    }

    const rows: string[] = [headers.join(',')];

    const latestSubmissions = this.getLatestSubmissions(assignmentId);
    // Sort by student name
    latestSubmissions.sort((a, b) => a.studentName.localeCompare(b.studentName));

    latestSubmissions.forEach((sub) => {
      const fields: string[] = [
        escapeCsvField(sub.studentId),
        escapeCsvField(sub.studentName),
        new Date(sub.submittedAt).toISOString(),
        sub.isLate ? 'Yes' : 'No',
      ];

      if (sub.grade) {
        assignment.rubric.criteria.forEach((c) => {
          const cg = sub.grade!.criterionGrades.find((g) => g.criterionId === c.id);
          fields.push(cg ? String(cg.score) : '');
        });
        fields.push(String(sub.grade.rawScore));
        if (includeLatePenalty) {
          fields.push(String(sub.grade.latePenalty), String(sub.lateDays));
        }
        fields.push(String(sub.grade.finalScore), String(Math.round(sub.grade.percentage * 100) / 100));
        if (includeLetterGrades) {
          fields.push(sub.grade.letterGrade);
        }
        if (includeFeedback) {
          fields.push(escapeCsvField(sub.grade.overallFeedback));
        }
      } else {
        // Ungraded — fill with empty
        assignment.rubric.criteria.forEach(() => {
          fields.push('');
        });
        fields.push('', ...(includeLatePenalty ? ['', ''] : []), '', '');
        if (includeLetterGrades) {
          fields.push('');
        }
        if (includeFeedback) {
          fields.push('');
        }
      }

      rows.push(fields.join(','));
    });

    return rows.join('\n');
  }

  // -----------------------------------------------------------------------
  // Bulk operations
  // -----------------------------------------------------------------------

  getStudentGradebook(studentId: string): Array<{
    assignment: Assignment;
    submission: Submission | null;
    score: number | null;
    percentage: number | null;
    letterGrade: string | null;
  }> {
    return this.assignments
      .filter((a) => a.status !== 'draft')
      .map((assignment) => {
        const submissions = this.submissions.filter(
          (s) => s.assignmentId === assignment.id && s.studentId === studentId,
        );
        // Get latest submission
        const submission = submissions.length > 0
          ? submissions.reduce((latest, s) => (s.submittedAt > latest.submittedAt ? s : latest))
          : null;

        return {
          assignment,
          submission,
          score: submission?.grade?.finalScore ?? null,
          percentage: submission?.grade?.percentage ?? null,
          letterGrade: submission?.grade?.letterGrade ?? null,
        };
      });
  }

  calculateOverallGrade(studentId: string): { percentage: number; letterGrade: string; totalScore: number; maxPossible: number } {
    const gradebook = this.getStudentGradebook(studentId);
    const graded = gradebook.filter((entry) => entry.score !== null);

    if (graded.length === 0) {
      return { percentage: 0, letterGrade: 'F', totalScore: 0, maxPossible: 0 };
    }

    const totalScore = graded.reduce((sum, entry) => sum + (entry.score ?? 0), 0);
    const maxPossible = graded.reduce((sum, entry) => sum + entry.assignment.maxScore, 0);
    const percentage = maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0;
    const letterGrade = percentageToLetterGrade(percentage);

    return { percentage, letterGrade, totalScore, maxPossible };
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  getEnrolledStudentIds(assignmentId: string): string[] {
    const studentIds = new Set<string>();
    this.submissions
      .filter((s) => s.assignmentId === assignmentId)
      .forEach((s) => {
        studentIds.add(s.studentId);
      });
    return Array.from(studentIds);
  }

  clearAll(): void {
    this.assignments = [];
    this.submissions = [];
    this.save();
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useClassroom(): {
  assignments: Assignment[];
  submissions: Submission[];
  createAssignment: (input: CreateAssignmentInput) => Assignment;
  updateAssignment: (id: string, updates: Partial<Pick<Assignment, 'title' | 'description' | 'instructions' | 'dueDate' | 'allowLateSubmissions' | 'latePenaltyPerDay' | 'tags' | 'attachments'>>) => Assignment;
  deleteAssignment: (id: string) => void;
  publishAssignment: (id: string) => Assignment;
  closeAssignment: (id: string) => Assignment;
  submitAssignment: (input: SubmitAssignmentInput) => Submission;
  gradeSubmission: (input: GradeSubmissionInput) => Submission;
  returnSubmission: (submissionId: string, feedback?: string) => Submission;
  getClassStats: (assignmentId: string, totalStudents?: number) => ClassStats;
  exportGradesToCsv: (assignmentId: string, options?: CsvExportOptions) => string;
} {
  const mgr = ClassroomManager.getInstance();
  const [, setTick] = useState(0);

  useEffect(() => {
    return mgr.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, [mgr]);

  return {
    assignments: mgr.getAllAssignments(),
    submissions: [...mgr.getSubmissionsForAssignment('')].length >= 0 ? (() => {
      const all: Submission[] = [];
      mgr.getAllAssignments().forEach((a) => {
        mgr.getSubmissionsForAssignment(a.id).forEach((s) => {
          all.push(s);
        });
      });
      return all;
    })() : [],
    createAssignment: useCallback((input: CreateAssignmentInput) => mgr.createAssignment(input), [mgr]),
    updateAssignment: useCallback((id: string, updates: Partial<Pick<Assignment, 'title' | 'description' | 'instructions' | 'dueDate' | 'allowLateSubmissions' | 'latePenaltyPerDay' | 'tags' | 'attachments'>>) => mgr.updateAssignment(id, updates), [mgr]),
    deleteAssignment: useCallback((id: string) => mgr.deleteAssignment(id), [mgr]),
    publishAssignment: useCallback((id: string) => mgr.publishAssignment(id), [mgr]),
    closeAssignment: useCallback((id: string) => mgr.closeAssignment(id), [mgr]),
    submitAssignment: useCallback((input: SubmitAssignmentInput) => mgr.submitAssignment(input), [mgr]),
    gradeSubmission: useCallback((input: GradeSubmissionInput) => mgr.gradeSubmission(input), [mgr]),
    returnSubmission: useCallback((submissionId: string, feedback?: string) => mgr.returnSubmission(submissionId, feedback), [mgr]),
    getClassStats: useCallback((assignmentId: string, totalStudents?: number) => mgr.getClassStats(assignmentId, totalStudents), [mgr]),
    exportGradesToCsv: useCallback((assignmentId: string, options?: CsvExportOptions) => mgr.exportGradesToCsv(assignmentId, options), [mgr]),
  };
}
