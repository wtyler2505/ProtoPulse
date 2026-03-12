/**
 * Generates shared/api-types.generated.ts from Drizzle schema + Zod insert schemas.
 * Run: npm run types:generate
 *
 * This script reads the entity catalog defined below (mirroring shared/schema.ts exports)
 * and writes a clean type barrel with:
 *   - Re-exports of all select types and insert types
 *   - Partial "Patch" types for update operations
 *   - Generic API response wrappers
 *   - Entity-specific response type aliases
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Entity catalog — mirrors shared/schema.ts exports exactly
// ---------------------------------------------------------------------------

interface EntityDef {
  /** PascalCase select type name exported from schema.ts */
  selectType: string;
  /** PascalCase insert type name exported from schema.ts (null if none) */
  insertType: string | null;
  /** camelCase Zod insert schema variable name exported from schema.ts (null if none) */
  insertSchemaName: string | null;
  /** Short name used for API response aliases (e.g. "Project" -> ProjectResponse) */
  apiName: string;
}

const entities: EntityDef[] = [
  { selectType: 'Project', insertType: 'InsertProject', insertSchemaName: 'insertProjectSchema', apiName: 'Project' },
  { selectType: 'ArchitectureNode', insertType: 'InsertArchitectureNode', insertSchemaName: 'insertArchitectureNodeSchema', apiName: 'ArchitectureNode' },
  { selectType: 'ArchitectureEdge', insertType: 'InsertArchitectureEdge', insertSchemaName: 'insertArchitectureEdgeSchema', apiName: 'ArchitectureEdge' },
  { selectType: 'BomItem', insertType: 'InsertBomItem', insertSchemaName: 'insertBomItemSchema', apiName: 'BomItem' },
  { selectType: 'ValidationIssue', insertType: 'InsertValidationIssue', insertSchemaName: 'insertValidationIssueSchema', apiName: 'ValidationIssue' },
  { selectType: 'ChatMessage', insertType: 'InsertChatMessage', insertSchemaName: 'insertChatMessageSchema', apiName: 'ChatMessage' },
  { selectType: 'HistoryItem', insertType: 'InsertHistoryItem', insertSchemaName: 'insertHistoryItemSchema', apiName: 'HistoryItem' },
  { selectType: 'User', insertType: 'InsertUser', insertSchemaName: 'insertUserSchema', apiName: 'User' },
  { selectType: 'Session', insertType: null, insertSchemaName: null, apiName: 'Session' },
  { selectType: 'ApiKeyRecord', insertType: null, insertSchemaName: null, apiName: 'ApiKey' },
  { selectType: 'UserChatSettings', insertType: 'InsertUserChatSettings', insertSchemaName: 'insertUserChatSettingsSchema', apiName: 'UserChatSettings' },
  { selectType: 'ComponentPart', insertType: 'InsertComponentPart', insertSchemaName: 'insertComponentPartSchema', apiName: 'ComponentPart' },
  { selectType: 'ComponentLibraryEntry', insertType: 'InsertComponentLibrary', insertSchemaName: 'insertComponentLibrarySchema', apiName: 'ComponentLibrary' },
  { selectType: 'CircuitDesignRow', insertType: 'InsertCircuitDesign', insertSchemaName: 'insertCircuitDesignSchema', apiName: 'CircuitDesign' },
  { selectType: 'CircuitInstanceRow', insertType: 'InsertCircuitInstance', insertSchemaName: 'insertCircuitInstanceSchema', apiName: 'CircuitInstance' },
  { selectType: 'CircuitNetRow', insertType: 'InsertCircuitNet', insertSchemaName: 'insertCircuitNetSchema', apiName: 'CircuitNet' },
  { selectType: 'CircuitWireRow', insertType: 'InsertCircuitWire', insertSchemaName: 'insertCircuitWireSchema', apiName: 'CircuitWire' },
  { selectType: 'CircuitViaRow', insertType: 'InsertCircuitVia', insertSchemaName: 'insertCircuitViaSchema', apiName: 'CircuitVia' },
  { selectType: 'SimulationResultRow', insertType: 'InsertSimulationResult', insertSchemaName: 'insertSimulationResultSchema', apiName: 'SimulationResult' },
  { selectType: 'SimulationScenario', insertType: 'InsertSimulationScenario', insertSchemaName: 'insertSimulationScenarioSchema', apiName: 'SimulationScenario' },
  { selectType: 'ArduinoWorkspace', insertType: 'InsertArduinoWorkspace', insertSchemaName: 'insertArduinoWorkspaceSchema', apiName: 'ArduinoWorkspace' },
  { selectType: 'ArduinoBuildProfile', insertType: 'InsertArduinoBuildProfile', insertSchemaName: 'insertArduinoBuildProfileSchema', apiName: 'ArduinoBuildProfile' },
  { selectType: 'ArduinoJob', insertType: 'InsertArduinoJob', insertSchemaName: 'insertArduinoJobSchema', apiName: 'ArduinoJob' },
  { selectType: 'ArduinoSerialSession', insertType: 'InsertArduinoSerialSession', insertSchemaName: 'insertArduinoSerialSessionSchema', apiName: 'ArduinoSerialSession' },
  { selectType: 'ArduinoSketchFile', insertType: 'InsertArduinoSketchFile', insertSchemaName: 'insertArduinoSketchFileSchema', apiName: 'ArduinoSketchFile' },
  { selectType: 'AiActionRow', insertType: 'InsertAiAction', insertSchemaName: 'insertAiActionSchema', apiName: 'AiAction' },
];

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

