import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookTemplate, Loader2, Plus, Trash2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useBomTemplates,
  useCreateBomTemplate,
  useApplyBomTemplate,
  useDeleteBomTemplate,
} from '@/lib/parts/use-bom-templates';
import type { BomTemplate } from '@/lib/parts/use-bom-templates';
import type { BomItem } from '@/lib/project-context';
import { useToast } from '@/hooks/use-toast';

interface BomTemplatesPanelProps {
  projectId: number;
  bom?: BomItem[];
}

function TemplateRow({
  template,
  projectId,
  onApply,
  onDelete,
  isApplying,
  isDeleting,
}: {
  template: BomTemplate;
  projectId: number;
  onApply: (templateId: string) => void;
  onDelete: (templateId: string) => void;
  isApplying: boolean;
  isDeleting: boolean;
}) {
  return (
    <div
      data-testid={`template-row-${template.id}`}
      className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-muted/30 px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <span data-testid={`template-name-${template.id}`} className="text-sm font-medium text-foreground truncate block">
          {template.name}
        </span>
        {template.description && (
          <span className="text-xs text-muted-foreground truncate block">{template.description}</span>
        )}
        {template.tags && template.tags.length > 0 && (
          <div className="flex gap-1 mt-1">
            {template.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="outline"
          size="sm"
          data-testid={`template-apply-${template.id}`}
          disabled={isApplying}
          onClick={() => { onApply(template.id); }}
          className="h-7 text-xs gap-1"
        >
          {isApplying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          Apply
        </Button>
        <Button
          variant="ghost"
          size="sm"
          data-testid={`template-delete-${template.id}`}
          disabled={isDeleting}
          onClick={() => { onDelete(template.id); }}
          className="h-7 px-2 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export default function BomTemplatesPanel({ projectId, bom }: BomTemplatesPanelProps) {
  const { data: templates, isLoading } = useBomTemplates();
  const createMutation = useCreateBomTemplate();
  const applyMutation = useApplyBomTemplate();
  const deleteMutation = useDeleteBomTemplate();
  const { toast } = useToast();
  const [newTemplateName, setNewTemplateName] = useState('');

  const handleSaveAsTemplate = () => {
    if (!newTemplateName.trim() || !bom || bom.length === 0) { return; }

    createMutation.mutate(
      {
        name: newTemplateName.trim(),
        items: bom.map((item) => ({
          partId: item.id,
          quantityNeeded: item.quantity,
          unitPrice: item.unitPrice,
          supplier: item.supplier !== 'Unknown' ? item.supplier : null,
        })),
      },
      {
        onSuccess: (result) => {
          toast({ title: 'Template saved', description: `"${result.name}" with ${result.itemCount} items` });
          setNewTemplateName('');
        },
        onError: () => {
          toast({ title: 'Failed to save template', variant: 'destructive' });
        },
      },
    );
  };

  const handleApply = (templateId: string) => {
    applyMutation.mutate(
      { templateId, projectId },
      {
        onSuccess: (result) => {
          toast({ title: 'Template applied', description: result.message });
        },
        onError: () => {
          toast({ title: 'Failed to apply template', variant: 'destructive' });
        },
      },
    );
  };

  const handleDelete = (templateId: string) => {
    deleteMutation.mutate(templateId, {
      onSuccess: () => {
        toast({ title: 'Template deleted' });
      },
    });
  };

  if (isLoading) {
    return (
      <Card data-testid="bom-templates-panel">
        <CardContent className="flex items-center justify-center py-6" data-testid="bom-templates-loading">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading templates...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="bom-templates-panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookTemplate className="h-4 w-4" />
          BOM Templates
          {templates && templates.length > 0 && (
            <Badge variant="secondary" data-testid="bom-templates-count">
              {templates.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Save current BOM as template */}
        <div className="flex items-center gap-2" data-testid="bom-templates-save-form">
          <Input
            data-testid="bom-templates-name-input"
            placeholder="Template name..."
            value={newTemplateName}
            onChange={(e) => { setNewTemplateName(e.target.value); }}
            className="h-8 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') { handleSaveAsTemplate(); } }}
          />
          <Button
            variant="default"
            size="sm"
            data-testid="bom-templates-save-btn"
            disabled={!newTemplateName.trim() || !bom || bom.length === 0 || createMutation.isPending}
            onClick={handleSaveAsTemplate}
            className="h-8 text-xs gap-1 shrink-0"
          >
            {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Save BOM as Template
          </Button>
        </div>

        {/* Template list */}
        {(!templates || templates.length === 0) ? (
          <p data-testid="bom-templates-empty" className="text-sm text-muted-foreground py-2 text-center">
            No templates saved yet. Save your current BOM as a template above.
          </p>
        ) : (
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2" data-testid="bom-templates-list">
              {templates.map((template) => (
                <TemplateRow
                  key={template.id}
                  template={template}
                  projectId={projectId}
                  onApply={handleApply}
                  onDelete={handleDelete}
                  isApplying={applyMutation.isPending}
                  isDeleting={deleteMutation.isPending}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
