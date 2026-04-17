/**
 * chat-cache-invalidation
 * ---------------------------------------------------------------------------
 * Narrow, tool-aware TanStack Query cache invalidation for ChatPanel.
 *
 * Why this module exists
 * ----------------------
 * Previously `ChatPanel` called `queryClient.invalidateQueries()` with no
 * arguments after every server-side AI tool call. That nukes the ENTIRE
 * query cache — dozens of unrelated queries across supply-chain, arduino
 * jobs, simulation scenarios, vault, spice-models, component library, etc.
 * — forcing a full refetch storm and UI flicker even when the AI only
 * touched a single BOM row.
 *
 * This module maps each tool name to the query-key prefix(es) that the
 * tool actually mutates. `invalidateAfterToolCalls` collects the union of
 * affected prefixes and invalidates only those.
 *
 * Fail-safe behaviour
 * -------------------
 * - If ANY executed tool is listed in {@link SCORCHED_EARTH_TOOLS}, we fall
 *   back to a full `invalidateQueries()` because those tools genuinely
 *   rewrite large swaths of project state.
 * - If a tool name has NO entry in {@link TOOL_INVALIDATION_MAP}, we also
 *   fall back to a full invalidation and log a warning. Stale data is a
 *   worse bug than a transient perf hit — when a new tool is added, the
 *   map MUST be extended to retain the perf win.
 *
 * Query-key conventions in this codebase
 * --------------------------------------
 * TanStack queries in ProtoPulse use two styles:
 *   1) Path-based keys that start with a URL literal:
 *      `[\`/api/projects/\${projectId}/bom-snapshots\`]`
 *   2) Name-based keys:
 *      `['circuit-designs', projectId]`, `['component-parts', projectId]`
 *
 * `queryClient.invalidateQueries({ queryKey: [prefix] })` in TanStack v5
 * does a prefix match against each query's key array, so a single string
 * prefix like `'circuit-designs'` invalidates every query whose first key
 * element equals that string — regardless of trailing args. Path-based
 * queries are invalidated by passing the exact leading URL string.
 */

import type { QueryClient } from '@tanstack/react-query';
import type { ToolCallInfo } from '@/lib/project-context';

/**
 * Tools that legitimately touch so much state that a narrow invalidation
 * would be incomplete or pathological. For these we fall back to a full
 * invalidate so downstream callers see fresh data everywhere.
 *
 * NOTE: `restore_snapshot` is listed defensively for a forward-compat
 * hook; it is not currently registered as an AI tool but matches the
 * project's snapshot API and will be safe-by-default if added later.
 */
export const SCORCHED_EARTH_TOOLS: ReadonlySet<string> = new Set([
  'clear_canvas',
  'generate_architecture',
  'restore_snapshot',
]);

/**
 * Map of tool name → list of query-key prefix tokens to invalidate.
 *
 * Each entry is the FIRST element of the query key array as used by
 * consumers across `client/src/`. Path-based keys are written as the
 * literal URL fragment so TanStack matches by string equality on the
 * leading element.
 *
 * When adding a new tool:
 *   1. Identify every `useQuery` whose data the tool mutates.
 *   2. Add that query's first key element to this list.
 *   3. Keep prefixes minimal — over-invalidating defeats the purpose.
 */
