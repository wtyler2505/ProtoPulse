import type { Connector, PartViews } from './component-types';
import {
  getSourceEvidence,
  inferPartFamily,
  requiresVerifiedExactness,
  type ExactPartFamily,
  type PartPinAccuracyReport,
  type PartSourceEvidence,
  type PartTrustCarrier,
  type PartVisualAccuracyReport,
} from './component-trust';

export type ExactPartVerificationItemStatus = 'ready' | 'warning' | 'blocked';

export interface ExactPartVerificationItem {
  detail: string;
  id: string;
  label: string;
  status: ExactPartVerificationItemStatus;
}

export interface ExactPartVerificationReadiness {
  blockers: string[];
  canVerify: boolean;
  evidenceCount: number;
  family: ExactPartFamily;
  items: ExactPartVerificationItem[];
  requiresVerification: boolean;
  summary: string;
  warnings: string[];
}

function hasBreadboardShapes(views: PartViews | null | undefined): boolean {
  return Array.isArray(views?.breadboard?.shapes) && views.breadboard.shapes.length > 0;
}

function isExact(value: 'unknown' | 'approximate' | 'exact' | undefined): boolean {
  return value === 'exact';
}

function normalizeVisualReport(meta: PartTrustCarrier): PartVisualAccuracyReport {
  return meta.visualAccuracyReport ?? {
    connectors: 'unknown',
    mountingHoles: 'unknown',
    outline: 'unknown',
    silkscreen: 'unknown',
  };
}

function normalizePinReport(meta: PartTrustCarrier): PartPinAccuracyReport {
  return meta.pinAccuracyReport ?? {
    breadboardAnchors: 'unknown',
    connectorNames: 'unknown',
    electricalRoles: 'unknown',
    unresolved: [],
  };
}

export function buildExactPartVerificationReadiness(
  meta: PartTrustCarrier,
  connectors: Connector[],
  views: PartViews,
): ExactPartVerificationReadiness {
  const family = inferPartFamily(meta);
  const requiresVerification = requiresVerifiedExactness(meta);
  if (!requiresVerification) {
    return {
      blockers: [],
      canVerify: true,
      evidenceCount: getSourceEvidence(meta).length,
      family,
      items: [],
      requiresVerification: false,
      summary: 'This part family can use wiring guidance without exact board/module verification.',
      warnings: [],
    };
  }

  const evidence = getSourceEvidence(meta);
  const visual = normalizeVisualReport(meta);
  const pin = normalizePinReport(meta);
  const blockers: string[] = [];
  const warnings: string[] = [];

  const acceptedEvidence = evidence.filter((entry) => entry.reviewStatus === 'accepted');
  const unresolved = pin.unresolved.filter((entry) => entry.trim().length > 0);

  const items: ExactPartVerificationItem[] = [
    {
      id: 'breadboard-art',
      label: 'Breadboard artwork',
      detail: hasBreadboardShapes(views)
        ? 'Breadboard view contains reviewable exact artwork.'
        : 'Add exact breadboard artwork before promoting this part.',
      status: hasBreadboardShapes(views) ? 'ready' : 'blocked',
    },
    {
      id: 'connector-map',
      label: 'Connector map',
      detail: connectors.length > 0
        ? `${connectors.length} connector${connectors.length === 1 ? '' : 's'} available for review.`
        : 'Add connectors and anchor positions before promoting this part.',
      status: connectors.length > 0 ? 'ready' : 'blocked',
    },
    {
      id: 'evidence',
      label: 'Evidence sources',
      detail: acceptedEvidence.length > 0
        ? `${acceptedEvidence.length} reviewed source${acceptedEvidence.length === 1 ? '' : 's'} accepted.`
        : evidence.length > 0
          ? 'Review and accept at least one source before promotion.'
          : 'Attach source evidence before promotion.',
      status: acceptedEvidence.length > 0 ? 'ready' : 'blocked',
    },
    {
      id: 'outline',
      label: 'Board outline fidelity',
      detail: isExact(visual.outline)
        ? 'Outline matches the reviewed reference.'
        : 'Mark the board outline as exact after review.',
      status: isExact(visual.outline) ? 'ready' : 'blocked',
    },
    {
      id: 'connector-art',
      label: 'Connector placement fidelity',
      detail: isExact(visual.connectors)
        ? 'Connector artwork alignment is exact.'
        : 'Connector placement must be exact before promotion.',
      status: isExact(visual.connectors) ? 'ready' : 'blocked',
    },
    {
      id: 'silkscreen',
      label: 'Silkscreen fidelity',
      detail: isExact(visual.silkscreen)
        ? 'Silkscreen labels and orientation cues are exact.'
        : 'Silkscreen is still approximate or unknown.',
      status: isExact(visual.silkscreen) ? 'ready' : 'warning',
    },
    {
      id: 'mounting-holes',
      label: 'Mounting-hole fidelity',
      detail: isExact(visual.mountingHoles)
        ? 'Mounting-hole placement is exact or explicitly reviewed.'
        : 'Mounting-hole fidelity still needs review if the board uses them.',
      status: isExact(visual.mountingHoles) ? 'ready' : 'warning',
    },
    {
      id: 'pin-names',
      label: 'Connector naming',
      detail: isExact(pin.connectorNames)
        ? 'Connector names match the reviewed references.'
        : 'Connector names must be reviewed to exact before promotion.',
      status: isExact(pin.connectorNames) ? 'ready' : 'blocked',
    },
    {
      id: 'pin-roles',
      label: 'Electrical roles',
      detail: isExact(pin.electricalRoles)
        ? 'Power, ground, control, and signal roles are exact.'
        : 'Electrical roles must be exact before authoritative wiring is unlocked.',
      status: isExact(pin.electricalRoles) ? 'ready' : 'blocked',
    },
    {
      id: 'anchors',
      label: 'Breadboard anchors',
      detail: isExact(pin.breadboardAnchors)
        ? 'Breadboard anchors are exact and ready for real layout guidance.'
        : 'Breadboard anchors must be exact before promotion.',
      status: isExact(pin.breadboardAnchors) ? 'ready' : 'blocked',
    },
    {
      id: 'unresolved',
      label: 'Unresolved review items',
      detail: unresolved.length === 0
        ? 'No unresolved review issues remain.'
        : `${unresolved.length} unresolved review item${unresolved.length === 1 ? '' : 's'} still need attention.`,
      status: unresolved.length === 0 ? 'ready' : 'blocked',
    },
  ];

  for (const item of items) {
    if (item.status === 'blocked') {
      blockers.push(item.detail);
    } else if (item.status === 'warning') {
      warnings.push(item.detail);
    }
  }

  const canVerify = blockers.length === 0;
  const summary = canVerify
    ? 'Ready to promote. Exact artwork, pin fidelity, and reviewed evidence are all in place.'
    : `Verification blocked by ${blockers.length} item${blockers.length === 1 ? '' : 's'}.`;

  return {
    blockers,
    canVerify,
    evidenceCount: evidence.length,
    family,
    items,
    requiresVerification,
    summary,
    warnings,
  };
}

export function buildEvidenceReviewSummary(evidence: PartSourceEvidence[]): string {
  const accepted = evidence.filter((entry) => entry.reviewStatus === 'accepted').length;
  if (evidence.length === 0) {
    return 'No evidence attached yet.';
  }
  return `${accepted}/${evidence.length} source${evidence.length === 1 ? '' : 's'} accepted for verification.`;
}
