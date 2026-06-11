#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_MANIFEST_PATH = '.agents/page-skills/manifest.json';
const VIEW_MODE_PATH = 'client/src/lib/project-context.tsx';
const NAV_ITEMS_PATH = 'client/src/components/layout/sidebar/sidebar-constants.ts';
const VALID_STATUSES = new Set(['active', 'planned', 'stub', 'retired']);

export async function fileExists(rootDir, relPath) {
  try {
    await access(path.join(rootDir, relPath));
    return true;
  } catch {
    return false;
  }
}

export function extractViewModes(source) {
  const match = source.match(/export\s+type\s+ViewMode\s*=\s*([^;]+);/s);
  if (!match) {
    return [];
  }
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

export function extractNavItems(source) {
  return [...source.matchAll(/view:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'/g)]
    .map((item) => ({ viewId: item[1], label: item[2] }));
}

export function validateManifest({ manifest, viewModes, navItems, skillExists }) {
  const errors = [];
  const warnings = [];
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const byViewId = new Map();

  if (!Array.isArray(manifest.entries)) {
    errors.push('Manifest must contain an entries array.');
  }

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      errors.push('Manifest contains a non-object entry.');
      continue;
    }
    if (typeof entry.viewId !== 'string' || entry.viewId.length === 0) {
      errors.push('Manifest entry is missing viewId.');
      continue;
    }
    if (byViewId.has(entry.viewId)) {
      errors.push(`Duplicate manifest entry for ${entry.viewId}.`);
    }
    byViewId.set(entry.viewId, entry);
    if (!VALID_STATUSES.has(entry.status)) {
      errors.push(`${entry.viewId}: invalid status "${String(entry.status)}".`);
    }
    if (!Number.isInteger(entry.tier) || entry.tier < 1 || entry.tier > 3) {
      errors.push(`${entry.viewId}: tier must be 1, 2, or 3.`);
    }
    if (!Array.isArray(entry.sourceGlobs)) {
      errors.push(`${entry.viewId}: sourceGlobs must be an array.`);
    }
    if (!Array.isArray(entry.testGlobs)) {
      errors.push(`${entry.viewId}: testGlobs must be an array.`);
    }
    if ((entry.status === 'active' || entry.status === 'stub') && !skillExists(entry)) {
      errors.push(`${entry.viewId}: ${entry.status} skill missing at ${entry.skillPath}.`);
    }
    if (entry.status === 'planned') {
      warnings.push(`${entry.viewId}: planned skill not built yet (${entry.skillName}).`);
    }
  }

  for (const viewId of viewModes) {
    if (!byViewId.has(viewId)) {
      errors.push(`ViewMode "${viewId}" is missing from manifest.`);
    }
  }

  for (const navItem of navItems) {
    const entry = byViewId.get(navItem.viewId);
    if (!entry) {
      errors.push(`Navigation view "${navItem.viewId}" (${navItem.label}) is missing from manifest.`);
    } else if (entry.label !== navItem.label) {
      warnings.push(`${navItem.viewId}: manifest label "${entry.label}" differs from nav label "${navItem.label}".`);
    }
  }

  return {
    errors,
    warnings,
    activeCount: entries.filter((entry) => entry.status === 'active').length,
    plannedCount: entries.filter((entry) => entry.status === 'planned').length,
    stubCount: entries.filter((entry) => entry.status === 'stub').length,
    retiredCount: entries.filter((entry) => entry.status === 'retired').length,
    totalCount: entries.length,
  };
}

export async function runPageSkillCheck(rootDir = process.cwd(), manifestPath = DEFAULT_MANIFEST_PATH) {
  const [manifestRaw, viewModeSource, navSource] = await Promise.all([
    readFile(path.join(rootDir, manifestPath), 'utf8'),
    readFile(path.join(rootDir, VIEW_MODE_PATH), 'utf8'),
    readFile(path.join(rootDir, NAV_ITEMS_PATH), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestRaw);
  const viewModes = extractViewModes(viewModeSource);
  const navItems = extractNavItems(navSource);
  const existence = new Map();

  const result = validateManifest({
    manifest,
    viewModes,
    navItems,
    skillExists: (entry) => {
      if (typeof entry.skillPath !== 'string' || entry.skillPath.length === 0) {
        return false;
      }
      return existence.get(entry.skillPath) === true;
    },
  });

  for (const entry of manifest.entries ?? []) {
    if (entry?.skillPath) {
      existence.set(entry.skillPath, await fileExists(rootDir, entry.skillPath));
    }
  }

  return validateManifest({
    manifest,
    viewModes,
    navItems,
    skillExists: (entry) => existence.get(entry.skillPath) === true,
  });
}

export function formatReport(result) {
  const lines = [
    'ProtoPulse page-skill coverage',
    `Total: ${result.totalCount} | active: ${result.activeCount} | planned: ${result.plannedCount} | stub: ${result.stubCount} | retired: ${result.retiredCount}`,
  ];
  if (result.errors.length > 0) {
    lines.push('', 'Errors:');
    lines.push(...result.errors.map((item) => `- ${item}`));
  }
  if (result.warnings.length > 0) {
    lines.push('', 'Planned / warnings:');
    lines.push(...result.warnings.map((item) => `- ${item}`));
  }
  if (result.errors.length === 0) {
    lines.push('', 'Coverage check passed.');
  }
  return lines.join('\n');
}

async function main() {
  const result = await runPageSkillCheck();
  console.log(formatReport(result));
  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