export const TOOL_INVALIDATION_MAP: Record<string, readonly string[]> = {
  // ---------------- architecture canvas ----------------
  add_node: [],
  remove_node: [],
  update_node: [],
  connect_nodes: [],
  remove_edge: [],
  auto_layout: [],
  add_subcircuit: [],
  assign_net_name: [],
  set_pin_map: [],
  auto_assign_pins: [],
  // Architecture/canvas state is Context-held (see project-context.tsx),
  // not TanStack-cached, so pure canvas edits need no query invalidation.
  // They can still surface through `component-part-node` joins:
  create_sheet: [],
  rename_sheet: [],
  move_to_sheet: [],

  // ---------------- BOM ----------------
  add_bom_item: ['/api/projects'], // bom-snapshots/bom-diff paths start with /api/projects
  update_bom_item: ['/api/projects'],
  remove_bom_item: ['/api/projects'],
  pricing_lookup: ['/api/projects'],
  suggest_alternatives: ['/api/projects'],
  optimize_bom: ['/api/projects'],
  check_lead_times: ['/api/projects'],
  add_datasheet_link: ['/api/projects'],
  analyze_bom_optimization: ['/api/projects'],
  suggest_alternate_part: ['/api/projects'],
  consolidate_packages: ['/api/projects'],

  // ---------------- validation ----------------
  run_validation: ['/api/projects'],
  clear_validation: ['/api/projects'],
  add_validation_issue: ['/api/projects'],
  auto_fix_validation: ['/api/projects'],

  // ---------------- component library / parts ----------------
  create_component_part: ['component-parts', 'component-library', 'parts'],
  modify_component: ['component-parts', 'component-library', 'parts', 'component-part', 'component-part-node'],
  delete_component_part: ['component-parts', 'component-library', 'parts'],
  fork_library_component: ['component-parts', 'component-library'],

  // ---------------- circuits ----------------
  create_circuit: ['circuit-designs', 'circuit-roots'],
  expand_architecture_to_circuit: ['circuit-designs', 'circuit-roots', 'circuit-instances', 'circuit-nets', 'circuit-wires', 'hierarchical-ports'],
  place_component: ['circuit-instances', 'circuit-children'],
  remove_component_instance: ['circuit-instances', 'circuit-children'],
  draw_net: ['circuit-nets', 'circuit-wires'],
  remove_net: ['circuit-nets', 'circuit-wires'],
  add_net_label: ['circuit-nets'],
  place_power_symbol: ['circuit-instances'],
  place_no_connect: ['circuit-instances'],
  place_breadboard_wire: ['circuit-wires'],
  remove_wire: ['circuit-wires'],
  draw_pcb_trace: ['circuit-wires', 'pcb-zones'],
  auto_route: ['circuit-wires'],
  auto_stitch_vias: ['circuit-vias'],
  generate_teardrops: ['circuit-wires'],

  // ---------------- design history / decisions ----------------
  save_design_decision: ['/api/projects'],

  // ---------------- read-only / export (no cache mutation) ----------------
  query_nodes: [],
  query_edges: [],
  query_bom_items: [],
  search_parts: [],
  get_part: [],
  get_alternates: [],
  check_stock: [],
  suggest_substitute: [],
  lookup_datasheet: [],
  lookup_datasheet_for_part: [],
  compare_parts: [],
  compare_components: [],
  recommend_part_for: [],
  parametric_search: [],
  search_datasheet: [],
  explain_design_tradeoffs: [],
  select_node: [],
  focus_node_in_view: [],
  copy_architecture_summary: [],
  copy_architecture_json: [],
  run_erc: [],
  power_budget_analysis: [],
  voltage_domain_check: [],
  dfm_check: [],
  thermal_analysis: [],
  generate_test_plan: [],
  design_review: [],
  hardware_debug_analysis: [],
  explain_net: [],
  explain_circuit_code: [],
  suggest_net_names: [],
  suggest_trace_path: [],
  generate_circuit_code: [],
  validate_component: [],
  suggest_components: [],
  generate_circuit_candidates: [],
  export_bom_csv: [],
  export_kicad: [],
  export_spice: [],
  preview_gerber: [],
  export_design_report: [],
  export_gerber: [],
  export_kicad_netlist: [],
  export_csv_netlist: [],
  export_pick_and_place: [],
  export_eagle: [],
  export_fritzing_project: [],
  trigger_export: [],

  // ---------------- arduino (advisory; arduino queries self-invalidate) ----------------
  generate_arduino_sketch: [],
  compile_sketch: ['arduino-jobs', 'arduino', 'arduino-files'],
  upload_firmware: ['arduino-jobs', 'arduino'],
  search_arduino_libraries: [],
  list_arduino_boards: [],
};

/**
 * Narrow cache invalidation for a batch of server-executed tool calls.
 *
 * Collects the union of affected query-key prefixes across all tool calls
 * in `toolCalls`, deduplicates, and fires one `invalidateQueries` per
 * unique prefix. Falls back to a full `invalidateQueries()` when:
 *   - any tool is a member of {@link SCORCHED_EARTH_TOOLS}, OR
 *   - any tool name has no entry in {@link TOOL_INVALIDATION_MAP}
 *     (safety-first: unknown mutations must not silently leave stale data).
 *
 * @param queryClient - The TanStack Query client to invalidate.
 * @param _projectId  - Current project id. Reserved for future use when we
 *                      scope path-based invalidations more precisely; kept
 *                      in the signature so callers don't have to refactor
 *                      later. The underscore suppresses unused-arg lints.
 * @param toolCalls   - The `toolCalls` array from an SSE `done` event.
 */
export function invalidateAfterToolCalls(
  queryClient: Pick<QueryClient, 'invalidateQueries'>,
  _projectId: number | null | undefined,
  toolCalls: ReadonlyArray<Pick<ToolCallInfo, 'name'>> | undefined,
): void {
  if (!toolCalls || toolCalls.length === 0) {
    return;
  }

  // Check scorched-earth first — if ANY tool demands a full nuke, do it.
  const scorched = toolCalls.some((tc) => SCORCHED_EARTH_TOOLS.has(tc.name));
  if (scorched) {
    void queryClient.invalidateQueries();
    return;
  }

  // Check for unknown tool names — safety-first fallback.
  const unknown = toolCalls.find((tc) => !(tc.name in TOOL_INVALIDATION_MAP));
  if (unknown) {
    // eslint-disable-next-line no-console
    console.warn(
      `[chat-cache-invalidation] Unknown tool "${unknown.name}" — falling back to full cache invalidation. ` +
        `Add an entry to TOOL_INVALIDATION_MAP to restore narrow invalidation.`,
    );
    void queryClient.invalidateQueries();
    return;
  }

  // Collect unique prefixes across all tool calls.
  const prefixes = new Set<string>();
  for (const tc of toolCalls) {
    const entry = TOOL_INVALIDATION_MAP[tc.name];
    if (!entry) continue;
    for (const p of entry) prefixes.add(p);
  }

  // Fire one narrow invalidation per unique prefix.
  for (const prefix of prefixes) {
    void queryClient.invalidateQueries({ queryKey: [prefix] });
  }
}
