export const liveEntryDecision = {
  id: 'ADR-0002',
  title: 'v3 enters the live app after ready-sample and migration gates pass',
  decision: 'enter-live-app-after-gates',
  stayInDocsUntil: [
    'real sample validation is ready end-to-end',
    'xyflow migration preserves node and edge counts',
    'visual inspection reports render and store',
    'blocked and ready compile states are visible',
    'Tyler verifies the v3 UI shell',
  ],
  firstLiveStep: 'add v3 as an alternate Architecture route or feature-flagged panel',
  notYet: 'do not replace the default xyflow Architecture view until migrated real projects pass the gates',
} as const;
