/**
 * Circuit tools — barrel module.
 *
 * Composes schematic, PCB, DSL, advanced PCB, and net-explanation tools into
 * three public registration functions. Individual categories live under
 * `./circuit/*`.
 *
 * Public API (unchanged from the previous monolithic file):
 *   - `registerCircuitTools(registry)`      — schematic: create/place/draw/net/annotate/ERC
 *   - `registerPcbTools(registry)`          — breadboard + PCB traces + auto-route
 *   - `registerCircuitCodeTools(registry)`  — DSL generate/explain, pcb-advanced, net-explain
 *   - `classifyNet`, `classifyInstanceRole`, `buildNetExplanation`, `NetClassification`
 *
 * @module ai-tools/circuit
 */

import type { ToolRegistry } from './registry';
import { registerCircuitCodeDslTools } from './circuit/code-dsl';
import { registerPcbAdvancedTools } from './circuit/pcb-advanced';
import { registerNetExplainTool } from './circuit/net-explain';

export { registerPcbAutorouteTools } from './circuit/pcb-autoroute';

export { registerCircuitTools } from './circuit/schematic';
export { registerPcbTools } from './circuit/pcb';

export {
  classifyNet,
  classifyInstanceRole,
  buildNetExplanation,
  type NetClassification,
} from './circuit/net-classify';

/**
 * Register Circuit DSL code generation / explanation tools, advanced PCB
 * tools, and the net explanation tool. Composition of three submodules —
 * preserved as a single registration function to keep `ai-tools/index.ts`
 * stable.
 *
 * Tools registered:
 *  - generate_circuit_code, explain_circuit_code  (code-dsl)
 *  - auto_stitch_vias, generate_teardrops, suggest_net_names  (pcb-advanced)
 *  - suggest_trace_path  (pcb-autoroute)
 *  - explain_net  (net-explain)
 */
export function registerCircuitCodeTools(registry: ToolRegistry): void {
  registerCircuitCodeDslTools(registry);
  registerPcbAdvancedTools(registry);
  registerNetExplainTool(registry);
}
