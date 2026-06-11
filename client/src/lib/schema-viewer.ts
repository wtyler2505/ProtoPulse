import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface SchemaViewerTable {
  schema: string;
  table: string;
  rowEstimate: number;
  columns: Array<{ name: string; type: string }>;
}

export interface SchemaViewerRelation {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}

export interface SchemaViewerSummary {
  ok: boolean;
  generatedAt: number;
  tables: SchemaViewerTable[];
  relations: SchemaViewerRelation[];
  totals: {
    tables: number;
    relations: number;
  };
}

export function useSchemaViewerSummary() {
  return useQuery<SchemaViewerSummary>({
    queryKey: ['schema-viewer-summary'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/schema-viewer/summary');
      return res.json() as Promise<SchemaViewerSummary>;
    },
  });
}

