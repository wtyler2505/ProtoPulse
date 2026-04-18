// =============================================================================
// KiCad Exporter — .kicad_pro project file (file-assembly phase)
// =============================================================================

import { sanitizeSymbolName } from './sexpr';
import {
  DEFAULT_TRACE_WIDTH,
  EDGE_CUTS_WIDTH,
  type KicadInput,
} from './types';

/**
 * Generates the .kicad_pro file content (JSON format).
 *
 * This is a minimal but valid project file that KiCad 7+ will accept.
 * It tells KiCad to look for the schematic and board files with the
 * same base name in the same directory.
 */
export function generateKicadProjectFile(input: KicadInput): string {
  const safeName = sanitizeSymbolName(input.circuit.name) || 'circuit';

  const project = {
    board: {
      design_settings: {
        defaults: {
          board_outline_line_width: EDGE_CUTS_WIDTH,
          copper_line_width: DEFAULT_TRACE_WIDTH,
          copper_text_size_h: 1.5,
          copper_text_size_v: 1.5,
          copper_text_thickness: 0.3,
          other_line_width: 0.15,
          silk_line_width: 0.15,
          silk_text_size_h: 1.0,
          silk_text_size_v: 1.0,
          silk_text_thickness: 0.15,
        },
        diff_pair_dimensions: [],
        drc_exclusions: [],
        rules: {
          min_clearance: 0.2,
          min_track_width: 0.2,
          min_via_annular_width: 0.13,
          min_via_diameter: 0.5,
        },
        track_widths: [0, 0.25, 0.5, 1.0],
        via_dimensions: [],
      },
    },
    libraries: {
      pinned_footprint_libs: [],
      pinned_symbol_libs: [],
    },
    meta: {
      filename: `${safeName}.kicad_pro`,
      version: 1,
    },
    net_settings: {
      classes: [
        {
          bus_width: 12,
          clearance: 0.2,
          diff_pair_gap: 0.25,
          diff_pair_via_gap: 0.25,
          diff_pair_width: 0.2,
          line_style: 0,
          microvia_diameter: 0.3,
          microvia_drill: 0.1,
          name: 'Default',
          pcb_color: 'rgba(0, 0, 0, 0.000)',
          schematic_color: 'rgba(0, 0, 0, 0.000)',
          track_width: 0.25,
          via_diameter: 0.6,
          via_drill: 0.3,
          wire_width: 6,
        },
      ],
      meta: {
        version: 3,
      },
      net_colors: null,
      netclass_assignments: null,
      netclass_patterns: [],
    },
    pcbnew: {
      last_paths: {
        gencad: '',
        idf: '',
        netlist: '',
        specctra_dsn: '',
        step: '',
        vrml: '',
      },
      page_layout_descr_file: '',
    },
    schematic: {
      drawing: {
        default_bus_thickness: 12,
        default_line_thickness: 6,
        default_text_size: 50,
        default_wire_thickness: 6,
      },
      legacy_lib_dir: '',
      legacy_lib_list: [],
    },
    sheets: [
      ['', ''],
    ],
    text_variables: {},
  };

  return JSON.stringify(project, null, 2);
}
