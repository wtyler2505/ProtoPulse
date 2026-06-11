import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Copy, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import RadialCommandLinearMenu from '@/components/ui/RadialCommandLinearMenu';
import type { RadialMenuItem } from '@/lib/radial-menu-actions';

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenuItem: ({
    children,
    disabled,
    onSelect,
    textValue: _textValue,
    ...props
  }: {
    children: ReactNode;
    disabled?: boolean;
    onSelect?: () => void;
    textValue?: string;
  } & Record<string, unknown>) => (
    <button type="button" disabled={disabled} onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  ContextMenuSeparator: () => <hr data-testid="linear-menu-separator" />,
  ContextMenuShortcut: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => (
    <span {...props}>{children}</span>
  ),
}));

function makeItems(): RadialMenuItem[] {
  return [
    {
      id: 'add_node',
      label: 'Add Node',
      description: 'Add a block.',
      icon: Plus,
      slot: 0,
      group: 'create',
      hint: 'N',
    },
    {
      id: 'copy_summary',
      label: 'Copy Summary',
      description: 'Copy a summary.',
      icon: Copy,
      slot: 7,
      group: 'reuse',
      hint: 'S',
    },
    {
      id: 'delete',
      label: 'Delete',
      description: 'Delete a block.',
      icon: Trash2,
      slot: 5,
      group: 'delete',
      hint: 'SW',
      destructive: true,
    },
  ];
}

describe('RadialCommandLinearMenu', () => {
  it('renders command rows with labels and hints', () => {
    render(<RadialCommandLinearMenu items={makeItems()} onSelect={vi.fn()} />);

    expect(screen.getByTestId('ctx-command-add_node')).toHaveTextContent('Add Node');
    expect(screen.getByTestId('ctx-command-add_node')).toHaveTextContent('N');
    expect(screen.getByTestId('ctx-command-copy_summary')).toHaveTextContent('Copy Summary');
  });

  it('dispatches selected command IDs', () => {
    const onSelect = vi.fn();
    render(<RadialCommandLinearMenu items={makeItems()} onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId('ctx-command-copy_summary'));
    expect(onSelect).toHaveBeenCalledWith('copy_summary');
  });

  it('disables selected commands with reason titles', () => {
    render(
      <RadialCommandLinearMenu
        items={makeItems()}
        disabledCommandIds={new Set(['delete'])}
        disabledReasons={{ delete: 'Select a node first' }}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId('ctx-command-delete')).toBeDisabled();
    expect(screen.getByTestId('ctx-command-delete')).toHaveAttribute('title', 'Select a node first');
  });

  it('adds separators between command groups', () => {
    render(<RadialCommandLinearMenu items={makeItems()} onSelect={vi.fn()} />);
    expect(screen.getAllByTestId('linear-menu-separator')).toHaveLength(2);
  });
});
