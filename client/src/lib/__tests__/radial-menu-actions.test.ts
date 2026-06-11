import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  dispatchRadialCommand,
  dispatchRadialCommandDetail,
  dispatchRadialCommandPreview,
  getActionById,
  getActionsForContext,
  getLinearActionsForContext,
  getRadialCoverageEntries,
  getSupportedContextTypes,
  isRadialAiCommand,
  RADIAL_COMMAND_EVENT,
  RADIAL_COMMAND_PREVIEW_EVENT,
  radialSlotMeta,
} from '@/lib/radial-menu-actions';
import type {
  MenuContext,
  MenuContextType,
  TargetKind,
  RadialCommandEventDetail,
  RadialCommandPreviewEventDetail,
} from '@/lib/radial-menu-actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ctx(view: MenuContextType, target: TargetKind, id?: string): MenuContext {
  return { view, target, targetId: id };
}

const primaryContexts: MenuContext[] = [
  ctx('architecture', 'node'),
  ctx('architecture', 'canvas'),
  ctx('schematic', 'node'),
  ctx('schematic', 'canvas'),
  ctx('pcb', 'node'),
  ctx('pcb', 'canvas'),
  ctx('breadboard', 'node'),
  ctx('breadboard', 'canvas'),
  ctx('bom', 'bom_row'),
  ctx('validation', 'issue'),
  ctx('simulation', 'probe'),
  ctx('starter_circuits', 'starter_circuit'),
  ctx('model_3d', 'model'),
  ctx('serial', 'log_line'),
  ctx('exports', 'file'),
  ctx('firmware', 'file'),
  ctx('inventory', 'part'),
];

// ---------------------------------------------------------------------------
// getActionsForContext
// ---------------------------------------------------------------------------

