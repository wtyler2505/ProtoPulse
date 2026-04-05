import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Connector, PartMeta, PartViews } from '@shared/component-types';
import {
  PART_EVIDENCE_FACETS,
  PART_EVIDENCE_REVIEW_STATUSES,
  PART_EVIDENCE_TYPES,
  type PartEvidenceFacet,
  type PartEvidenceReviewStatus,
  type PartEvidenceType,
  type PartPinAccuracyReport,
  type PartSourceEvidence,
  type PartVerificationLevel,
  type PartVisualAccuracyReport,
} from '@shared/component-trust';
import { buildEvidenceReviewSummary, buildExactPartVerificationReadiness } from '@shared/exact-part-verification';

interface ExactPartVerificationDialogProps {
  connectors: Connector[];
  meta: PartMeta;
  onConfirm: (payload: {
    evidence: PartSourceEvidence[];
    note?: string;
    pinAccuracyReport: PartPinAccuracyReport;
    verificationLevel: PartVerificationLevel;
    verifiedBy?: string;
    visualAccuracyReport: PartVisualAccuracyReport;
  }) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  views: PartViews;
}

const ACCURACY_OPTIONS = [
  { label: 'Unknown', value: 'unknown' },
  { label: 'Approximate', value: 'approximate' },
  { label: 'Exact', value: 'exact' },
] as const;

function defaultVisualAccuracyReport(meta: PartMeta): PartVisualAccuracyReport {
  return meta.visualAccuracyReport ?? {
    connectors: 'unknown',
    mountingHoles: 'unknown',
    outline: 'unknown',
    silkscreen: 'unknown',
  };
}

function defaultPinAccuracyReport(meta: PartMeta): PartPinAccuracyReport {
  return meta.pinAccuracyReport ?? {
    breadboardAnchors: 'unknown',
    connectorNames: 'unknown',
    electricalRoles: 'unknown',
    unresolved: [],
  };
}

function defaultEvidence(meta: PartMeta): PartSourceEvidence[] {
  return Array.isArray(meta.sourceEvidence) ? meta.sourceEvidence : [];
}

function parseSupportsCsv(value: string): PartEvidenceFacet[] {
  const allowed = new Set<PartEvidenceFacet>(PART_EVIDENCE_FACETS);
  const facets = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry): entry is PartEvidenceFacet => allowed.has(entry as PartEvidenceFacet));
  return Array.from(new Set(facets));
}

function supportsToCsv(value: PartEvidenceFacet[]): string {
  return value.join(', ');
}

function readinessToneClass(blocked: boolean): string {
  return blocked
    ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
    : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
}

function checklistToneClass(status: 'ready' | 'warning' | 'blocked'): string {
  if (status === 'ready') {
    return 'border-emerald-400/25 bg-emerald-400/8 text-emerald-200';
  }
  if (status === 'warning') {
    return 'border-amber-400/25 bg-amber-400/8 text-amber-100';
  }
  return 'border-rose-400/25 bg-rose-400/8 text-rose-200';
}

