import { useProject } from '@/lib/project-context';
import { AlertTriangle, AlertCircle, CheckCircle2, ChevronRight, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ValidationView() {
  const { issues, runValidation } = useProject();

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="w-5 h-5 text-destructive" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info': return <AlertCircle className="w-5 h-5 text-primary" />;
      default: return null;
    }
  };

  return (
    <div className="h-full p-6 bg-background/50 flex flex-col items-center">
      <div className="w-full max-w-5xl flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-display font-bold flex items-center gap-3">
             <ActivityIcon /> 
             System Validation
          </h2>
          <p className="text-muted-foreground mt-1">Found {issues.length} potential issues in your design.</p>
        </div>
        <button 
          onClick={runValidation}
          className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]"
        >
          Run DRC Checks
        </button>
      </div>

      <div className="w-full max-w-5xl flex-1 overflow-hidden bg-card/50 border border-border rounded-xl backdrop-blur-sm shadow-xl flex flex-col">
        <div className="flex items-center gap-6 p-4 border-b border-border bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
           <div className="w-8 text-center">Sev</div>
           <div className="flex-1">Description</div>
           <div className="w-32">Component</div>
           <div className="w-32">Action</div>
        </div>
        
        <ScrollArea className="flex-1">
          {issues.map((issue) => (
            <div key={issue.id} className="flex items-start gap-6 p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer">
              <div className="w-8 flex justify-center mt-0.5">{getIcon(issue.severity)}</div>
              <div className="flex-1">
                <h3 className="font-medium text-foreground text-sm">{issue.message}</h3>
                {issue.suggestion && (
                  <div className="mt-1.5 text-xs text-muted-foreground flex items-start gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-emerald-500/80">Suggestion: {issue.suggestion}</span>
                  </div>
                )}
              </div>
              <div className="w-32 text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded self-start text-center">
                {issue.componentId || 'GLOBAL'}
              </div>
              <div className="w-32">
                 <button className="opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 rounded w-full">
                   Auto-Fix
                 </button>
              </div>
            </div>
          ))}

          {issues.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <CheckCircle2 className="w-16 h-16 mb-4 text-emerald-500/20" />
              <p className="text-lg font-medium text-foreground">All Systems Nominal</p>
              <p className="text-sm">No design rule violations detected.</p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

function ActivityIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-primary">
      <path d="M22 12H18L15 21L9 3L6 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
