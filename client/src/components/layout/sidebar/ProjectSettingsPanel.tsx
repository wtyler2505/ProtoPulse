import { useState, useEffect } from 'react';
import { Check, Settings } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { copyToClipboard } from '@/lib/clipboard';
import { SETTINGS_SAVE_FEEDBACK_DURATION } from '@/components/panels/chat/constants';
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

export default function ProjectSettingsPanel({
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
  const [showSettings, setShowSettings] = useState(false);
  const [settingsName, setSettingsName] = useState(projectName);
  const [settingsDesc, setSettingsDesc] = useState(projectDescription);
  const [settingsSaved, setSettingsSaved] = useState(false);

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

  return (
    <div className="p-3 border-t border-sidebar-border bg-sidebar/20">
      <StyledTooltip content="Open project settings" side="right">
        <button
          data-testid="button-project-settings"
          className="w-full flex items-center gap-2 p-2 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings className="w-4 h-4" />
          <span className="text-xs font-medium">Project Settings</span>
        </button>
      </StyledTooltip>
      {showSettings && (
        <div className="px-3 pb-3 space-y-2 border-t border-border pt-2 mt-1 bg-muted/10 backdrop-blur">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Project Name</div>
          <input
            data-testid="settings-name-input"
            type="text"
            value={settingsName}
            onChange={(e) => setSettingsName(e.target.value)}
            onBlur={saveSettings}
            onKeyDown={(e) => { if (e.key === 'Enter') saveSettings(); }}
            className="w-full text-xs bg-muted/30 border border-border/50 px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50 transition-colors"
          />
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-2">Description</div>
          <textarea
            data-testid="settings-desc-input"
            value={settingsDesc}
            onChange={(e) => setSettingsDesc(e.target.value)}
            onBlur={saveSettings}
            rows={2}
            className="w-full text-xs bg-muted/30 border border-border/50 px-2 py-1.5 text-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
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
}
