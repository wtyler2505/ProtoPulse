import type { Express } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';

interface TableSummaryRow {
  [key: string]: unknown;
  schema_name: string;
  table_name: string;
  row_estimate: string;
}

interface ColumnSummaryRow {
  [key: string]: unknown;
  table_name: string;
  column_name: string;
  data_type: string;
}

interface RelationSummaryRow {
  [key: string]: unknown;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
}

export function registerSchemaViewerRoutes(app: Express): void {
  app.get('/api/schema-viewer/summary', async (_req, res) => {
    try {
      const tablesResult = await db.execute<TableSummaryRow>(sql`
        SELECT
          n.nspname::text AS schema_name,
          c.relname::text AS table_name,
          COALESCE(c.reltuples, 0)::bigint::text AS row_estimate
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY n.nspname, c.relname
        LIMIT 80
      `);

      const columnsResult = await db.execute<ColumnSummaryRow>(sql`
        SELECT
          table_name::text,
          column_name::text,
          data_type::text
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);

      const relationsResult = await db.execute<RelationSummaryRow>(sql`
        SELECT
          tc.table_name::text AS source_table,
          kcu.column_name::text AS source_column,
          ccu.table_name::text AS target_table,
          ccu.column_name::text AS target_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name
      `);

      const columnsByTable = new Map<string, ColumnSummaryRow[]>();
      for (const row of columnsResult.rows) {
        const key = row.table_name;
        const list = columnsByTable.get(key) ?? [];
        list.push(row);
        columnsByTable.set(key, list);
      }

      const tables = tablesResult.rows.map((row) => ({
        schema: row.schema_name,
        table: row.table_name,
        rowEstimate: Number(row.row_estimate),
        columns: (columnsByTable.get(row.table_name) ?? []).slice(0, 12).map((col) => ({
          name: col.column_name,
          type: col.data_type,
        })),
      }));

      const relations = relationsResult.rows.map((row) => ({
        sourceTable: row.source_table,
        sourceColumn: row.source_column,
        targetTable: row.target_table,
        targetColumn: row.target_column,
      }));

      return res.status(200).json({
        ok: true,
        generatedAt: Date.now(),
        tables,
        relations,
        totals: {
          tables: tables.length,
          relations: relations.length,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown schema summary error';
      return res.status(500).json({
        ok: false,
        message,
        tables: [],
        relations: [],
        totals: { tables: 0, relations: 0 },
      });
    }
  });
}