function generateApiTypes(): string {
  const lines: string[] = [];

  // Header
  lines.push('// AUTO-GENERATED by script/generate-api-types.ts — do not edit manually');
  lines.push('// Run `npm run types:generate` to regenerate');
  lines.push('');

  // Collect all type names for the import statement
  const importedTypes: string[] = [];
  for (const entity of entities) {
    importedTypes.push(entity.selectType);
    if (entity.insertType) {
      importedTypes.push(entity.insertType);
    }
  }

  lines.push(`import type {`);
  for (let i = 0; i < importedTypes.length; i++) {
    const comma = i < importedTypes.length - 1 ? ',' : ',';
    lines.push(`  ${importedTypes[i]}${comma}`);
  }
  lines.push(`} from './schema';`);
  lines.push('');

  // Re-export all entity types
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('// Re-exported entity types');
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('');

  const selectTypes = entities.map((e) => e.selectType);
  const insertTypes = entities.filter((e) => e.insertType).map((e) => e.insertType as string);
  lines.push(`export type { ${selectTypes.join(', ')} } from './schema';`);
  lines.push(`export type { ${insertTypes.join(', ')} } from './schema';`);
  lines.push('');

  // Patch (partial insert) types
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('// Patch types — Partial<InsertType> for update/PATCH operations');
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('');

  for (const entity of entities) {
    if (entity.insertType) {
      lines.push(`export type Patch${entity.apiName} = Partial<${entity.insertType}>;`);
    }
  }
  lines.push('');

  // Generic API response wrappers
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('// Generic API response wrappers');
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('');
  lines.push('export interface ApiResponse<T> {');
  lines.push('  data: T;');
  lines.push('}');
  lines.push('');
  lines.push('export interface ApiListResponse<T> {');
  lines.push('  data: T[];');
  lines.push('}');
  lines.push('');
  lines.push('export interface ApiError {');
  lines.push('  error: string;');
  lines.push('  status: number;');
  lines.push('}');
  lines.push('');
  lines.push('export interface PaginatedResponse<T> {');
  lines.push('  data: T[];');
  lines.push('  total: number;');
  lines.push('  page: number;');
  lines.push('  pageSize: number;');
  lines.push('}');
  lines.push('');

  // Entity-specific response type aliases
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('// Entity-specific response types');
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('');

  for (const entity of entities) {
    lines.push(`export type ${entity.apiName}Response = ApiResponse<${entity.selectType}>;`);
    lines.push(`export type ${entity.apiName}ListResponse = ApiListResponse<${entity.selectType}>;`);
  }
  lines.push('');

  // Zod schema re-exports (runtime validators)
  const schemaExports = entities
    .filter((e) => e.insertSchemaName)
    .map((e) => e.insertSchemaName as string);

  lines.push('// ---------------------------------------------------------------------------');
  lines.push('// Zod schema re-exports (runtime validators)');
  lines.push('// ---------------------------------------------------------------------------');
  lines.push('');
  lines.push(`export { ${schemaExports.join(', ')} } from './schema';`);
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const outputPath = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..', 'shared', 'api-types.generated.ts');
  const content = generateApiTypes();

  fs.writeFileSync(outputPath, content, 'utf-8');

  const entityCount = entities.length;
  const insertCount = entities.filter((e) => e.insertType).length;
  const patchCount = insertCount;
  const responseCount = entityCount * 2; // Response + ListResponse per entity

  console.log(`Generated ${outputPath}`);
  console.log(`  ${entityCount} select types`);
  console.log(`  ${insertCount} insert types`);
  console.log(`  ${patchCount} patch types`);
  console.log(`  ${responseCount} response type aliases`);
  console.log(`  ${schemaExports.length} Zod schema re-exports`);

  // Self-check: read back and count export statements
  const written = fs.readFileSync(outputPath, 'utf-8');
  const exportLines = written.split('\n').filter((l) => l.startsWith('export'));
  console.log(`  ${exportLines.length} total export statements`);
}

const schemaExports = entities
  .filter((e) => e.insertSchemaName)
  .map((e) => e.insertSchemaName as string);

main();
