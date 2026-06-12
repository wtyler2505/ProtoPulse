import { readFileSync, writeFileSync } from 'node:fs';

import { runErc  } from '@protopulse/erc';
import { exportBomCsv, exportKicadNetlist } from '@protopulse/export';
import { seedPartDb } from '@protopulse/parts';
import { Command } from 'commander';

import { badgeSvg } from './badge.js';
import { importLegacy } from './legacy.js';
import { loadDesign } from './load.js';

import type {Finding} from '@protopulse/erc';

/**
 * protopulse — CI for circuits. `protopulse check` fails your pipeline
 * the way a failing test does, because that's what it is.
 *
 * Exit codes: 0 clean · 1 findings at/above --fail-on · 2 load/usage error.
 */
const program = new Command();

program.name('protopulse').description('ProtoPulse headless engine — checks and exports for CI');

interface CheckReport {
  designId: string;
  branch: string;
  counts: { error: number; warn: number; info: number };
  materializeWarnings: string[];
  invariantViolations: string[];
  findings: Finding[];
}

function severityGlyph(sev: Finding['severity']): string {
  return sev === 'error' ? '✖' : sev === 'warn' ? '⚠' : 'ℹ';
}

program
  .command('check')
  .argument('<design>', 'path to a .ppx directory or .ppx.json bundle')
  .option('--branch <name>', 'branch to check (default: design head)')
  .option('--format <fmt>', 'pretty | json', 'pretty')
  .option('--fail-on <severity>', 'error | warn', 'error')
  .option('--badge <file>', 'write a shields-style SVG badge of the result')
  .description('materialize the design, validate invariants, run ERC')
  .action((designPath: string, opts: { branch?: string; format: string; failOn: string; badge?: string }) => {
    const { designId, branch, result } = loadDesign(designPath, opts.branch);
    const findings = runErc(result.graph, seedPartDb());
    const report: CheckReport = {
      designId,
      branch,
      counts: {
        error: findings.filter((f) => f.severity === 'error').length,
        warn: findings.filter((f) => f.severity === 'warn').length,
        info: findings.filter((f) => f.severity === 'info').length,
      },
      materializeWarnings: result.warnings.map((w) => `${w.opId}: ${w.message}`),
      invariantViolations: result.violations.map((v) => v.message),
      findings,
    };

    if (opts.format === 'json') {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
      process.stdout.write(`${designId} @ ${branch}\n`);
      for (const w of report.materializeWarnings) process.stdout.write(`  ~ ${w}\n`);
      for (const v of report.invariantViolations) process.stdout.write(`  !! CORRUPT: ${v}\n`);
      for (const f of findings) {
        process.stdout.write(`  ${severityGlyph(f.severity)} [${f.code}] ${f.message}\n`);
      }
      const { error, warn } = report.counts;
      process.stdout.write(`${String(error)} error(s), ${String(warn)} warning(s)\n`);
    }

    if (opts.badge !== undefined) {
      // The badge always reflects the truth — including on failing exits.
      writeFileSync(
        opts.badge,
        badgeSvg({
          errors: report.counts.error,
          warnings: report.counts.warn,
          corrupt: report.invariantViolations.length > 0,
        }),
      );
    }

    if (report.invariantViolations.length > 0) process.exitCode = 2;
    else if (report.counts.error > 0) process.exitCode = 1;
    else if (opts.failOn === 'warn' && report.counts.warn > 0) process.exitCode = 1;
  });

program
  .command('export')
  .argument('<design>', 'path to a .ppx directory or .ppx.json bundle')
  .option('--branch <name>', 'branch to export (default: design head)')
  .option('--netlist <file>', 'write a KiCad netlist')
  .option('--bom <file>', 'write a CSV BOM')
  .option('--date <iso>', 'timestamp to embed (default: now)')
  .description('export KiCad netlist and/or BOM from the materialized graph')
  .action(
    (designPath: string, opts: { branch?: string; netlist?: string; bom?: string; date?: string }) => {
      if (opts.netlist === undefined && opts.bom === undefined) {
        throw new Error('nothing to do: pass --netlist and/or --bom');
      }
      const { result } = loadDesign(designPath, opts.branch);
      const parts = seedPartDb();
      if (opts.netlist !== undefined) {
        const date = opts.date ?? new Date().toISOString();
        writeFileSync(opts.netlist, exportKicadNetlist(result.graph, parts, { date }));
        process.stdout.write(`wrote ${opts.netlist}\n`);
      }
      if (opts.bom !== undefined) {
        writeFileSync(opts.bom, exportBomCsv(result.graph, parts));
        process.stdout.write(`wrote ${opts.bom}\n`);
      }
    },
  );

program
  .command('import-legacy')
  .argument('<snapshot>', 'path to a legacy project snapshot (JSON, raw rows with ids)')
  .requiredOption('--out <file>', 'write the .ppx.json bundle here')
  .option('--design <name>', 'which legacy circuit design to import (default: first)')
  .option('--format <fmt>', 'pretty | json (report format)', 'pretty')
  .description(
    'convert a legacy ProtoPulse project snapshot into a .ppx op-log bundle.\n' +
      'The snapshot is a raw-row dump WITH ids (the legacy export format drops them):\n' +
      "  psql \"$DATABASE_URL\" -At -c \"select json_build_object(\n" +
      "    'project', (select json_build_object('name', name) from projects where id = :PID),\n" +
      "    'parts', (select coalesce(json_agg(json_build_object(\n" +
      "      'id', id, 'meta', meta, 'connectors', connectors)), '[]')\n" +
      '      from component_parts where project_id = :PID),\n' +
      "    'designs', (select coalesce(json_agg(json_build_object(\n" +
      "      'id', d.id, 'name', d.name,\n" +
      "      'instances', (select coalesce(json_agg(json_build_object(\n" +
      "        'id', i.id, 'referenceDesignator', i.reference_designator, 'partId', i.part_id,\n" +
      "        'schematicX', i.schematic_x, 'schematicY', i.schematic_y,\n" +
      "        'schematicRotation', i.schematic_rotation, 'properties', i.properties)), '[]')\n" +
      '        from circuit_instances i where i.circuit_id = d.id),\n' +
      "      'nets', (select coalesce(json_agg(json_build_object(\n" +
      "        'id', n.id, 'name', n.name, 'segments', n.segments)), '[]')\n" +
      '        from circuit_nets n where n.circuit_id = d.id))), \'[]\')\n' +
      '      from circuit_designs d where d.project_id = :PID)\n' +
      '  )" > snapshot.json',
  )
  .action((snapshotPath: string, opts: { out: string; design?: string; format: string }) => {
    const raw: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    const { bundle, report } = importLegacy(raw, opts.design);
    writeFileSync(opts.out, JSON.stringify(bundle, null, 2));
    if (opts.format === 'json') {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
      process.stdout.write(
        `${report.designName} → ${opts.out}: ${String(report.components)} component(s), ` +
          `${String(report.nets)} net(s), ${String(report.connections)} connection(s)\n`,
      );
      for (const n of report.notes) process.stdout.write(`  ~ ${n}\n`);
      for (const s of report.skipped) process.stdout.write(`  − skipped: ${s}\n`);
      for (const p of report.problems) process.stdout.write(`  !! ${p}\n`);
    }
    // Skips are honest, problems are not: a bundle that materializes
    // with warnings or violations should fail the pipeline.
    if (report.problems.length > 0) process.exitCode = 1;
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 2;
});
