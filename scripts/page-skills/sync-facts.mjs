#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MANIFEST_PATH = '.agents/page-skills/manifest.json';
const START = '<!-- PAGE-SKILL:AUTO-SYNC:START -->';
const END = '<!-- PAGE-SKILL:AUTO-SYNC:END -->';

async function currentCommit(rootDir) {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd: rootDir });
    return stdout.trim();
  } catch {
    return 'unknown';
  }
}

function autoSyncBlock(entry, syncedAt, commit) {
  const sourceGlobs = entry.sourceGlobs.length > 0
    ? entry.sourceGlobs.map((item) => `- ${item}`).join('\n')
    : '- none recorded';
  const testGlobs = entry.testGlobs.length > 0
    ? entry.testGlobs.map((item) => `- ${item}`).join('\n')
    : '- none recorded';
  return `${START}
Last synced: ${syncedAt}
Commit: ${commit}
Manifest status: ${entry.status}
Tier: ${String(entry.tier)}

Source globs:
${sourceGlobs}

Test globs:
${testGlobs}
${END}`;
}

export function replaceAutoSyncSection(skillText, block) {
  const startIndex = skillText.indexOf(START);
  const endIndex = skillText.indexOf(END);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return null;
  }
  return `${skillText.slice(0, startIndex)}${block}${skillText.slice(endIndex + END.length)}`;
}

export async function syncPageSkillFacts(rootDir = process.cwd()) {
  const manifestPath = path.join(rootDir, MANIFEST_PATH);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const syncedAt = new Date().toISOString();
  const commit = await currentCommit(rootDir);
  const changed = [];
  const skipped = [];

  for (const entry of manifest.entries ?? []) {
    if (entry.status !== 'active' && entry.status !== 'stub') {
      continue;
    }
    const skillPath = path.join(rootDir, entry.skillPath);
    let skillText;
    try {
      skillText = await readFile(skillPath, 'utf8');
    } catch {
      skipped.push(`${entry.viewId}: missing ${entry.skillPath}`);
      continue;
    }
    const nextText = replaceAutoSyncSection(skillText, autoSyncBlock(entry, syncedAt, commit));
    if (nextText == null) {
      skipped.push(`${entry.viewId}: missing AUTO-SYNC markers`);
      continue;
    }
    if (nextText !== skillText) {
      await writeFile(skillPath, nextText, 'utf8');
      changed.push(entry.viewId);
    }
    entry.lastSynced = syncedAt;
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { changed, skipped, syncedAt, commit };
}

async function main() {
  const result = await syncPageSkillFacts();
  console.log(`Synced page-skill facts at ${result.syncedAt} (${result.commit}).`);
  console.log(`Changed: ${result.changed.length > 0 ? result.changed.join(', ') : 'none'}`);
  if (result.skipped.length > 0) {
    console.log('Skipped:');
    for (const item of result.skipped) {
      console.log(`- ${item}`);
    }
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
