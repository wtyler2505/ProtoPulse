import { Fragment, memo } from 'react';
import { cn } from '@/lib/utils';
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/ui/context-menu';
import { radialSlotMeta, type RadialCommandGroup, type RadialMenuItem } from '@/lib/radial-menu-actions';

interface RadialCommandLinearMenuProps {
  items: RadialMenuItem[];
  disabledCommandIds?: ReadonlySet<string>;
  disabledReasons?: Partial<Record<string, string>>;
  onSelect: (commandId: string) => void;
}

const groupTone: Record<RadialCommandGroup, string> = {
  create: 'text-emerald-300',
  transform: 'text-sky-300',
  connect: 'text-cyan-300',
  inspect: 'text-teal-300',
  run: 'text-amber-300',
  delete: 'text-red-300',
  edit: 'text-blue-300',
  reuse: 'text-lime-300',
};

function RadialCommandLinearMenu({
  items,
  disabledCommandIds,
  disabledReasons,
  onSelect,
}: RadialCommandLinearMenuProps) {
  return (
    <>
      {items.map((item, index) => {
        const Icon = item.icon;
        const disabled = item.disabled || disabledCommandIds?.has(item.id) || false;
        const disabledReason = item.disabledReason ?? disabledReasons?.[item.id];
        const previousGroup = items[index - 1]?.group ?? null;
        const showSeparator = previousGroup !== null && previousGroup !== item.group;

        return (
          <Fragment key={item.id}>
            {showSeparator && <ContextMenuSeparator />}
            <ContextMenuItem
              data-testid={`ctx-command-${item.id}`}
              disabled={disabled}
              textValue={item.label}
              title={disabled ? disabledReason : item.description}
              onSelect={() => onSelect(item.id)}
              className={cn(item.destructive && 'text-red-200 focus:text-red-100')}
            >
              <Icon className={cn('mr-2 h-3.5 w-3.5 shrink-0', item.destructive ? 'text-red-300' : groupTone[item.group])} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <ContextMenuShortcut className="ml-3 tracking-normal">
                {item.hint ?? radialSlotMeta[item.slot].direction}
              </ContextMenuShortcut>
            </ContextMenuItem>
          </Fragment>
        );
      })}
    </>
  );
}

export default memo(RadialCommandLinearMenu);
