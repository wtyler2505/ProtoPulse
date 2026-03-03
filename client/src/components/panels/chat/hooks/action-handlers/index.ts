import { navigationHandlers } from './navigation';
import { architectureHandlers } from './architecture';
import { bomHandlers } from './bom';
import { validationHandlers } from './validation';
import { exportHandlers } from './export';
import { miscHandlers } from './misc';
import type { ActionHandler } from './types';

export type { ActionHandler, ActionContext, ActionState } from './types';

export const ACTION_HANDLERS: Record<string, ActionHandler> = {
  ...navigationHandlers,
  ...architectureHandlers,
  ...bomHandlers,
  ...validationHandlers,
  ...exportHandlers,
  ...miscHandlers,
};