export default function ExactPartVerificationDialog({
  connectors,
  meta,
  onConfirm,
  onOpenChange,
  open,
  pending,
  views,
}: ExactPartVerificationDialogProps) {
  const [verificationLevel, setVerificationLevel] = useState<PartVerificationLevel>(meta.verificationLevel ?? 'mixed-source');
  const [verifyNote, setVerifyNote] = useState('');
  const [visualAccuracyReport, setVisualAccuracyReport] = useState<PartVisualAccuracyReport>(defaultVisualAccuracyReport(meta));
  const [pinAccuracyReport, setPinAccuracyReport] = useState<PartPinAccuracyReport>(defaultPinAccuracyReport(meta));
  const [evidence, setEvidence] = useState<PartSourceEvidence[]>(defaultEvidence(meta));

  useEffect(() => {
    if (!open) {
      return;
    }
    setVerificationLevel(meta.verificationLevel ?? 'mixed-source');
    setVerifyNote('');
    setVisualAccuracyReport(defaultVisualAccuracyReport(meta));
    setPinAccuracyReport(defaultPinAccuracyReport(meta));
    setEvidence(defaultEvidence(meta));
  }, [meta, open]);

  const draftMeta = useMemo<PartMeta>(() => ({
    ...meta,
    pinAccuracyReport,
    sourceEvidence: evidence,
    verificationLevel,
    visualAccuracyReport,
  }), [evidence, meta, pinAccuracyReport, verificationLevel, visualAccuracyReport]);

  const readiness = useMemo(
    () => buildExactPartVerificationReadiness(draftMeta, connectors, views),
    [connectors, draftMeta, views],
  );

  const unresolvedText = pinAccuracyReport.unresolved.join('\n');

  const handleEvidenceChange = (index: number, updates: Partial<PartSourceEvidence>) => {
    setEvidence((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...updates } : entry));
  };

  const handleAddEvidence = () => {
    setEvidence((current) => [
      ...current,
      {
        label: '',
        reviewStatus: 'pending',
        supports: ['outline'],
        type: 'official-image',
      },
    ]);
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidence((current) => current.filter((_, entryIndex) => entryIndex !== index));
  };

  const handleConfirm = () => {
    onConfirm({
      evidence: evidence.filter((entry) => entry.label.trim().length > 0 && entry.supports.length > 0),
      note: verifyNote.trim() || undefined,
      pinAccuracyReport: {
        ...pinAccuracyReport,
        unresolved: pinAccuracyReport.unresolved.filter((entry) => entry.trim().length > 0),
      },
      verificationLevel,
      visualAccuracyReport,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-border bg-background" data-testid="dialog-verify-exact-part">
        <DialogHeader>
          <DialogTitle>Exact Part Verification Workbench</DialogTitle>
          <DialogDescription className="sr-only">
            Review source evidence, visual fidelity, and pin accuracy before promoting an exact board or module part.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
          <div className={`rounded-xl border px-4 py-3 ${readinessToneClass(!readiness.canVerify)}`} data-testid="verify-readiness-summary">
            <div className="flex items-center gap-2">
              {readiness.canVerify ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <p className="text-sm font-medium">
                {readiness.canVerify ? 'Ready to promote' : 'Verification blocked'}
              </p>
            </div>
            <p className="mt-2 text-sm">{readiness.summary}</p>
            <p className="mt-2 text-xs opacity-90">{buildEvidenceReviewSummary(evidence)}</p>
            {readiness.blockers.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs">
                {readiness.blockers.map((blocker) => (
                  <li key={blocker}>• {blocker}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="space-y-3 rounded-xl border border-border/60 bg-card/35 p-4" data-testid="verify-evidence-section">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Source evidence</h3>
                  <p className="text-xs text-muted-foreground">
                    Accept the sources that genuinely support this exact board/module model.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={handleAddEvidence} data-testid="button-add-verification-evidence">
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Add evidence
                </Button>
              </div>

              <div className="space-y-3">
                {evidence.length === 0 && (
                  <div className="rounded-md border border-dashed border-border/80 px-3 py-4 text-sm text-muted-foreground">
                    No evidence attached yet. Add at least one reviewed source before promoting this part.
                  </div>
                )}

                {evidence.map((entry, index) => (
                  <div key={`${entry.label}-${index}`} className="rounded-lg border border-border/70 bg-background/60 p-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`verify-evidence-label-${index}`}>Label</Label>
                        <Input
                          id={`verify-evidence-label-${index}`}
                          value={entry.label}
                          onChange={(event) => handleEvidenceChange(index, { label: event.target.value })}
                          placeholder="Official board photo"
                          className="bg-card border-border"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`verify-evidence-url-${index}`}>URL</Label>
                        <Input
                          id={`verify-evidence-url-${index}`}
                          value={entry.href ?? ''}
                          onChange={(event) => handleEvidenceChange(index, { href: event.target.value || undefined })}
                          placeholder="https://..."
                          className="bg-card border-border"
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label>Type</Label>
                        <Select
                          value={entry.type}
                          onValueChange={(value) => handleEvidenceChange(index, { type: value as PartEvidenceType })}
                        >
                          <SelectTrigger className="bg-card border-border">
                            <SelectValue placeholder="Evidence type" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            {PART_EVIDENCE_TYPES.map((value) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Review status</Label>
                        <Select
                          value={entry.reviewStatus ?? 'pending'}
                          onValueChange={(value) => handleEvidenceChange(index, { reviewStatus: value as PartEvidenceReviewStatus })}
                        >
                          <SelectTrigger className="bg-card border-border">
                            <SelectValue placeholder="Review status" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            {PART_EVIDENCE_REVIEW_STATUSES.map((value) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end justify-end">
                        <Button type="button" size="sm" variant="ghost" onClick={() => handleRemoveEvidence(index)}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <Label htmlFor={`verify-evidence-supports-${index}`}>Supports facets</Label>
                      <Input
                        id={`verify-evidence-supports-${index}`}
                        value={supportsToCsv(entry.supports)}
                        onChange={(event) => handleEvidenceChange(index, { supports: parseSupportsCsv(event.target.value) })}
                        placeholder="outline, pins, labels"
                        className="bg-card border-border"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Valid facets: {PART_EVIDENCE_FACETS.join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-border/60 bg-card/35 p-4" data-testid="verify-checklist-section">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Promotion checklist</h3>
                <p className="text-xs text-muted-foreground">
                  ProtoPulse uses the same checklist here and in the API route.
                </p>
              </div>
              <div className="space-y-2">
                {readiness.items.map((item) => (
                  <div key={item.id} className={`rounded-md border px-3 py-2 ${checklistToneClass(item.status)}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{item.label}</p>
                      <Badge variant="outline" className="border-current/30 bg-transparent text-[10px] uppercase tracking-[0.12em]">
                        {item.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs opacity-90">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-3 rounded-xl border border-border/60 bg-card/35 p-4" data-testid="verify-visual-accuracy-section">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Visual accuracy</h3>
                <p className="text-xs text-muted-foreground">
                  Mark each area after comparing it against the real board or module.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {([
                  ['outline', 'Board outline'],
                  ['connectors', 'Connector placement'],
                  ['silkscreen', 'Silkscreen labels'],
                  ['mountingHoles', 'Mounting holes'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Select
                      value={visualAccuracyReport[key]}
                      onValueChange={(value) =>
                        setVisualAccuracyReport((current) => ({ ...current, [key]: value as typeof current[typeof key] }))
                      }
                    >
                      <SelectTrigger className="bg-card border-border">
                        <SelectValue placeholder="Select fidelity" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {ACCURACY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-border/60 bg-card/35 p-4" data-testid="verify-pin-accuracy-section">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Pin accuracy</h3>
                <p className="text-xs text-muted-foreground">
                  Exact authoritative wiring only unlocks when names, roles, and anchors are all exact.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {([
                  ['connectorNames', 'Connector names'],
                  ['electricalRoles', 'Electrical roles'],
                  ['breadboardAnchors', 'Breadboard anchors'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Select
                      value={pinAccuracyReport[key]}
                      onValueChange={(value) =>
                        setPinAccuracyReport((current) => ({ ...current, [key]: value as typeof current[typeof key] }))
                      }
                    >
                      <SelectTrigger className="bg-card border-border">
                        <SelectValue placeholder="Select fidelity" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {ACCURACY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="verify-unresolved-items">Unresolved review items</Label>
                <Textarea
                  id="verify-unresolved-items"
                  value={unresolvedText}
                  onChange={(event) =>
                    setPinAccuracyReport((current) => ({
                      ...current,
                      unresolved: event.target.value
                        .split('\n')
                        .map((entry) => entry.trim())
                        .filter(Boolean),
                    }))
                  }
                  placeholder="One open question per line"
                  rows={4}
                  className="bg-card border-border"
                />
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="verify-level">Verification level</Label>
              <Select value={verificationLevel} onValueChange={(value) => setVerificationLevel(value as PartVerificationLevel)}>
                <SelectTrigger id="verify-level" className="bg-card border-border">
                  <SelectValue placeholder="Select verification level" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="official-backed">Official-backed</SelectItem>
                  <SelectItem value="mixed-source">Mixed-source</SelectItem>
                  <SelectItem value="community-only">Community-only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="verify-note">Review note</Label>
              <Textarea
                id="verify-note"
                value={verifyNote}
                onChange={(event) => setVerifyNote(event.target.value)}
                placeholder="Compared the exact board art against the official photo, confirmed connector names/roles, and resolved all anchor uncertainty."
                rows={3}
                className="bg-card border-border"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={pending || !readiness.canVerify}
            data-testid="button-confirm-verify-exact-part"
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgeCheck className="mr-2 h-4 w-4" />}
            Promote to verified
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