describe('getActionsForContext', () => {
  describe('architecture view', () => {
    it('returns the full 8-slot node wheel', () => {
      const actions = getActionsForContext(ctx('architecture', 'node'));
      expect(actions.map((a) => a.id)).toEqual([
        'add_to_bom',
        'change_type',
        'connect',
        'ai_explain_architecture',
        'analyze_architecture',
        'delete',
        'edit',
        'duplicate',
      ]);
      expect(actions.map((a) => a.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('keeps destructive delete in the south-west slot', () => {
      const del = getActionById(ctx('architecture', 'node'), 'delete');
      expect(del?.destructive).toBe(true);
      expect(del?.slot).toBe(5);
      expect(radialSlotMeta[5].direction).toBe('SW');
    });

    it('returns stable canvas actions for non-node architecture targets', () => {
      const actions = getActionsForContext(ctx('architecture', 'wire'));
      expect(actions.map((a) => a.id)).toEqual([
        'add_node',
        'generate_architecture',
        'ai_propose_connection',
        'fit_view',
        'analyze_architecture',
        'run_validation',
        'select_all',
        'paste',
      ]);
      expect(actions.map((a) => a.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });
  });

  describe('schematic view', () => {
    it('includes transform, wire, inspect, run, delete, edit, and reuse for symbols', () => {
      const ids = getActionsForContext(ctx('schematic', 'node')).map((a) => a.id);
      expect(ids).toEqual([
        'ai_schematic_review',
        'rotate',
        'add_wire',
        'view_datasheet',
        'run_erc',
        'delete',
        'edit_properties',
        'mirror',
      ]);
    });

    it('returns canvas placement and ERC actions', () => {
      const ids = getActionsForContext(ctx('schematic', 'canvas')).map((a) => a.id);
      expect(ids).toEqual([
        'add_component',
        'add_power',
        'add_wire',
        'ai_schematic_review',
        'run_erc',
        'fit_view',
        'select_all',
        'paste',
      ]);
    });
  });

  describe('pcb view', () => {
    it('uses the object wheel for pads, vias, and traces', () => {
      for (const target of ['node', 'pad', 'via', 'trace'] as const) {
        const ids = getActionsForContext(ctx('pcb', target)).map((a) => a.id);
        expect(ids).toEqual([
          'ai_pcb_review',
          'rotate',
          'route_trace',
          'measure',
          'run_drc',
          'delete',
          'edit_pad',
          'flip_side',
        ]);
      }
    });

    it('returns canvas routing and DRC actions', () => {
      const ids = getActionsForContext(ctx('pcb', 'canvas')).map((a) => a.id);
      expect(ids).toEqual([
        'add_via',
        'ai_pcb_review',
        'route_trace',
        'measure',
        'run_drc',
        'add_keepout',
        'select_all',
        'paste',
      ]);
    });
  });

  describe('breadboard view', () => {
    it('uses the part wheel for parts and wires', () => {
      for (const target of ['node', 'wire'] as const) {
        const ids = getActionsForContext(ctx('breadboard', target)).map((a) => a.id);
        expect(ids).toEqual([
          'ai_breadboard_wiring',
          'move',
          'add_wire',
          'view_datasheet',
          'validate_wiring',
          'delete',
          'edit_properties',
          'rotate',
        ]);
      }
    });

    it('returns canvas placement and starter circuit actions', () => {
      const ids = getActionsForContext(ctx('breadboard', 'canvas')).map((a) => a.id);
      expect(ids).toEqual([
        'add_component',
        'ai_breadboard_wiring',
        'add_wire',
        'show_rails',
        'validate_wiring',
        'delete',
        'select_all',
        'starter_circuit',
      ]);
    });
  });

  describe('secondary workspaces', () => {
    it('supports BOM row and canvas command wheels', () => {
      expect(getActionsForContext(ctx('bom', 'bom_row')).map((a) => a.id)).toEqual([
        'add_to_inventory',
        'ai_part_tradeoffs',
        'find_alternates',
        'view_datasheet',
        'check_supply_risk',
        'remove',
        'edit_quantity',
        'copy_bom_row',
      ]);
      expect(getActionsForContext(ctx('bom', 'canvas')).map((a) => a.id)).toEqual([
        'add_bom_item',
        'ai_bom_plan',
        'open_bom_alternates',
        'open_bom_templates',
        'quote_bom',
        'open_supply_chain',
        'open_bom_settings',
        'export_bom_csv',
      ]);
    });

    it('returns useful command sets outside the core canvas views', () => {
      expect(getActionsForContext(ctx('validation', 'issue')).map((a) => a.id)).toEqual([
        'create_task',
        'ai_issue_fix',
        'jump_to_source',
        'explain_issue',
        'rerun_validation',
        'suppress_issue',
        'open_validation_summary',
        'copy_issue',
      ]);
      expect(getActionsForContext(ctx('simulation', 'probe')).map((a) => a.id)).toEqual([
        'add_probe',
        'ai_simulation_explain',
        'run_simulation',
        'compare_waveform',
        'sweep_simulation',
        'remove_probe',
        'simulation_settings',
        'export_waveform',
      ]);
      expect(getActionsForContext(ctx('starter_circuits', 'starter_circuit')).map((a) => a.id)).toEqual([
        'ai_starter_learn',
        'starter_show_difficulty',
        'open_starter_circuit',
        'starter_show_category',
        'starter_toggle_details',
        'starter_reset_filters',
        'copy_starter_parts',
        'copy_starter_code',
      ]);
      expect(getActionsForContext(ctx('starter_circuits', 'canvas')).map((a) => a.id)).toEqual([
        'ai_starter_learn',
        'starter_filter_beginner',
        'open_starter_circuit',
        'starter_filter_sensors',
        'starter_filter_motors',
        'starter_reset_filters',
        'starter_filter_displays',
        'copy_starter_code',
      ]);
      expect(getActionsForContext(ctx('model_3d', 'model')).map((a) => a.id)).toEqual([
        'ai_3d_fit_inspection',
        'isolate_model',
        'cross_probe',
        'measure',
        'fit_check',
        'clear_3d_scene',
        'model_properties',
        'capture_view',
      ]);
      expect(getActionsForContext(ctx('serial', 'log_line')).map((a) => a.id)).toEqual(
        expect.arrayContaining(['ai_serial_decode', 'decode_serial']),
      );
      expect(getActionsForContext(ctx('exports', 'file')).map((a) => a.id)).toEqual([
        'create_export',
        'ai_export_plan',
        'reveal_export_format',
        'open_import_design',
        'run_export_precheck',
        'open_import_history',
        'export_settings',
        'copy_export_summary',
      ]);
      expect(getActionsForContext(ctx('firmware', 'file')).map((a) => a.id)).toEqual([
        'add_firmware_snippet',
        'ai_firmware_review',
        'format_firmware',
        'open_firmware_review',
        'compile_firmware',
        'open_firmware_console',
        'firmware_settings',
        'export_firmware',
      ]);
      expect(getActionsForContext(ctx('inventory', 'part')).map((a) => a.id)).toEqual([
        'add_inventory_item',
        'ai_inventory_plan',
        'find_alternates',
        'inspect_part',
        'stock_audit',
        'remove_inventory_item',
        'edit_inventory_item',
        'print_inventory_label',
      ]);
    });
  });

  describe('action contract', () => {
    it('caps every wheel at 8 actions for instant selection', () => {
      for (const c of primaryContexts) {
        expect(getActionsForContext(c).length).toBeLessThanOrEqual(8);
      }
    });

    it('requires slot, group, description, icon, label, and id metadata', () => {
      for (const c of primaryContexts) {
        for (const action of getActionsForContext(c)) {
          expect(action.id).toBeTruthy();
          expect(action.label).toBeTruthy();
          expect(action.description).toBeTruthy();
          expect(action.icon).toBeDefined();
          expect(action.slot).toBeGreaterThanOrEqual(0);
          expect(action.slot).toBeLessThanOrEqual(7);
          expect(action.group).toBeTruthy();
          expect(radialSlotMeta[action.slot]).toBeDefined();
        }
      }
    });

    it('keeps item ids unique within each wheel', () => {
      for (const c of primaryContexts) {
        const ids = getActionsForContext(c).map((a) => a.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// getLinearActionsForContext
// ---------------------------------------------------------------------------

describe('getLinearActionsForContext', () => {
  it('keeps the architecture radial wheel capped while exposing deeper fallback commands', () => {
    const radialIds = getActionsForContext(ctx('architecture', 'canvas')).map((a) => a.id);
    const linearIds = getLinearActionsForContext(ctx('architecture', 'canvas')).map((a) => a.id);

    expect(radialIds.length).toBeLessThanOrEqual(8);
    expect(radialIds).not.toContain('copy_json');
    expect(linearIds).toEqual(
      expect.arrayContaining([
        'add_sensor',
        'ai_explain_architecture',
        'ai_expand_block',
        'toggle_grid',
        'copy_json',
        'create_schematic_instance',
      ]),
    );
  });

  it('uses the radial command set as the default linear fallback outside expanded adapters', () => {
    const context = ctx('validation', 'issue');
    expect(getLinearActionsForContext(context)).toEqual(getActionsForContext(context));
  });

  it('lets shared command lookup resolve linear-only Architecture commands', () => {
    const command = getActionById(ctx('architecture', 'canvas'), 'copy_json');
    expect(command?.label).toBe('Copy JSON');
    expect(command?.group).toBe('reuse');
  });

  it('lets shared command lookup resolve Architecture AI fallback commands', () => {
    const explain = getActionById(ctx('architecture', 'node'), 'ai_explain_architecture');
    const expand = getActionById(ctx('architecture', 'node'), 'ai_expand_block');

    expect(explain?.label).toContain('Explain');
    expect(explain?.group).toBe('inspect');
    expect(expand?.label).toBe('AI Expand');
    expect(expand?.group).toBe('transform');
  });

  it('keeps the Schematic radial wheel focused while exposing deeper fallback commands', () => {
    const radialIds = getActionsForContext(ctx('schematic', 'canvas')).map((a) => a.id);
    const linearIds = getLinearActionsForContext(ctx('schematic', 'canvas')).map((a) => a.id);

    expect(radialIds).toEqual([
      'add_component',
      'add_power',
      'add_wire',
      'ai_schematic_review',
      'run_erc',
      'fit_view',
      'select_all',
      'paste',
    ]);
    expect(linearIds).toEqual(
      expect.arrayContaining(['add_power', 'fit_view', 'toggle_grid', 'replace_component', 'add_decoupling']),
    );
  });

  it('lets shared command lookup resolve linear-only Schematic commands', () => {
    const command = getActionById(ctx('schematic', 'canvas'), 'add_power');
    expect(command?.label).toBe('Add Power');
    expect(command?.group).toBe('create');
  });

  it('keeps the PCB radial wheel focused while exposing deeper fallback commands', () => {
    const radialIds = getActionsForContext(ctx('pcb', 'canvas')).map((a) => a.id);
    const linearIds = getLinearActionsForContext(ctx('pcb', 'canvas')).map((a) => a.id);

    expect(radialIds).toEqual([
      'add_via',
      'ai_pcb_review',
      'route_trace',
      'measure',
      'run_drc',
      'add_keepout',
      'select_all',
      'paste',
    ]);
    expect(radialIds).not.toContain('add_pour');
    expect(linearIds).toEqual(expect.arrayContaining(['add_pour', 'add_keepout', 'add_comment', 'fit_view', 'copy']));
  });

  it('exposes selected-footprint PCB fallback commands without crowding the node wheel', () => {
    const radialIds = getActionsForContext(ctx('pcb', 'node')).map((a) => a.id);
    const linearIds = getLinearActionsForContext(ctx('pcb', 'node')).map((a) => a.id);

    expect(radialIds).toEqual([
      'ai_pcb_review',
      'rotate',
      'route_trace',
      'measure',
      'run_drc',
      'delete',
      'edit_pad',
      'flip_side',
    ]);
    expect(linearIds).toEqual(expect.arrayContaining(['fit_view', 'select_all', 'copy', 'paste']));
  });

  it('lets shared command lookup resolve linear-only PCB commands', () => {
    const command = getActionById(ctx('pcb', 'canvas'), 'add_pour');
    expect(command?.label).toBe('Copper Pour');
    expect(command?.group).toBe('create');
  });
});

// ---------------------------------------------------------------------------
// getSupportedContextTypes
// ---------------------------------------------------------------------------

describe('getSupportedContextTypes', () => {
  it('returns all supported context types', () => {
    expect(getSupportedContextTypes()).toEqual([
      'architecture',
      'schematic',
      'pcb',
      'breadboard',
      'bom',
      'validation',
      'simulation',
      'starter_circuits',
      'model_3d',
      'serial',
      'exports',
      'firmware',
      'inventory',
    ]);
  });

  it('returns a new array each call', () => {
    const a = getSupportedContextTypes();
    const b = getSupportedContextTypes();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// getRadialCoverageEntries
// ---------------------------------------------------------------------------

describe('getRadialCoverageEntries', () => {
  it('summarizes full, ready, and empty radial coverage without running commands', () => {
    const coverage = getRadialCoverageEntries();
    const architectureNode = coverage.find((entry) => entry.key === 'architecture-node');
    const architectureCanvas = coverage.find((entry) => entry.key === 'architecture-canvas');
    const bomCanvas = coverage.find((entry) => entry.key === 'bom-canvas');
    const bomRow = coverage.find((entry) => entry.key === 'bom-bom_row');
    const breadboardCanvas = coverage.find((entry) => entry.key === 'breadboard-canvas');
    const starterCircuit = coverage.find((entry) => entry.key === 'starter_circuits-starter_circuit');
    const starterCanvas = coverage.find((entry) => entry.key === 'starter_circuits-canvas');
    const exportsFile = coverage.find((entry) => entry.key === 'exports-file');
    const firmwareFile = coverage.find((entry) => entry.key === 'firmware-file');
    const inventoryPart = coverage.find((entry) => entry.key === 'inventory-part');
    const model3d = coverage.find((entry) => entry.key === 'model_3d-model');
    const pcbCanvas = coverage.find((entry) => entry.key === 'pcb-canvas');
    const schematicCanvas = coverage.find((entry) => entry.key === 'schematic-canvas');
    const simulationProbe = coverage.find((entry) => entry.key === 'simulation-probe');
    const validationIssue = coverage.find((entry) => entry.key === 'validation-issue');

    expect(coverage.length).toBeGreaterThan(getSupportedContextTypes().length);
    expect(architectureNode).toMatchObject({
      commandCount: 8,
      emptySlotCount: 0,
      coverageLevel: 'full',
      aiCommandCount: 1,
    });
    expect(architectureCanvas).toMatchObject({
      commandCount: 8,
      emptySlotCount: 0,
      coverageLevel: 'full',
      aiCommandCount: 2,
    });
    expect(bomCanvas).toMatchObject({
      commandCount: 8,
      emptySlotCount: 0,
      coverageLevel: 'full',
      aiCommandCount: 1,
    });
    expect(bomRow).toMatchObject({
      commandCount: 8,
      emptySlotCount: 0,
      coverageLevel: 'full',
      aiCommandCount: 1,
    });
    expect(breadboardCanvas).toMatchObject({
      commandCount: 8,
      emptySlotCount: 0,
      coverageLevel: 'full',
      aiCommandCount: 1,
    });
    expect(starterCanvas).toMatchObject({
      commandCount: 8,
      emptySlotCount: 0,
      coverageLevel: 'full',
      aiCommandCount: 1,
    });
    expect(starterCircuit).toMatchObject({
      commandCount: 8,
      emptySlotCount: 0,
      coverageLevel: 'full',
      aiCommandCount: 1,
    });
    expect(exportsFile).toMatchObject({
      commandCount: 8,
      emptySlotCount: 0,
      coverageLevel: 'full',
      aiCommandCount: 1,
    });
    expect(firmwareFile).toMatchObject({
      commandCount: 8,
      emptySlotCount: 0,
      coverageLevel: 'full',
      aiCommandCount: 1,
    });
    expect(inventoryPart).toMatchObject({
      commandCount: 8,
      emptySlotCount: 0,
      coverageLevel: 'full',
      aiCommandCount: 1,
    });
    expect(model3d).toMatchObject({
      commandCount: 8,
      emptySlotCount: 0,
      coverageLevel: 'full',
      aiCommandCount: 1,
    });
    expect(pcbCanvas).toMatchObject({
      commandCount: 8,
      emptySlotCount: 0,
      coverageLevel: 'full',
      aiCommandCount: 1,
    });
    expect(schematicCanvas).toMatchObject({
      commandCount: 8,
      emptySlotCount: 0,
      coverageLevel: 'full',
      aiCommandCount: 1,
    });
    expect(simulationProbe).toMatchObject({
      commandCount: 8,
      emptySlotCount: 0,
      coverageLevel: 'full',
      aiCommandCount: 1,
    });
    expect(validationIssue).toMatchObject({
      commandCount: 8,
      emptySlotCount: 0,
      coverageLevel: 'full',
      aiCommandCount: 2,
    });
  });

  it('tracks linear fallback depth beside the capped radial wheel', () => {
    const coverage = getRadialCoverageEntries();
    const pcbCanvas = coverage.find((entry) => entry.key === 'pcb-canvas');

    expect(pcbCanvas?.commandCount).toBe(8);
    expect(pcbCanvas?.linearCommandCount).toBeGreaterThan(pcbCanvas?.commandCount ?? 0);
    expect(pcbCanvas?.commandIds).toEqual([
      'add_via',
      'ai_pcb_review',
      'route_trace',
      'measure',
      'run_drc',
      'add_keepout',
      'select_all',
      'paste',
    ]);
  });

  it('shares AI command detection with the customizer coverage map', () => {
    const generate = getActionById(ctx('architecture', 'canvas'), 'generate_architecture');
    const addNode = getActionById(ctx('architecture', 'canvas'), 'add_node');

    expect(generate && isRadialAiCommand(generate)).toBe(true);
    expect(addNode && isRadialAiCommand(addNode)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dispatchRadialCommand
// ---------------------------------------------------------------------------

describe('dispatchRadialCommand', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('broadcasts a command detail and reports handled commands', () => {
    const listener = vi.fn((event: Event) => {
      const detail = (event as CustomEvent<RadialCommandEventDetail>).detail;
      detail.handled = true;
    });
    window.addEventListener(RADIAL_COMMAND_EVENT, listener);

    const handled = dispatchRadialCommand({
      commandId: 'add_node',
      context: { view: 'architecture', target: 'canvas', pointer: { x: 20, y: 30 } },
    });

    expect(handled).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    const detail = (listener.mock.calls[0][0] as CustomEvent<RadialCommandEventDetail>).detail;
    expect(detail).toMatchObject({
      commandId: 'add_node',
      source: 'radial-menu',
      context: { view: 'architecture', target: 'canvas', pointer: { x: 20, y: 30 } },
      handled: true,
    });

    window.removeEventListener(RADIAL_COMMAND_EVENT, listener);
  });

  it('returns false when no view adapter handles the command', () => {
    expect(
      dispatchRadialCommand({
        commandId: 'not_wired_yet',
        context: ctx('firmware', 'file'),
      }),
    ).toBe(false);
  });

  it('returns mutated command details for undo-aware adapters', () => {
    const undo = vi.fn();
    const listener = vi.fn((event: Event) => {
      const detail = (event as CustomEvent<RadialCommandEventDetail>).detail;
      detail.handled = true;
      detail.undo = {
        label: 'Restore node',
        description: 'Restore the deleted node.',
        run: undo,
      };
    });
    window.addEventListener(RADIAL_COMMAND_EVENT, listener);

    const detail = dispatchRadialCommandDetail({
      commandId: 'delete',
      context: ctx('architecture', 'node'),
    });

    expect(detail.handled).toBe(true);
    expect(detail.undo?.label).toBe('Restore node');
    detail.undo?.run();
    expect(undo).toHaveBeenCalledTimes(1);

    window.removeEventListener(RADIAL_COMMAND_EVENT, listener);
  });
});

// ---------------------------------------------------------------------------
// dispatchRadialCommandPreview
// ---------------------------------------------------------------------------

describe('dispatchRadialCommandPreview', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('broadcasts show and clear preview details for canvas adapters', () => {
    const listener = vi.fn();
    window.addEventListener(RADIAL_COMMAND_PREVIEW_EVENT, listener);

    dispatchRadialCommandPreview({
      phase: 'show',
      commandId: 'route_trace',
      context: { view: 'pcb', target: 'canvas', pointer: { x: 320, y: 240 } },
    });
    dispatchRadialCommandPreview({ phase: 'clear' });

    expect(listener).toHaveBeenCalledTimes(2);
    const showDetail = (listener.mock.calls[0][0] as CustomEvent<RadialCommandPreviewEventDetail>).detail;
    expect(showDetail).toMatchObject({
      phase: 'show',
      commandId: 'route_trace',
      source: 'radial-menu',
      context: { view: 'pcb', target: 'canvas', pointer: { x: 320, y: 240 } },
    });
    const clearDetail = (listener.mock.calls[1][0] as CustomEvent<RadialCommandPreviewEventDetail>).detail;
    expect(clearDetail).toMatchObject({
      phase: 'clear',
      source: 'radial-menu',
    });

    window.removeEventListener(RADIAL_COMMAND_PREVIEW_EVENT, listener);
  });
});
