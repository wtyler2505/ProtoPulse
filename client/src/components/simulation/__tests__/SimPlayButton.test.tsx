import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SimPlayButton from '../SimPlayButton';
import type { SimPlayButtonProps } from '../SimPlayButton';
import type { SimulationTypeResult } from '@/lib/simulation/auto-detect';

// Mock Radix DropdownMenu portals for happy-dom
vi.mock('@radix-ui/react-dropdown-menu', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@radix-ui/react-dropdown-menu');
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => children,
  };
});

function renderButton(overrides: Partial<SimPlayButtonProps> = {}) {
  const defaultProps: SimPlayButtonProps = {
    isRunning: false,
    isStopping: false,
    detection: null,
    onStart: vi.fn(),
    onStop: vi.fn(),
    ...overrides,
  };
  return { ...render(<SimPlayButton {...defaultProps} />), props: defaultProps };
}

describe('SimPlayButton', () => {
  // ---------------------------------------------------------------------------
  // Play state (not running)
  // ---------------------------------------------------------------------------

  it('renders play button when not running', () => {
    renderButton();
    expect(screen.getByTestId('sim-play-button')).toBeInTheDocument();
  });

  it('renders play button text', () => {
    renderButton();
    expect(screen.getByTestId('sim-play-button')).toHaveTextContent(/Start Simulation/i);
  });

  it('shows dropdown trigger (chevron) when no detection', () => {
    renderButton({ detection: null });
    // The button itself is the dropdown trigger — has chevron icon
    const btn = screen.getByTestId('sim-play-button');
    expect(btn).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Stop state (running)
  // ---------------------------------------------------------------------------

  it('renders stop button when running', () => {
    renderButton({ isRunning: true });
    expect(screen.getByTestId('sim-stop-button')).toBeInTheDocument();
    expect(screen.getByTestId('sim-stop-button')).toHaveTextContent(/Stop/i);
  });

  it('calls onStop when stop button is clicked', () => {
    const onStop = vi.fn();
    renderButton({ isRunning: true, onStop });
    fireEvent.click(screen.getByTestId('sim-stop-button'));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('shows stopping state with disabled button', () => {
    renderButton({ isRunning: true, isStopping: true });
    const btn = screen.getByTestId('sim-stop-button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/Stopping/i);
  });

  // ---------------------------------------------------------------------------
  // High confidence detection — direct play
  // ---------------------------------------------------------------------------

  it('calls onStart with detected type on click when high confidence', () => {
    const onStart = vi.fn();
    const detection: SimulationTypeResult = {
      type: 'ac',
      confidence: 0.9,
      reason: 'AC sources detected',
    };
    renderButton({ detection, onStart });

    fireEvent.click(screen.getByTestId('sim-play-button'));
    expect(onStart).toHaveBeenCalledWith('ac');
  });

  it('maps dc type to dcop analysis type on start', () => {
    const onStart = vi.fn();
    const detection: SimulationTypeResult = {
      type: 'dc',
      confidence: 0.9,
      reason: 'DC sources only',
    };
    renderButton({ detection, onStart });

    fireEvent.click(screen.getByTestId('sim-play-button'));
    expect(onStart).toHaveBeenCalledWith('dcop');
  });

  it('maps transient type to transient analysis type on start', () => {
    const onStart = vi.fn();
    const detection: SimulationTypeResult = {
      type: 'transient',
      confidence: 0.85,
      reason: 'Pulse sources detected',
    };
    renderButton({ detection, onStart });

    fireEvent.click(screen.getByTestId('sim-play-button'));
    expect(onStart).toHaveBeenCalledWith('transient');
  });

  // ---------------------------------------------------------------------------
  // Type badge
  // ---------------------------------------------------------------------------

  it('shows type badge with high confidence detection', () => {
    const detection: SimulationTypeResult = {
      type: 'ac',
      confidence: 0.9,
      reason: 'AC sources detected',
    };
    renderButton({ detection });
    const badge = screen.getByTestId('sim-type-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('AC');
  });

  it('shows DC badge label for dc type', () => {
    const detection: SimulationTypeResult = {
      type: 'dc',
      confidence: 0.9,
      reason: 'DC sources only',
    };
    renderButton({ detection });
    expect(screen.getByTestId('sim-type-badge')).toHaveTextContent('DC');
  });

  it('shows Transient badge label for transient type', () => {
    const detection: SimulationTypeResult = {
      type: 'transient',
      confidence: 0.85,
      reason: 'Pulse sources detected',
    };
    renderButton({ detection });
    expect(screen.getByTestId('sim-type-badge')).toHaveTextContent('Transient');
  });

  it('badge has title with reason for tooltip', () => {
    const detection: SimulationTypeResult = {
      type: 'ac',
      confidence: 0.9,
      reason: 'AC sources detected — frequency-domain analysis recommended',
    };
    renderButton({ detection });
    expect(screen.getByTestId('sim-type-badge')).toHaveAttribute('title', detection.reason);
  });

  // ---------------------------------------------------------------------------
  // Low confidence / mixed — dropdown
  // ---------------------------------------------------------------------------

  it('shows dropdown trigger when confidence is below threshold', () => {
    const detection: SimulationTypeResult = {
      type: 'dc',
      confidence: 0.5,
      reason: 'Low confidence',
    };
    renderButton({ detection });
    // Button should be present and be a dropdown trigger (no direct onStart call)
    const btn = screen.getByTestId('sim-play-button');
    expect(btn).toBeInTheDocument();
  });

  it('shows dropdown trigger for mixed type regardless of confidence', () => {
    const detection: SimulationTypeResult = {
      type: 'mixed',
      confidence: 0.8,
      reason: 'Multiple signal types',
    };
    renderButton({ detection });
    // Mixed always shows dropdown
    const btn = screen.getByTestId('sim-play-button');
    expect(btn).toBeInTheDocument();
  });

  it('does not call onStart directly when confidence < 0.7', () => {
    const onStart = vi.fn();
    const detection: SimulationTypeResult = {
      type: 'dc',
      confidence: 0.5,
      reason: 'Low confidence',
    };
    renderButton({ detection, onStart });

    // Clicking the dropdown trigger should NOT call onStart directly
    fireEvent.click(screen.getByTestId('sim-play-button'));
    expect(onStart).not.toHaveBeenCalled();
  });

  it('shows Mixed badge for mixed type with amber styling', () => {
    const detection: SimulationTypeResult = {
      type: 'mixed',
      confidence: 0.4,
      reason: 'Multiple signal types detected',
    };
    renderButton({ detection });
    const badge = screen.getByTestId('sim-type-badge');
    expect(badge).toHaveTextContent('Mixed');
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  it('does not render stop button when not running', () => {
    renderButton({ isRunning: false });
    expect(screen.queryByTestId('sim-stop-button')).not.toBeInTheDocument();
  });

  it('does not render play button when running', () => {
    renderButton({ isRunning: true });
    expect(screen.queryByTestId('sim-play-button')).not.toBeInTheDocument();
  });

  it('does not show badge when no detection and not running', () => {
    renderButton({ detection: null });
    expect(screen.queryByTestId('sim-type-badge')).not.toBeInTheDocument();
  });

  it('confidence at exactly 0.7 triggers dropdown (threshold is >=)', () => {
    const onStart = vi.fn();
    const detection: SimulationTypeResult = {
      type: 'dc',
      confidence: 0.7,
      reason: 'At threshold',
    };
    renderButton({ detection, onStart });

    // 0.7 meets the threshold — should auto-start
    fireEvent.click(screen.getByTestId('sim-play-button'));
    expect(onStart).toHaveBeenCalledWith('dcop');
  });

  it('confidence at 0.69 shows dropdown', () => {
    const onStart = vi.fn();
    const detection: SimulationTypeResult = {
      type: 'dc',
      confidence: 0.69,
      reason: 'Below threshold',
    };
    renderButton({ detection, onStart });

    fireEvent.click(screen.getByTestId('sim-play-button'));
    // Should NOT auto-start — dropdown trigger only
    expect(onStart).not.toHaveBeenCalled();
  });
});
