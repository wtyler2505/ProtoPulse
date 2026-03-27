import { describe, expect, it } from 'vitest';

import {
  buildPredictionAddNodeActions,
  getPredictionComponentCount,
  getPredictionComponentLabel,
} from '@/lib/prediction-actions';

describe('prediction-actions', () => {
  it('prefers an explicit label when present', () => {
    expect(getPredictionComponentLabel({ component: 'led', label: 'Power LED' })).toBe('Power LED');
  });

  it('builds a label from value and component when no explicit label exists', () => {
    expect(getPredictionComponentLabel({ component: 'resistor', value: '330R' })).toBe('330R resistor');
  });

  it('includes subtype details when present', () => {
    expect(getPredictionComponentLabel({ component: 'diode', type: 'schottky' })).toBe('schottky diode');
  });

  it('defaults count to one when the payload omits it', () => {
    expect(getPredictionComponentCount({ component: 'test-point' })).toBe(1);
  });

  it('returns a positive integer count for multi-add predictions', () => {
    expect(getPredictionComponentCount({ component: 'mounting-hole', count: 4 })).toBe(4);
  });

  it('builds one add_node action per requested component', () => {
    expect(buildPredictionAddNodeActions({ component: 'mounting-hole', count: 4 })).toEqual([
      { type: 'add_node', nodeType: 'mounting-hole', label: 'mounting hole' },
      { type: 'add_node', nodeType: 'mounting-hole', label: 'mounting hole' },
      { type: 'add_node', nodeType: 'mounting-hole', label: 'mounting hole' },
      { type: 'add_node', nodeType: 'mounting-hole', label: 'mounting hole' },
    ]);
  });
});
