/**
 * ShareSimulationButton (BL-0213)
 *
 * Captures the current simulation configuration (analysis type, parameters,
 * probes, circuit ID) and copies a shareable URL to the clipboard.
 */

import { useState, useCallback } from 'react';
import { Share2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { copySimulationLink } from '@/lib/simulation-links';
import type { SimulationSnapshot, SimLinkAnalysisType, SimLinkProbe } from '@/lib/simulation-links';

export interface ShareSimulationButtonProps {
  /** Current project ID. */
  projectId: number;
  /** Circuit design ID being simulated. */
  circuitId: number;
  /** Selected analysis type. */
  analysisType: SimLinkAnalysisType;
  /** Current analysis parameters (flat key-value). */
  parameters: Record<string, string | number>;
  /** Current probes (optional). */
  probes?: SimLinkProbe[];
  /** Whether the button should be disabled. */
  disabled?: boolean;
}

export default function ShareSimulationButton({
  projectId,
  circuitId,
  analysisType,
  parameters,
  probes,
  disabled = false,
}: ShareSimulationButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const snapshot: SimulationSnapshot = {
      circuitId,
      simType: analysisType,
      parameters,
      probes,
      timestamp: new Date().toISOString(),
    };

    try {
      await copySimulationLink(snapshot, projectId);
      setCopied(true);
      toast({
        title: 'Simulation link copied',
        description: 'Shareable link with frozen settings has been copied to your clipboard.',
      });
      // Reset the check icon after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      toast({
        title: 'Failed to copy link',
        description: 'Could not copy the simulation link to your clipboard.',
        variant: 'destructive',
      });
    }
  }, [circuitId, analysisType, parameters, probes, projectId, toast]);

  const Icon = copied ? Check : Share2;

  return (
    <button
      type="button"
      data-testid="share-simulation"
      onClick={handleShare}
      disabled={disabled}
      className="h-8 px-3 flex items-center gap-1.5 text-xs border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title="Copy shareable simulation link"
    >
      <Icon className="w-3.5 h-3.5" />
      {copied ? 'Copied' : 'Share'}
    </button>
  );
}
