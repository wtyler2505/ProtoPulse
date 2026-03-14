import { useState, useCallback, useMemo, useRef, memo } from 'react';
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
  AlertTriangle,
  Layers,
  FileCode,
  FileSpreadsheet,
  Drill,
  LayoutGrid,
  Box,
  Upload,
  History,
} from 'lucide-react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useOutput } from '@/lib/contexts/output-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { downloadBlob } from '@/lib/csv';
import { validateExportPreflight } from '@/lib/export-validation';
import { runExportPrecheck } from '@/lib/export-precheck';
import { generateImportPreview } from '@/lib/import-preview';
import ImportPreviewDialog from '@/components/panels/ImportPreviewDialog';
import ExportPrecheckPanel from '@/components/panels/ExportPrecheckPanel';
import ImportWarningsPanel from '@/components/panels/ImportWarningsPanel';
import ImportHistoryPanel from '@/components/panels/ImportHistoryPanel';
import ExportProfileSelector from '@/components/panels/ExportProfileSelector';
import { generateImportWarnings } from '@/lib/import-warnings';
import type { ImportWarning } from '@/lib/import-warnings';
import type { ProjectExportData } from '@/lib/export-validation';
import type { ImportPreview } from '@/lib/import-preview';
import type { ImportHistoryEntry } from '@/lib/import-history';
import type { ImportedDesign } from '@/lib/design-import';

