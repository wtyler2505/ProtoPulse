import { useState, useCallback, useMemo } from 'react';
import { useComponentEditor } from '@/lib/component-editor/ComponentEditorProvider';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  parseSubcircuit,
  validateSubcircuit,
  autoMapPorts,
  generateSubcircuitTemplate,
  summarizeBody,
  countInternalNodes,
} from '@/lib/component-editor/spice-subcircuit';
import type { SubcircuitDiagnostic, PortMapping } from '@/lib/component-editor/spice-subcircuit';
import {
  Zap,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  RefreshCw,
  Trash2,
  ArrowRightLeft,
  FileCode,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Severity icon helper
// ---------------------------------------------------------------------------

function DiagnosticIcon({ severity }: { severity: SubcircuitDiagnostic['severity'] }) {
  switch (severity) {
    case 'error':
      return <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    case 'info':
      return <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SpiceSubcircuitEditor() {
  const { state, dispatch } = useComponentEditor();
  const spiceText = state.present.meta.spiceSubcircuit ?? '';
  const connectors = state.present.connectors;
  const componentName = state.present.meta.title;

  const [localText, setLocalText] = useState(spiceText);
  const [showMappings, setShowMappings] = useState(false);

  // Validate whenever localText changes
  const validation = useMemo(() => validateSubcircuit(localText), [localText]);

  // Auto-map ports to connectors
  const mapResult = useMemo(() => {
    if (!validation.parsed) {
      return null;
    }
    return autoMapPorts(validation.parsed.ports, connectors);
  }, [validation.parsed, connectors]);

  // Body summary
  const bodySummary = useMemo(() => {
    if (!validation.parsed) {
      return null;
    }
    return summarizeBody(validation.parsed);
  }, [validation.parsed]);

  const internalNodeCount = useMemo(() => {
    if (!validation.parsed) {
      return 0;
    }
    return countInternalNodes(validation.parsed);
  }, [validation.parsed]);

  // Check if local text differs from saved state
  const isDirty = localText !== spiceText;

  const handleApply = useCallback(() => {
    dispatch({
      type: 'UPDATE_META',
      payload: { spiceSubcircuit: localText || undefined },
    });
  }, [localText, dispatch]);

  const handleGenerate = useCallback(() => {
    const template = generateSubcircuitTemplate(componentName, connectors);
    setLocalText(template);
  }, [componentName, connectors]);

  const handleClear = useCallback(() => {
    setLocalText('');
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5" data-testid="spice-subcircuit-editor">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-[var(--color-editor-accent)]" />
        <h3 className="text-sm font-semibold text-foreground">SPICE Subcircuit</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Attach a SPICE <code className="text-[var(--color-editor-accent)]/80">.SUBCKT</code> definition to this component.
        This model will be used when simulating circuits that include this part.
      </p>

      {/* Text editor */}
      <div className="space-y-1.5">
        <Label htmlFor="spice-subcircuit-text" className="text-muted-foreground text-sm">
          Subcircuit Definition
        </Label>
        <Textarea
          id="spice-subcircuit-text"
          data-testid="textarea-spice-subcircuit"
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          placeholder={`.SUBCKT MYCOMP port1 port2\nR1 port1 port2 1k\n.ENDS MYCOMP`}
          rows={12}
          className="bg-card border-border font-mono text-xs leading-5 resize-y"
          spellCheck={false}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="default"
          size="sm"
          data-testid="button-apply-spice"
          onClick={handleApply}
          disabled={!isDirty}
          className="gap-1.5 bg-[var(--color-editor-accent)] text-black hover:bg-[var(--color-editor-accent)]/80"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Apply
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="button-generate-template"
          onClick={handleGenerate}
          className="gap-1.5"
        >
          <FileCode className="w-3.5 h-3.5" />
          Generate Template
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="button-show-mappings"
          onClick={() => setShowMappings((v) => !v)}
          disabled={!validation.parsed}
          className="gap-1.5"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          {showMappings ? 'Hide' : 'Show'} Port Mapping
        </Button>
        <Button
          variant="ghost"
          size="sm"
          data-testid="button-clear-spice"
          onClick={handleClear}
          disabled={localText.length === 0}
          className="gap-1.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </Button>
      </div>

      {/* Diagnostics */}
      {localText.trim().length > 0 && validation.diagnostics.length > 0 && (
        <div className="space-y-1" data-testid="spice-diagnostics">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Diagnostics</span>
          <div className="space-y-0.5">
            {validation.diagnostics.map((d, i) => (
              <div
                key={i}
                className="flex items-start gap-1.5 text-xs py-0.5"
                data-testid={`diagnostic-${d.severity}-${i}`}
              >
                <DiagnosticIcon severity={d.severity} />
                <span className={
                  d.severity === 'error' ? 'text-red-400' :
                  d.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'
                }>
                  {d.line > 0 ? `Line ${d.line}: ` : ''}{d.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Valid subcircuit info */}
      {validation.parsed && (
        <div className="rounded border border-border bg-card/50 p-3 space-y-2" data-testid="spice-summary">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-foreground">{validation.parsed.name}</span>
            <span className="text-xs text-muted-foreground">
              {validation.parsed.ports.length} port{validation.parsed.ports.length !== 1 ? 's' : ''}
              {' · '}
              {validation.parsed.bodyLines.length} element{validation.parsed.bodyLines.length !== 1 ? 's' : ''}
              {internalNodeCount > 0 && (
                <> · {internalNodeCount} internal node{internalNodeCount !== 1 ? 's' : ''}</>
              )}
            </span>
          </div>

          {/* Parameters */}
          {Object.keys(validation.parsed.params).length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Parameters: </span>
              {Object.entries(validation.parsed.params).map(([k, v]) => `${k}=${v}`).join(', ')}
            </div>
          )}

          {/* Body summary */}
          {bodySummary && Object.keys(bodySummary).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(bodySummary).map(([type, count]) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-xs text-muted-foreground"
                >
                  {type}: {count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Port mapping panel */}
      {showMappings && mapResult && validation.parsed && (
        <div className="rounded border border-border bg-card/50 p-3 space-y-2" data-testid="spice-port-mapping">
          <div className="flex items-center gap-2 mb-1">
            <ArrowRightLeft className="w-4 h-4 text-[var(--color-editor-accent)]" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Port ↔ Pin Mapping</span>
            <RefreshCw
              className="w-3 h-3 text-muted-foreground cursor-pointer hover:text-foreground"
              onClick={() => { /* Auto-map recalculates via useMemo */ }}
              data-testid="button-refresh-mapping"
            />
          </div>

          {/* Mapped pairs */}
          {mapResult.mappings.length > 0 && (
            <div className="space-y-0.5">
              {mapResult.mappings.map((m: PortMapping) => (
                <div
                  key={`${m.portName}-${m.connectorId}`}
                  className="flex items-center gap-2 text-xs py-0.5"
                  data-testid={`mapping-${m.portName}`}
                >
                  <span className="font-mono text-[var(--color-editor-accent)]">{m.portName}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono text-foreground">{m.connectorName}</span>
                  <CheckCircle2 className="w-3 h-3 text-green-400 ml-auto" />
                </div>
              ))}
            </div>
          )}

          {/* Unmapped ports */}
          {mapResult.unmappedPorts.length > 0 && (
            <div className="space-y-0.5 pt-1 border-t border-border/50">
              <span className="text-xs text-amber-400 font-medium">Unmapped Ports</span>
              {mapResult.unmappedPorts.map((name) => (
                <div key={name} className="flex items-center gap-2 text-xs py-0.5" data-testid={`unmapped-port-${name}`}>
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span className="font-mono text-amber-400">{name}</span>
                  <span className="text-muted-foreground">— no matching pin</span>
                </div>
              ))}
            </div>
          )}

          {/* Unmapped connectors */}
          {mapResult.unmappedConnectors.length > 0 && (
            <div className="space-y-0.5 pt-1 border-t border-border/50">
              <span className="text-xs text-muted-foreground font-medium">Unmapped Pins</span>
              {mapResult.unmappedConnectors.map((name) => (
                <div key={name} className="flex items-center gap-2 text-xs py-0.5" data-testid={`unmapped-connector-${name}`}>
                  <Info className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono text-muted-foreground">{name}</span>
                  <span className="text-muted-foreground">— no matching port</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
