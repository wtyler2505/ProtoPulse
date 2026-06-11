#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

export const STANDARD_REFERENCES = [
  'references/page-map.md',
  'references/testing.md',
  'references/ux-contract.md',
  'references/gotchas.md',
  'references/self-improvement-log.md',
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fileStats(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!(await exists(absolutePath))) {
    return { relativePath, exists: false, lines: 0, tests: 0 };
  }

  const text = await readFile(absolutePath, 'utf8');
  return {
    relativePath,
    exists: true,
    lines: text.split(/\r?\n/).length,
    tests: (text.match(/\b(?:it|test)\s*\(/g) || []).length,
  };
}

export async function inspectPageSkillPack({
  rootDir = process.cwd(),
  skillDir,
  sourceFiles = [],
  testFiles = [],
  references = STANDARD_REFERENCES,
}) {
  const [referenceStats, sourceStats, testStats] = await Promise.all([
    Promise.all(references.map((file) => fileStats(path.join(rootDir, skillDir), file))),
    Promise.all(sourceFiles.map((file) => fileStats(rootDir, file))),
    Promise.all(testFiles.map((file) => fileStats(rootDir, file))),
  ]);

  const missing = [...referenceStats, ...sourceStats, ...testStats].filter((entry) => !entry.exists);

  return {
    references: referenceStats,
    sources: sourceStats,
    tests: testStats,
    missing,
    totalTests: testStats.reduce((sum, entry) => sum + entry.tests, 0),
    ok: missing.length === 0,
  };
}

function formatGroup(title, entries) {
  const lines = [`${title}:`];
  for (const entry of entries) {
    const status = entry.exists ? 'ok' : 'missing';
    const extra = entry.exists ? ` (${entry.lines} lines${entry.tests ? `, ${entry.tests} tests` : ''})` : '';
    lines.push(`- ${status}: ${entry.relativePath}${extra}`);
  }
  return lines.join('\n');
}

export function formatPageSkillInspectionReport(title, report) {
  return [
    `${title} Skill Inspection`,
    `Status: ${report.ok ? 'ok' : 'needs work'}`,
    `Tracked test cases in required files: ${report.totalTests}`,
    '',
    formatGroup('References', report.references),
    '',
    formatGroup('Source files', report.sources),
    '',
    formatGroup('Test files', report.tests),
    '',
    report.missing.length
      ? `Missing required files:\n${report.missing.map((entry) => `- ${entry.relativePath}`).join('\n')}`
      : 'Missing required files: none',
  ].join('\n');
}
