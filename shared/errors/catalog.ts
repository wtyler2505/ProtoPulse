/**
 * Assembled error catalog — merges all 9 domain catalogs into a single
 * Record<ErrorCode, ErrorCatalogEntry>.
 */

import type { ErrorCode } from './error-codes';
import type { ErrorCatalogEntry } from './error-types';
import { authCatalog } from './catalog-auth';
import { validationCatalog } from './catalog-validation';
import { exportCatalog } from './catalog-export';
import { importCatalog } from './catalog-import';
import { circuitCatalog } from './catalog-circuit';
import { aiCatalog } from './catalog-ai';
import { storageCatalog } from './catalog-storage';
import { projectCatalog } from './catalog-project';
import { systemCatalog } from './catalog-system';

export const errorCatalog: Record<ErrorCode, ErrorCatalogEntry> = {
  ...authCatalog,
  ...validationCatalog,
  ...exportCatalog,
  ...importCatalog,
  ...circuitCatalog,
  ...aiCatalog,
  ...storageCatalog,
  ...projectCatalog,
  ...systemCatalog,
} as Record<ErrorCode, ErrorCatalogEntry>;
