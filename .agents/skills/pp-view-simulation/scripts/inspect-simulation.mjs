#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-simulation';
const SOURCE_FILES = [];
const TEST_FILES = [];

export async function inspectSimulation(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatSimulationInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Simulation', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectSimulation();
  console.log(formatSimulationInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
