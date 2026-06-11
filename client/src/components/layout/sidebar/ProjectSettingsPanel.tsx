/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Check, Settings, Download, Upload } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { copyToClipboard } from '@/lib/clipboard';
import { SETTINGS_SAVE_FEEDBACK_DURATION } from '@/components/panels/chat/constants';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { GraphNode, GraphEdge } from '@/lib/graph-types';
import type { BomItem, ValidationIssue } from '@/lib/project-context';

interface ProjectSettingsPanelProps {
  projectName: string;
  setProjectName: (name: string) => void;
  projectDescription: string;
  setProjectDescription: (desc: string) => void;
  nodes: GraphNode[];
  edges: GraphEdge[];
  bom: BomItem[];
  issues: ValidationIssue[];
  addOutputLog: (log: string) => void;
}

const ProjectSettingsPanel = memo(function ProjectSettingsPanel({
  projectName,
  setProjectName,
  projectDescription,
  setProjectDescription,
  nodes,
  edges,
  bom,
  issues,
  addOutputLog,
}: ProjectSettingsPanelProps) {
  const projectId = useProjectId();
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsName, setSettingsName] = useState(projectName);
  const [settingsDesc, setSettingsDesc] = useState(projectDescription);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSettingsName(projectName); }, [projectName]);
  useEffect(() => { setSettingsDesc(projectDescription); }, [projectDescription]);

  const settingsDirty = settingsName !== projectName || settingsDesc !== projectDescription;

  const saveSettings = () => {
    if (settingsName.trim() && settingsName !== projectName) {
      setProjectName(settingsName.trim());
    }
    if (settingsDesc !== projectDescription) {
      setProjectDescription(settingsDesc);
    }
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), SETTINGS_SAVE_FEEDBACK_DURATION);
  };

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await apiRequest('GET', `/api/projects/${projectId}/export`);
      const blob = await res.blob();

      const disposition = res.headers.get('Content-Disposition');
      let filename = `project-${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
      if (disposition) {
        const match = /filename="([^"]+)"/.exec(disposition);
        if (match) {
          filename = match[1];
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addOutputLog(`[SYSTEM] Project exported as ${filename}`);
      toast({ title: 'Export complete', description: `Saved as ${filename}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      addOutputLog(`[ERROR] Export failed: ${message}`);
      toast({ variant: 'destructive', title: 'Export failed', description: message });
    } finally {
      setExporting(false);
    }
  }, [projectId, projectName, addOutputLog, toast]);

  const handleImport = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON file');
      }

      const res = await apiRequest('POST', '/api/projects/import', parsed);
      const result = await res.json() as { projectId: number; name: string };

      addOutputLog(`[SYSTEM] Project imported: "${result.name}" (ID: ${result.projectId})`);
      toast({ title: 'Import complete', description: `Created project "${result.name}"` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      addOutputLog(`[ERROR] Import failed: ${message}`);
      toast({ variant: 'destructive', title: 'Import failed', description: message });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [addOutputLog, toast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImport(file);
    }
  }, [handleImport]);

  return (
    <div className="border-t border-border/60 bg-sidebar/10">
      <StyledTooltip content="Open project settings" side="top">
        <button
          data-testid="button-project-settings"
          className="flex h-6 w-full items-center gap-1.5 px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/35 hover:text-foreground"
          onClick={() => setShowSettings(true)}
        >
          <Settings className="w-3.5 h-3.5 shrink-0 text-primary" />
          <span className="truncate font-medium">Project Settings</span>
        </button>
      </StyledTooltip>
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent
          data-testid="project-settings-dialog"
          className="w-[min(640px,calc(100vw-2rem))] max-w-[640px] border border-border bg-background/95 p-0"
        >
          <DialogHeader className="border-b border-border/60 px-3 py-1.5">
            <DialogTitle className="text-sm">Project Settings</DialogTitle>
            <DialogDescription className="sr-only">
              Edit project metadata, review project stats, and import or export the project file.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(68dvh,24rem)] space-y-2 overflow-y-auto px-3 pb-3 pt-2">
            <div className="space-y-1.5 rounded-sm border border-border/50 bg-muted/15 p-2">
              <label htmlFor="project-settings-name" className="block text-[11px] font-medium text-muted-foreground">Project Name</label>
              <input
                id="project-settings-name"
                data-testid="settings-name-input"
                type="text"
                value={settingsName}
                onChange={(e) => setSettingsName(e.target.value)}
                onBlur={saveSettings}
                onKeyDown={(e) => { if (e.key === 'Enter') { saveSettings(); } }}
                className="w-full border border-border/50 bg-background/70 px-2 py-1.5 text-xs text-foreground transition-colors focus-ring focus-visible:border-primary/50 focus-visible:outline-none"
              />
              <label htmlFor="project-settings-description" className="block pt-0.5 text-[11px] font-medium text-muted-foreground">Description</label>
              <textarea
                id="project-settings-description"
                data-testid="settings-desc-input"
                value={settingsDesc}
                onChange={(e) => setSettingsDesc(e.target.value)}
                onBlur={saveSettings}
                rows={2}
                className="w-full resize-none border border-border/50 bg-background/70 px-2 py-1.5 text-xs text-foreground transition-colors focus-ring focus-visible:border-primary/50 focus-visible:outline-none"
              />
              {settingsDirty && (
                <button
                  data-testid="settings-save-button"
                  className="flex h-7 w-full items-center justify-center gap-1 bg-primary px-3 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  onClick={saveSettings}
                >
                  <Check className="h-3 w-3" />
                  Save Changes
                </button>
              )}
              {settingsSaved && (
                <div className="flex items-center gap-1 text-[11px] text-green-400">
                  <Check className="h-3 w-3" />
                  Saved successfully
                </div>
              )}
            </div>

            <div className="space-y-1.5 rounded-sm border border-border/50 bg-muted/15 p-2">
              <div className="text-[11px] font-medium text-muted-foreground">Project Stats</div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-sm border border-border/50 bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{(nodes || []).length}</span> nodes
                </div>
                <div className="rounded-sm border border-border/50 bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{(edges || []).length}</span> edges
                </div>
                <div className="rounded-sm border border-border/50 bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{(bom || []).length}</span> BOM items
                </div>
                <div className="rounded-sm border border-border/50 bg-muted/20 px-2 py-1 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{(issues || []).length}</span> issues
                </div>
              </div>
            </div>

            <div className="space-y-1.5 rounded-sm border border-border/50 bg-muted/15 p-2">
              <div className="text-[11px] font-medium text-muted-foreground">Import / Export</div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  data-testid="button-export-project"
                  disabled={exporting}
                  className="flex h-7 items-center justify-center gap-1 border border-border/50 bg-muted/30 px-2.5 text-[11px] transition-colors hover:bg-muted/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleExport}
                >
                  <Download className="h-3 w-3" />
                  {exporting ? 'Exporting...' : 'Export'}
                </button>
                <button
                  data-testid="button-import-project"
                  disabled={importing}
                  className="flex h-7 items-center justify-center gap-1 border border-border/50 bg-muted/30 px-2.5 text-[11px] transition-colors hover:bg-muted/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3 w-3" />
                  {importing ? 'Importing...' : 'Import'}
                </button>
                <label htmlFor="project-import-file" className="sr-only">Import project file</label>
                <input
                  id="project-import-file"
                  ref={fileInputRef}
                  data-testid="input-import-file"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <div className="space-y-1 rounded-sm border border-border/50 bg-muted/15 p-2">
              <div className="text-[11px] font-medium text-muted-foreground">Version</div>
              <div
                className="cursor-pointer text-xs font-mono text-primary hover:underline"
                data-testid="text-version"
                onClick={() => {
                  copyToClipboard('ProtoPulse v1.0.0-alpha');
                  addOutputLog('[SYSTEM] Version info copied: ProtoPulse v1.0.0-alpha');
                }}
              >
                v1.0.0-alpha
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default ProjectSettingsPanel;
