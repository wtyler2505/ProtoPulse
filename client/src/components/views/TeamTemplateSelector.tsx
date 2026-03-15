import { useState, useCallback } from 'react';
import {
  Cpu,
  Zap,
  Activity,
  Radio,
  GraduationCap,
  Search,
  Check,
  ChevronRight,
  Layers,
  FileText,
  Shield,
  Tag,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  BUILT_IN_TEMPLATES,
  TeamTemplateManager,
  TEMPLATE_CATEGORIES,
} from '@/lib/team-templates';
import type { TeamTemplate, TemplateCategory, AppliedTemplate } from '@/lib/team-templates';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Cpu,
  Zap,
  Activity,
  Radio,
  GraduationCap,
};

function getTemplateIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconName] ?? Cpu;
}

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  general: 'text-blue-400',
  power: 'text-yellow-400',
  sensor: 'text-green-400',
  rf: 'text-purple-400',
  educational: 'text-cyan-400',
};

interface TemplateCardProps {
  template: TeamTemplate;
  selected: boolean;
  onSelect: (template: TeamTemplate) => void;
}

function TemplateCard({ template, selected, onSelect }: TemplateCardProps) {
  const Icon = getTemplateIcon(template.icon);
  const colorClass = CATEGORY_COLORS[template.category];

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 border',
        selected
          ? 'border-[var(--accent-primary,#00F0FF)] shadow-[0_0_12px_rgba(0,240,255,0.2)] bg-[var(--accent-primary,#00F0FF)]/5'
          : 'border-border bg-card hover:border-muted-foreground/50',
      )}
      data-testid={`template-card-${template.id}`}
      onClick={() => { onSelect(template); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(template);
        }
      }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 flex items-center justify-center rounded-md bg-muted', colorClass)}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold text-foreground truncate">
                {template.name}
              </CardTitle>
              {selected ? (
                <Check className="w-4 h-4 text-[var(--accent-primary,#00F0FF)] shrink-0" data-testid={`template-selected-${template.id}`} />
              ) : null}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {template.description}
        </CardDescription>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
            <Shield className="w-2.5 h-2.5" />
            {template.drcRules.length} DRC rules
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
            <Layers className="w-2.5 h-2.5" />
            {template.exportPresets.filter((p) => p.enabled).length} exports
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
            <Tag className="w-2.5 h-2.5" />
            {template.suggestedComponents.length} components
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

interface TemplateDetailProps {
  template: TeamTemplate;
}

function TemplateDetail({ template }: TemplateDetailProps) {
  return (
    <div className="space-y-4 text-sm" data-testid={`template-detail-${template.id}`}>
      <div>
        <h4 className="font-medium text-foreground flex items-center gap-1.5 mb-1.5">
          <Shield className="w-3.5 h-3.5" /> DRC Rules
        </h4>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {template.drcRules.map((rule) => (
            <li key={rule.type} className="flex items-center gap-2">
              <span className={cn('w-1.5 h-1.5 rounded-full', rule.severity === 'error' ? 'bg-red-500' : 'bg-yellow-500')} />
              <span className="font-mono">{rule.type}</span>
              {!rule.enabled ? <span className="text-muted-foreground/50">(disabled)</span> : null}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="font-medium text-foreground flex items-center gap-1.5 mb-1.5">
          <FileText className="w-3.5 h-3.5" /> BOM Requirements
        </h4>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {template.bomRequirements.map((req) => (
            <li key={req.field} className="flex items-center gap-2">
              <span className={cn('w-1.5 h-1.5 rounded-full', req.required ? 'bg-red-500' : 'bg-gray-500')} />
              <span>{req.field}</span>
              <span className="text-muted-foreground/50">({req.required ? 'required' : 'optional'})</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="font-medium text-foreground flex items-center gap-1.5 mb-1.5">
          <Layers className="w-3.5 h-3.5" /> Export Presets
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {template.exportPresets.map((preset) => (
            <Badge
              key={preset.formatId}
              variant={preset.enabled ? 'secondary' : 'outline'}
              className={cn('text-[10px]', !preset.enabled && 'opacity-50')}
            >
              {preset.label}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-medium text-foreground flex items-center gap-1.5 mb-1.5">
          <Tag className="w-3.5 h-3.5" /> Suggested Components
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {template.suggestedComponents.map((comp) => (
            <Badge key={comp} variant="outline" className="text-[10px]">
              {comp}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main selector component
// ---------------------------------------------------------------------------

export interface TeamTemplateSelectorProps {
  onSelect: (applied: AppliedTemplate) => void;
  onSkip: () => void;
  projectName: string;
}

export default function TeamTemplateSelector({ onSelect, onSkip, projectName }: TeamTemplateSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all');

  const mgr = TeamTemplateManager.getInstance();

  const templates = searchQuery ? mgr.searchTemplates(searchQuery) : BUILT_IN_TEMPLATES;
  const filtered = categoryFilter === 'all' ? templates : templates.filter((t) => t.category === categoryFilter);

  const selectedTemplate = selectedId ? mgr.getTemplateById(selectedId) : null;

  const handleSelectTemplate = useCallback((template: TeamTemplate) => {
    setSelectedId((prev) => (prev === template.id ? null : template.id));
  }, []);

  const handleApply = useCallback(() => {
    if (!selectedId) {
      return;
    }
    const applied = mgr.applyTemplate(selectedId, projectName);
    if (applied) {
      onSelect(applied);
    }
  }, [selectedId, mgr, projectName, onSelect]);

  return (
    <div className="space-y-4" data-testid="team-template-selector">
      <div className="flex items-center gap-2" data-testid="template-search-bar">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); }}
            className="pl-8 h-8 text-sm bg-background border-border"
            data-testid="input-template-search"
          />
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap" data-testid="template-category-filters">
        {TEMPLATE_CATEGORIES.map((cat) => (
          <Button
            key={cat.value}
            variant={categoryFilter === cat.value ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'h-6 text-[11px] px-2',
              categoryFilter === cat.value && 'bg-[var(--accent-primary,#00F0FF)] text-black',
            )}
            onClick={() => { setCategoryFilter(cat.value); }}
            data-testid={`template-filter-${cat.value}`}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1" data-testid="template-grid">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-2 text-center py-4" data-testid="template-no-results">
            No templates match your search.
          </p>
        ) : (
          filtered.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              selected={selectedId === t.id}
              onSelect={handleSelectTemplate}
            />
          ))
        )}
      </div>

      {selectedTemplate ? (
        <div className="border border-border rounded-lg p-3 bg-muted/30" data-testid="template-detail-panel">
          <TemplateDetail template={selectedTemplate} />
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSkip}
          data-testid="button-skip-template"
        >
          Skip (blank project)
        </Button>
        <Button
          size="sm"
          disabled={!selectedId}
          onClick={handleApply}
          className="bg-[var(--accent-primary,#00F0FF)] text-black hover:bg-[var(--accent-primary,#00F0FF)]/90"
          data-testid="button-apply-template"
        >
          Apply Template
          <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
