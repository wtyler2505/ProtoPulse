import { memo, useCallback } from 'react';
import { Cpu, FileText, Package, Layers, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BUILT_IN_PROFILES } from '@/lib/export-profiles';
import type { ExportProfile } from '@/lib/export-profiles';

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const ICON_MAP: Record<ExportProfile['iconHint'], React.ComponentType<{ className?: string }>> = {
  cpu: Cpu,
  'file-text': FileText,
  package: Package,
  layers: Layers,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExportProfileSelectorProps {
  /** Called with the list of format IDs when a profile's "Export All" is clicked. */
  onExportProfile: (formatIds: readonly string[]) => void;
  /** Set of format IDs currently being exported (shown as loading). */
  exportingFormats?: ReadonlySet<string>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ExportProfileSelector({ onExportProfile, exportingFormats }: ExportProfileSelectorProps) {
  const handleClick = useCallback(
    (profile: ExportProfile) => {
      onExportProfile(profile.formatIds);
    },
    [onExportProfile],
  );

  return (
    <div data-testid="export-profile-selector" className="flex flex-col gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
        Quick Export Profiles
      </span>

      <div className="grid grid-cols-2 gap-2">
        {BUILT_IN_PROFILES.map((profile) => {
          const Icon = ICON_MAP[profile.iconHint];
          const isExporting =
            exportingFormats !== undefined &&
            profile.formatIds.some((fid) => exportingFormats.has(fid));

          return (
            <button
              key={profile.id}
              data-testid={`export-profile-${profile.id}`}
              className={cn(
                'flex flex-col items-start gap-1.5 p-2.5 border border-border/50 bg-card/30 backdrop-blur',
                'hover:bg-muted/30 hover:border-primary/30 transition-colors text-left focus-ring',
                isExporting && 'opacity-70 pointer-events-none',
              )}
              onClick={() => handleClick(profile)}
              disabled={isExporting}
              aria-label={`Export ${profile.label} profile`}
            >
              <div className="flex items-center gap-1.5 w-full">
                <Icon className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                <span className="text-xs font-medium text-foreground truncate">{profile.label}</span>
              </div>

              <p className="text-[10px] text-muted-foreground/70 leading-tight line-clamp-2">
                {profile.description}
              </p>

              <div className="flex items-center gap-1 mt-auto pt-1 text-[10px] text-primary/80 font-medium">
                {isExporting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3 h-3" />
                    <span>Export All ({profile.formatIds.length})</span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(ExportProfileSelector);
