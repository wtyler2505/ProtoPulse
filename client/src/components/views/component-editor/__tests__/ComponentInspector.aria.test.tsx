// @vitest-environment happy-dom

/**
 * BL-0781 — ComponentInspector ARIA spinbutton contract.
 *
 * Three migration sites in this file:
 *   - L76 (NumberField helper): swap Input + numeric input typing to
 *     NumberInput so forwarded min/max props mirror onto
 *     aria-valuemin/aria-valuemax. A call site that already passes
 *     min/max (Stroke W passes min={0}, Opacity passes min={0} max={1})
 *     exercises the contract end-to-end.
 *   - L382 (constraint distance): ADD-MIN={0}, ADD-MAX={1000} (mm).
 *   - L394 (constraint pitch): ADD-MIN={0.1}, ADD-MAX={10} (mm).
 *
 * Audit row: docs/audits/bl-0781-number-input-audit.md §ComponentInspector.tsx.
 */

import { useEffect, useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import {
  ComponentEditorProvider,
  useComponentEditor,
} from '@/lib/component-editor/ComponentEditorProvider';
import ComponentInspector from '@/components/views/component-editor/ComponentInspector';
import type { Constraint, Shape } from '@shared/component-types';

function rectShape(id: string, x = 0, y = 0): Shape {
  return {
    id,
    type: 'rect',
    x,
    y,
    width: 10,
    height: 10,
    rotation: 0,
    style: { strokeWidth: 1, opacity: 1 },
    layer: 'top',
  } as Shape;
}

function distanceConstraint(id: string, shapeIds: string[]): Constraint {
  return {
    id,
    type: 'distance',
    shapeIds,
    params: { distance: 5 },
    enabled: true,
  };
}

function pitchConstraint(id: string, shapeIds: string[]): Constraint {
  return {
    id,
    type: 'pitch',
    shapeIds,
    params: { pitch: 2.54 },
    enabled: true,
  };
}

/**
 * Seeds the provider with a breadboard view containing two shapes (selected)
 * and two existing constraints (distance + pitch) bound to those shapes — so
 * the constraint editor inputs render without requiring the user to click
 * "Add Constraint". The seed runs in a layout-equivalent effect (post-render)
 * to avoid "setState during render of another component" warnings.
 */
function Seed() {
  const { dispatch } = useComponentEditor();
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    dispatch({ type: 'SET_EDITOR_VIEW', payload: 'breadboard' });
    dispatch({ type: 'ADD_SHAPE', payload: { view: 'breadboard', shape: rectShape('s1') } });
    dispatch({ type: 'ADD_SHAPE', payload: { view: 'breadboard', shape: rectShape('s2', 20, 0) } });
    dispatch({ type: 'SET_SELECTION', payload: ['s1', 's2'] });
    dispatch({ type: 'ADD_CONSTRAINT', payload: distanceConstraint('c-dist', ['s1', 's2']) });
    dispatch({ type: 'ADD_CONSTRAINT', payload: pitchConstraint('c-pitch', ['s1', 's2']) });
  }, [dispatch]);
  return null;
}

function renderInspector() {
  return render(
    <ComponentEditorProvider>
      <Seed />
      <ComponentInspector />
    </ComponentEditorProvider>,
  );
}

describe('ComponentInspector — BL-0781 ARIA spinbutton contract', () => {
  it('NumberField helper mirrors min/max props onto aria attrs (Opacity field)', async () => {
    // The Opacity field is rendered by MultiShapeInspector at L260 with
    // step={0.1} min={0} max={1}. With two shapes selected the multi-shape
    // path is active, so the field is visible.
    renderInspector();
    const opacity = await screen.findByTestId('input-shape-opacity');
    expect(opacity.getAttribute('min')).toBe('0');
    expect(opacity.getAttribute('max')).toBe('1');
    expect(opacity.getAttribute('aria-valuemin')).toBe('0');
    expect(opacity.getAttribute('aria-valuemax')).toBe('1');
  });

  it('constraint distance input has min={0} max={1000} mirrored onto aria attrs', async () => {
    renderInspector();
    const distance = await screen.findByTestId('input-constraint-distance-c-dist');
    expect(distance.getAttribute('min')).toBe('0');
    expect(distance.getAttribute('max')).toBe('1000');
    expect(distance.getAttribute('aria-valuemin')).toBe('0');
    expect(distance.getAttribute('aria-valuemax')).toBe('1000');
  });

  it('constraint pitch input has min={0.1} max={10} mirrored onto aria attrs', async () => {
    renderInspector();
    const pitch = await screen.findByTestId('input-constraint-pitch-c-pitch');
    expect(pitch.getAttribute('min')).toBe('0.1');
    expect(pitch.getAttribute('max')).toBe('10');
    expect(pitch.getAttribute('aria-valuemin')).toBe('0.1');
    expect(pitch.getAttribute('aria-valuemax')).toBe('10');
  });
});

