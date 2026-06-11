#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-ai-chat';
const SOURCE_FILES = [
  "client/src/components/panels/ChatPanel.tsx",
  "client/src/hooks/useChatSettings.ts"
];
const TEST_FILES = [];

export async function inspectAiChat(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatAiChatInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse AI Chat', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectAiChat();
  console.log(formatAiChatInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
