import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { Prediction } from '@/lib/ai-prediction-engine';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Package: (props: Record<string, unknown>) => <svg data-testid="icon-package" {...props} />,
  CheckCircle: (props: Record<string, unknown>) => <svg data-testid="icon-check-circle" {...props} />,
  ShieldAlert: (props: Record<string, unknown>) => <svg data-testid="icon-shield-alert" {...props} />,
  Zap: (props: Record<string, unknown>) => <svg data-testid="icon-zap" {...props} />,
  GraduationCap: (props: Record<string, unknown>) => <svg data-testid="icon-graduation-cap" {...props} />,
  ChevronDown: (props: Record<string, unknown>) => <svg data-testid="icon-chevron-down" {...props} />,
  ChevronUp: (props: Record<string, unknown>) => <svg data-testid="icon-chevron-up" {...props} />,
  X: (props: Record<string, unknown>) => <svg data-testid="icon-x" {...props} />,
  Brain: (props: Record<string, unknown>) => <svg data-testid="icon-brain" {...props} />,
  Trash2: (props: Record<string, unknown>) => <svg data-testid="icon-trash2" {...props} />,
  Loader2: (props: Record<string, unknown>) => <svg data-testid="icon-loader2" {...props} />,
}));

import PredictionCard from '@/components/ui/PredictionCard';
import PredictionPanel from '@/components/ui/PredictionPanel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrediction(overrides: Partial<Prediction> = {}): Prediction {
  return {
    id: 'pred-test-1',
    ruleId: 'mcu-decoupling-caps',
    title: 'Add decoupling capacitors',
    description: 'MCU needs 100nF ceramic capacitors on each VCC pin.',
    confidence: 0.95,
    category: 'missing_component',
    action: { type: 'add_component', payload: { component: 'capacitor', value: '100nF' } },
    dismissed: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PredictionCard
// ---------------------------------------------------------------------------

describe('PredictionCard', () => {
  const onAccept = vi.fn();
  const onDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders prediction title', () => {
    const pred = makePrediction();
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    expect(screen.getByTestId(`prediction-title-${pred.id}`).textContent).toBe('Add decoupling capacitors');
  });

  it('renders prediction description', () => {
    const pred = makePrediction();
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    expect(screen.getByTestId(`prediction-description-${pred.id}`).textContent).toContain('100nF ceramic');
  });

  it('renders confidence badge with percentage', () => {
    const pred = makePrediction({ confidence: 0.85 });
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    expect(screen.getByTestId(`prediction-confidence-${pred.id}`).textContent).toBe('85%');
  });

  it('renders category label for missing_component', () => {
    const pred = makePrediction({ category: 'missing_component' });
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    expect(screen.getByTestId(`prediction-category-${pred.id}`).textContent).toBe('Missing Component');
  });

  it('renders category label for best_practice', () => {
    const pred = makePrediction({ category: 'best_practice' });
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    expect(screen.getByTestId(`prediction-category-${pred.id}`).textContent).toBe('Best Practice');
  });

  it('renders category label for safety', () => {
    const pred = makePrediction({ category: 'safety' });
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    expect(screen.getByTestId(`prediction-category-${pred.id}`).textContent).toBe('Safety');
  });

  it('renders category label for optimization', () => {
    const pred = makePrediction({ category: 'optimization' });
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    expect(screen.getByTestId(`prediction-category-${pred.id}`).textContent).toBe('Optimization');
  });

  it('renders category label for learning_tip', () => {
    const pred = makePrediction({ category: 'learning_tip' });
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    expect(screen.getByTestId(`prediction-category-${pred.id}`).textContent).toBe('Learning Tip');
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const pred = makePrediction();
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId(`prediction-dismiss-${pred.id}`));
    expect(onDismiss).toHaveBeenCalledWith(pred.id);
  });

  it('calls onAccept when Apply button clicked', () => {
    const pred = makePrediction();
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId(`prediction-accept-${pred.id}`));
    expect(onAccept).toHaveBeenCalledWith(pred.id);
  });

  it('does not render Apply button when no action', () => {
    const pred = makePrediction({ action: undefined });
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    expect(screen.queryByTestId(`prediction-accept-${pred.id}`)).toBeNull();
  });

  it('expands to show details when toggle clicked', () => {
    const pred = makePrediction();
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);

    // Initially no details
    expect(screen.queryByTestId(`prediction-details-${pred.id}`)).toBeNull();

    // Click expand
    fireEvent.click(screen.getByTestId(`prediction-toggle-${pred.id}`));

    // Details should appear
    expect(screen.getByTestId(`prediction-details-${pred.id}`)).toBeDefined();
  });

  it('collapses details when toggle clicked twice', () => {
    const pred = makePrediction();
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTestId(`prediction-toggle-${pred.id}`));
    expect(screen.getByTestId(`prediction-details-${pred.id}`)).toBeDefined();

    fireEvent.click(screen.getByTestId(`prediction-toggle-${pred.id}`));
    expect(screen.queryByTestId(`prediction-details-${pred.id}`)).toBeNull();
  });

  it('shows action type in expanded details', () => {
    const pred = makePrediction();
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId(`prediction-toggle-${pred.id}`));
    const details = screen.getByTestId(`prediction-details-${pred.id}`);
    expect(details.textContent).toContain('add component');
  });

  it('renders card container with data-testid', () => {
    const pred = makePrediction();
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    expect(screen.getByTestId(`prediction-card-${pred.id}`)).toBeDefined();
  });

  it('renders icon container with data-testid', () => {
    const pred = makePrediction();
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    expect(screen.getByTestId(`prediction-icon-${pred.id}`)).toBeDefined();
  });

  it('shows high confidence value correctly', () => {
    const pred = makePrediction({ confidence: 0.97 });
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    expect(screen.getByTestId(`prediction-confidence-${pred.id}`).textContent).toBe('97%');
  });

  it('shows low confidence value correctly', () => {
    const pred = makePrediction({ confidence: 0.35 });
    render(<PredictionCard prediction={pred} onAccept={onAccept} onDismiss={onDismiss} />);
    expect(screen.getByTestId(`prediction-confidence-${pred.id}`).textContent).toBe('35%');
  });
});

