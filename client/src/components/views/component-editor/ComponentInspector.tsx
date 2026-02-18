import { useCallback, useMemo, useState } from 'react';
import { useComponentEditor } from '@/lib/component-editor/ComponentEditorProvider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Shape, ShapeStyle, RectShape, CircleShape, TextShape, PathShape } from '@shared/component-types';
import type { Constraint, ConstraintType } from '@shared/component-types';
import { createConstraint } from '@/lib/component-editor/constraint-solver';
import { Link2, Trash2, ToggleLeft, ToggleRight, Sparkles, Check, X } from 'lucide-react';
import { inferConstraints, type InferredConstraint } from '@/lib/component-editor/constraint-inference';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

type CanvasView = 'breadboard' | 'schematic' | 'pcb';

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 pt-3 pb-1">
      {children}
    </h3>
  );
}

function ColorInput({
  label,
  value,
  testId,
  onChange,
}: {
  label: string;
  value: string;
  testId: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground w-16 shrink-0">{label}</Label>
      <div
        className="w-5 h-5 rounded border border-border shrink-0"
        style={{ backgroundColor: value || 'transparent' }}
      />
      <Input
        data-testid={testId}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 bg-card border-border text-sm flex-1"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  testId,
  onChange,
  step,
  min,
  max,
  readOnly,
}: {
  label: string;
  value: number;
  testId: string;
  onChange?: (val: number) => void;
  step?: number;
  min?: number;
  max?: number;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground w-16 shrink-0">{label}</Label>
      <Input
        data-testid={testId}
        type="number"
        value={value}
        aria-label={label}
        onChange={(e) => onChange?.(parseFloat(e.target.value) || 0)}
        step={step}
        min={min}
        max={max}
        readOnly={readOnly}
        className="h-7 bg-card border-border text-sm flex-1"
      />
    </div>
  );
}

