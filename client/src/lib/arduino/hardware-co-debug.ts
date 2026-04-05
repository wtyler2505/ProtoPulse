import type { SerialMonitorLine } from '@/lib/web-serial';

export interface HardwareCoDebugReadiness {
  blockedReason: string | null;
  canRun: boolean;
  code: string;
  hasCode: boolean;
  hasSerialLogs: boolean;
  serialLogs: string;
  title: string;
}

const NO_CODE_PLACEHOLDER = '// ProtoPulse note: No sketch code was provided from this view.';
const NO_LOGS_PLACEHOLDER = '(No serial logs captured yet.)';

export function buildHardwareCoDebugReadiness({
  code,
  monitor,
}: {
  code: string;
  monitor: SerialMonitorLine[];
}): HardwareCoDebugReadiness {
  const trimmedCode = code.trim();
  const recentLogs = monitor.slice(-50).map((line) => line.data.trim()).filter(Boolean).join('\n');

  const hasCode = trimmedCode.length > 0;
  const hasSerialLogs = recentLogs.length > 0;
  const canRun = hasCode || hasSerialLogs;

  let title = 'AI Copilot needs sketch code or serial logs before it can run';
  if (hasCode && hasSerialLogs) {
    title = 'AI Co-Debug (analyzes sketch code, hardware context, and live serial logs)';
  } else if (hasCode) {
    title = 'AI Co-Debug (using sketch code and project hardware context)';
  } else if (hasSerialLogs) {
    title = 'AI Co-Debug (using live serial logs and project hardware context)';
  }

  return {
    blockedReason: canRun
      ? null
      : 'AI Copilot needs sketch code, serial logs, or both before it can diagnose hardware issues.',
    canRun,
    code: hasCode ? trimmedCode : NO_CODE_PLACEHOLDER,
    hasCode,
    hasSerialLogs,
    serialLogs: hasSerialLogs ? recentLogs : NO_LOGS_PLACEHOLDER,
    title,
  };
}
