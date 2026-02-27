/**
 * ExportPanel — Unified Export UI (Phase 12.11)
 *
 * Provides categorized export options for manufacturing files,
 * EDA tool interoperability, and documentation outputs.
 */

import { useState, useCallback } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { apiRequest } from '@/lib/queryClient';
import {
  Download,
  FileText,
  Cpu,
  Package,
  Factory,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExportStatus = 'idle' | 'loading' | 'success' | 'error';

interface ExportAction {
  id: string;
  label: string;
  description: string;
  endpoint: string;
  body?: Record<string, unknown>;
  fileType?: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresDrc?: boolean;
}

interface ExportCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  actions: ExportAction[];
}

// ---------------------------------------------------------------------------
// Export Definitions
// ---------------------------------------------------------------------------

const EXPORT_CATEGORIES: ExportCategory[] = [
  {
    id: 'manufacturing',
    label: 'Manufacturing',
    icon: Factory,
    actions: [
      {
        id: 'gerber',
        label: 'Gerber (RS-274X)',
        description: 'PCB fabrication files — copper, mask, silk, paste, outline + drill',
        endpoint: '/export/gerber',
        icon: Cpu,
        requiresDrc: true,
      },
      {
        id: 'bom-jlcpcb',
        label: 'BOM — JLCPCB',
        description: 'Bill of materials in JLCPCB assembly format',
        endpoint: '/export/bom',
        body: { bomFormat: 'jlcpcb' },
        fileType: 'csv',
        icon: Package,
      },
      {
        id: 'bom-mouser',
        label: 'BOM — Mouser',
        description: 'Bill of materials in Mouser ordering format',
        endpoint: '/export/bom',
        body: { bomFormat: 'mouser' },
        fileType: 'csv',
        icon: Package,
      },
      {
        id: 'bom-digikey',
        label: 'BOM — Digi-Key',
        description: 'Bill of materials in Digi-Key ordering format',
        endpoint: '/export/bom',
        body: { bomFormat: 'digikey' },
        fileType: 'csv',
        icon: Package,
      },
      {
        id: 'bom-generic',
        label: 'BOM — Generic CSV',
        description: 'Full BOM with all fields',
        endpoint: '/export/bom',
        body: { bomFormat: 'generic' },
        fileType: 'csv',
        icon: Package,
      },
      {
        id: 'pick-place',
        label: 'Pick & Place',
        description: 'SMT assembly placement file',
        endpoint: '/export/pick-place',
        fileType: 'csv',
        icon: Cpu,
        requiresDrc: true,
      },
    ],
  },
  {
    id: 'interop',
    label: 'Interoperability',
    icon: FileText,
    actions: [
      {
        id: 'kicad',
        label: 'KiCad Project',
        description: '.kicad_sch + .kicad_pcb + .kicad_pro (KiCad 7+)',
        endpoint: '/export/kicad',
        icon: FileText,
      },
      {
        id: 'eagle',
        label: 'Eagle Project',
        description: '.sch + .brd (Autodesk Fusion Electronics / Eagle)',
        endpoint: '/export/eagle',
        icon: FileText,
      },
      {
        id: 'fzz',
        label: 'Fritzing Project (.fzz)',
        description: 'Fritzing full project archive',
        endpoint: '/export/fzz',
        icon: FileText,
      },
      {
        id: 'netlist-spice',
        label: 'Netlist — SPICE',
        description: 'SPICE netlist for simulation',
        endpoint: '/export/netlist',
        body: { netlistFormat: 'spice' },
        fileType: 'cir',
        icon: FileText,
      },
      {
        id: 'netlist-kicad',
        label: 'Netlist — KiCad',
        description: 'KiCad S-expression netlist',
        endpoint: '/export/netlist',
        body: { netlistFormat: 'kicad' },
        fileType: 'net',
        icon: FileText,
      },
      {
        id: 'netlist-csv',
        label: 'Netlist — CSV',
        description: 'Generic CSV netlist',
        endpoint: '/export/netlist',
        body: { netlistFormat: 'csv' },
        fileType: 'csv',
        icon: FileText,
      },
    ],
  },
  {
    id: 'documentation',
    label: 'Documentation',
    icon: Download,
    actions: [
      {
        id: 'pdf-schematic',
        label: 'PDF — Schematic',
        description: 'Schematic view with title block and border',
        endpoint: '/export/pdf',
        body: { viewData: { type: 'schematic', instances: [], wires: [], labels: [], bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 } } },
        fileType: 'svg',
        icon: FileText,
      },
      {
        id: 'pdf-pcb',
        label: 'PDF — PCB Layout',
        description: 'PCB layout view (composite or per-layer)',
        endpoint: '/export/pdf',
        body: { viewData: { type: 'pcb', layers: [], instances: [], traces: [], boardOutline: [], boardWidth: 50, boardHeight: 40, renderMode: 'composite' } },
        fileType: 'svg',
        icon: FileText,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Download Helper
// ---------------------------------------------------------------------------

function downloadBlob(data: string | ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function ExportButton({
  action,
  projectId,
  status,
  onStatusChange,
  onError,
}: {
  action: ExportAction;
  projectId: number;
  status: ExportStatus;
  onStatusChange: (id: string, status: ExportStatus) => void;
  onError: (id: string, message: string) => void;
}) {
  const isLoading = status === 'loading';
  const Icon = action.icon;

  const handleExport = useCallback(async () => {
    onStatusChange(action.id, 'loading');
    try {
      const url = `/api/projects/${projectId}${action.endpoint}`;
      const response = await apiRequest('POST', url, action.body || {});

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/csv') || contentType.includes('text/plain') || contentType.includes('image/svg+xml')) {
        // Direct file download
        const text = await response.text();
        const ext = action.fileType || 'txt';
        const mime = contentType.includes('csv') ? 'text/csv' : contentType.includes('svg') ? 'image/svg+xml' : 'text/plain';
        downloadBlob(text, `${action.id}.${ext}`, mime);
      } else if (contentType.includes('application/zip')) {
        // Binary download (FZZ)
        const buffer = await response.arrayBuffer();
        downloadBlob(buffer, `export.fzz`, 'application/zip');
      } else {
        // JSON response — may contain multiple files
        const json = await response.json();

        if (json.files && Array.isArray(json.files)) {
          // Multi-file export (KiCad, Eagle)
          for (const file of json.files) {
            downloadBlob(file.content, file.filename, 'text/plain');
          }
        } else if (json.layers) {
          // Gerber package — download each layer + drill
          for (const layer of json.layers) {
            downloadBlob(layer.content, layer.filename, 'text/plain');
          }
          if (json.drill) {
            downloadBlob(json.drill.content, json.drill.filename, 'text/plain');
          }
        }
      }

      onStatusChange(action.id, 'success');
      setTimeout(() => onStatusChange(action.id, 'idle'), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      onError(action.id, message);
      onStatusChange(action.id, 'error');
      setTimeout(() => onStatusChange(action.id, 'idle'), 5000);
    }
  }, [action, projectId, onStatusChange, onError]);

  return (
    <button
      data-testid={`export-${action.id}`}
      onClick={handleExport}
      disabled={isLoading}
      className={cn(
        'w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left',
        'hover:bg-muted/50 hover:border-primary/30',
        status === 'success' && 'border-green-500/30 bg-green-500/5',
        status === 'error' && 'border-red-500/30 bg-red-500/5',
        isLoading && 'opacity-70 cursor-wait',
      )}
    >
      <div className="mt-0.5 shrink-0">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        ) : status === 'success' ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : status === 'error' ? (
          <AlertTriangle className="w-4 h-4 text-red-500" />
        ) : (
          <Icon className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{action.label}</span>
          {action.requiresDrc && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              DRC Required
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
      </div>
      <Download className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1" />
    </button>
  );
}

function CategorySection({
  category,
  projectId,
  statuses,
  onStatusChange,
  onError,
}: {
  category: ExportCategory;
  projectId: number;
  statuses: Record<string, ExportStatus>;
  onStatusChange: (id: string, status: ExportStatus) => void;
  onError: (id: string, message: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const Icon = category.icon;

  return (
    <div data-testid={`export-category-${category.id}`} className="border rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-3 hover:bg-muted/30 transition-colors"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{category.label}</span>
        <span className="text-xs text-muted-foreground ml-auto">{category.actions.length} formats</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {category.actions.map(action => (
            <ExportButton
              key={action.id}
              action={action}
              projectId={projectId}
              status={statuses[action.id] || 'idle'}
              onStatusChange={onStatusChange}
              onError={onError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ExportPanel() {
  const projectId = useProjectId();
  const [statuses, setStatuses] = useState<Record<string, ExportStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleStatusChange = useCallback((id: string, status: ExportStatus) => {
    setStatuses(prev => ({ ...prev, [id]: status }));
  }, []);

  const handleError = useCallback((id: string, message: string) => {
    setErrors(prev => ({ ...prev, [id]: message }));
  }, []);

  return (
    <div data-testid="export-panel" className="h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Download className="w-4 h-4 text-primary" />
          Export Design
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Generate manufacturing files, EDA project exports, and documentation.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {EXPORT_CATEGORIES.map(category => (
          <CategorySection
            key={category.id}
            category={category}
            projectId={projectId}
            statuses={statuses}
            onStatusChange={handleStatusChange}
            onError={handleError}
          />
        ))}
      </div>

      {/* Error display */}
      {Object.keys(errors).length > 0 && (
        <div className="p-3 border-t bg-red-500/5">
          {Object.entries(errors).map(([id, message]) => (
            statuses[id] === 'error' && (
              <div key={id} className="flex items-start gap-2 text-xs text-red-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
