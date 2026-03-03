/**
 * Shared small icon-button used in breadboard and PCB toolbars.
 */
import { memo } from 'react';
import { cn } from '@/lib/utils';

interface ToolButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
  testId: string;
}

const ToolButton = memo(function ToolButton({ icon: Icon, label, active, onClick, testId }: ToolButtonProps) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
        active && 'bg-primary/20 text-primary border border-primary/40',
      )}
    >
      <Icon className="w-[18px] h-[18px]" />
    </button>
  );
});

export default ToolButton;
