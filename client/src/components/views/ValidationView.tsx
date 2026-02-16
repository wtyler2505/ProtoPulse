import { useProject } from '@/lib/project-context';
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ValidationView() {
  const { issues } = useProject();

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertCircle className="w-5 h-5 text-destructive" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info': return <CheckCircle2 className="w-5 h-5 text-primary" />;
      default: return null;
    }
  };

  return (
    <div className="h-full p-6 overflow-auto bg-background/50">
      <h2 className="text-xl font-display font-bold mb-6 flex items-center gap-2">
        <ActivityIcon /> SYSTEM VALIDATION REPORT
      </h2>

      <div className="space-y-4 max-w-4xl mx-auto">
        {issues.map((issue) => (
          <div key={issue.id} className="flex items-start gap-4 p-4 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
            <div className="mt-1">{getIcon(issue.severity)}</div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground">{issue.message}</h3>
              <p className="text-sm text-muted-foreground mt-1">Component ID: <span className="font-mono text-primary">{issue.componentId || 'Global'}</span></p>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded border border-primary/20">
                AUTO-FIX
              </button>
              <button className="px-3 py-1 text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 rounded border border-border">
                IGNORE
              </button>
            </div>
          </div>
        ))}

        {issues.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No issues detected. System nominal.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-primary">
      <path d="M22 12H18L15 21L9 3L6 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
