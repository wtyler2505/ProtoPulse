import type { ViewMode } from '@/lib/project-context';

export type FeatureMaturity = 'ready' | 'setup_required' | 'experimental' | 'advanced';

export interface ViewFeatureMaturity {
  maturity: FeatureMaturity;
  shortLabel: string;
  description: string;
}

export type TrustReceiptStatus = 'ready' | 'setup_required' | 'caution' | 'experimental';

export interface TrustReceiptFact {
  label: string;
  value: string;
}

export interface TrustReceipt {
  title: string;
  status: TrustReceiptStatus;
  summary: string;
  label?: string;
  facts?: TrustReceiptFact[];
  warnings?: string[];
  nextStep?: string;
}

const VIEW_FEATURE_MATURITY: Partial<Record<ViewMode, ViewFeatureMaturity>> = {
  arduino: {
    maturity: 'setup_required',
    shortLabel: 'Setup',
    description: 'Needs Arduino CLI plus a board profile before verify/upload is meaningful.',
  },
  serial_monitor: {
    maturity: 'setup_required',
    shortLabel: 'Setup',
    description: 'Needs a detected serial device and connection settings before monitoring starts.',
  },
  output: {
    maturity: 'setup_required',
    shortLabel: 'Prep',
    description: 'Some exports stay blocked or partial until design data and session-backed preflight are ready.',
  },
  ordering: {
    maturity: 'advanced',
    shortLabel: 'Advanced',
    description: 'Treat ordering, quotes, and DFM as planning guidance until the real PCB layout is verified.',
  },
  generative_design: {
    maturity: 'experimental',
    shortLabel: 'Beta',
    description: 'AI-generated design output is still exploratory and should be reviewed before use.',
  },
  digital_twin: {
    maturity: 'advanced',
    shortLabel: 'Advanced',
    description: 'Best used after hardware, telemetry, and simulation sources are configured.',
  },
  community: {
    maturity: 'experimental',
    shortLabel: 'Beta',
    description: 'Community content quality and coverage may vary across projects and parts.',
  },
};

export function getViewFeatureMaturity(view: ViewMode): ViewFeatureMaturity | undefined {
  return VIEW_FEATURE_MATURITY[view];
}

export function getFeatureMaturityLabel(maturity: FeatureMaturity): string {
  switch (maturity) {
    case 'ready':
      return 'Ready';
    case 'setup_required':
      return 'Setup required';
    case 'experimental':
      return 'Experimental';
    case 'advanced':
      return 'Advanced';
  }
}
