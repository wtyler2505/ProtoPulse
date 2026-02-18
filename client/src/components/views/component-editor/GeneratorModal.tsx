import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { generate, type GeneratorResult, type GeneratorConfig } from '@/lib/component-editor/generators';
import { SHAPE_TEMPLATES, type ShapeTemplate } from '@/lib/component-editor/shape-templates';

type PackageType = GeneratorConfig['type'];

interface GeneratorModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (result: GeneratorResult) => void;
}

const PACKAGE_LABELS: Record<PackageType, string> = {
  dip: 'DIP (Dual Inline Package)',
  soic: 'SOIC (Small Outline IC)',
  qfp: 'QFP (Quad Flat Package)',
  header: 'Pin Header',
  resistor: 'Resistor',
  capacitor: 'Capacitor',
};

function getPreviewDescription(config: GeneratorConfig): string {
  switch (config.type) {
    case 'dip':
      return `${config.pinCount ?? 8}-pin DIP package with ${(config.pinCount ?? 8) / 2} pins per side, ${config.pitch ?? 2.54}mm pin spacing, ${config.bodyWidth ?? 7.62}mm row spacing. THT through-hole pads.`;
    case 'soic':
      return `${config.pinCount ?? 8}-pin SOIC package with ${(config.pinCount ?? 8) / 2} pins per side, ${config.pitch ?? 1.27}mm pitch. SMD surface-mount pads.`;
    case 'qfp':
      return `${config.pinCount ?? 32}-pin QFP package with ${(config.pinCount ?? 32) / 4} pins per side, ${config.pitch ?? 0.5}mm pitch. SMD surface-mount pads.`;
    case 'header':
      return `${config.cols ?? 4}×${config.rows ?? 1} pin header (${(config.cols ?? 4) * (config.rows ?? 1)} pins total), ${config.pitch ?? 2.54}mm pitch. THT through-hole pads.`;
    case 'resistor':
      return `2-pin resistor, ${config.mountingType === 'smd' ? 'SMD (0603-style)' : 'THT axial'} package.`;
    case 'capacitor':
      return `2-pin capacitor, ${config.mountingType === 'smd' ? 'SMD' : 'THT radial electrolytic'} package.`;
    default:
      return '';
  }
}

const CATEGORY_LABELS: Record<ShapeTemplate['category'], string> = {
  ic: 'ICs & Headers',
  passive: 'Passive Components',
  mechanical: 'Mechanical',
  misc: 'Symbols & Misc',
};

const CATEGORY_ORDER: ShapeTemplate['category'][] = ['ic', 'passive', 'mechanical', 'misc'];

function groupTemplatesByCategory(): Record<string, ShapeTemplate[]> {
  const groups: Record<string, ShapeTemplate[]> = {};
  for (const t of SHAPE_TEMPLATES) {
    if (!groups[t.category]) groups[t.category] = [];
    groups[t.category].push(t);
  }
  return groups;
}

