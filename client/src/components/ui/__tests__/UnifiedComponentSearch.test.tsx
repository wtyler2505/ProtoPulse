import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setActiveView = vi.fn();
const addBomItem = vi.fn();

vi.mock('cmdk', () => {
  const CommandRoot = ({
    children,
    shouldFilter: _shouldFilter,
    loop: _loop,
    label: _label,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    shouldFilter?: boolean;
    loop?: boolean;
    label?: string;
  }) => <div {...props}>{children}</div>;
  const CommandInput = ({
    onValueChange,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { onValueChange?: (value: string) => void }) => (
    <input
      {...props}
      onChange={(event) => {
        onValueChange?.(event.currentTarget.value);
      }}
    />
  );
  const CommandList = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div role="listbox" {...props}>
      {children}
    </div>
  );
  const CommandEmpty = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>;
  const CommandGroup = ({
    children,
    heading,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { heading?: string }) => (
    <div {...props}>
      {heading ? <div>{heading}</div> : null}
      {children}
    </div>
  );
  const CommandItem = ({
    children,
    onSelect,
    value,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { onSelect?: (value: string) => void; value?: string }) => (
    <div
      // eslint-disable-next-line jsx-a11y/role-has-required-aria-props -- test mock, Radix's real CommandItem supplies aria-selected
      role="option"
      tabIndex={0}
      onClick={() => { onSelect?.(value ?? ''); }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onSelect?.(value ?? '');
        }
      }}
      {...props}
    >
      {children}
    </div>
  );

  return {
    Command: Object.assign(CommandRoot, {
      Input: CommandInput,
      List: CommandList,
      Empty: CommandEmpty,
      Group: CommandGroup,
      Item: CommandItem,
    }),
  };
});

vi.mock('lucide-react', () => ({
  Search: (props: Record<string, unknown>) => <svg data-testid="icon-search" {...props} />,
  Package: (props: Record<string, unknown>) => <svg data-testid="icon-package" {...props} />,
  Cpu: (props: Record<string, unknown>) => <svg data-testid="icon-cpu" {...props} />,
  Globe: (props: Record<string, unknown>) => <svg data-testid="icon-globe" {...props} />,
  Plus: (props: Record<string, unknown>) => <svg data-testid="icon-plus" {...props} />,
  ArrowRightToLine: (props: Record<string, unknown>) => <svg data-testid="icon-place" {...props} />,
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 18,
}));

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({
    setActiveView,
  }),
}));

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    bom: [],
    addBomItem,
  }),
}));

vi.mock('@/lib/community-library', () => ({
  useCommunityLibrary: () => ({
    components: [
      {
        id: 'community-1',
        name: 'NPN Transistor (2N2222)',
        description: 'General-purpose NPN transistor',
      },
    ],
  }),
}));

vi.mock('@/lib/component-editor/hooks', () => ({
  useComponentParts: () => ({
    data: [
      {
        id: 101,
        meta: {
          title: 'ATtiny85',
          description: '8-bit AVR Microcontroller, 8-pin DIP',
        },
      },
    ],
  }),
}));

vi.mock('@/lib/community-bom-bridge', () => ({
  mapCommunityPartToBom: (part: { name: string; description: string }) => ({
    partNumber: part.name,
    manufacturer: 'Community',
    description: part.description,
    quantity: 1,
    unitPrice: 0,
    totalPrice: 0,
    stock: 0,
    supplier: 'Community Library',
    status: 'In Stock',
  }),
}));

import UnifiedComponentSearch from '@/components/ui/UnifiedComponentSearch';

describe('UnifiedComponentSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('places a standard-library component when the option itself is selected', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(<UnifiedComponentSearch />);

    act(() => {
      window.dispatchEvent(new CustomEvent('protopulse:focus-component-search'));
    });

    fireEvent.click(screen.getByRole('option', { name: /ATtiny85/i }));

    expect(setActiveView).toHaveBeenCalledWith('schematic');
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'protopulse:place-component-instance',
        detail: { partId: 101 },
      }),
    );
  });

  it('exposes a real accessible Place button for standard-library results', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(<UnifiedComponentSearch />);

    act(() => {
      window.dispatchEvent(new CustomEvent('protopulse:focus-component-search'));
    });

    fireEvent.click(screen.getByRole('button', { name: /Place ATtiny85 on schematic/i }));

    expect(setActiveView).toHaveBeenCalledWith('schematic');
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'protopulse:place-component-instance',
        detail: { partId: 101 },
      }),
    );
  });

  it('defaults community-library selection to Add to BOM', () => {
    render(<UnifiedComponentSearch />);

    act(() => {
      window.dispatchEvent(new CustomEvent('protopulse:focus-component-search'));
    });

    fireEvent.change(screen.getByPlaceholderText(/Search components across standard library/i), {
      target: { value: '2N2222' },
    });
    fireEvent.click(screen.getByRole('option', { name: /NPN Transistor \(2N2222\)/i }));

    expect(addBomItem).toHaveBeenCalledWith(
      expect.objectContaining({
        partNumber: 'NPN Transistor (2N2222)',
        manufacturer: 'Community',
      }),
    );
    expect(setActiveView).toHaveBeenCalledWith('procurement');
  });
});
