import { useState, useCallback, memo } from 'react';
import {
  Download,
  FileText,
  Cpu,
  CircuitBoard,
  Package,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  FileCode,
  FileSpreadsheet,
  Drill,
  LayoutGrid,
} from 'lucide-react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useOutput } from '@/lib/contexts/output-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { downloadBlob } from '@/lib/csv';

// ---------------------------------------------------------------------------
// Export format definitions
// ---------------------------------------------------------------------------

interface ExportFormat {
  id: string;
  label: string;
  extension: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  endpoint: string;
  method: 'POST';
  body?: Record<string, unknown>;
  /** When true the response is JSON with a `files` array instead of a raw blob. */
  jsonResponse?: boolean;
}

interface ExportCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  formats: ExportFormat[];
}

const EXPORT_CATEGORIES: ExportCategory[] = [
  {
    id: 'schematic',
    label: 'Schematic & Netlist',
    icon: CircuitBoard,
    formats: [
      {
        id: 'kicad',
        label: 'KiCad Project',
        extension: '.kicad_sch / .kicad_pcb / .kicad_pro',
        description: 'Full KiCad project bundle (schematic + PCB + project file)',
        icon: Layers,
        endpoint: '/export/kicad',
        method: 'POST',
        jsonResponse: true,
      },
      {
        id: 'eagle',
        label: 'Eagle Project',
        extension: '.sch / .brd (XML)',
        description: 'Autodesk Eagle schematic and board files',
        icon: Layers,
        endpoint: '/export/eagle',
        method: 'POST',
        jsonResponse: true,
      },
      {
        id: 'spice',
        label: 'SPICE Netlist',
        extension: '.cir',
        description: 'Circuit simulation netlist for LTspice, ngspice, etc.',
        icon: FileCode,
        endpoint: '/export/spice',
        method: 'POST',
      },
      {
        id: 'netlist-csv',
        label: 'Netlist (CSV)',
        extension: '.csv',
        description: 'Connectivity netlist in CSV format',
        icon: FileSpreadsheet,
        endpoint: '/export/netlist',
        method: 'POST',
        body: { netlistFormat: 'csv' },
      },
      {
        id: 'netlist-kicad',
        label: 'Netlist (KiCad)',
        extension: '.net',
        description: 'Connectivity netlist in KiCad S-expression format',
        icon: FileText,
        endpoint: '/export/netlist',
        method: 'POST',
        body: { netlistFormat: 'kicad' },
      },
    ],
  },
  {
    id: 'fabrication',
    label: 'PCB Fabrication',
    icon: Cpu,
    formats: [
      {
        id: 'gerber',
        label: 'Gerber + Drill',
        extension: '.gbr / .drl (RS-274X + Excellon)',
        description: 'Manufacturing files: copper layers, solder mask, silkscreen, and drill',
        icon: LayoutGrid,
        endpoint: '/export/gerber',
        method: 'POST',
        jsonResponse: true,
      },
      {
        id: 'pick-place',
        label: 'Pick-and-Place',
        extension: '.csv',
        description: 'SMT assembly placement file with X/Y coordinates and rotation',
        icon: FileSpreadsheet,
        endpoint: '/export/pick-place',
        method: 'POST',
      },
    ],
  },
  {
    id: 'documentation',
    label: 'Documentation & BOM',
    icon: Package,
    formats: [
      {
        id: 'bom-csv',
        label: 'BOM (CSV)',
        extension: '.csv',
        description: 'Bill of materials with part numbers, quantities, and pricing',
        icon: FileSpreadsheet,
        endpoint: '/export/bom',
        method: 'POST',
        body: { format: 'csv' },
      },
      {
        id: 'fzz',
        label: 'Fritzing Project',
        extension: '.fzz',
        description: 'Full Fritzing project archive',
        icon: Layers,
        endpoint: '/export/fzz',
        method: 'POST',
        jsonResponse: true,
      },
      {
        id: 'pdf',
        label: 'Design Report (PDF)',
        extension: '.pdf',
        description: 'Comprehensive design report with architecture, BOM, validation, and circuits',
        icon: FileText,
        endpoint: '/export/report-pdf',
        method: 'POST',
      },
      {
        id: 'fmea',
        label: 'FMEA Report',
        extension: '.csv',
        description: 'Failure Mode and Effects Analysis with risk priority numbers',
        icon: FileSpreadsheet,
        endpoint: '/export/fmea',
        method: 'POST',
      },
    ],
  },
  {
    id: 'firmware',
    label: 'Firmware',
    icon: Cpu,
    formats: [
      {
        id: 'firmware',
        label: 'Firmware Scaffold',
        extension: '.cpp / .h / .ini',
        description: 'Arduino/PlatformIO starter code generated from architecture',
        icon: FileCode,
        endpoint: '/export/firmware',
        method: 'POST',
        jsonResponse: true,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Per-format download state
// ---------------------------------------------------------------------------

type DownloadState = 'idle' | 'loading' | 'success' | 'error';

// ---------------------------------------------------------------------------
// ExportPanel component
// ---------------------------------------------------------------------------

function ExportPanel() {
  const projectId = useProjectId();
  const { addOutputLog } = useOutput();
  const { toast } = useToast();

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    schematic: true,
    fabrication: true,
    documentation: true,
    firmware: true,
  });

  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadState>>({});

  const toggleCategory = useCallback((catId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  }, []);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setDownloadStates((prev) => ({ ...prev, [format.id]: 'loading' }));
    addOutputLog(`[EXPORT] Starting ${format.label} export...`);

    try {
      const url = `/api/projects/${projectId}${format.endpoint}`;
      const res = await fetch(url, {
        method: format.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(format.body ?? {}),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(errorBody || `HTTP ${res.status}`);
      }

      if (format.jsonResponse) {
        // JSON response with file(s) array
        const json = await res.json() as Record<string, unknown>;

        // Handle `files` array (KiCad, Eagle, Gerber)
        const files = json.files as { filename: string; content: string }[] | undefined;
        if (files && Array.isArray(files)) {
          for (const file of files) {
            const blob = new Blob([file.content], { type: 'application/octet-stream' });
            downloadBlob(blob, file.filename);
          }
          addOutputLog(`[EXPORT] Downloaded ${files.length} file(s) for ${format.label}`);
        }

        // Handle drill sub-object from Gerber export
        const drill = json.drill as { filename: string; content: string } | undefined;
        if (drill) {
          const blob = new Blob([drill.content], { type: 'application/octet-stream' });
          downloadBlob(blob, drill.filename);
        }
      } else {
        // Raw content response (SPICE, CSV, SVG, etc.)
        const contentDisposition = res.headers.get('Content-Disposition');
        let filename = `export${format.extension.split('/')[0].split('(')[0].trim()}`;
        if (contentDisposition) {
          const match = /filename="?([^";\n]+)"?/.exec(contentDisposition);
          if (match) {
            filename = match[1];
          }
        }
        const blob = await res.blob();
        downloadBlob(blob, filename);
        addOutputLog(`[EXPORT] Downloaded ${format.label}: ${filename}`);
      }

      setDownloadStates((prev) => ({ ...prev, [format.id]: 'success' }));
      toast({ title: 'Export complete', description: `${format.label} exported successfully.` });

      // Reset success state after 3 seconds
      setTimeout(() => {
        setDownloadStates((prev) => ({ ...prev, [format.id]: 'idle' }));
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setDownloadStates((prev) => ({ ...prev, [format.id]: 'error' }));
      addOutputLog(`[EXPORT] Failed ${format.label}: ${message}`);
      toast({ title: 'Export failed', description: message, variant: 'destructive' });

      setTimeout(() => {
        setDownloadStates((prev) => ({ ...prev, [format.id]: 'idle' }));
      }, 5000);
    }
  }, [projectId, addOutputLog, toast]);

  return (
    <div className="h-full w-full bg-background/80 backdrop-blur p-4 overflow-auto flex flex-col gap-4" data-testid="export-panel">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-display font-bold text-foreground tracking-wide">EXPORT CENTER</h2>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground border-border pointer-events-none select-none" data-testid="label-export-format-count">
          {EXPORT_CATEGORIES.reduce((sum, cat) => sum + cat.formats.length, 0)} formats
        </Badge>
      </div>

      {/* Categories */}
      {EXPORT_CATEGORIES.map((category) => {
        const CatIcon = category.icon;
        const isExpanded = expandedCategories[category.id] !== false;

        return (
          <div key={category.id} data-testid={`export-category-${category.id}`} className="border border-border/50 bg-card/30 backdrop-blur">
            {/* Category header */}
            <button
              data-testid={`export-category-toggle-${category.id}`}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors focus-ring"
              onClick={() => toggleCategory(category.id)}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${category.label}`}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
              <CatIcon className="w-3.5 h-3.5 shrink-0 text-primary/70" />
              <span className="flex-1 text-left">{category.label}</span>
              <span className="text-[10px] font-mono bg-muted/50 px-1.5 py-0.5 tabular-nums">
                {category.formats.length}
              </span>
            </button>

            {/* Format list */}
            {isExpanded && (
              <div className="border-t border-border/30 divide-y divide-border/20">
                {category.formats.map((format) => {
                  const state = downloadStates[format.id] ?? 'idle';
                  const FormatIcon = format.icon;

                  return (
                    <div
                      key={format.id}
                      data-testid={`export-format-${format.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/20 transition-colors group"
                    >
                      <FormatIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">{format.label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground/60">{format.extension}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5 line-clamp-1">{format.description}</p>
                      </div>

                      <StyledTooltip content={state === 'loading' ? 'Exporting...' : `Download ${format.label}`} side="left">
                        <button
                          data-testid={`export-download-${format.id}`}
                          className={cn(
                            'p-1.5 transition-colors shrink-0 focus-ring',
                            state === 'idle' && 'text-muted-foreground hover:text-primary hover:bg-primary/10',
                            state === 'loading' && 'text-primary animate-pulse cursor-wait',
                            state === 'success' && 'text-green-400',
                            state === 'error' && 'text-destructive',
                          )}
                          onClick={() => handleExport(format)}
                          disabled={state === 'loading'}
                          aria-label={`Download ${format.label}`}
                        >
                          {state === 'idle' && <Download className="w-4 h-4" />}
                          {state === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
                          {state === 'success' && <CheckCircle2 className="w-4 h-4" />}
                          {state === 'error' && <AlertCircle className="w-4 h-4" />}
                        </button>
                      </StyledTooltip>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Footer hint */}
      <p className="text-[10px] text-muted-foreground/50 text-center mt-auto pt-2">
        Exports use the active circuit design. Ensure your schematic has components placed before exporting.
      </p>
    </div>
  );
}

export default memo(ExportPanel);
