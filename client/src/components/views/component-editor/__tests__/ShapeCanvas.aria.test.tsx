// @vitest-environment happy-dom

/**
 * BL-0781 — ShapeCanvas ARIA spinbutton contract.
 *
 * Two raw numeric inputs at L642 (ref-image-x) and L648 (ref-image-y) gated
 * by `refImage` state — only render after a reference image is uploaded.
 * Bounds per audit row: ADD-MIN={-10000}, ADD-MAX={10000}.
 *
 * Audit: docs/audits/bl-0781-number-input-audit.md §ShapeCanvas.tsx.
 *
 * Test strategy: stub URL.createObjectURL + window.Image so handleRefImageUpload
 * resolves synchronously, then dispatch a file-input change to flip the
 * `refImage` state.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ComponentEditorProvider } from '@/lib/component-editor/ComponentEditorProvider';
import ShapeCanvas from '@/components/views/component-editor/ShapeCanvas';

class FakeImage {
  onload: (() => void) | null = null;
  naturalWidth = 100;
  naturalHeight = 100;
  set src(_v: string) {
    // Fire onload synchronously so handleRefImageUpload's setRefImage flushes
    // in the same tick — happy-dom doesn't natively run Image decoding.
    queueMicrotask(() => this.onload?.());
  }
}

describe('ShapeCanvas — BL-0781 ARIA spinbutton contract', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', FakeImage);
    // jsdom-style createObjectURL stub (happy-dom may already have one but
    // we want a predictable string).
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:test',
      revokeObjectURL: () => {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderCanvas() {
    return render(
      <ComponentEditorProvider>
        <ShapeCanvas view="breadboard" />
      </ComponentEditorProvider>,
    );
  }

  async function uploadRefImage() {
    const fileInput = screen.getByTestId('ref-image-input') as HTMLInputElement;
    const file = new File(['x'], 'ref.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    // Wait two microtask ticks: src setter → onload → setRefImage → re-render.
    await Promise.resolve();
    await Promise.resolve();
  }

  it('ref-image-x input mirrors min/max to aria attrs after upload', async () => {
    renderCanvas();
    await uploadRefImage();
    const input = await screen.findByTestId('ref-image-x');
    expect(input.getAttribute('min')).toBe('-10000');
    expect(input.getAttribute('max')).toBe('10000');
    expect(input.getAttribute('aria-valuemin')).toBe('-10000');
    expect(input.getAttribute('aria-valuemax')).toBe('10000');
  });

  it('ref-image-y input mirrors min/max to aria attrs after upload', async () => {
    renderCanvas();
    await uploadRefImage();
    const input = await screen.findByTestId('ref-image-y');
    expect(input.getAttribute('min')).toBe('-10000');
    expect(input.getAttribute('max')).toBe('10000');
    expect(input.getAttribute('aria-valuemin')).toBe('-10000');
    expect(input.getAttribute('aria-valuemax')).toBe('10000');
  });
});
