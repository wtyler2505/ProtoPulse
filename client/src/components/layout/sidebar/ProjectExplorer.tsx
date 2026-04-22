import { useState, useCallback, memo, type Dispatch, type SetStateAction } from 'react';
import type { Node } from '@xyflow/react';
import {
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  CircuitBoard,
  Cpu,
  Package,
  AlertTriangle,
  Grid3X3,
  Microchip,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectId, useProjectMeta } from '@/lib/project-context';
import type { BomItem, ValidationIssue, ViewMode } from '@/lib/project-context';
import { useCircuitDesigns } from '@/lib/circuit-editor/hooks';
import ComponentTree from './ComponentTree';

// ---------------------------------------------------------------------------
// Section configuration
// ---------------------------------------------------------------------------

interface SectionConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  view: ViewMode;
}

const SECTIONS: SectionConfig[] = [
  { key: 'architecture', label: 'Architecture', icon: LayoutGrid, view: 'architecture' },
  { key: 'schematics', label: 'Schematics', icon: CircuitBoard, view: 'schematic' },
  { key: 'pcb', label: 'PCB Layout', icon: Microchip, view: 'pcb' },
  { key: 'components', label: 'Components', icon: Cpu, view: 'component_editor' },
  { key: 'bom', label: 'Bill of Materials', icon: Package, view: 'procurement' },
  { key: 'validation', label: 'Validation', icon: AlertTriangle, view: 'validation' },
];

// ---------------------------------------------------------------------------
// SectionHeader — collapsible row with count badge + view navigation
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  config: SectionConfig;
  count: number;
  expanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  severityCounts?: { error: number; warning: number };
}

function SectionHeader({ config, count, expanded, hasChildren, onToggle, onNavigate, severityCounts }: SectionHeaderProps) {
  const Icon = config.icon;

  const handleClick = () => {
    if (hasChildren) {
      onToggle();
    } else {
      onNavigate();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      data-testid={`explorer-section-${config.key}`}
      role="button"
      tabIndex={0}
      aria-label={hasChildren ? (expanded ? `Collapse ${config.label}` : `Expand ${config.label}`) : `Navigate to ${config.label}`}
      aria-expanded={hasChildren ? expanded : undefined}
      className="px-4 py-1.5 flex items-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted/50 focus-ring group"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {hasChildren ? (
        expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />
      ) : (
        <span className="w-3 shrink-0" />
      )}
      <Icon className="w-3 h-3 shrink-0" />
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions -- Phase 3 InteractiveCard migration (Plan 03-a11y-systemic) */}
      <span
        data-testid={`explorer-nav-${config.key}`}
        className="text-xs flex-1 truncate hover:text-primary cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate();
        }}
      >
        {config.label}
      </span>
      {severityCounts && severityCounts.error > 0 ? (
        <span
          data-testid={`explorer-badge-${config.key}-errors`}
          className="text-[10px] font-medium bg-destructive/20 text-destructive px-1.5 py-0.5 tabular-nums"
        >
          {severityCounts.error}
        </span>
      ) : null}
      {severityCounts && severityCounts.warning > 0 ? (
        <span
          data-testid={`explorer-badge-${config.key}-warnings`}
          className="text-[10px] font-medium bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 tabular-nums"
        >
          {severityCounts.warning}
        </span>
      ) : null}
      <span
        data-testid={`explorer-badge-${config.key}`}
        className="text-[10px] font-medium bg-muted/50 text-muted-foreground px-1.5 py-0.5 ml-auto tabular-nums"
      >
        {count}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProjectExplorer — main exported component
// ---------------------------------------------------------------------------

interface ProjectExplorerProps {
  nodes: Node[];
  bom: BomItem[];
  issues: ValidationIssue[];
  searchQuery: string;
  selectedNodeId: string | null;
  expandedCategories: Record<string, boolean>;
  setExpandedCategories: Dispatch<SetStateAction<Record<string, boolean>>>;
  focusNode: (id: string) => void;
  setNodes: (nodes: Node[]) => void;
  addOutputLog: (msg: string) => void;
}

function ProjectExplorer({
  nodes,
  bom,
  issues,
  searchQuery,
  selectedNodeId,
  expandedCategories,
  setExpandedCategories,
  focusNode,
  setNodes,
  addOutputLog,
}: ProjectExplorerProps) {
  const { setActiveView } = useProjectMeta();
  const projectId = useProjectId();
  const circuitDesignsQuery = useCircuitDesigns(projectId);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    architecture: true,
  });

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const navigateToView = useCallback(
    (view: ViewMode) => {
      setActiveView(view);
    },
    [setActiveView],
  );

  // Compute counts
  const nodeCount = (nodes ?? []).length;
  const schematicCount = circuitDesignsQuery.data?.length ?? 0;
  const bomCount = (bom ?? []).length;
  const issueCount = (issues ?? []).length;
  const errorCount = (issues ?? []).filter((i) => i.severity === 'error').length;
  const warningCount = (issues ?? []).filter((i) => i.severity === 'warning').length;

  const getCounts = (key: string): number => {
    switch (key) {
      case 'architecture':
        return nodeCount;
      case 'schematics':
        return schematicCount;
      case 'pcb':
        return schematicCount; // PCB layouts map to circuit designs
      case 'components':
        return nodeCount;
      case 'bom':
        return bomCount;
      case 'validation':
        return issueCount;
      default:
        return 0;
    }
  };

  const hasChildren = (key: string): boolean => {
    return key === 'architecture';
  };

  return (
    <div data-testid="project-explorer" className="mt-2 space-y-0.5">
      {SECTIONS.map((section) => {
        const expanded = expandedSections[section.key] === true;
        const count = getCounts(section.key);

        return (
          <div key={section.key}>
            <SectionHeader
              config={section}
              count={count}
              expanded={expanded}
              hasChildren={hasChildren(section.key)}
              onToggle={() => toggleSection(section.key)}
              onNavigate={() => navigateToView(section.view)}
              severityCounts={section.key === 'validation' ? { error: errorCount, warning: warningCount } : undefined}
            />
            {section.key === 'architecture' && expanded && (
              <div className="pl-2">
                <ComponentTree
                  nodes={nodes}
                  searchQuery={searchQuery}
                  selectedNodeId={selectedNodeId}
                  expandedCategories={expandedCategories}
                  setExpandedCategories={setExpandedCategories}
                  focusNode={focusNode}
                  setNodes={setNodes}
                  addOutputLog={addOutputLog}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(ProjectExplorer);
