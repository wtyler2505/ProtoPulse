/**
 * ShapeCanvas — reference-image X/Y offset NumberInput ARIA-contract test (BL-0781).
 *
 * Per the BL-0781 audit (docs/audits/bl-0781-number-input-audit.md,
 * "Component-editor + views" table, ShapeCanvas.tsx rows), the two ref-image
 * offset inputs (`ref-image-x` / `ref-image-y`, `w-14 h-5` — the audit corrected
 * the plan's `w-12` citation) migrated from raw `<input type="number">` to
 * `NumberInput`. Action is OMIT-MAX for both — canvas-coordinate offsets have no
 * domain ceiling.
 *
 * These inputs only render once `refImage` state is populated, which happens
 * asynchronously via the hidden file-input's `onChange` → `new Image()` →
 * `img.onload`. `happy-dom` does not actually decode image bytes, so `Image` is
 * stubbed here to invoke `onload` on the next microtask (a standard technique —
 * see e.g. testing-library recipes for `<img>`/`Image()` upload flows).
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { ComponentEditorProvider } from '@/lib/component-editor/ComponentEditorProvider';
import ShapeCanvas from '../ShapeCanvas';

class MockImage {
  onload: (() => void) | null = null;
  naturalWidth = 120;
  naturalHeight = 80;
  private _src = '';
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
  get src() {
    return this._src;
  }
}

async function uploadReferenceImage() {
  render(
    <ComponentEditorProvider>
      <ShapeCanvas view="schematic" />
    </ComponentEditorProvider>,
  );

  const file = new File(['fake-image-bytes'], 'reference.png', { type: 'image/png' });
  const fileInput = screen.getByTestId('ref-image-input');
  fireEvent.change(fileInput, { target: { files: [file] } });

  // refImage is set asynchronously via Image.onload — wait for the X offset field to appear.
  await waitFor(() => expect(screen.queryByTestId('ref-image-x')).not.toBeNull());
}

describe('ShapeCanvas — reference-image offset NumberInput ARIA contract (BL-0781)', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', MockImage as unknown as typeof Image);
    if (!URL.createObjectURL || typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn(() => 'blob:mock-ref-image');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-ref-image');
    }
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the X offset input as a spinbutton once a reference image is uploaded', async () => {
    await uploadReferenceImage();
    const el = screen.getByTestId('ref-image-x');
    expect(el.getAttribute('type')).toBe('number');
  });

  it('OMIT-MAX: X offset input omits aria-valuemax and the HTML max attribute', async () => {
    await uploadReferenceImage();
    const el = screen.getByTestId('ref-image-x');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('max')).toBe(false);
  });

  it('OMIT-MAX: Y offset input omits aria-valuemax and the HTML max attribute', async () => {
    await uploadReferenceImage();
    const el = screen.getByTestId('ref-image-y');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('max')).toBe(false);
  });

  it('regression guard: never coerces the missing max to aria-valuemax="0" (X, Y)', async () => {
    await uploadReferenceImage();
    expect(screen.getByTestId('ref-image-x').getAttribute('aria-valuemax')).not.toBe('0');
    expect(screen.getByTestId('ref-image-y').getAttribute('aria-valuemax')).not.toBe('0');
  });

  it('preserves the tight className (w-14 h-5) on both offset instances — visual-risk', async () => {
    await uploadReferenceImage();
    const x = screen.getByTestId('ref-image-x');
    const y = screen.getByTestId('ref-image-y');
    expect(x.className).toContain('w-14');
    expect(x.className).toContain('h-5');
    expect(y.className).toContain('w-14');
    expect(y.className).toContain('h-5');
  });

  it('mirrors the rounded x/y offset value onto aria-valuenow', async () => {
    await uploadReferenceImage();
    // Initial refImage.x/y = 0 per handleRefImageUpload
    expect(screen.getByTestId('ref-image-x').getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByTestId('ref-image-y').getAttribute('aria-valuenow')).toBe('0');
  });
});
