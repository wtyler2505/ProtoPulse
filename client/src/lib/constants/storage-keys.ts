/**
 * Centralized localStorage key constants.
 * All localStorage access should use these constants instead of string literals.
 */
export const STORAGE_KEYS = {
  // AI settings (ChatPanel)
  AI_PROVIDER: 'protopulse_ai_provider',
  AI_MODEL: 'protopulse_ai_model',
  AI_TEMPERATURE: 'protopulse_ai_temp',
  AI_SYSTEM_PROMPT: 'protopulse_ai_sysprompt',
  ROUTING_STRATEGY: 'protopulse_routing_strategy',

  // Procurement settings (ProcurementView)
  OPTIMIZATION_GOAL: 'protopulse_optimization_goal',
  PREFERRED_SUPPLIERS: 'protopulse_preferred_suppliers',
  BOM_SORT_ORDER: 'protopulse_bom_sort_order',

  // Asset manager (AssetManager)
  // Keys intentionally unprefixed — pre-existing data in user browsers
  ASSET_FAVORITES: 'asset-favorites',
  ASSET_RECENT: 'asset-recent',
  ASSET_CUSTOM: 'asset-custom',
} as const;
