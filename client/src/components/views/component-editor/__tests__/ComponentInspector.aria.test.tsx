/**
 * ComponentInspector — NumberInput ARIA-contract migration test (BL-0781).
 *
 * Per the BL-0781 audit (docs/audits/bl-0781-number-input-audit.md,
 * "Component-editor + views" table):
 *
 *   - ComponentInspector.tsx lines 74-85 — the local `NumberField` wrapper — is the
 *     highest-leverage single swap in the set: its internal `<Input type="number">`
 *     migrated to `NumberInput`, cascading correctly to all 13 call sites (X/Y,
 *     Width/Height, Rotation, Stroke Width, Opacity, CX/CY, Radius, Font Size)
 *     WITHOUT touching those call sites, since they already pass per-shape
 *     min/max (some optionally undefined, which is correct).
 *   - Lines 381-390 / 392-402 — the constraint "distance" and "pitch" params — are
 *     SEPARATE raw `<Input type="number">` instances outside the NumberField
 *     wrapper. Both are OMIT-MAX (no coded ceiling for constraint distances).
 *
 * This suite exercises: (1) the NumberField wrapper's cascade via the "X" position
 * field (no min/max passed at that call site → OMIT-MAX/OMIT-MIN), and (2) the two
 * separate constraint distance/pitch instances (OMIT-MAX).
 */

// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import type { RectShape } from '@shared/component-types';

import {
  ComponentEditorProvider,
  useComponentEditor,
} from '@/lib/component-editor/ComponentEditorProvider';
import ComponentInspector from '../ComponentInspector';

function makeRect(id: string, x: number): RectShape {
  return {
    id,
    type: 'rect',
    x,
    y: 0,
    width: 10,
    height: 10,
    rotation: 0,
    style: { fill: '#555', stroke: '#888', strokeWidth: 1 },
  };
}

/** Seeds the editor with one selected shape (drives the NumberField wrapper cascade). */
function SeedOneShape({ children }: { children: ReactNode }) {
  const { dispatch } = useComponentEditor();
  useEffect(() => {
    dispatch({ type: 'SET_EDITOR_VIEW', payload: 'schematic' });
    dispatch({ type: 'ADD_SHAPE', payload: { view: 'schematic', shape: makeRect('r1', 0) } });
    dispatch({ type: 'SET_SELECTION', payload: ['r1'] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

/** Seeds the editor with two selected shapes (required for constraint creation). */
function SeedTwoShapes({ children }: { children: ReactNode }) {
  const { dispatch } = useComponentEditor();
  useEffect(() => {
    dispatch({ type: 'SET_EDITOR_VIEW', payload: 'schematic' });
    dispatch({ type: 'ADD_SHAPE', payload: { view: 'schematic', shape: makeRect('r1', 0) } });
    dispatch({ type: 'ADD_SHAPE', payload: { view: 'schematic', shape: makeRect('r2', 30) } });
    dispatch({ type: 'SET_SELECTION', payload: ['r1', 'r2'] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

function renderWithOneShape() {
  return render(
    <ComponentEditorProvider>
      <SeedOneShape>
        <ComponentInspector />
      </SeedOneShape>
    </ComponentEditorProvider>,
  );
}

function renderWithTwoShapes() {
  return render(
    <ComponentEditorProvider>
      <SeedTwoShapes>
        <ComponentInspector />
      </SeedTwoShapes>
    </ComponentEditorProvider>,
  );
}

describe('ComponentInspector — NumberField wrapper NumberInput cascade (BL-0781)', () => {
  it('renders the X position field as a spinbutton via the migrated NumberField wrapper', () => {
    renderWithOneShape();
    const el = screen.getByTestId('input-shape-x');
    expect(el.getAttribute('type')).toBe('number');
  });

  it('cascades OMIT-MAX to call sites with no max prop (X position)', () => {
    renderWithOneShape();
    const el = screen.getByTestId('input-shape-x');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('max')).toBe(false);
  });

  it('cascades OMIT-MIN to call sites with no min prop (X position)', () => {
    renderWithOneShape();
    const el = screen.getByTestId('input-shape-x');
    expect(el.hasAttribute('aria-valuemin')).toBe(false);
    expect(el.hasAttribute('min')).toBe(false);
  });

  it('mirrors a real min bound onto aria-valuemin for a call site that passes one (Opacity min=0)', () => {
    renderWithOneShape();
    const el = screen.getByTestId('input-shape-opacity');
    expect(el.getAttribute('aria-valuemin')).toBe('0');
  });

  it('regression guard: never coerces the missing max to aria-valuemax="0" (X position)', () => {
    renderWithOneShape();
    const el = screen.getByTestId('input-shape-x');
    expect(el.getAttribute('aria-valuemax')).not.toBe('0');
  });
});

describe('ComponentInspector — constraint distance/pitch NumberInput ARIA contract (BL-0781)', () => {
  it('OMIT-MAX: constraint distance input omits aria-valuemax and the HTML max attribute', () => {
    renderWithTwoShapes();
    fireEvent.click(screen.getByTestId('button-add-constraint-distance'));
    const el = screen.getByTestId(/^input-constraint-distance-/);
    expect(el.getAttribute('type')).toBe('number');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('max')).toBe(false);
  });

  it('OMIT-MAX: constraint pitch input omits aria-valuemax and the HTML max attribute', () => {
    renderWithTwoShapes();
    fireEvent.click(screen.getByTestId('button-add-constraint-pitch'));
    const el = screen.getByTestId(/^input-constraint-pitch-/);
    expect(el.getAttribute('type')).toBe('number');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('max')).toBe(false);
  });

  it('preserves the tight className (h-5 w-14 text-[10px]) on the distance instance — visual-risk', () => {
    renderWithTwoShapes();
    fireEvent.click(screen.getByTestId('button-add-constraint-distance'));
    const el = screen.getByTestId(/^input-constraint-distance-/);
    expect(el.className).toContain('h-5');
    expect(el.className).toContain('w-14');
    expect(el.className).toContain('text-[10px]');
  });

  it('mirrors the createConstraint default distance value (100) onto aria-valuenow', () => {
    renderWithTwoShapes();
    fireEvent.click(screen.getByTestId('button-add-constraint-distance'));
    const el = screen.getByTestId(/^input-constraint-distance-/);
    expect(el.getAttribute('aria-valuenow')).toBe('100');
  });
});
