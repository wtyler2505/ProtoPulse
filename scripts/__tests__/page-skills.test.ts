// @ts-nocheck
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditPageSkillPacks } from '../page-skills/audit-packs.mjs';
import { buildPlannedPageSkillPacks } from '../page-skills/build-planned-packs.mjs';
import { extractNavItems, extractViewModes, validateManifest } from '../page-skills/check.mjs';
import { replaceAutoSyncSection } from '../page-skills/sync-facts.mjs';

describe('page skill coverage helpers', () => {
  it('extracts ViewMode values and nav labels from repo source', () => {
    expect(extractViewModes("export type ViewMode = 'dashboard' | 'schematic';")).toEqual(['dashboard', 'schematic']);
    expect(extractNavItems("{ view: 'dashboard', label: 'Dashboard' }, { view: 'schematic', label: 'Schematic' }")).toEqual([
      { viewId: 'dashboard', label: 'Dashboard' },
      { viewId: 'schematic', label: 'Schematic' },
    ]);
  });

  it('reports missing views and missing active skills', () => {
    const result = validateManifest({
      manifest: {
        entries: [
          {
            viewId: 'dashboard',
            label: 'Dashboard',
            tier: 1,
            skillName: 'pp-view-dashboard',
            skillPath: '.agents/skills/pp-view-dashboard/SKILL.md',
            status: 'active',
            sourceGlobs: [],
            testGlobs: [],
          },
        ],
      },
      viewModes: ['dashboard', 'schematic'],
      navItems: [{ viewId: 'dashboard', label: 'Dashboard' }],
      skillExists: () => false,
    });
    expect(result.errors).toContain('dashboard: active skill missing at .agents/skills/pp-view-dashboard/SKILL.md.');
    expect(result.errors).toContain('ViewMode "schematic" is missing from manifest.');
  });

  it('allows planned skills to stay visible without requiring a skill file yet', () => {
    const result = validateManifest({
      manifest: {
        entries: [
          {
            viewId: 'schematic',
            label: 'Schematic',
            tier: 2,
            skillName: 'pp-view-schematic',
            skillPath: '.agents/skills/pp-view-schematic/SKILL.md',
            status: 'planned',
            sourceGlobs: [],
            testGlobs: [],
          },
        ],
      },
      viewModes: ['schematic'],
      navItems: [{ viewId: 'schematic', label: 'Schematic' }],
      skillExists: () => false,
    });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain('schematic: planned skill not built yet (pp-view-schematic).');
  });

  it('replaces only the AUTO-SYNC section', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'page-skills-'));
    await mkdir(path.join(dir, 'skill'), { recursive: true });
    const skillPath = path.join(dir, 'skill', 'SKILL.md');
    await writeFile(skillPath, [
      '# Skill',
      'Manual guidance stays.',
      '<!-- PAGE-SKILL:AUTO-SYNC:START -->',
      'old facts',
      '<!-- PAGE-SKILL:AUTO-SYNC:END -->',
      'Manual ending stays.',
      '',
    ].join('\n'));
    const text = await readFile(skillPath, 'utf8');
    const next = replaceAutoSyncSection(text, [
      '<!-- PAGE-SKILL:AUTO-SYNC:START -->',
      'new facts',
      '<!-- PAGE-SKILL:AUTO-SYNC:END -->',
    ].join('\n'));
    expect(next).toContain('Manual guidance stays.');
    expect(next).toContain('new facts');
    expect(next).not.toContain('old facts');
    expect(next).toContain('Manual ending stays.');
  });

  it('builds a planned page skill pack and audit sees it as active', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'page-skill-pack-'));
    await mkdir(path.join(dir, '.agents/page-skills'), { recursive: true });
    await mkdir(path.join(dir, 'client/src/components/views'), { recursive: true });
    await writeFile(path.join(dir, 'client/src/components/views/FooView.tsx'), 'export default function FooView() { return null; }\n');
    await writeFile(path.join(dir, '.agents/page-skills/manifest.json'), JSON.stringify({
      schemaVersion: 1,
      description: 'fixture',
      entries: [
        {
          viewId: 'foo',
          label: 'Foo',
          tier: 2,
          skillName: 'pp-view-foo',
          skillPath: '.agents/skills/pp-view-foo/SKILL.md',
          status: 'planned',
          sourceGlobs: ['client/src/components/views/FooView.tsx'],
          testGlobs: [],
          lastSynced: null,
          nextAction: 'Build fixture.',
        },
      ],
    }, null, 2));

    const built = await buildPlannedPageSkillPacks(dir);
    const manifest = JSON.parse(await readFile(path.join(dir, '.agents/page-skills/manifest.json'), 'utf8'));
    const audit = await auditPageSkillPacks(dir);

    expect(built.built).toEqual(['pp-view-foo']);
    expect(manifest.entries[0].status).toBe('active');
    expect(audit.errors).toEqual([]);
    expect(audit.warnings).toEqual([]);
  });
});
