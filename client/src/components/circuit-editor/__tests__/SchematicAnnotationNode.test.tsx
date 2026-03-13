import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SchematicAnnotationNode from '../SchematicAnnotationNode';
import type { Node, NodeProps } from '@xyflow/react';
import type { AnnotationNodeData } from '../SchematicAnnotationNode';

// Mock @xyflow/react internals that NodeProps may depend on
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react');
  return {
    ...actual,
  };
});

function renderAnnotationNode(overrides: Partial<AnnotationNodeData> = {}, selected = false) {
  const defaultData: AnnotationNodeData = {
    annotationId: 'test-ann-1',
    text: 'Hello World',
    fontSize: 14,
    color: '#ffffff',
    onTextChange: vi.fn(),
    onFontSizeChange: vi.fn(),
    onColorChange: vi.fn(),
    ...overrides,
  };

  const props = {
    id: 'annotation-test-ann-1',
    data: defaultData,
    selected,
    type: 'schematic-annotation',
    isConnectable: false,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    zIndex: 0,
    dragging: false,
    deletable: true,
    selectable: true,
    parentId: undefined,
    sourcePosition: undefined,
    targetPosition: undefined,
    dragHandle: undefined,
    width: 100,
    height: 30,
  } as unknown as NodeProps<Node<AnnotationNodeData>>;

  render(<SchematicAnnotationNode {...props} />);
  return defaultData;
}

describe('SchematicAnnotationNode', () => {
  it('renders the annotation text', () => {
    renderAnnotationNode();
    expect(screen.getByTestId('annotation-text-test-ann-1')).toBeDefined();
    expect(screen.getByText('Hello World')).toBeDefined();
  });

  it('shows placeholder when text is empty', () => {
    renderAnnotationNode({ text: '' });
    expect(screen.getByText('Double-click to edit')).toBeDefined();
  });

  it('applies font size and color styles', () => {
    renderAnnotationNode({ fontSize: 20, color: '#ef4444' });
    const textEl = screen.getByTestId('annotation-text-test-ann-1');
    expect(textEl.style.fontSize).toBe('20px');
    expect(textEl.style.color).toBe('#ef4444');
  });

  it('enters edit mode on double-click', async () => {
    renderAnnotationNode();
    const textEl = screen.getByTestId('annotation-text-test-ann-1');
    await userEvent.dblClick(textEl);
    expect(screen.getByTestId('annotation-edit-test-ann-1')).toBeDefined();
  });

  it('calls onTextChange on Enter', async () => {
    const data = renderAnnotationNode();
    const textEl = screen.getByTestId('annotation-text-test-ann-1');
    await userEvent.dblClick(textEl);

    const textarea = screen.getByTestId('annotation-edit-test-ann-1');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'New text');
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(data.onTextChange).toHaveBeenCalledWith('test-ann-1', 'New text');
  });

  it('cancels edit on Escape', async () => {
    renderAnnotationNode();
    const textEl = screen.getByTestId('annotation-text-test-ann-1');
    await userEvent.dblClick(textEl);

    const textarea = screen.getByTestId('annotation-edit-test-ann-1');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Discarded text');
    fireEvent.keyDown(textarea, { key: 'Escape' });

    // Should show original text, not the discarded text
    expect(screen.getByText('Hello World')).toBeDefined();
  });

  it('shows controls when selected', () => {
    renderAnnotationNode({}, true);
    expect(screen.getByTestId('annotation-controls-test-ann-1')).toBeDefined();
  });

  it('calls onFontSizeChange when font size is changed', async () => {
    const data = renderAnnotationNode({}, true);
    const select = screen.getByTestId('annotation-fontsize-test-ann-1');
    fireEvent.change(select, { target: { value: '20' } });
    expect(data.onFontSizeChange).toHaveBeenCalledWith('test-ann-1', 20);
  });

  it('calls onColorChange when a color swatch is clicked', async () => {
    const data = renderAnnotationNode({}, true);
    const swatch = screen.getByTestId('annotation-color-ef4444');
    await userEvent.click(swatch);
    expect(data.onColorChange).toHaveBeenCalledWith('test-ann-1', '#ef4444');
  });

  it('has correct data-testid', () => {
    renderAnnotationNode();
    expect(screen.getByTestId('schematic-annotation-test-ann-1')).toBeDefined();
  });
});
