import type { Express } from 'express';
import { storage } from './storage';
import { registerAuthRoutes } from './routes/auth';
import { registerSettingsRoutes } from './routes/settings';
import { registerProjectRoutes } from './routes/projects';
import { registerArchitectureRoutes } from './routes/architecture';
import { registerBomRoutes } from './routes/bom';
import { registerValidationRoutes } from './routes/validation';
import { registerChatRoutes } from './routes/chat';
import { registerHistoryRoutes } from './routes/history';
import { registerComponentRoutes } from './routes/components';
import { registerSeedRoutes } from './routes/seed';
import { registerAdminRoutes } from './routes/admin';
import { registerBatchRoutes } from './routes/batch';
import { registerProjectIORoutes } from './routes/project-io';
import { registerChatBranchRoutes } from './routes/chat-branches';
import { registerSpiceModelRoutes } from './routes/spice-models';
import { registerBomSnapshotRoutes } from './routes/bom-snapshots';
import { registerDesignPreferenceRoutes } from './routes/design-preferences';
import { registerComponentLifecycleRoutes } from './routes/component-lifecycle';
import { registerDesignHistoryRoutes } from './routes/design-history';
import { registerCommentRoutes } from './routes/comments';
import { registerBackupRoutes } from './routes/backup';

// Re-export shared utilities for backward compatibility
// (consumed by circuit-routes.ts, circuit-ai.ts, and tests)
export { HttpError, asyncHandler, parseIdParam, payloadLimit, paginationSchema } from './routes/utils';

// Tech debt: domain routers import `storage` as a module singleton, while circuit-routes.ts
// and circuit-ai.ts receive it as an explicit IStorage parameter (better for test isolation).
// A future pass should align all domain routers to the DI pattern. See review notes 2026-03-02.

export async function registerRoutes(app: Express): Promise<void> {
  registerAuthRoutes(app);
  registerSettingsRoutes(app);
  registerProjectRoutes(app);
  registerArchitectureRoutes(app);
  registerBomRoutes(app);
  registerValidationRoutes(app);
  registerChatRoutes(app);
  registerHistoryRoutes(app);
  registerComponentRoutes(app);
  registerSeedRoutes(app);
  registerAdminRoutes(app);
  registerBatchRoutes(app);
  registerProjectIORoutes(app);
  registerChatBranchRoutes(app);
  registerSpiceModelRoutes(app);
  registerBomSnapshotRoutes(app);
  registerDesignPreferenceRoutes(app);
  registerComponentLifecycleRoutes(app);
  registerDesignHistoryRoutes(app);
  registerCommentRoutes(app);
  registerBackupRoutes(app);

  // --- Circuit Schematic Routes ---
  const { registerCircuitRoutes } = await import('./circuit-routes');
  registerCircuitRoutes(app, storage);

  // --- Circuit AI Routes ---
  const { registerCircuitAIRoutes } = await import('./circuit-ai');
  registerCircuitAIRoutes(app, storage);
}