export default function GeneratorModal({ open, onClose, onGenerate }: GeneratorModalProps) {
  const [packageType, setPackageType] = useState<PackageType>('dip');
  const [pinCount, setPinCount] = useState(8);
  const [pitch, setPitch] = useState(2.54);
  const [bodyWidth, setBodyWidth] = useState(7.62);
  const [bodySize, setBodySize] = useState(7);
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(1);
  const [mountingType, setMountingType] = useState<'tht' | 'smd'>('tht');

  const templateGroups = groupTemplatesByCategory();

  const handleTemplateClick = (template: ShapeTemplate) => {
    onGenerate({ shapes: template.generate(), connectors: [] });
    onClose();
  };

  const handleTypeChange = (value: string) => {
    const t = value as PackageType;
    setPackageType(t);
    switch (t) {
      case 'dip':
        setPinCount(8);
        setPitch(2.54);
        setBodyWidth(7.62);
        break;
      case 'soic':
        setPinCount(8);
        setPitch(1.27);
        break;
      case 'qfp':
        setPinCount(32);
        setPitch(0.5);
        setBodySize(7);
        break;
      case 'header':
        setCols(4);
        setRows(1);
        setPitch(2.54);
        break;
      case 'resistor':
      case 'capacitor':
        setMountingType('tht');
        break;
    }
  };

  const buildConfig = (): GeneratorConfig => {
    switch (packageType) {
      case 'dip':
        return { type: 'dip', pinCount, pitch, bodyWidth };
      case 'soic':
        return { type: 'soic', pinCount, pitch };
      case 'qfp':
        return { type: 'qfp', pinCount, pitch, bodySize };
      case 'header':
        return { type: 'header', cols, rows, pitch };
      case 'resistor':
        return { type: 'resistor', mountingType };
      case 'capacitor':
        return { type: 'capacitor', mountingType };
    }
  };

  const handleGenerate = () => {
    const config = buildConfig();
    const result = generate(config);
    onGenerate(result);
    onClose();
  };

  const config = buildConfig();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto" data-testid="generator-modal">
        <DialogHeader>
          <DialogTitle>Generate Package</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-sm font-semibold">Quick Templates</Label>
            <p className="text-xs text-muted-foreground mb-2">Click a template to instantly add it</p>
            {CATEGORY_ORDER.filter(cat => templateGroups[cat]).map(cat => (
              <div key={cat} className="mb-2">
                <span className="text-xs text-muted-foreground font-medium" data-testid={`template-category-${cat}`}>{CATEGORY_LABELS[cat]}</span>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {templateGroups[cat].map(template => (
                    <button
                      key={template.id}
                      data-testid={`template-card-${template.id}`}
                      onClick={() => handleTemplateClick(template)}
                      className="text-left rounded-md border border-border bg-card p-2 hover:bg-accent hover:border-accent-foreground/20 transition-colors cursor-pointer"
                    >
                      <span className="text-sm font-medium block leading-tight">{template.name}</span>
                      <span className="text-xs text-muted-foreground leading-tight">{template.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <Label className="text-sm font-semibold">Package Generator</Label>
        </div>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="package-type">Package Type</Label>
            <Select value={packageType} onValueChange={handleTypeChange}>
              <SelectTrigger data-testid="select-package-type" id="package-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(PACKAGE_LABELS) as [PackageType, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key} data-testid={`option-${key}`}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(packageType === 'dip' || packageType === 'soic' || packageType === 'qfp') && (
            <div className="space-y-2">
              <Label htmlFor="pin-count">Pin Count</Label>
              <Input
                id="pin-count"
                data-testid="input-pin-count"
                type="number"
                min={packageType === 'qfp' ? 4 : 2}
                step={packageType === 'qfp' ? 4 : 2}
                value={pinCount}
                onChange={(e) => setPinCount(Math.max(2, parseInt(e.target.value) || 2))}
              />
            </div>
          )}

          {(packageType === 'dip' || packageType === 'soic' || packageType === 'qfp' || packageType === 'header') && (
            <div className="space-y-2">
              <Label htmlFor="pitch">Pitch (mm)</Label>
              <Input
                id="pitch"
                data-testid="input-pitch"
                type="number"
                min={0.1}
                step={0.01}
                value={pitch}
                onChange={(e) => setPitch(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
              />
            </div>
          )}

          {packageType === 'dip' && (
            <div className="space-y-2">
              <Label htmlFor="row-spacing">Row Spacing (mm)</Label>
              <Input
                id="row-spacing"
                data-testid="input-row-spacing"
                type="number"
                min={1}
                step={0.01}
                value={bodyWidth}
                onChange={(e) => setBodyWidth(Math.max(1, parseFloat(e.target.value) || 1))}
              />
            </div>
          )}

          {packageType === 'qfp' && (
            <div className="space-y-2">
              <Label htmlFor="body-size">Body Size (mm)</Label>
              <Input
                id="body-size"
                data-testid="input-body-size"
                type="number"
                min={1}
                step={0.1}
                value={bodySize}
                onChange={(e) => setBodySize(Math.max(1, parseFloat(e.target.value) || 1))}
              />
            </div>
          )}

          {packageType === 'header' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="cols">Columns</Label>
                <Input
                  id="cols"
                  data-testid="input-cols"
                  type="number"
                  min={1}
                  value={cols}
                  onChange={(e) => setCols(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rows">Rows</Label>
                <Input
                  id="rows"
                  data-testid="input-rows"
                  type="number"
                  min={1}
                  value={rows}
                  onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
            </>
          )}

          {(packageType === 'resistor' || packageType === 'capacitor') && (
            <div className="space-y-2">
              <Label htmlFor="mounting-type">Mounting Type</Label>
              <Select value={mountingType} onValueChange={(v) => setMountingType(v as 'tht' | 'smd')}>
                <SelectTrigger data-testid="select-mounting-type" id="mounting-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tht" data-testid="option-tht">THT (Through-Hole)</SelectItem>
                  <SelectItem value="smd" data-testid="option-smd">SMD (Surface-Mount)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground" data-testid="preview-description">
            {getPreviewDescription(config)}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button onClick={handleGenerate} data-testid="button-generate">
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