function SingleShapeInspector({ shape, view }: { shape: Shape; view: CanvasView }) {
  const { dispatch } = useComponentEditor();
  const style = shape.style || {};

  const updateShape = useCallback(
    (updates: Partial<Shape>) => {
      dispatch({ type: 'UPDATE_SHAPE', payload: { view, shapeId: shape.id, updates } });
    },
    [dispatch, view, shape.id],
  );

  const updateStyle = useCallback(
    (styleUpdates: Partial<ShapeStyle>) => {
      updateShape({ style: { ...style, ...styleUpdates } } as Partial<Shape>);
    },
    [updateShape, style],
  );

  return (
    <div className="flex flex-col gap-1">
      <SectionHeader>Position</SectionHeader>
      <div className="px-3 flex flex-col gap-1.5">
        <NumberField label="X" value={shape.x} testId="input-shape-x" onChange={(v) => updateShape({ x: v })} />
        <NumberField label="Y" value={shape.y} testId="input-shape-y" onChange={(v) => updateShape({ y: v })} />
      </div>

      <SectionHeader>Size</SectionHeader>
      <div className="px-3 flex flex-col gap-1.5">
        <NumberField label="Width" value={shape.width} testId="input-shape-width" onChange={(v) => updateShape({ width: v })} />
        <NumberField label="Height" value={shape.height} testId="input-shape-height" onChange={(v) => updateShape({ height: v })} />
      </div>

      <SectionHeader>Rotation</SectionHeader>
      <div className="px-3 flex flex-col gap-1.5">
        <NumberField label="Deg" value={shape.rotation} testId="input-shape-rotation" onChange={(v) => updateShape({ rotation: v })} />
      </div>

      <SectionHeader>Style</SectionHeader>
      <div className="px-3 flex flex-col gap-1.5">
        <ColorInput label="Fill" value={style.fill ?? ''} testId="input-shape-fill" onChange={(v) => updateStyle({ fill: v })} />
        <ColorInput label="Stroke" value={style.stroke ?? ''} testId="input-shape-stroke" onChange={(v) => updateStyle({ stroke: v })} />
        <NumberField label="Stroke W" value={style.strokeWidth ?? 1} testId="input-shape-strokeWidth" step={0.5} min={0} onChange={(v) => updateStyle({ strokeWidth: v })} />
        <NumberField label="Opacity" value={style.opacity ?? 1} testId="input-shape-opacity" step={0.1} min={0} max={1} onChange={(v) => updateStyle({ opacity: v })} />
      </div>

      {shape.type === 'rect' && (
        <>
          <SectionHeader>Rectangle</SectionHeader>
          <div className="px-3 flex flex-col gap-1.5">
            <NumberField
              label="Radius"
              value={(shape as RectShape).rx ?? 0}
              testId="input-shape-rx"
              min={0}
              onChange={(v) => updateShape({ rx: v } as Partial<Shape>)}
            />
          </div>
        </>
      )}

      {shape.type === 'circle' && (
        <>
          <SectionHeader>Circle</SectionHeader>
          <div className="px-3 flex flex-col gap-1.5">
            <NumberField label="CX" value={(shape as CircleShape).cx} testId="input-shape-cx" readOnly />
            <NumberField label="CY" value={(shape as CircleShape).cy} testId="input-shape-cy" readOnly />
          </div>
        </>
      )}

      {shape.type === 'text' && (
        <>
          <SectionHeader>Text</SectionHeader>
          <div className="px-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground w-16 shrink-0">Content</Label>
              <Input
                data-testid="input-shape-text"
                value={(shape as TextShape).text}
                aria-label="Content"
                onChange={(e) => updateShape({ text: e.target.value } as Partial<Shape>)}
                className="h-7 bg-card border-border text-sm flex-1"
              />
            </div>
            <NumberField
              label="Size"
              value={style.fontSize ?? 14}
              testId="input-shape-fontSize"
              min={1}
              onChange={(v) => updateStyle({ fontSize: v })}
            />
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground w-16 shrink-0">Font</Label>
              <Input
                data-testid="input-shape-fontFamily"
                value={style.fontFamily ?? 'sans-serif'}
                aria-label="Font"
                onChange={(e) => updateStyle({ fontFamily: e.target.value })}
                className="h-7 bg-card border-border text-sm flex-1"
              />
            </div>
          </div>
        </>
      )}

      {shape.type === 'path' && (
        <>
          <SectionHeader>Path</SectionHeader>
          <div className="px-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground w-16 shrink-0">d</Label>
              <span
                data-testid="display-shape-path"
                className="text-xs text-muted-foreground truncate flex-1"
                title={(shape as PathShape).d}
              >
                {(shape as PathShape).d.length > 40
                  ? (shape as PathShape).d.slice(0, 40) + '…'
                  : (shape as PathShape).d}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MultiShapeInspector({ shapes, view }: { shapes: Shape[]; view: CanvasView }) {
  const { dispatch } = useComponentEditor();

  const sharedStyle = useMemo(() => {
    const first = shapes[0]?.style || {};
    return {
      fill: first.fill ?? '',
      stroke: first.stroke ?? '',
      strokeWidth: first.strokeWidth ?? 1,
      opacity: first.opacity ?? 1,
    };
  }, [shapes]);

  const updateAll = useCallback(
    (styleUpdates: Partial<ShapeStyle>) => {
      shapes.forEach((s) => {
        dispatch({
          type: 'UPDATE_SHAPE',
          payload: {
            view,
            shapeId: s.id,
            updates: { style: { ...(s.style || {}), ...styleUpdates } } as Partial<Shape>,
          },
        });
      });
    },
    [dispatch, shapes, view],
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="px-3 pt-3 pb-1">
        <p data-testid="multi-selection-count" className="text-sm text-foreground font-medium">
          {shapes.length} shapes selected
        </p>
      </div>

      <SectionHeader>Style</SectionHeader>
      <div className="px-3 flex flex-col gap-1.5">
        <ColorInput label="Fill" value={sharedStyle.fill} testId="input-shape-fill" onChange={(v) => updateAll({ fill: v })} />
        <ColorInput label="Stroke" value={sharedStyle.stroke} testId="input-shape-stroke" onChange={(v) => updateAll({ stroke: v })} />
        <NumberField label="Stroke W" value={sharedStyle.strokeWidth} testId="input-shape-strokeWidth" step={0.5} min={0} onChange={(v) => updateAll({ strokeWidth: v })} />
        <NumberField label="Opacity" value={sharedStyle.opacity} testId="input-shape-opacity" step={0.1} min={0} max={1} onChange={(v) => updateAll({ opacity: v })} />
      </div>
    </div>
  );
}

function ConstraintSection({ view }: { view: CanvasView }) {
  const { state, dispatch } = useComponentEditor();
  const selectedIds = state.ui.selectedShapeIds;
  const constraints = state.present.constraints || [];
  const relevantConstraints = constraints.filter(c =>
    c.shapeIds.some(id => selectedIds.includes(id))
  );

  const handleAdd = (type: ConstraintType) => {
    if (selectedIds.length < 2 && type !== 'fixed') return;
    const ids = type === 'fixed' ? [selectedIds[0]] : selectedIds.slice(0, 2);
    const constraint = createConstraint(type, ids);
    dispatch({ type: 'ADD_CONSTRAINT', payload: constraint });
  };

  const [suggestions, setSuggestions] = useState<InferredConstraint[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleInfer = () => {
    const shapes = state.present.views[view].shapes;
    const connectors = state.present.connectors;
    const canvasView = view as 'breadboard' | 'schematic' | 'pcb';
    const results = inferConstraints(shapes, connectors, canvasView, constraints);
    setSuggestions(results);
    setShowSuggestions(true);
  };

  const handleAcceptSuggestion = (s: InferredConstraint) => {
    const constraint = createConstraint(s.type, s.shapeIds, s.params);
    dispatch({ type: 'ADD_CONSTRAINT', payload: constraint });
    setSuggestions(prev => prev.filter(p => p !== s));
  };

  const handleDismissSuggestion = (s: InferredConstraint) => {
    setSuggestions(prev => prev.filter(p => p !== s));
  };

  const handleDelete = (id: string) => {
    dispatch({ type: 'DELETE_CONSTRAINT', payload: id });
  };

  const handleToggle = (id: string, enabled: boolean) => {
    dispatch({ type: 'UPDATE_CONSTRAINT', payload: { constraintId: id, updates: { enabled } } });
  };

  return (
    <div className="flex flex-col gap-1">
      <SectionHeader>Constraints</SectionHeader>
      <div className="px-3 flex flex-col gap-2">
        {selectedIds.length >= 2 && (
          <div className="flex flex-wrap gap-1">
            {(['distance', 'alignment', 'pitch', 'symmetric', 'equal'] as ConstraintType[]).map(type => (
              <Button key={type} variant="outline" size="sm" className="h-6 text-[10px] px-2"
                data-testid={`button-add-constraint-${type}`}
                onClick={() => handleAdd(type)}>
                <Link2 className="w-3 h-3 mr-1" />{type}
              </Button>
            ))}
          </div>
        )}
        {selectedIds.length >= 1 && (
          <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 w-fit"
            data-testid="button-add-constraint-fixed"
            onClick={() => handleAdd('fixed')}>
            <Link2 className="w-3 h-3 mr-1" />fixed
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 w-fit"
          data-testid="button-infer-constraints"
          onClick={handleInfer}>
          <Sparkles className="w-3 h-3 mr-1" />auto-detect
        </Button>
        {showSuggestions && suggestions.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1">
            <span className="text-[10px] text-muted-foreground font-medium">Suggestions ({suggestions.length})</span>
            {suggestions.map((s, idx) => (
              <div key={idx} data-testid={`suggestion-${idx}`}
                className="flex items-start gap-1 p-1.5 rounded bg-purple-500/5 border border-purple-500/20 text-[10px]">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-purple-400">{s.type}</span>
                  <span className="text-muted-foreground ml-1">({Math.round(s.confidence * 100)}%)</span>
                  <p className="text-muted-foreground leading-tight mt-0.5">{s.reason}</p>
                </div>
                <button
                  data-testid={`button-accept-suggestion-${idx}`}
                  className="p-0.5 hover:text-green-400 text-muted-foreground shrink-0"
                  onClick={() => handleAcceptSuggestion(s)}
                  title="Accept">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  data-testid={`button-dismiss-suggestion-${idx}`}
                  className="p-0.5 hover:text-red-400 text-muted-foreground shrink-0"
                  onClick={() => handleDismissSuggestion(s)}
                  title="Dismiss">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {relevantConstraints.length === 0 && (
          <p className="text-xs text-muted-foreground" data-testid="constraints-empty">
            {selectedIds.length < 2 ? 'Select 2 shapes to add constraints' : 'No constraints on selected shapes'}
          </p>
        )}
        {relevantConstraints.map(c => (
          <div key={c.id} data-testid={`constraint-${c.id}`}
            className="flex items-center gap-1 p-1.5 rounded bg-muted/30 border border-border text-xs">
            <span className={`font-medium ${c.enabled ? 'text-[#00F0FF]' : 'text-muted-foreground line-through'}`}>
              {c.type}
            </span>
            {c.params.distance !== undefined && (
              <Input
                type="number"
                value={Number(c.params.distance)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  dispatch({ type: 'UPDATE_CONSTRAINT', payload: { constraintId: c.id, updates: { params: { ...c.params, distance: val } } } });
                }}
                className="h-5 w-14 text-[10px] bg-card border-border px-1"
                data-testid={`input-constraint-distance-${c.id}`}
              />
            )}
            {c.params.pitch !== undefined && (
              <Input
                type="number"
                value={Number(c.params.pitch)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  dispatch({ type: 'UPDATE_CONSTRAINT', payload: { constraintId: c.id, updates: { params: { ...c.params, pitch: val } } } });
                }}
                className="h-5 w-14 text-[10px] bg-card border-border px-1"
                data-testid={`input-constraint-pitch-${c.id}`}
              />
            )}
            {c.type === 'symmetric' && (
              <select
                value={String(c.params.axis || 'x')}
                onChange={(e) => {
                  dispatch({ type: 'UPDATE_CONSTRAINT', payload: { constraintId: c.id, updates: { params: { ...c.params, axis: e.target.value } } } });
                }}
                className="h-5 text-[10px] bg-card border border-border rounded px-1 text-foreground"
                data-testid={`select-constraint-axis-${c.id}`}
              >
                <option value="x">X axis</option>
                <option value="y">Y axis</option>
              </select>
            )}
            {c.type === 'equal' && (
              <select
                value={String(c.params.property || 'width')}
                onChange={(e) => {
                  dispatch({ type: 'UPDATE_CONSTRAINT', payload: { constraintId: c.id, updates: { params: { ...c.params, property: e.target.value } } } });
                }}
                className="h-5 text-[10px] bg-card border border-border rounded px-1 text-foreground"
                data-testid={`select-constraint-property-${c.id}`}
              >
                <option value="width">Width</option>
                <option value="height">Height</option>
                <option value="both">Both</option>
              </select>
            )}
            <button
              data-testid={`button-toggle-constraint-${c.id}`}
              className="ml-auto p-0.5 hover:text-foreground text-muted-foreground"
              onClick={() => handleToggle(c.id, !c.enabled)}
              title={c.enabled ? 'Disable constraint' : 'Enable constraint'}>
              {c.enabled ? <ToggleRight className="w-3.5 h-3.5 text-[#00F0FF]" /> : <ToggleLeft className="w-3.5 h-3.5" />}
            </button>
            <button
              data-testid={`button-delete-constraint-${c.id}`}
              className="p-0.5 hover:text-destructive text-muted-foreground"
              onClick={() => handleDelete(c.id)}
              title="Delete constraint">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ComponentInspector() {
  const { state } = useComponentEditor();
  const activeView = state.ui.activeEditorView;
  const selectedIds = state.ui.selectedShapeIds;

  const isCanvasView = activeView === 'breadboard' || activeView === 'schematic' || activeView === 'pcb';
  if (!isCanvasView) return null;

  const view = activeView as CanvasView;
  const shapes = state.present.views[view].shapes;
  const selectedShapes = shapes.filter((s) => selectedIds.includes(s.id));

  return (
    <div
      data-testid="inspector-panel"
      role="complementary"
      aria-label="Shape properties inspector"
      className="w-64 flex-shrink-0 border-l border-border bg-card overflow-y-auto"
    >
      {selectedShapes.length === 0 && (
        <div className="flex items-center justify-center h-full p-4">
          <p data-testid="inspector-empty" className="text-sm text-muted-foreground text-center">
            Select a shape to edit properties
          </p>
        </div>
      )}

      {selectedShapes.length === 1 && (
        <SingleShapeInspector shape={selectedShapes[0]} view={view} />
      )}

      {selectedShapes.length > 1 && (
        <MultiShapeInspector shapes={selectedShapes} view={view} />
      )}

      <ConstraintSection view={view} />
    </div>
  );
}
