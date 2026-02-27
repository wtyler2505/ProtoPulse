/**
 * Shared small icon-button used in breadboard and PCB toolbars.
 */
import { cn } from '@/lib/utils';

interface ToolButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
  testId: string;
}

export default function ToolButton({ icon: Icon, label, active, onClick, testId }: ToolButtonProps) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      title={label}
      className={cn(
        'h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors',
        active && 'bg-primary/20 text-primary',
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
