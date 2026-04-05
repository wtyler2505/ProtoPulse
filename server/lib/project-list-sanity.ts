import type { Project } from '@shared/schema';

export interface ProjectListAnomaly {
  projectId: number;
  issues: string[];
}

export function findProjectListAnomalies(projectList: Project[]): ProjectListAnomaly[] {
  const duplicateCounts = new Map<number, number>();
  for (const project of projectList) {
    duplicateCounts.set(project.id, (duplicateCounts.get(project.id) ?? 0) + 1);
  }

  return projectList.flatMap((project) => {
    const issues: string[] = [];

    if (project.deletedAt !== null) {
      issues.push('soft-deleted project leaked into active list');
    }
    if (project.ownerId === null) {
      issues.push('owner missing');
    }
    if (project.name.trim().length === 0) {
      issues.push('blank project name');
    }
    if ((duplicateCounts.get(project.id) ?? 0) > 1) {
      issues.push('duplicate project id in list');
    }

    return issues.length > 0 ? [{ projectId: project.id, issues }] : [];
  });
}
