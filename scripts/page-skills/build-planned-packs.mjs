#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST_PATH = '.agents/page-skills/manifest.json';
const AUTO_SYNC_START = '<!-- PAGE-SKILL:AUTO-SYNC:START -->';
const AUTO_SYNC_END = '<!-- PAGE-SKILL:AUTO-SYNC:END -->';
const REQUIRED_PACK_FILES = [
  'references/page-map.md',
  'references/testing.md',
  'references/ux-contract.md',
  'references/gotchas.md',
  'references/self-improvement-log.md',
  'agents/openai.yaml',
];

const FOCUS = {
  dashboard: ['status overview', 'project health', 'recent activity', 'next actions'],
  component_editor: ['component metadata', 'pin data', 'footprint readiness', 'part editing safety'],
  output: ['exports', 'artifact download', 'format readiness', 'fab handoff'],
  arduino: ['compile/upload', 'board selection', 'serial workflow', 'device safety'],
  circuit_code: ['generated circuit code', 'code preview', 'copy/export actions', 'source trust'],
  simulation: ['simulation setup', 'run controls', 'results display', 'error recovery'],
  calculators: ['electronics calculators', 'input validation', 'units', 'apply-to-design actions'],
  generative_design: ['AI generation', 'proposal review', 'adoption flow', 'trust labels'],
  serial_monitor: ['serial connection', 'logs', 'send controls', 'device feedback'],
  digital_twin: ['virtual hardware state', '3D/behavior preview', 'sync health', 'state confidence'],
  storage: ['inventory', 'local storage', 'saved parts', 'data recovery'],
  ordering: ['PCB order flow', 'fab checks', 'cost/shipping', 'final review'],
  lifecycle: ['project lifecycle', 'maturity stages', 'readiness', 'history'],
  starter_circuits: ['starter templates', 'learning flow', 'quick start', 'safe defaults'],
  design_patterns: ['reusable patterns', 'search/browse', 'apply flow', 'pattern trust'],
  kanban: ['tasks', 'status columns', 'workflow planning', 'drag/drop'],
  comments: ['discussion', 'review notes', 'anchors', 'resolved state'],
  design_history: ['version history', 'diffs', 'restore flow', 'auditability'],
  knowledge: ['learning content', 'search', 'source quality', 'view-aware help'],
  community: ['shared projects', 'community examples', 'trust/safety', 'import flow'],
  project_explorer: ['project tree', 'file navigation', 'sidebar density', 'selection'],
  viewer_3d: ['3D board view', 'camera controls', 'nonblank rendering', 'performance'],
  audit_trail: ['audit events', 'filtering', 'evidence', 'traceability'],
  labs: ['lab templates', 'experiment setup', 'guided workflow', 'result capture'],
  supply_chain: ['supplier risk', 'availability alerts', 'alternates', 'source confidence'],
  bom_templates: ['BOM templates', 'reuse', 'template editing', 'apply flow'],
  personal_inventory: ['personal parts', 'stock counts', 'locations', 'part confidence'],
  part_alternates: ['alternate parts', 'comparison', 'tradeoffs', 'substitution safety'],
  part_usage: ['where-used data', 'usage impact', 'project links', 'part lifecycle'],
  vault_browser: ['vault browsing', 'knowledge sources', 'search', 'provenance'],
};