const SESSION_KEY = 'protopulse-session-id';

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
      {
        id: 'odb-plus-plus',
        label: 'ODB++',
        extension: '.zip (ODB++ archive)',
        description: 'Industry-standard PCB manufacturing format (Siemens/Valor)',
        icon: Package,
        endpoint: '/export/odb-plus-plus',
        method: 'POST',
      },
      {
        id: 'ipc2581',
        label: 'IPC-2581',
        extension: '.xml (IPC-2581B)',
        description: 'Open standard XML-based PCB data exchange format',
        icon: FileCode,
        endpoint: '/export/ipc2581',
        method: 'POST',
      },
      {
        id: 'etchable-pcb',
        label: 'Etchable PCB (DIY)',
        extension: '.svg',
        description: 'High-contrast mirrored SVG for toner transfer or photoresist etching',
        icon: Drill,
        endpoint: '/export/etchable-pcb',
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
    id: '3d-cad',
    label: '3D & CAD',
    icon: Box,
    formats: [
      {
        id: 'step',
        label: 'STEP 3D Model (.step)',
        extension: '.step (ISO-10303)',
        description: 'ISO-10303 3D assembly for mechanical CAD (SolidWorks, FreeCAD, Fusion 360)',
        icon: Box,
        endpoint: '/export/step',
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
  const { projectName } = useProjectMeta();
  const { nodes } = useArchitecture();
  const { bom } = useBom();
  const { addOutputLog } = useOutput();
  const { toast } = useToast();

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    schematic: true,
    fabrication: true,
    documentation: true,
    '3d-cad': true,
    firmware: true,
  });

  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadState>>({});

  // -- Pre-check state --
  const [precheckFormatId, setPrecheckFormatId] = useState<string | null>(null);

  // -- Import preview state --
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const pendingImportDesignRef = useRef<ImportedDesign | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // -- Import warnings state --
  const [importWarnings, setImportWarnings] = useState<ImportWarning[]>([]);
  const [importWarningsFileName, setImportWarningsFileName] = useState('');

  // -- Import history state --
  const [importHistoryExpanded, setImportHistoryExpanded] = useState(false);

  // Build export validation data from available context
  const exportData: ProjectExportData = useMemo(() => ({
    projectName,
    hasSession: !!localStorage.getItem(SESSION_KEY),
    architectureNodeCount: nodes.length,
    hasCircuitInstances: false, // Conservative — no circuit context here
    hasPcbLayout: false,
    bomItemCount: bom.length,
    bomItemsWithPartNumber: bom.filter((item) => item.partNumber.trim().length > 0).length,
    hasCircuitSource: false,
    hasCircuitComponent: false,
    hasBoardProfile: false,
    bomItemsWithFailureData: 0,
  }), [projectName, nodes.length, bom]);

  // Pre-compute validation results for all formats
  const validationResults = useMemo(() => {
    const results: Record<string, ReturnType<typeof validateExportPreflight>> = {};
    for (const cat of EXPORT_CATEGORIES) {
      for (const fmt of cat.formats) {
        results[fmt.id] = validateExportPreflight(fmt.id, exportData);
      }
    }
    return results;
  }, [exportData]);

  const toggleCategory = useCallback((catId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  }, []);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setDownloadStates((prev) => ({ ...prev, [format.id]: 'loading' }));
    addOutputLog(`[EXPORT] Starting ${format.label} export...`);

    try {
      const url = `/api/projects/${projectId}${format.endpoint}`;
      const sessionId = localStorage.getItem(SESSION_KEY) ?? '';
      const res = await fetch(url, {
        method: format.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId,
        },
        body: JSON.stringify(format.body ?? {}),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(errorBody || `HTTP ${res.status}`);
      }

      const exportedFiles: string[] = [];

      if (format.jsonResponse) {
        // JSON response with file(s) or layer(s) array
        const json = await res.json() as Record<string, unknown>;

        // Handle `files` array (KiCad, Eagle, Firmware)
        const files = json.files as { filename: string; content: string }[] | undefined;
        if (files && Array.isArray(files)) {
          for (const file of files) {
            const blob = new Blob([file.content], { type: 'application/octet-stream' });
            downloadBlob(blob, file.filename);
            exportedFiles.push(file.filename);
          }
        }

        // Handle `layers` array (Gerber export)
        const layers = json.layers as { filename: string; content: string }[] | undefined;
        if (layers && Array.isArray(layers)) {
          for (const layer of layers) {
            const blob = new Blob([layer.content], { type: 'application/octet-stream' });
            downloadBlob(blob, layer.filename);
            exportedFiles.push(layer.filename);
          }
        }

        // Handle drill sub-object from Gerber export
        const drill = json.drill as { filename: string; content: string } | undefined;
        if (drill) {
          const blob = new Blob([drill.content], { type: 'application/octet-stream' });
          downloadBlob(blob, drill.filename);
          exportedFiles.push(drill.filename);
        }

        addOutputLog(`[EXPORT] Downloaded ${exportedFiles.length} file(s) for ${format.label}`);
      } else {
        // Raw content response (SPICE, CSV, SVG, FZZ ZIP, etc.)
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
        exportedFiles.push(filename);
        addOutputLog(`[EXPORT] Downloaded ${format.label}: ${filename}`);
      }

      setDownloadStates((prev) => ({ ...prev, [format.id]: 'success' }));
      toast({
        title: 'Export complete',
        description: exportedFiles.length > 1
          ? `${format.label}: ${exportedFiles.length} files exported (${exportedFiles.join(', ')})`
          : `${format.label} exported successfully.`,
      });

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

  // -- Pre-check aware export handler --
  // Flat lookup for format objects by id
  const formatById = useMemo(() => {
    const map: Record<string, ExportFormat> = {};
    for (const cat of EXPORT_CATEGORIES) {
      for (const fmt of cat.formats) {
        map[fmt.id] = fmt;
      }
    }
    return map;
  }, []);

  const handleExportClick = useCallback((format: ExportFormat) => {
    // Run precheck — if all pass, export immediately; otherwise show panel
    const precheck = runExportPrecheck(format.id, exportData);
    if (precheck.passed && precheck.warnings.length === 0) {
      void handleExport(format);
    } else {
      setPrecheckFormatId(format.id);
    }
  }, [exportData, handleExport]);

  const handlePrecheckExportAnyway = useCallback(() => {
    if (precheckFormatId) {
      const format = formatById[precheckFormatId];
      if (format) {
        void handleExport(format);
      }
    }
    setPrecheckFormatId(null);
  }, [precheckFormatId, formatById, handleExport]);

  const handlePrecheckClose = useCallback(() => {
    setPrecheckFormatId(null);
  }, []);

  // -- Profile export handler --

  const handleProfileExport = useCallback(
    (formatIds: readonly string[]) => {
      for (const fid of formatIds) {
        const format = formatById[fid];
        if (format) {
          void handleExport(format);
        }
      }
    },
    [formatById, handleExport],
  );

  const exportingFormats = useMemo(() => {
    const s = new Set<string>();
    for (const [id, state] of Object.entries(downloadStates)) {
      if (state === 'loading') {
        s.add(id);
      }
    }
    return s;
  }, [downloadStates]);

  // -- Import handlers --

  const handleImportFileSelect = useCallback(() => {
    const input = fileInputRef.current ?? document.createElement('input');
    input.type = 'file';
    input.accept = '.kicad_sch,.kicad_pcb,.sch,.brd,.SchDoc,.PcbDoc,.asc,.dsn,.net,.json';
    fileInputRef.current = input;

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }

      file.text().then((content) => {
        import('@/lib/design-import').then(({ DesignImporter }) => {
          const importer = DesignImporter.getInstance();
          const result = importer.importFile(content, file.name);

          if (result.status === 'complete' && result.design) {
            const projectData = {
              nodes: nodes.map((n) => ({
                id: n.id,
                data: { label: (n.data as Record<string, unknown>)?.label as string | undefined },
              })),
              edges: [],
              bomItems: bom.map((b) => ({
                partNumber: b.partNumber,
                description: b.description,
              })),
            };
            const preview = generateImportPreview(result.design, projectData);
            pendingImportDesignRef.current = result.design;
            setImportFileName(file.name);
            setImportPreview(preview);
            setImportDialogOpen(true);
          } else if (result.status === 'error') {
            toast({
              variant: 'destructive',
              title: 'Import failed',
              description: `${String(result.errorCount)} error(s) in "${file.name}". The file could not be parsed.`,
            });
          }
        }).catch(() => {
          toast({ variant: 'destructive', title: 'Import failed', description: 'Could not load the design import module.' });
        });
      }).catch(() => {
        toast({ variant: 'destructive', title: 'Import failed', description: 'Could not read the file.' });
      });

      // Reset so the same file can be re-selected
      input.value = '';
    };

    input.click();
  }, [nodes, bom, toast]);

  const handleImportApply = useCallback(() => {
    const design = pendingImportDesignRef.current;
    if (!design) {
      return;
    }

    import('@/lib/design-import').then(({ DesignImporter }) => {
      const importer = DesignImporter.getInstance();
      const proto = importer.convertToProtoPulse(design);
      addOutputLog(`[IMPORT] Applied import: ${String(proto.nodes.length)} nodes, ${String(proto.edges.length)} edges, ${String(proto.bomItems.length)} BOM items from "${importFileName}".`);
      toast({
        title: 'Design imported',
        description: `Added ${String(proto.nodes.length)} nodes, ${String(proto.edges.length)} edges, and ${String(proto.bomItems.length)} BOM items.`,
      });

      // Generate and display import warnings.
      const warnings = generateImportWarnings(design, design.format);
      setImportWarnings(warnings);
      setImportWarningsFileName(importFileName);
    }).catch(() => {
      toast({ variant: 'destructive', title: 'Import failed', description: 'Could not apply the import.' });
    });

    setImportDialogOpen(false);
    pendingImportDesignRef.current = null;
  }, [importFileName, addOutputLog, toast]);

  const handleImportCancel = useCallback(() => {
    setImportDialogOpen(false);
    pendingImportDesignRef.current = null;
  }, []);

  const handleImportHistoryRestore = useCallback((entry: ImportHistoryEntry) => {
    addOutputLog(`[IMPORT] Restoring import from history: "${entry.fileName}" (${entry.sourceFormat})`);
    toast({
      title: 'Import restored',
      description: `Restored "${entry.fileName}" from import history.`,
    });
  }, [addOutputLog, toast]);

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

      {/* Quick export profiles */}
      <ExportProfileSelector
        onExportProfile={handleProfileExport}
        exportingFormats={exportingFormats}
      />

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
                  const validation = validationResults[format.id];
                  const hasErrors = validation && !validation.canExport;
                  const hasWarnings = validation && validation.warnings.length > 0 && validation.canExport;
                  const tooltipLines: string[] = [];
                  if (hasErrors && validation) {
                    tooltipLines.push(...validation.errors);
                    tooltipLines.push(...validation.suggestions);
                  } else if (state === 'loading') {
                    tooltipLines.push('Exporting...');
                  } else {
                    if (hasWarnings && validation) {
                      tooltipLines.push(...validation.warnings);
                    }
                    tooltipLines.push(`Download ${format.label}`);
                  }

                  const showPrecheck = precheckFormatId === format.id;

                  return (
                    <div key={format.id}>
                      <div
                        data-testid={`export-format-${format.id}`}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 transition-colors group',
                          hasErrors ? 'opacity-60' : 'hover:bg-muted/20',
                        )}
                      >
                        <FormatIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground">{format.label}</span>
                            <span className="text-[10px] font-mono text-muted-foreground/60">{format.extension}</span>
                            {hasErrors && (
                              <StyledTooltip content={validation.errors.join(' | ')} side="top">
                                <span data-testid={`export-validation-${format.id}-error`}>
                                  <AlertCircle className="w-3 h-3 text-destructive" />
                                </span>
                              </StyledTooltip>
                            )}
                            {hasWarnings && validation && (
                              <StyledTooltip content={validation.warnings.join(' | ')} side="top">
                                <span data-testid={`export-validation-${format.id}-warning`}>
                                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                                </span>
                              </StyledTooltip>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5 line-clamp-1">{format.description}</p>
                        </div>

                        <StyledTooltip content={tooltipLines.join('\n')} side="left">
                          <button
                            data-testid={`export-download-${format.id}`}
                            className={cn(
                              'p-1.5 transition-colors shrink-0 focus-ring',
                              hasErrors && 'text-destructive/50 cursor-not-allowed ring-1 ring-destructive/30 rounded',
                              !hasErrors && state === 'idle' && 'text-muted-foreground hover:text-primary hover:bg-primary/10',
                              state === 'loading' && 'text-primary animate-pulse cursor-wait',
                              state === 'success' && 'text-green-400',
                              state === 'error' && 'text-destructive',
                            )}
                            onClick={() => handleExportClick(format)}
                            disabled={state === 'loading'}
                            aria-label={hasErrors ? `Pre-check ${format.label}: ${validation.errors[0] ?? 'missing data'}` : `Download ${format.label}`}
                          >
                            {state === 'idle' && <Download className="w-4 h-4" />}
                            {state === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
                            {state === 'success' && <CheckCircle2 className="w-4 h-4" />}
                            {state === 'error' && <AlertCircle className="w-4 h-4" />}
                          </button>
                        </StyledTooltip>
                      </div>
                      {showPrecheck && (
                        <div className="px-3 pb-2.5">
                          <ExportPrecheckPanel
                            format={format.id}
                            formatLabel={format.label}
                            projectData={exportData}
                            onExportAnyway={handlePrecheckExportAnyway}
                            onClose={handlePrecheckClose}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Import section */}
      <div className="border border-border/50 bg-card/30 backdrop-blur" data-testid="import-section">
        <div className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground">
          <Upload className="w-3.5 h-3.5 shrink-0 text-primary/70" />
          <span className="flex-1 text-left">Import Design</span>
        </div>
        <div className="border-t border-border/30 px-3 py-2.5">
          <p className="text-[10px] text-muted-foreground/70 leading-tight mb-2">
            Import a design file (KiCad, EAGLE, Altium, gEDA, LTspice, Proteus, OrCAD) with a preview of changes before applying.
          </p>
          <button
            data-testid="import-design-file-button"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-foreground bg-muted/30 hover:bg-muted/50 border border-border/50 rounded-sm transition-colors focus-ring"
            onClick={handleImportFileSelect}
          >
            <Upload className="w-3.5 h-3.5" />
            Choose File to Import
          </button>
        </div>
      </div>

      {/* Import warnings (shown after import completes) */}
      {importWarnings.length > 0 && (
        <ImportWarningsPanel
          warnings={importWarnings}
          fileName={importWarningsFileName}
          onDismiss={() => setImportWarnings([])}
        />
      )}

      {/* Import history (collapsible) */}
      <div className="border border-border/50 bg-card/30 backdrop-blur" data-testid="import-history-section">
        <button
          data-testid="import-history-toggle"
          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors focus-ring"
          onClick={() => setImportHistoryExpanded((prev) => !prev)}
          aria-expanded={importHistoryExpanded}
          aria-label={`${importHistoryExpanded ? 'Collapse' : 'Expand'} import history`}
        >
          {importHistoryExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
          <History className="w-3.5 h-3.5 shrink-0 text-primary/70" />
          <span className="flex-1 text-left">Import History</span>
        </button>
        {importHistoryExpanded && (
          <div className="border-t border-border/30">
            <ImportHistoryPanel onRestore={handleImportHistoryRestore} />
          </div>
        )}
      </div>

      {/* Import preview dialog */}
      <ImportPreviewDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        preview={importPreview}
        fileName={importFileName}
        onApply={handleImportApply}
        onCancel={handleImportCancel}
      />

      {/* Footer hint */}
      <p className="text-[10px] text-muted-foreground/50 text-center mt-auto pt-2">
        Exports use the active circuit design. Ensure your schematic has components placed before exporting.
      </p>
    </div>
  );
}

export default memo(ExportPanel);
