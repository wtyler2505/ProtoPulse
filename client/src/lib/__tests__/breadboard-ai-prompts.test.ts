import { describe, expect, it } from 'vitest';

import { buildBreadboardSelectionPrompt } from '@/lib/breadboard-ai-prompts';

describe('buildBreadboardSelectionPrompt', () => {
  it('adds provisional-wiring guidance when an exact board/module is still a candidate', () => {
    const prompt = buildBreadboardSelectionPrompt('plan_layout_around_selected_part', {
      authoritativeWiringAllowed: false,
      benchLayoutHeadline: 'Bench layout is still rough.',
      benchLayoutLabel: 'Needs work',
      benchLayoutRisks: ['Pin trust is still low.'],
      benchLayoutScore: 42,
      benchLayoutStrengths: ['Board outline is present.'],
      benchLayoutSummary: 'A candidate exact board is on the bench.',
      coachCautions: ['Double-check power pins.'],
      coachNextMoves: ['Verify the header order.'],
      coachPlanSteps: ['Pending Add support parts'],
      exactPinCount: 12,
      fit: 'requires_jumpers',
      heuristicPinCount: 4,
      modelQuality: 'ai_drafted',
      orientationSummary: 'USB connector faces left.',
      partTitle: 'Arduino Mega 2560 R3',
      pinMapConfidence: 'mixed',
      pins: [
        { label: '5V', coordLabel: 'j1', confidence: 'exact' },
        { label: 'GND', coordLabel: 'j2', confidence: 'heuristic' },
      ],
      projectName: 'ProtoPulse',
      railStrategy: 'Keep power header close to the rail edge.',
      refDes: 'U1',
      requiresVerification: true,
      stashSummary: 'One board on hand.',
      trustSummary: 'This board/module is still a candidate. ProtoPulse can place it visually, but authoritative wiring guidance stays blocked until review is complete.',
      verificationLevel: 'mixed-source',
      verificationStatus: 'candidate',
    });

    expect(prompt).toContain('Verification status: candidate');
    expect(prompt).toContain('Authoritative wiring allowed: no');
    expect(prompt).toContain('do not present hookup steps as authoritative');
  });
});
