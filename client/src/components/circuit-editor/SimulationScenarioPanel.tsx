import { memo, useState, useCallback } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { 
  useSimulationScenarios, 
  useCreateSimulationScenario, 
  useDeleteSimulationScenario 
} from '@/lib/circuit-editor/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Play, 
  Save, 
  Trash2, 
  History, 
  Settings2, 
  Clock,
  Activity,
  Plus,
  X,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { SimulationScenario } from '@shared/schema';

interface SimulationScenarioPanelProps {
  circuitId: number;
  currentConfig: Record<string, unknown>;
  onLoadConfig: (config: Record<string, unknown>) => void;
}

const SimulationScenarioPanel = memo(function SimulationScenarioPanel({ 
  circuitId, 
  currentConfig,
  onLoadConfig 
}: SimulationScenarioPanelProps) {
  const projectId = useProjectId();
  const { data: scenarios, isLoading } = useSimulationScenarios(projectId, circuitId);
  const createMutation = useCreateSimulationScenario();
  const deleteMutation = useDeleteSimulationScenario();

  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const handleSaveCurrent = useCallback(async () => {
    if (!newName.trim()) return;
    
    await createMutation.mutateAsync({
      projectId,
      circuitId,
      name: newName.trim(),
      description: newDesc.trim(),
      config: currentConfig,
    });
    
    setIsSaving(false);
    setNewName('');
    setNewDesc('');
  }, [newName, newDesc, currentConfig, projectId, circuitId, createMutation]);

  const handleDelete = useCallback((id: number) => {
    void deleteMutation.mutateAsync({ projectId, circuitId, scenarioId: id });
  }, [projectId, circuitId, deleteMutation]);

  return (
    <div className="flex flex-col h-full bg-card/40" data-testid="sim-scenario-panel">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <History className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground flex-1">Simulation Presets</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsSaving(!isSaving)}
          className={cn(
            'h-7 px-2 gap-1.5 text-xs font-bold uppercase tracking-wider',
            isSaving ? 'text-destructive hover:text-destructive' : 'text-primary hover:text-primary hover:bg-primary/10'
          )}
        >
          {isSaving ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {isSaving ? 'Cancel' : 'Save New'}
        </Button>
      </div>

      {/* Save Form */}
      {isSaving && (
        <div className="p-3 border-b border-border bg-primary/5 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Scenario Name</label>
            <Input 
              value={newName} 
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. 5V Rail Transient"
              className="h-8 text-xs"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Description</label>
            <Textarea 
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Analysis of power-on ripple..."
              className="text-xs min-h-[60px] resize-none"
            />
          </div>
          <Button 
            onClick={handleSaveCurrent}
            disabled={!newName.trim() || createMutation.isPending}
            className="w-full h-8 text-xs gap-2"
          >
            {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save Preset
          </Button>
        </div>
      )}

      {/* Scenarios List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
          </div>
        ) : !scenarios || scenarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2 px-6 text-center opacity-40">
            <Clock className="w-8 h-8" />
            <span className="text-[10px] leading-relaxed italic">No saved simulation presets for this circuit. Save your current config to reuse it later.</span>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {scenarios.map((scenario) => (
              <div 
                key={scenario.id} 
                className="p-3 hover:bg-accent/20 transition-colors group"
                data-testid={`scenario-item-${scenario.id}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-[11px] font-bold text-foreground truncate">{scenario.name}</h4>
                      <Badge variant="secondary" className="text-[8px] h-3.5 px-1 uppercase py-0 leading-none">
                        {(scenario.config as Record<string, unknown>)?.analysisType as string || 'op'}
                      </Badge>
                    </div>
                    {scenario.description && (
                      <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {scenario.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(scenario.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <Clock className="w-2.5 h-2.5" />
                    {format(new Date(scenario.createdAt), 'MMM d, h:mm a')}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] gap-1 px-2 border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => onLoadConfig(scenario.config as Record<string, unknown>)}
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    Load
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default SimulationScenarioPanel;

/** Local Badge component if not using global one */
function Badge({ children, variant, className }: { children: React.ReactNode, variant?: string, className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      variant === 'secondary' ? "border-transparent bg-secondary text-secondary-foreground" : "border-transparent bg-primary text-primary-foreground",
      className
    )}>
      {children}
    </span>
  );
}