// ---------------------------------------------------------------------------
// PredictionPanel
// ---------------------------------------------------------------------------

describe('PredictionPanel', () => {
  const onAccept = vi.fn();
  const onDismiss = vi.fn();
  const onClearAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders panel container', () => {
    const preds = [makePrediction({ id: 'p1' })];
    render(
      <PredictionPanel predictions={preds} onAccept={onAccept} onDismiss={onDismiss} onClearAll={onClearAll} />,
    );
    expect(screen.getByTestId('prediction-panel')).toBeDefined();
  });

  it('does not render when idle with no predictions', () => {
    render(
      <PredictionPanel predictions={[]} onAccept={onAccept} onDismiss={onDismiss} onClearAll={onClearAll} />,
    );
    expect(screen.queryByTestId('prediction-panel')).toBeNull();
  });

  it('shows analyzing state when loading with no predictions', () => {
    render(
      <PredictionPanel predictions={[]} onAccept={onAccept} onDismiss={onDismiss} onClearAll={onClearAll} isAnalyzing />,
    );
    expect(screen.getByTestId('prediction-panel-analyzing')).toBeDefined();
    expect(screen.getByText('Analyzing your design for next-step suggestions...')).toBeDefined();
  });

  it('renders prediction cards when predictions exist', () => {
    const preds = [makePrediction({ id: 'p1' }), makePrediction({ id: 'p2' })];
    render(
      <PredictionPanel predictions={preds} onAccept={onAccept} onDismiss={onDismiss} onClearAll={onClearAll} />,
    );
    expect(screen.getByTestId('prediction-card-p1')).toBeDefined();
    expect(screen.getByTestId('prediction-card-p2')).toBeDefined();
  });

  it('shows count badge', () => {
    const preds = [makePrediction({ id: 'p1' }), makePrediction({ id: 'p2' })];
    render(
      <PredictionPanel predictions={preds} onAccept={onAccept} onDismiss={onDismiss} onClearAll={onClearAll} />,
    );
    expect(screen.getByTestId('prediction-panel-count').textContent).toBe('2');
  });

  it('does not show count badge when no predictions', () => {
    render(
      <PredictionPanel predictions={[]} onAccept={onAccept} onDismiss={onDismiss} onClearAll={onClearAll} />,
    );
    expect(screen.queryByTestId('prediction-panel-count')).toBeNull();
  });

  it('calls onClearAll when clear all button clicked', () => {
    const preds = [makePrediction({ id: 'p1' })];
    render(
      <PredictionPanel predictions={preds} onAccept={onAccept} onDismiss={onDismiss} onClearAll={onClearAll} />,
    );
    fireEvent.click(screen.getByTestId('prediction-panel-clear-all'));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('collapses body when toggle clicked', () => {
    const preds = [makePrediction({ id: 'p1' })];
    render(
      <PredictionPanel predictions={preds} onAccept={onAccept} onDismiss={onDismiss} onClearAll={onClearAll} />,
    );
    expect(screen.getByTestId('prediction-panel-body')).toBeDefined();

    fireEvent.click(screen.getByTestId('prediction-panel-toggle'));
    expect(screen.queryByTestId('prediction-panel-body')).toBeNull();
  });

  it('re-expands body when toggle clicked twice', () => {
    const preds = [makePrediction({ id: 'p1' })];
    render(
      <PredictionPanel predictions={preds} onAccept={onAccept} onDismiss={onDismiss} onClearAll={onClearAll} />,
    );
    fireEvent.click(screen.getByTestId('prediction-panel-toggle'));
    fireEvent.click(screen.getByTestId('prediction-panel-toggle'));
    expect(screen.getByTestId('prediction-panel-body')).toBeDefined();
  });

  it('shows loading indicator when isAnalyzing is true', () => {
    render(
      <PredictionPanel predictions={[]} onAccept={onAccept} onDismiss={onDismiss} onClearAll={onClearAll} isAnalyzing />,
    );
    expect(screen.getByTestId('prediction-panel-loading')).toBeDefined();
  });

  it('does not show loading indicator when isAnalyzing is false', () => {
    render(
      <PredictionPanel predictions={[]} onAccept={onAccept} onDismiss={onDismiss} onClearAll={onClearAll} isAnalyzing={false} />,
    );
    expect(screen.queryByTestId('prediction-panel-loading')).toBeNull();
  });

  it('does not show clear-all button when collapsed', () => {
    const preds = [makePrediction({ id: 'p1' })];
    render(
      <PredictionPanel predictions={preds} onAccept={onAccept} onDismiss={onDismiss} onClearAll={onClearAll} />,
    );
    fireEvent.click(screen.getByTestId('prediction-panel-toggle'));
    expect(screen.queryByTestId('prediction-panel-clear-all')).toBeNull();
  });
});
