#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST_PATH = '.agents/page-skills/manifest.json';
const REQUIRED_SKILL_FILES = [
  'SKILL.md',
  'agents/openai.yaml',
  'references/page-map.md',
  'references/testing.md',
  'references/ux-contract.md',
  'references/gotchas.md',
  'references/self-improvement-log.md',
];
const AUTO_SYNC_START = '<!-- PAGE-SKILL:AUTO-SYNC:START -->';
const AUTO_SYNC_END = '<!-- PAGE-SKILL:AUTO-SYNC:END -->';

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function skillDirFromSkillPath(skillPath) {
  return path.dirname(skillPath);
}

function scriptName(entry) {
  return `scripts/inspect-${entry.skillName.replace(/^pp-view-/, '')}.mjs`;
}

export async function auditPageSkillPacks(rootDir = process.cwd()) {
  const manifest = JSON.parse(await readFile(path.join(rootDir, MANIFEST_PATH), 'utf8'));
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const errors = [];
  const warnings = [];
  const activeEntries = entries.filter((entry) => entry.status === 'active');
  const plannedEntries = entries.filter((entry) => entry.status === 'planned');

  for (const entry of entries) {
    if (!entry.viewId || !entry.skillName || !entry.skillPath) {
      errors.push(`Malformed manifest entry: ${JSON.stringify(entry)}`);
    }
  }

  if (plannedEntries.length > 0) {
    errors.push(`Manifest still has planned skills: ${plannedEntries.map((entry) => entry.skillName).join(', ')}`);
  }

  for (const entry of activeEntries) {
    const skillDir = skillDirFromSkillPath(entry.skillPath);
    for (const relativeFile of REQUIRED_SKILL_FILES) {
      const filePath = path.join(rootDir, skillDir, relativeFile);
      if (!(await fileExists(filePath))) {
        errors.push(`${entry.skillName}: missing ${path.join(skillDir, relativeFile)}`);
      }
    }

    const inspectorPath = path.join(rootDir, skillDir, scriptName(entry));
    if (!(await fileExists(inspectorPath))) {
      errors.push(`${entry.skillName}: missing ${path.join(skillDir, scriptName(entry))}`);
    }

    if (await fileExists(path.join(rootDir, entry.skillPath))) {
      const skillText = await readFile(path.join(rootDir, entry.skillPath), 'utf8');
      if (!skillText.includes(AUTO_SYNC_START) || !skillText.includes(AUTO_SYNC_END)) {
        errors.push(`${entry.skillName}: missing AUTO-SYNC block.`);
      }
      if (!skillText.includes('Fast Workflow') || !skillText.includes('Self-Improvement Rule')) {
        warnings.push(`${entry.skillName}: SKILL.md may be too thin.`);
      }
    }
  }

  return {
    totalCount: entries.length,
    activeCount: activeEntries.length,
    plannedCount: plannedEntries.length,
    errors,
    warnings,
  };
}

export function formatPackAuditReport(result) {
  const lines = [
    'ProtoPulse page-skill pack audit',
    `Total: ${result.totalCount} | active: ${result.activeCount} | planned: ${result.plannedCount}`,
  ];

  if (result.errors.length > 0) {
    lines.push('', 'Errors:');
    lines.push(...result.errors.map((item) => `- ${item}`));
  }

  if (result.warnings.length > 0) {
    lines.push('', 'Warnings:');
    lines.push(...result.warnings.map((item) => `- ${item}`));
  }

  if (result.errors.length === 0 && result.warnings.length === 0) {
    lines.push('', 'Pack audit passed.');
  }

  return lines.join('\n');
}

async function main() {
  const result = await auditPageSkillPacks();
  console.log(formatPackAuditReport(result));
  if (result.errors.length > 0 || result.warnings.length > 0) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
