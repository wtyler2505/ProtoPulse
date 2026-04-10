import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CoachLearnMoreCard, { getLearnMoreContent, type LearnMoreContent } from '../CoachLearnMoreCard';

// ---------------------------------------------------------------------------
// getLearnMoreContent — static content map
// ---------------------------------------------------------------------------

describe('getLearnMoreContent', () => {
  it('returns content for a known trap ID', () => {
    const content = getLearnMoreContent('esp32-flash-gpio');
    expect(content).toBeDefined();
    expect(content!.whatCouldHappen).toBeTruthy();
    expect(content!.howToFix).toBeTruthy();
    expect(content!.beginnerTip).toBeTruthy();
  });

  it('returns undefined for an unknown trap ID', () => {
    const content = getLearnMoreContent('made-up-trap-xyz');
    expect(content).toBeUndefined();
  });

  it('has content for all heuristic trap IDs', () => {
    const heuristicTrapIds = [
      'esp32-flash-gpio',
      'esp32-adc2-wifi',
      'esp32-gpio12-strapping',
      'esp32-gpio0-boot',
      'avr-5v-logic',
      'avr-serial-conflict',
      'avr-reset-noise',
      'mcu-3v3-logic',
      'motor-brake-polarity',
      'motor-hall-order',
      'motor-back-emf',
      'motor-shoot-through',
      'motor-pwm-frequency',
    ];
    for (const id of heuristicTrapIds) {
      expect(getLearnMoreContent(id)).toBeDefined();
    }
  });

  it('has content for coach suggestion IDs', () => {
    const coachIds = ['support-decoupler', 'support-control-pull'];
    for (const id of coachIds) {
      expect(getLearnMoreContent(id)).toBeDefined();
    }
  });

  it('has content for preflight check IDs', () => {
    const preflightIds = [
      'voltage-mismatch',
      'missing-decoupling',
      'power-budget',
      'adc2-wifi-conflict',
      'unconnected-required-pins',
    ];
    for (const id of preflightIds) {
      expect(getLearnMoreContent(id)).toBeDefined();
    }
  });

  it('content fields are non-empty strings', () => {
    const content = getLearnMoreContent('avr-5v-logic');
    expect(content).toBeDefined();
    expect(content!.whatCouldHappen.length).toBeGreaterThan(10);
    expect(content!.howToFix.length).toBeGreaterThan(10);
    expect(content!.beginnerTip.length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// CoachLearnMoreCard — rendering
// ---------------------------------------------------------------------------

describe('CoachLearnMoreCard', () => {
  it('renders collapsed by default with a Why? button', () => {
    render(<CoachLearnMoreCard trapId="esp32-flash-gpio" />);
    expect(screen.getByTestId('coach-learn-more-esp32-flash-gpio')).toBeInTheDocument();
    expect(screen.getByTestId('coach-learn-more-trigger-esp32-flash-gpio')).toBeInTheDocument();
    expect(screen.queryByTestId('coach-learn-more-body-esp32-flash-gpio')).not.toBeInTheDocument();
  });

  it('expands on click to show explanation', async () => {
    const user = userEvent.setup();
    render(<CoachLearnMoreCard trapId="esp32-flash-gpio" />);

    await user.click(screen.getByTestId('coach-learn-more-trigger-esp32-flash-gpio'));

    const body = screen.getByTestId('coach-learn-more-body-esp32-flash-gpio');
    expect(body).toBeInTheDocument();
    expect(body.textContent).toContain('What could happen');
    expect(body.textContent).toContain('How to fix');
  });

  it('collapses again on second click', async () => {
    const user = userEvent.setup();
    render(<CoachLearnMoreCard trapId="esp32-flash-gpio" />);

    const trigger = screen.getByTestId('coach-learn-more-trigger-esp32-flash-gpio');
    await user.click(trigger);
    expect(screen.getByTestId('coach-learn-more-body-esp32-flash-gpio')).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.queryByTestId('coach-learn-more-body-esp32-flash-gpio')).not.toBeInTheDocument();
  });

  it('renders nothing when trapId has no content', () => {
    const { container } = render(<CoachLearnMoreCard trapId="nonexistent-trap" />);
    expect(container.innerHTML).toBe('');
  });

  it('shows beginner tip section when expanded', async () => {
    const user = userEvent.setup();
    render(<CoachLearnMoreCard trapId="avr-5v-logic" />);

    await user.click(screen.getByTestId('coach-learn-more-trigger-avr-5v-logic'));

    const body = screen.getByTestId('coach-learn-more-body-avr-5v-logic');
    expect(body.textContent).toContain('Beginner tip');
  });

  it('renders with compact variant', () => {
    render(<CoachLearnMoreCard trapId="esp32-flash-gpio" variant="compact" />);
    expect(screen.getByTestId('coach-learn-more-esp32-flash-gpio')).toBeInTheDocument();
  });

  it('expanded card contains whatCouldHappen text from content map', async () => {
    const user = userEvent.setup();
    render(<CoachLearnMoreCard trapId="motor-brake-polarity" />);

    await user.click(screen.getByTestId('coach-learn-more-trigger-motor-brake-polarity'));

    const content = getLearnMoreContent('motor-brake-polarity');
    expect(content).toBeDefined();
    const body = screen.getByTestId('coach-learn-more-body-motor-brake-polarity');
    expect(body.textContent).toContain(content!.whatCouldHappen);
  });

  it('expanded card contains howToFix text from content map', async () => {
    const user = userEvent.setup();
    render(<CoachLearnMoreCard trapId="support-decoupler" />);

    await user.click(screen.getByTestId('coach-learn-more-trigger-support-decoupler'));

    const content = getLearnMoreContent('support-decoupler');
    expect(content).toBeDefined();
    const body = screen.getByTestId('coach-learn-more-body-support-decoupler');
    expect(body.textContent).toContain(content!.howToFix);
  });
});