function titleCase(value) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function sentenceList(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function scriptSlug(skillName) {
  return skillName.replace(/^pp-view-/, '');
}

function functionName(skillName) {
  return `inspect${scriptSlug(skillName)
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')}`;
}

function autoSyncBlock(entry) {
  return `${AUTO_SYNC_START}
Last synced: pending
Commit: pending
Manifest status: ${entry.status}
Tier: ${String(entry.tier)}

Source globs:
${entry.sourceGlobs.length ? sentenceList(entry.sourceGlobs) : '- none recorded'}

Test globs:
${entry.testGlobs.length ? sentenceList(entry.testGlobs) : '- none recorded'}
${AUTO_SYNC_END}`;
}

function skillText(entry) {
  const focus = FOCUS[entry.viewId] ?? ['page behavior', 'layout', 'tests', 'workflow clarity'];
  return `---
name: ${entry.skillName}
description: ProtoPulse page intelligence for ${entry.label}. Use when working on ${entry.label} view behavior, layout, workflow, tests, or page-specific UX.
---

# ProtoPulse ${entry.label}

Use this for page-level ${entry.label} work: ${focus.join(', ')}.

## When To Use

${sentenceList(focus.map((item) => `${titleCase(item)} work in the ${entry.label} area.`))}
- Bugs where ${entry.label} routing, state, layout, or tests are unclear.
- Any task where a future agent would otherwise need to rediscover ${entry.label} file locations.

## Fast Workflow

1. Run \`node ${path.dirname(entry.skillPath)}/scripts/inspect-${scriptSlug(entry.skillName)}.mjs\`.
2. Read \`references/page-map.md\` for files and ownership.
3. Read \`references/ux-contract.md\` before changing layout or user-facing behavior.
4. Read \`references/testing.md\` for the closest checks.
5. Read \`references/gotchas.md\` before touching sync, persistence, generated output, or trust-sensitive behavior.
6. Add durable lessons to \`references/self-improvement-log.md\`.

## Useful Checks

- \`node ${path.dirname(entry.skillPath)}/scripts/inspect-${scriptSlug(entry.skillName)}.mjs\`
- \`npm run page-skills:check\`
- Run the nearest tests listed in \`references/testing.md\`.
- Browser-check visible UI, scroll, menu, and responsive changes.

## Self-Improvement Rule

This skill is allowed to improve itself. Keep auto-synced facts inside the block below, and keep human guidance in the reference files.

Warnings count as defects. Do not call ${entry.label} work clean while known test, runtime, or console warnings remain.

## Auto-Sync Facts

${autoSyncBlock(entry)}
`;
}

function pageMap(entry) {
  const sourceLines = entry.sourceGlobs.length ? sentenceList(entry.sourceGlobs.map((item) => `\`${item}\``)) : '- No source globs recorded yet.';
  const testLines = entry.testGlobs.length ? sentenceList(entry.testGlobs.map((item) => `\`${item}\``)) : '- No test globs recorded yet.';
  return `# ${entry.label} Page Map

Use this before changing ${entry.label}. It records where the page likely lives and what nearby systems can be affected.

## Source Globs

${sourceLines}

## Test Globs

${testLines}

## Ownership

- This skill owns page-level ${entry.label} orientation.
- Implementation files remain the source of truth.
- If this map disagrees with the code, update this map after verifying the code.

## Neighbor Systems

- Workspace navigation can affect whether ${entry.label} is reachable.
- UI/UX changes can affect layout, density, scrolling, and accessibility.
- AI/chat actions may need view-aware context for this page.
- Validation, export, inventory, or procurement may depend on this page when the workflow touches hardware readiness.
`;
}

function testing(entry) {
  const testLines = entry.testGlobs.length
    ? sentenceList(entry.testGlobs.map((item) => `\`npm run test -- ${item}\``))
    : '- No dedicated test glob is recorded yet. Add or locate the nearest test before risky changes.';
  return `# ${entry.label} Testing Guide

Use the smallest test set that proves the changed behavior.

## Recorded Test Handles

${testLines}

## Skill Checks

- \`node ${path.dirname(entry.skillPath)}/scripts/inspect-${scriptSlug(entry.skillName)}.mjs\`
- \`npm run page-skills:check\`
- \`npm run page-skills:audit-packs\`

## Browser Checks

For visible UI changes:

1. Open ${entry.label}.
2. Confirm the page loads without a white screen.
3. Confirm main controls are reachable.
4. Confirm menus and panels scroll when content grows.
5. Confirm text does not overlap or overflow.
6. Confirm keyboard/focus behavior when controls changed.

Warnings count as defects.
`;
}

function uxContract(entry) {
  const focus = FOCUS[entry.viewId] ?? ['page behavior', 'layout', 'tests', 'workflow clarity'];
  return `# ${entry.label} UX Contract

The ${entry.label} page should be useful, readable, and easy to recover from.

## Must Hold True

${sentenceList(focus.map((item) => `${titleCase(item)} is visible enough for a user to understand what is happening.`))}
- Important actions have clear labels or familiar icons with tooltips.
- Secondary actions do not crowd the main work area.
- Long menus and panels can scroll.
- Error, warning, empty, and loading states are understandable.
- AI-generated or uncertain data is clearly marked.

## Layout Rules

- Keep the page focused on the user's next action.
- Avoid piling up extra top bars.
- Do not nest cards inside cards.
- Keep text inside its container.
- Check laptop-height viewports, not only wide desktop.
`;
}

function gotchas(entry) {
  return `# ${entry.label} Gotchas

## Common Risks

- Passing tests do not prove the layout is good.
- A page can be reachable by URL while the rendered view fails to change.
- Fixed heights and nested overflow can create scroll traps.
- Mocked tests can hide runtime warnings.
- View-specific changes can still affect workspace navigation.

## Before Finishing

- Run the nearest tests.
- Run this skill's inspector.
- Check visible UI in a browser when layout changed.
- Update \`references/self-improvement-log.md\` with durable lessons.
`;
}

function selfImprovement(entry) {
  return `# ${entry.label} Skill Self-Improvement Log

## Accepted Learnings

- This skill was built from the page-skill manifest so ${entry.label} work has a discoverable home.
- Keep page maps current when source files move.
- Keep tests and browser checks tied to real ${entry.label} behavior.

## Pending Proposals

- Add screenshots for the main ${entry.label} states.
- Add more specific gotchas after the next real ${entry.label} implementation pass.

## Rejected Or Deferred

- Do not leave this as a thin \`SKILL.md\` only.
`;
}

function openaiYaml(entry) {
  return `display_name: ProtoPulse ${entry.label}
short_description: Page intelligence for ProtoPulse ${entry.label} workflows, UX, tests, and self-improvement.
default_prompt: |
  You are helping with the ProtoPulse ${entry.label} page.
  Start with the page inspector, then read the smallest matching reference.
  Keep changes scoped, verify the nearest tests, and update the self-improvement log when you learn something durable.
`;
}

function inspector(entry) {
  const fnName = functionName(entry.skillName);
  return `#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '${path.dirname(entry.skillPath)}';
const SOURCE_FILES = ${JSON.stringify(entry.sourceGlobs.filter((item) => !item.includes('*')), null, 2)};
const TEST_FILES = ${JSON.stringify(entry.testGlobs.filter((item) => !item.includes('*')), null, 2)};

export async function ${fnName}(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function format${fnName.replace(/^inspect/, '')}InspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse ${entry.label}', report);
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  const report = await ${fnName}();
  console.log(format${fnName.replace(/^inspect/, '')}InspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
`;
}

async function writeSkillPack(rootDir, entry) {
  const skillDir = path.join(rootDir, path.dirname(entry.skillPath));
  await mkdir(path.join(skillDir, 'references'), { recursive: true });
  await mkdir(path.join(skillDir, 'scripts'), { recursive: true });
  await mkdir(path.join(skillDir, 'agents'), { recursive: true });

  const files = {
    'SKILL.md': skillText(entry),
    'references/page-map.md': pageMap(entry),
    'references/testing.md': testing(entry),
    'references/ux-contract.md': uxContract(entry),
    'references/gotchas.md': gotchas(entry),
    'references/self-improvement-log.md': selfImprovement(entry),
    'agents/openai.yaml': openaiYaml(entry),
    [`scripts/inspect-${scriptSlug(entry.skillName)}.mjs`]: inspector(entry),
  };

  for (const [relativePath, text] of Object.entries(files)) {
    await writeFile(path.join(skillDir, relativePath), text, 'utf8');
  }
}

async function hasFullPack(rootDir, entry) {
  const skillDir = path.join(rootDir, path.dirname(entry.skillPath));
  for (const relativePath of REQUIRED_PACK_FILES) {
    try {
      await access(path.join(skillDir, relativePath));
    } catch {
      return false;
    }
  }
  return true;
}

export async function buildPlannedPageSkillPacks(rootDir = process.cwd()) {
  const manifestPath = path.join(rootDir, MANIFEST_PATH);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const built = [];

  for (const entry of manifest.entries ?? []) {
    const shouldBuild = entry.status === 'planned' || (entry.status === 'active' && !(await hasFullPack(rootDir, entry)));
    if (!shouldBuild) {
      continue;
    }
    entry.status = 'active';
    entry.nextAction = `Keep ${entry.label} page map, UX contract, tests, and gotchas current.`;
    await writeSkillPack(rootDir, entry);
    built.push(entry.skillName);
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { built };
}

async function main() {
  const result = await buildPlannedPageSkillPacks();
  console.log(`Built planned page-skill packs: ${result.built.length}`);
  for (const skillName of result.built) {
    console.log(`- ${skillName}`);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
