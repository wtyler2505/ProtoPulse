export interface JitSkillRunDetail {
  command?: string;
  ruleType?: string;
  violationId?: string;
}

export function buildJitSkillChatMessage(detail: JitSkillRunDetail | null | undefined): string | null {
  const command = detail?.command?.trim();
  if (!command) {
    return null;
  }
  const ruleType = detail?.ruleType?.trim() || 'unknown-rule';
  const violationId = detail?.violationId?.trim() || 'unknown-violation';
  return `Run this remediation skill command now: ${command}. Context: rule=${ruleType}, violation=${violationId}. Execute safely and summarize the exact changes.`;
}

