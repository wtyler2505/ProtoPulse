import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { computePartDiff, applyPartialDiff } from '@/lib/component-editor/diff-engine';
import { useApiKeys } from '@/hooks/useApiKeys';
import DiffPreview from './DiffPreview';
import type { PartState } from '@shared/component-types';
import type { PartDiff } from '@/lib/component-editor/types';

interface ModifyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPart: PartState;
  projectId: number;
  partId: number;
  onApply: (newState: PartState) => void;
}

type ModalState = 'input' | 'loading' | 'review';

export default function ModifyModal({ open, onOpenChange, currentPart, projectId, partId, onApply }: ModifyModalProps) {
  const [modalState, setModalState] = useState<ModalState>('input');
  const [instruction, setInstruction] = useState('');
  const { apiKey, updateLocalKey } = useApiKeys();
  const setApiKey = useCallback((key: string) => { updateLocalKey('gemini', key); }, [updateLocalKey]);
  const [error, setError] = useState<string | null>(null);

  const [diff, setDiff] = useState<PartDiff | null>(null);
  const [modifiedPart, setModifiedPart] = useState<PartState | null>(null);
  const [acceptedShapeIds, setAcceptedShapeIds] = useState<Set<string>>(new Set());
  const [acceptedConnectorIds, setAcceptedConnectorIds] = useState<Set<string>>(new Set());
  const [acceptedMetaFields, setAcceptedMetaFields] = useState<Set<string>>(new Set());

  const abortRef = useRef<AbortController | null>(null);

  const resetToInput = useCallback(() => {
    setModalState('input');
    setError(null);
    setDiff(null);
    setModifiedPart(null);
    setAcceptedShapeIds(new Set());
    setAcceptedConnectorIds(new Set());
    setAcceptedMetaFields(new Set());
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      abortRef.current?.abort();
      abortRef.current = null;
      resetToInput();
      setInstruction('');
    }
    onOpenChange(nextOpen);
  }, [onOpenChange, resetToInput]);

  const initializeAcceptedSets = useCallback((computedDiff: PartDiff) => {
    setAcceptedShapeIds(new Set(computedDiff.shapes.map(s => s.shapeId)));
    setAcceptedConnectorIds(new Set(computedDiff.connectors.map(c => c.connectorId)));
    setAcceptedMetaFields(new Set(computedDiff.metaChanges.map(m => m.field)));
  }, []);

  const handleModify = useCallback(async () => {
    if (!instruction.trim()) return;

    setModalState('loading');
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await apiRequest(
        'POST',
        `/api/projects/${projectId}/component-parts/${partId}/ai/modify`,
        {
          instruction: instruction.trim(),
          currentPart,
          apiKey: apiKey || undefined,
        },
        controller.signal,
      );

      if (controller.signal.aborted) return;

      const result: PartState = await response.json();
      const computedDiff = computePartDiff(currentPart, result);

      if (!computedDiff.hasChanges) {
        setError('AI returned no changes. Try a different instruction.');
        setModalState('input');
        return;
      }

      setModifiedPart(result);
      setDiff(computedDiff);
      initializeAcceptedSets(computedDiff);
      setModalState('review');
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      setModalState('input');
    } finally {
      abortRef.current = null;
    }
  }, [instruction, apiKey, projectId, partId, currentPart, initializeAcceptedSets]);

  const handleCancel = useCallback(() => {
    if (modalState === 'loading') {
      abortRef.current?.abort();
      abortRef.current = null;
      setModalState('input');
      setError(null);
    } else {
      handleOpenChange(false);
    }
  }, [modalState, handleOpenChange]);

  const handleToggleShape = useCallback((shapeId: string) => {
    setAcceptedShapeIds(prev => {
      const next = new Set(prev);
      if (next.has(shapeId)) next.delete(shapeId);
      else next.add(shapeId);
      return next;
    });
  }, []);

  const handleToggleConnector = useCallback((connectorId: string) => {
    setAcceptedConnectorIds(prev => {
      const next = new Set(prev);
      if (next.has(connectorId)) next.delete(connectorId);
      else next.add(connectorId);
      return next;
    });
  }, []);

  const handleToggleMeta = useCallback((field: string) => {
    setAcceptedMetaFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }, []);

  const handleAcceptAll = useCallback(() => {
    if (!diff) return;
    setAcceptedShapeIds(new Set(diff.shapes.map(s => s.shapeId)));
    setAcceptedConnectorIds(new Set(diff.connectors.map(c => c.connectorId)));
    setAcceptedMetaFields(new Set(diff.metaChanges.map(m => m.field)));
  }, [diff]);

  const handleRejectAll = useCallback(() => {
    setAcceptedShapeIds(new Set());
    setAcceptedConnectorIds(new Set());
    setAcceptedMetaFields(new Set());
  }, []);

  const handleApply = useCallback(() => {
    if (!diff || !modifiedPart) return;

    const result = applyPartialDiff(
      currentPart,
      modifiedPart,
      diff,
      acceptedShapeIds,
      acceptedConnectorIds,
      acceptedMetaFields,
    );

    onApply(result);
    handleOpenChange(false);
  }, [diff, modifiedPart, currentPart, acceptedShapeIds, acceptedConnectorIds, acceptedMetaFields, onApply, handleOpenChange]);

  const hasAnyAccepted = acceptedShapeIds.size > 0 || acceptedConnectorIds.size > 0 || acceptedMetaFields.size > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border"
        data-testid="modify-modal"
      >
        <DialogHeader>
          <DialogTitle data-testid="modify-modal-title">
            {modalState === 'review' ? 'Review AI Changes' : 'AI Modify Component'}
          </DialogTitle>
          <DialogDescription className="sr-only">Use AI to modify component properties and review changes</DialogDescription>
        </DialogHeader>

        {modalState === 'input' && (
          <div className="flex flex-col gap-4 py-2">
            {error && (
              <div
                data-testid="modify-error"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="modify-instruction">Modification Instruction</Label>
              <Textarea
                id="modify-instruction"
                data-testid="textarea-instruction"
                placeholder="Describe what to change, e.g. 'Add 4 GPIO pins on the right side'"
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="modify-api-key">API Key</Label>
              <Input
                id="modify-api-key"
                data-testid="input-api-key"
                type="password"
                placeholder="Gemini API key (optional if set server-side)"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
            </div>
          </div>
        )}

        {modalState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4" data-testid="modify-loading">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">AI is analyzing and modifying your component...</p>
          </div>
        )}

        {modalState === 'review' && diff && (
          <div className="py-2" data-testid="modify-review">
            <DiffPreview
              diff={diff}
              acceptedShapeIds={acceptedShapeIds}
              acceptedConnectorIds={acceptedConnectorIds}
              acceptedMetaFields={acceptedMetaFields}
              onToggleShape={handleToggleShape}
              onToggleConnector={handleToggleConnector}
              onToggleMeta={handleToggleMeta}
              onAcceptAll={handleAcceptAll}
              onRejectAll={handleRejectAll}
            />
          </div>
        )}

        <DialogFooter>
          {modalState === 'input' && (
            <>
              <Button
                data-testid="button-cancel"
                variant="outline"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                data-testid="button-modify"
                onClick={handleModify}
                disabled={!instruction.trim()}
              >
                Modify
              </Button>
            </>
          )}
          {modalState === 'loading' && (
            <Button
              data-testid="button-cancel-loading"
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          )}
          {modalState === 'review' && (
            <>
              <Button
                data-testid="button-discard"
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => resetToInput()}
              >
                Discard All
              </Button>
              <Button
                data-testid="button-apply"
                onClick={handleApply}
                disabled={!hasAnyAccepted}
              >
                Apply Selected Changes
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
