import { useRolePreset, ROLE_IDS, getRolePreset } from '@/lib/role-presets';
import type { RoleId } from '@/lib/role-presets';
import { cn } from '@/lib/utils';
import { GraduationCap, Wrench, Rocket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const ROLE_ICONS: Record<RoleId, LucideIcon> = {
  student: GraduationCap,
  hobbyist: Wrench,
  pro: Rocket,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RolePresetSelectorProps {
  className?: string;
}

export default function RolePresetSelector({ className }: RolePresetSelectorProps) {
  const { activeRole, setActiveRole } = useRolePreset();

  return (
    <div
      data-testid="role-preset-selector"
      className={cn('flex gap-1 p-1 bg-muted/50 border border-border rounded-md', className)}
    >
      {ROLE_IDS.map((id) => {
        const preset = getRolePreset(id);
        const Icon = ROLE_ICONS[id];
        const isActive = activeRole === id;

        return (
          <button
            key={id}
            data-testid={`role-preset-${id}`}
            aria-pressed={isActive}
            title={preset.description}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors',
              isActive
                ? 'bg-primary/15 text-primary shadow-[0_0_8px_rgba(6,182,212,0.15)]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
            onClick={() => setActiveRole(id)}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{preset.label}</span>
          </button>
        );
      })}
    </div>
  );
}
