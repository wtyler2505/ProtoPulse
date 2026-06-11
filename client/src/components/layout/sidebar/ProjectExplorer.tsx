/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
import { useState, useCallback, memo, type Dispatch, type SetStateAction } from 'react';
import type { GraphNode } from '@/lib/graph-types';
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
      className={cn(
        "flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-muted-foreground hover:bg-muted/30 hover:text-foreground focus-ring group cursor-pointer",
        hasChildren && expanded && "bg-muted/20 text-foreground",
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {hasChildren ? (
        expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />
      ) : (
        <span className="w-3 shrink-0" />
      )}
      <Icon className="w-3 h-3 shrink-0 text-muted-foreground/70" />
      <span
        data-testid={`explorer-nav-${config.key}`}
        className="flex-1 cursor-pointer truncate text-[11px] leading-5 hover:text-primary"
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
        className="rounded-sm bg-destructive/20 px-1 py-0.5 text-[11px] font-medium tabular-nums text-destructive"
        >
          {severityCounts.error}
        </span>
      ) : null}
      {severityCounts && severityCounts.warning > 0 ? (
        <span
          data-testid={`explorer-badge-${config.key}-warnings`}
        className="rounded-sm bg-yellow-500/20 px-1 py-0.5 text-[11px] font-medium tabular-nums text-yellow-500"
        >
          {severityCounts.warning}
        </span>
      ) : null}
      <span
        data-testid={`explorer-badge-${config.key}`}
        className="ml-auto rounded-sm bg-muted/50 px-1 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
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
  nodes: GraphNode[];
  bom: BomItem[];
  issues: ValidationIssue[];
  searchQuery: string;
  selectedNodeId: string | null;
  expandedCategories: Record<string, boolean>;
  setExpandedCategories: Dispatch<SetStateAction<Record<string, boolean>>>;
  focusNode: (id: string) => void;
  setNodes: (nodes: GraphNode[]) => void;
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
    <div data-testid="project-explorer" className="mt-0.5 space-y-0.5">
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
              <div className="pl-2.5">
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
