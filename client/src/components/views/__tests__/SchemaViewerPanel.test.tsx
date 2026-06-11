import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SchemaViewerPanel from '@/components/views/SchemaViewerPanel';

vi.mock('@/lib/schema-viewer', () => ({
  useSchemaViewerSummary: () => ({
    data: {
      ok: true,
      generatedAt: Date.now(),
      tables: [
        { schema: 'public', table: 'projects', rowEstimate: 12, columns: [{ name: 'id', type: 'integer' }] },
        { schema: 'public', table: 'bom_items', rowEstimate: 40, columns: [{ name: 'project_id', type: 'integer' }] },
      ],
      relations: [
        { sourceTable: 'bom_items', sourceColumn: 'project_id', targetTable: 'projects', targetColumn: 'id' },
        { sourceTable: 'chat_messages', sourceColumn: 'project_id', targetTable: 'projects', targetColumn: 'id' },
      ],
      totals: { tables: 2, relations: 2 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe('SchemaViewerPanel', () => {
  it('renders schema totals, table cards, and relations', () => {
    render(<SchemaViewerPanel />);

    expect(screen.getByTestId('schema-viewer-panel')).toBeInTheDocument();
    expect(screen.getByTestId('schema-viewer-totals').textContent).toContain('2 tables, 2 relationships');
    expect(screen.getByTestId('schema-viewer-table-list').textContent).toContain('projects');
    expect(screen.getByTestId('schema-viewer-relations').textContent).toContain('bom_items.project_id');
    expect(screen.getByTestId('schema-viewer-graph')).toBeInTheDocument();
    expect(screen.getByLabelText('Schema relation graph')).toBeInTheDocument();
  });

  it('filters relation highlights by selected table', () => {
    render(<SchemaViewerPanel />);
    fireEvent.click(screen.getByTestId('schema-viewer-table-projects'));
    expect(screen.getByTestId('schema-viewer-selection-summary').textContent).toContain('Selected projects: 2 related relationships');
    expect(screen.getByTestId('schema-viewer-relations').textContent).toContain('chat_messages.project_id');
  });
});
