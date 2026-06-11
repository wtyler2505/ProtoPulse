import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import RadialCommandPreview from '@/components/ui/RadialCommandPreview';
import type { RadialCommandPreviewState } from '@/components/ui/RadialCommandPreview';

function makePreview(overrides: Partial<RadialCommandPreviewState> = {}): RadialCommandPreviewState {
  return {
    context: {
      view: 'pcb',
      target: 'canvas',
      pointer: { x: 320, y: 260 },
    },
    item: {
      id: 'route_trace',
      label: 'Route',
      description: 'Start trace routing.',
      icon: ArrowRight,
      slot: 2,
      group: 'connect',
    },
    position: { x: 320, y: 260 },
    ...overrides,
  };
}

describe('RadialCommandPreview', () => {
  it('renders a lightweight route ghost with command copy', () => {
    render(<RadialCommandPreview preview={makePreview()} />);

    expect(screen.getByTestId('radial-command-preview')).toBeInTheDocument();
    expect(screen.getByTestId('radial-command-preview-label')).toHaveTextContent('Route');
    expect(screen.getByTestId('radial-command-preview-detail')).toHaveTextContent('route ghost from pointer');
    expect(screen.getByTestId('radial-command-preview-chip')).toHaveTextContent('E');
    expect(screen.queryByTestId('radial-command-preview-ai-hint')).not.toBeInTheDocument();
  });

  it('uses a rail-specific preview for breadboard rail inspection', () => {
    render(
      <RadialCommandPreview
        preview={makePreview({
          context: { view: 'breadboard', target: 'canvas', pointer: { x: 240, y: 220 } },
          item: {
            id: 'show_rails',
            label: 'Rails',
            description: 'Inspect power rail continuity.',
            icon: Plus,
            slot: 3,
            group: 'inspect',
          },
          position: { x: 240, y: 220 },
        })}
      />,
    );

    expect(screen.getByTestId('radial-command-preview-label')).toHaveTextContent('Rails');
    expect(screen.getByTestId('radial-command-preview-detail')).toHaveTextContent('rail continuity highlight');
  });

  it('surfaces disabled reasons instead of action hints', () => {
    render(
      <RadialCommandPreview
        preview={makePreview({
          context: { view: 'architecture', target: 'node', targetLabel: 'Motor Driver' },
          item: {
            id: 'delete',
            label: 'Delete',
            description: 'Remove this block.',
            icon: Trash2,
            slot: 5,
            group: 'delete',
            destructive: true,
            disabled: true,
            disabledReason: 'Selection is locked',
          },
          position: { x: 420, y: 320 },
        })}
      />,
    );

    expect(screen.getByTestId('radial-command-preview-label')).toHaveTextContent('Delete');
    expect(screen.getByTestId('radial-command-preview-detail')).toHaveTextContent('Selection is locked');
  });

  it('surfaces AI prompt context before an AI command is fired', () => {
    render(
      <RadialCommandPreview
        preview={makePreview({
          context: { view: 'validation', target: 'issue', targetLabel: 'Missing ESD' },
          item: {
            id: 'explain_issue',
            label: 'Explain',
            description: 'Explain this validation result.',
            icon: Plus,
            slot: 3,
            group: 'inspect',
          },
          position: { x: 360, y: 280 },
        })}
      />,
    );

    expect(screen.getByTestId('radial-command-preview-label')).toHaveTextContent('Explain');
    expect(screen.getByTestId('radial-command-preview-ai-badge')).toHaveTextContent('AI');
    expect(screen.getByTestId('radial-command-preview-detail')).toHaveTextContent(
      'Explains cause, impact, and fix path for this validation issue.',
    );
    expect(screen.getByTestId('radial-command-preview-ai-meta')).toHaveTextContent('Issue, source link, rule context');
    expect(screen.getByTestId('radial-command-preview-ai-scope')).toHaveTextContent('Validation / Missing ESD');
    expect(screen.getByTestId('radial-command-preview-ai-bound')).toHaveTextContent('Validation issue prompt');
    expect(screen.getByTestId('radial-command-preview-ai-delivery')).toHaveTextContent('Click to explain issue');
    expect(screen.getByTestId('radial-command-preview-ai-hint')).toHaveTextContent('Click drafts / Shift-click sends');
  });

  it('shows a specific 3D fit packet for model AI commands', () => {
    render(
      <RadialCommandPreview
        preview={makePreview({
          context: { view: 'model_3d', target: 'model', targetLabel: 'Buck converter' },
          item: {
            id: 'ai_3d_fit_inspection',
            label: 'AI Fit',
            description: 'Ask AI to inspect 3D fit.',
            icon: Plus,
            slot: 0,
            group: 'inspect',
          },
          position: { x: 360, y: 280 },
        })}
      />,
    );

    expect(screen.getByTestId('radial-command-preview-label')).toHaveTextContent('AI Fit');
    expect(screen.getByTestId('radial-command-preview-detail')).toHaveTextContent(
      'Checks 3D fit, route provenance, clearance, and physical risk.',
    );
    expect(screen.getByTestId('radial-command-preview-ai-meta')).toHaveTextContent('Model part, traces, vias, bridge data');
    expect(screen.getByTestId('radial-command-preview-ai-scope')).toHaveTextContent('3D View / Buck converter');
    expect(screen.getByTestId('radial-command-preview-ai-bound')).toHaveTextContent('3D fit inspection prompt');
    expect(screen.getByTestId('radial-command-preview-ai-delivery')).toHaveTextContent('Click to inspect fit');
    expect(screen.getByTestId('radial-command-preview-ai-hint')).toHaveTextContent('Click drafts / Shift-click sends');
  });

  it('shows a starter-circuit learning packet for AI Learn', () => {
    render(
      <RadialCommandPreview
        preview={makePreview({
          context: { view: 'starter_circuits', target: 'starter_circuit', targetLabel: 'Blink' },
          item: {
            id: 'ai_starter_learn',
            label: 'AI Learn',
            description: 'Ask AI to explain this starter circuit.',
            icon: Plus,
            slot: 0,
            group: 'inspect',
          },
          position: { x: 360, y: 280 },
        })}
      />,
    );

    expect(screen.getByTestId('radial-command-preview-label')).toHaveTextContent('AI Learn');
    expect(screen.getByTestId('radial-command-preview-detail')).toHaveTextContent(
      'Explains the starter circuit, wiring idea, and first safe build step.',
    );
    expect(screen.getByTestId('radial-command-preview-ai-meta')).toHaveTextContent('Circuit goal, parts, sketch preview');
    expect(screen.getByTestId('radial-command-preview-ai-scope')).toHaveTextContent('Starter Circuits / Blink');
    expect(screen.getByTestId('radial-command-preview-ai-bound')).toHaveTextContent('Starter circuit learning prompt');
    expect(screen.getByTestId('radial-command-preview-ai-delivery')).toHaveTextContent('Click to open lesson prompt');
  });
});
