import { useState, useCallback } from 'react';
import { Code2, Play, ToggleLeft, ToggleRight, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { BUILTIN_TEMPLATES } from '@/lib/drc-scripting';
import type { DrcScript } from '@/lib/drc-scripting';
import type { ScriptDesignData } from '@/lib/drc-scripting';
import type { useToast } from '@/hooks/use-toast';

interface ScriptResult {
  scriptId: string;
  passed: boolean;
  violations: Array<{ ruleId: string; severity: string; message: string }>;
  executionTimeMs: number;
}

interface CustomRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scripts: DrcScript[];
  scriptResults: ScriptResult[];
  scriptDesignData: ScriptDesignData;
  runScript: (id: string, data: ScriptDesignData) => Promise<ScriptResult | null>;
  runAllEnabled: (data: ScriptDesignData) => Promise<Array<ScriptResult | null>>;
  addScript: (name: string, description: string, code: string) => void;
  updateScript: (id: string, updates: Partial<Pick<DrcScript, 'name' | 'description' | 'code' | 'enabled'>>) => void;
  deleteScript: (id: string) => void;
  toast: ReturnType<typeof useToast>['toast'];
}

export function CustomRulesDialog({
  open, onOpenChange, scripts, scriptResults, scriptDesignData,
  runScript, runAllEnabled, addScript, updateScript, deleteScript, toast,
}: CustomRulesDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [editingScript, setEditingScript] = useState<DrcScript | null>(null);
  const [scriptName, setScriptName] = useState('');
  const [scriptDescription, setScriptDescription] = useState('');
  const [scriptCode, setScriptCode] = useState('');

  const handleApplyTemplate = useCallback((templateIdx: string) => {
    const idx = parseInt(templateIdx, 10);
    if (isNaN(idx) || idx < 0 || idx >= BUILTIN_TEMPLATES.length) { return; }
    const tmpl = BUILTIN_TEMPLATES[idx];
    setScriptName(tmpl.name);
    setScriptDescription(tmpl.description);
    setScriptCode(tmpl.code);
    setSelectedTemplate(templateIdx);
  }, []);

  const handleEditScript = useCallback((script: DrcScript) => {
    setEditingScript(script);
    setScriptName(script.name);
    setScriptDescription(script.description);
    setScriptCode(script.code);
  }, []);

  const handleAddScript = useCallback(() => {
    if (!scriptName.trim()) {
      toast({ title: 'Script Name Required', description: 'Enter a name for the script.', variant: 'destructive' });
      return;
    }
    addScript(scriptName.trim(), scriptDescription.trim(), scriptCode);
    setScriptName('');
    setScriptDescription('');
    setScriptCode('');
    toast({ title: 'Script Added', description: `"${scriptName.trim()}" added to custom rules.` });
  }, [scriptName, scriptDescription, scriptCode, addScript, toast]);

  const handleUpdateScript = useCallback(() => {
    if (!editingScript) { return; }
    updateScript(editingScript.id, { name: scriptName.trim(), description: scriptDescription.trim(), code: scriptCode });
    setEditingScript(null);
    setScriptName('');
    setScriptDescription('');
    setScriptCode('');
    toast({ title: 'Script Updated', description: `"${scriptName.trim()}" updated.` });
  }, [editingScript, scriptName, scriptDescription, scriptCode, updateScript, toast]);

  const handleDeleteScript = useCallback((id: string) => {
    deleteScript(id);
    toast({ title: 'Script Deleted', description: 'Custom rule removed.' });
  }, [deleteScript, toast]);

  const handleRunAllScripts = useCallback(async () => {
    const allResults = await runAllEnabled(scriptDesignData);
    const totalViolations = allResults.reduce((sum, r) => sum + (r?.violations.length ?? 0), 0);
    toast({ title: 'Scripts Executed', description: `Ran ${allResults.length} script(s), found ${totalViolations} violation(s).` });
  }, [runAllEnabled, scriptDesignData, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="custom-rules-dialog" className="bg-card border-border max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-primary" />
            Custom DRC Rules
          </DialogTitle>
          <DialogDescription>
            Write JavaScript scripts that validate your design against custom rules. Scripts run in a sandboxed environment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Script list */}
          {scripts.length > 0 && (
            <div data-testid="script-list" className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Scripts ({scripts.length})</h4>
                <Button data-testid="run-all-scripts" variant="outline" size="sm" className="h-7 text-xs" onClick={() => void handleRunAllScripts()}>
                  <Play className="w-3 h-3 mr-1" />
                  Run All Enabled
                </Button>
              </div>
              {scripts.map((script) => (
                <div key={script.id} data-testid={`script-item-${script.id}`} className="flex items-center justify-between py-2 px-3 border border-border/50 rounded hover:bg-muted/20">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      data-testid={`script-toggle-${script.id}`}
                      onClick={() => { updateScript(script.id, { enabled: !script.enabled }); }}
                      className="flex-shrink-0"
                      aria-label={`Toggle ${script.name}`}
                    >
                      {script.enabled ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{script.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{script.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <Button
                      data-testid={`script-run-${script.id}`}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => { void runScript(script.id, scriptDesignData).then(() => { toast({ title: 'Script Executed', description: `Ran "${script.name}".` }); }); }}
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                    <Button
                      data-testid={`script-edit-${script.id}`}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => { handleEditScript(script); }}
                    >
                      <Code2 className="w-3 h-3" />
                    </Button>
                    <Button
                      data-testid={`script-delete-${script.id}`}
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => { handleDeleteScript(script.id); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Template selector */}
          <div className="space-y-2">
            <Label className="text-xs">Load from Template</Label>
            <Select value={selectedTemplate} onValueChange={handleApplyTemplate}>
              <SelectTrigger data-testid="template-select" className="h-8 text-xs">
                <SelectValue placeholder="Choose a built-in template..." />
              </SelectTrigger>
              <SelectContent>
                {BUILTIN_TEMPLATES.map((tmpl, idx) => (
                  <SelectItem key={idx} value={String(idx)} className="text-xs">{tmpl.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Script editor */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Name</Label>
                <Input data-testid="script-name-input" value={scriptName} onChange={(e) => { setScriptName(e.target.value); }} className="h-7 text-xs" placeholder="Rule name" />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Input data-testid="script-description-input" value={scriptDescription} onChange={(e) => { setScriptDescription(e.target.value); }} className="h-7 text-xs" placeholder="What does this rule check?" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Script Code</Label>
              <textarea
                data-testid="script-code-editor"
                value={scriptCode}
                onChange={(e) => { setScriptCode(e.target.value); }}
                className="w-full h-40 bg-background border border-border rounded p-2 text-xs font-mono resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                placeholder="// Available: nodes, edges, bomItems, report(ruleId, message, severity, nodeIds, suggestion), warn(message), hasProperty(nodeId, key)"
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {editingScript ? (
            <>
              <Button data-testid="cancel-edit-script" variant="outline" size="sm" onClick={() => { setEditingScript(null); setScriptName(''); setScriptDescription(''); setScriptCode(''); }}>
                Cancel
              </Button>
              <Button data-testid="update-script" size="sm" onClick={handleUpdateScript}>
                Update Script
              </Button>
            </>
          ) : (
            <Button data-testid="add-script" size="sm" onClick={handleAddScript}>
              <Plus className="w-3 h-3 mr-1" />
              Add Script
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Inline section rendered below the Design Gateway / DFM grid when there are script results. */
export function ScriptResultsSection({ scriptResults, scripts }: { scriptResults: ScriptResult[]; scripts: DrcScript[] }) {
  if (scriptResults.length === 0) { return null; }
  return (
    <div data-testid="script-results-section" className="w-full max-w-5xl mt-4 bg-card/40 border border-border backdrop-blur-xl shadow-xl p-4">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Code2 className="w-4 h-4 text-primary" />
        Custom Rule Results
      </h3>
      <div className="space-y-2 max-h-48 overflow-auto">
        {scriptResults.map((r) => {
          const script = scripts.find((s) => s.id === r.scriptId);
          return (
            <div key={r.scriptId} data-testid={`script-result-${r.scriptId}`} className="border border-border/50 rounded p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{script?.name ?? r.scriptId}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={r.passed ? 'outline' : 'destructive'} className="text-[10px]">
                    {r.passed ? 'PASS' : 'FAIL'}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{r.executionTimeMs}ms</span>
                </div>
              </div>
              {r.violations.map((v, vi) => (
                <div key={`${v.ruleId}-${vi}`} className="text-xs text-muted-foreground pl-2 border-l border-border ml-1 mt-1">
                  <span className={cn('font-mono', v.severity === 'error' ? 'text-destructive' : v.severity === 'warning' ? 'text-yellow-500' : 'text-primary')}>
                    [{v.severity}]
                  </span>{' '}
                  {v.message}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
