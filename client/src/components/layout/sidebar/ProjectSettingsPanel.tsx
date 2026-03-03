import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Check, Settings, Download, Upload } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { copyToClipboard } from '@/lib/clipboard';
import { SETTINGS_SAVE_FEEDBACK_DURATION } from '@/components/panels/chat/constants';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Node, Edge } from '@xyflow/react';
import type { BomItem, ValidationIssue } from '@/lib/project-context';

interface ProjectSettingsPanelProps {
  projectName: string;
  setProjectName: (name: string) => void;
  projectDescription: string;
  setProjectDescription: (desc: string) => void;
  nodes: Node[];
  edges: Edge[];
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
    <div className="p-3 border-t border-border bg-sidebar/20">
      <StyledTooltip content="Open project settings" side="right">
        <button
          data-testid="button-project-settings"
          className="w-full flex items-center gap-2 p-2 bg-muted/30 border border-border/50 hover:bg-muted/50 text-foreground hover:text-primary transition-colors"
          onClick={() => setShowSettings(!showSettings)}
        >
          <div className="w-6 h-6 flex items-center justify-center bg-primary/10 border border-primary/20">
            <Settings className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-medium">Project Settings</span>
        </button>
      </StyledTooltip>
      {showSettings && (
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2 mt-1 bg-muted/10 backdrop-blur">
          <label htmlFor="project-settings-name" className="text-[10px] text-muted-foreground uppercase tracking-wider block">Project Name</label>
          <input
            id="project-settings-name"
            data-testid="settings-name-input"
            type="text"
            value={settingsName}
            onChange={(e) => setSettingsName(e.target.value)}
            onBlur={saveSettings}
            onKeyDown={(e) => { if (e.key === 'Enter') { saveSettings(); } }}
            className="w-full text-xs bg-muted/30 border border-border/50 px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50 transition-colors focus-ring"
          />
          <label htmlFor="project-settings-description" className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2 block">Description</label>
          <textarea
            id="project-settings-description"
            data-testid="settings-desc-input"
            value={settingsDesc}
            onChange={(e) => setSettingsDesc(e.target.value)}
            onBlur={saveSettings}
            rows={2}
            className="w-full text-xs bg-muted/30 border border-border/50 px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none focus-ring"
          />
          {settingsDirty && (
            <button
              data-testid="settings-save-button"
              className="w-full text-xs bg-primary text-primary-foreground py-1.5 px-3 hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
              onClick={saveSettings}
            >
              <Check className="w-3 h-3" />
              Save Changes
            </button>
          )}
          {settingsSaved && (
            <div className="text-xs text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Saved successfully
            </div>
          )}
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-3">Stats</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{(nodes || []).length}</span> nodes
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{(edges || []).length}</span> edges
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{(bom || []).length}</span> BOM items
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{(issues || []).length}</span> issues
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-3">Import / Export</div>
          <div className="flex gap-2">
            <button
              data-testid="button-export-project"
              disabled={exporting}
              className="flex-1 text-xs bg-muted/30 border border-border/50 py-1.5 px-3 hover:bg-muted/50 hover:text-primary transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleExport}
            >
              <Download className="w-3 h-3" />
              {exporting ? 'Exporting...' : 'Export'}
            </button>
            <button
              data-testid="button-import-project"
              disabled={importing}
              className="flex-1 text-xs bg-muted/30 border border-border/50 py-1.5 px-3 hover:bg-muted/50 hover:text-primary transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-3 h-3" />
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

          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2">Version</div>
          <div
            className="text-xs font-mono text-primary cursor-pointer hover:underline"
            data-testid="text-version"
            onClick={() => {
              copyToClipboard('ProtoPulse v1.0.0-alpha');
              addOutputLog('[SYSTEM] Version info copied: ProtoPulse v1.0.0-alpha');
            }}
          >v1.0.0-alpha</div>
        </div>
      )}
    </div>
  );
});

export default ProjectSettingsPanel;
