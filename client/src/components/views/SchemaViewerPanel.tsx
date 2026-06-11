import { Database, Link2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSchemaViewerSummary } from '@/lib/schema-viewer';

export default function SchemaViewerPanel() {
  const { data, isLoading, isError, refetch } = useSchemaViewerSummary();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const relatedEdges = useMemo(() => {
    if (!data || !selectedTable) {
      return [];
    }
    return data.relations.filter((rel) => rel.sourceTable === selectedTable || rel.targetTable === selectedTable);
  }, [data, selectedTable]);
  const graphNodes = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.tables.slice(0, 10).map((table, idx) => {
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      return {
        table: table.table,
        x: 36 + col * 96,
        y: 28 + row * 54,
      };
    });
  }, [data]);
  const nodePos = useMemo(() => new Map(graphNodes.map((n) => [n.table, n])), [graphNodes]);
  const graphEdges = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.relations
      .filter((rel) => nodePos.has(rel.sourceTable) && nodePos.has(rel.targetTable))
      .slice(0, 24);
  }, [data, nodePos]);

  return (
    <section className="w-full space-y-4 border border-border bg-card/40 p-4 backdrop-blur-xl" data-testid="schema-viewer-panel">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium">Schema Viewer</h3>
        </div>
        <button
          type="button"
          className="h-8.5 border border-border px-3 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => { void refetch(); }}
          data-testid="schema-viewer-refresh"
          aria-label="Refresh schema viewer data"
        >
          Refresh
        </button>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground" data-testid="schema-viewer-loading">Loading schema…</p>
      ) : null}
      {isError ? (
        <p className="text-xs text-destructive" data-testid="schema-viewer-error">Failed to load schema summary.</p>
      ) : null}
      {data ? (
        <>
          <p className="text-xs text-muted-foreground" data-testid="schema-viewer-totals">
            {String(data.totals.tables)} tables, {String(data.totals.relations)} relationships
          </p>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <div className="space-y-2" data-testid="schema-viewer-table-list">
              {data.tables.slice(0, 6).map((table) => (
                <button
                  type="button"
                  key={`${table.schema}.${table.table}`}
                  className={`w-full border p-3 text-left ${selectedTable === table.table ? 'border-primary/60 bg-primary/10' : 'border-border/60 bg-muted/10'}`}
                  onClick={() => {
                    setSelectedTable((curr) => (curr === table.table ? null : table.table));
                  }}
                  data-testid={`schema-viewer-table-${table.table}`}
                  aria-label={`Select table ${table.table}`}
                >
                  <p className="text-sm font-medium text-foreground">{table.table}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ~{String(table.rowEstimate)} rows, {String(table.columns.length)} cols
                  </p>
                </button>
              ))}
            </div>
            <div className="space-y-2" data-testid="schema-viewer-relations">
              {(selectedTable ? relatedEdges : data.relations).slice(0, 6).map((rel, idx) => (
                <div
                  key={`${rel.sourceTable}-${rel.sourceColumn}-${idx}`}
                  className={`border p-3 text-xs ${selectedTable && (rel.sourceTable === selectedTable || rel.targetTable === selectedTable) ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border/60 bg-muted/10 text-muted-foreground'}`}
                >
                  <Link2 className="w-3 h-3 inline mr-1" />
                  {rel.sourceTable}.{rel.sourceColumn} → {rel.targetTable}.{rel.targetColumn}
                </div>
              ))}
            </div>
          </div>
          {graphNodes.length > 0 ? (
            <div className="border border-border/70 bg-muted/10 p-2.5" data-testid="schema-viewer-graph">
              <p className="mb-1.5 text-xs text-muted-foreground">Relation graph</p>
              <svg viewBox="0 0 520 150" className="w-full h-[150px]" role="img" aria-label="Schema relation graph">
                {graphEdges.map((edge, idx) => {
                  const from = nodePos.get(edge.sourceTable);
                  const to = nodePos.get(edge.targetTable);
                  if (!from || !to) {
                    return null;
                  }
                  const active = selectedTable ? edge.sourceTable === selectedTable || edge.targetTable === selectedTable : false;
                  return (
                    <line
                      key={`${edge.sourceTable}-${edge.targetTable}-${idx}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                      strokeOpacity={active ? 0.9 : 0.35}
                      strokeWidth={active ? 2 : 1}
                    />
                  );
                })}
                {graphNodes.map((node) => {
                  const active = selectedTable === node.table;
                  return (
                    <g key={node.table}>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={active ? 12 : 10}
                        fill={active ? 'hsl(var(--primary))' : 'hsl(var(--card))'}
                        stroke="hsl(var(--border))"
                      />
                      <text
                        x={node.x}
                        y={node.y + 22}
                        textAnchor="middle"
                        fontSize="10"
                        fill="hsl(var(--muted-foreground))"
                      >
                        {node.table}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : null}
          {selectedTable ? (
            <p className="text-xs text-muted-foreground" data-testid="schema-viewer-selection-summary">
              Selected {selectedTable}: {String(relatedEdges.length)} related relationship{relatedEdges.length === 1 ? '' : 's'}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
