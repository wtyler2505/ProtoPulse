import { z } from 'zod';

export const V3BlockedTaskSchema = z.object({
  id: z.string(),
  reason: z.string(),
});

export const V3CompileReportSchema = z.object({
  status: z.enum(['ready', 'blocked']),
  acceptedFacts: z.record(z.unknown()),
  missingFacts: z.array(z.string()),
  blockedTasks: z.array(V3BlockedTaskSchema),
  emittedTsx: z.string().nullable(),
});

export type V3CompileReport = z.infer<typeof V3CompileReportSchema>;

export function createV3CompileReport(input: V3CompileReport): V3CompileReport {
  return V3CompileReportSchema.parse(input);
}

export function renderV3CompileReportMarkdown(report: V3CompileReport): string {
  const acceptedFactLines = Object.entries(report.acceptedFacts).map(([key, value]) => (
    `- ${key}: ${String(value).replace(/\n/g, ' ').slice(0, 120)}`
  ));
  const missingFactLines = report.missingFacts.map((fact) => `- ${fact}`);
  const blockedTaskLines = report.blockedTasks.map((task) => `- ${task.id}: ${task.reason}`);

  return [
    '# ProtoPulse v3 Compile Report',
    '',
    `Status: ${report.status}`,
    '',
    '## Accepted Facts',
    acceptedFactLines.length > 0 ? acceptedFactLines.join('\n') : '- none',
    '',
    '## Missing Facts',
    missingFactLines.length > 0 ? missingFactLines.join('\n') : '- none',
    '',
    '## Blocked Tasks',
    blockedTaskLines.length > 0 ? blockedTaskLines.join('\n') : '- none',
    '',
    '## Emitted TSX',
    report.emittedTsx ? ['```tsx', report.emittedTsx, '```'].join('\n') : 'Not emitted.',
  ].join('\n');
}
