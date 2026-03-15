import type { ViewMode } from '@/lib/project-context';

/**
 * BL-0312: Contextual "Explain this panel" data for every view/panel.
 * Each explanation includes a title, description, practical tips, and
 * links to related views so that users can navigate the tool with confidence.
 */

export interface PanelExplanation {
  /** Human-readable panel title. */
  title: string;
  /** 1-3 sentence description of what the panel does and why it matters. */
  description: string;
  /** Actionable tips for getting the most out of this panel. */
  tips: string[];
  /** Views that complement or feed into this one. */
  relatedViews: { view: ViewMode; label: string }[];
}

export const PANEL_EXPLANATIONS: Record<ViewMode, PanelExplanation> = {
  dashboard: {
    title: 'Dashboard',
    description:
      'Your project overview at a glance. See component counts, validation status, BOM summary, and recent activity all in one place.',
    tips: [
      'Check here first to understand the overall health of your design.',
      'Click any summary card to jump directly to the relevant view.',
      'Validation badges update in real-time as you make changes.',
    ],
    relatedViews: [
      { view: 'architecture', label: 'Architecture' },
      { view: 'validation', label: 'Validation' },
      { view: 'procurement', label: 'Procurement' },
    ],
  },

  project_explorer: {
    title: 'Project Explorer',
    description:
      'Browse and manage all files and assets within your project. Navigate the project tree to find schematics, libraries, and exported files.',
    tips: [
      'Double-click a file to open it in the appropriate editor.',
      'Right-click for context menu options like rename or delete.',
    ],
    relatedViews: [
      { view: 'dashboard', label: 'Dashboard' },
      { view: 'design_history', label: 'History' },
    ],
  },

  architecture: {
    title: 'Architecture',
    description:
      'Design your system as a high-level block diagram. Add microcontrollers, sensors, power supplies, and other blocks, then connect them to define how your system is organized.',
    tips: [
      'Drag from the component library in the sidebar to add blocks.',
      'Connect blocks by dragging from one handle to another.',
      'Double-click a block label to rename it inline.',
      'This view feeds the BOM, schematic, and validation views automatically.',
    ],
    relatedViews: [
      { view: 'schematic', label: 'Schematic' },
      { view: 'procurement', label: 'Procurement' },
      { view: 'validation', label: 'Validation' },
    ],
  },

  component_editor: {
    title: 'Component Editor',
    description:
      'Create and customize electronic component definitions including pin layouts, symbols, footprints, and electrical properties.',
    tips: [
      'Define pins with correct electrical types (input, output, power, passive) for accurate ERC.',
      'Set the package type to auto-generate a PCB footprint.',
      'Use the constraint solver to validate physical dimensions.',
    ],
    relatedViews: [
      { view: 'schematic', label: 'Schematic' },
      { view: 'pcb', label: 'PCB' },
      { view: 'community', label: 'Community' },
    ],
  },

  schematic: {
    title: 'Schematic',
    description:
      'Capture your circuit schematic with component symbols, wires, and net names. This is the electrical blueprint of your design.',
    tips: [
      'Use net labels to connect distant pins without visible wires.',
      'Run ERC (Electrical Rule Check) from the toolbar to catch wiring errors.',
      'Cross-probing highlights the same net across schematic, breadboard, and PCB views.',
    ],
    relatedViews: [
      { view: 'breadboard', label: 'Breadboard' },
      { view: 'pcb', label: 'PCB' },
      { view: 'simulation', label: 'Simulation' },
      { view: 'validation', label: 'Validation' },
    ],
  },

  breadboard: {
    title: 'Breadboard',
    description:
      'Visualize your circuit on a virtual solderless breadboard. Place components and wires exactly as you would on a physical breadboard.',
    tips: [
      'Rails run horizontally and are shared across the entire board.',
      'Terminal strips run vertically in groups of 5.',
      'Use this view to plan your physical prototype before soldering.',
    ],
    relatedViews: [
      { view: 'schematic', label: 'Schematic' },
      { view: 'pcb', label: 'PCB' },
      { view: 'serial_monitor', label: 'Serial Monitor' },
    ],
  },

  pcb: {
    title: 'PCB Layout',
    description:
      'Place component footprints and route copper traces on your printed circuit board. Supports multi-layer stackups, design rules, and auto-routing.',
    tips: [
      'Use the ratsnest (thin lines) to see which pads still need connections.',
      'Run DRC to check clearances, trace widths, and via sizes against your rules.',
      'Press R to rotate a selected component 90 degrees.',
      'Try the auto-router for a quick first pass, then clean up by hand.',
    ],
    relatedViews: [
      { view: 'schematic', label: 'Schematic' },
      { view: 'viewer_3d', label: '3D View' },
      { view: 'ordering', label: 'Order PCB' },
      { view: 'validation', label: 'Validation' },
    ],
  },

  procurement: {
    title: 'Procurement (BOM)',
    description:
      'Manage your Bill of Materials. Track part numbers, quantities, suppliers, pricing, stock levels, and find alternate parts.',
    tips: [
      'Click column headers to sort by price, quantity, or stock status.',
      'Use the alternate parts finder to locate cheaper or more available substitutes.',
      'Export your BOM to CSV or supplier-specific formats for easy ordering.',
    ],
    relatedViews: [
      { view: 'architecture', label: 'Architecture' },
      { view: 'storage', label: 'Inventory' },
      { view: 'ordering', label: 'Order PCB' },
    ],
  },

  validation: {
    title: 'Validation',
    description:
      'Run design rule checks (DRC), electrical rule checks (ERC), and design-for-manufacturing (DFM) analysis. Catch errors before they become expensive mistakes.',
    tips: [
      'Click a violation to highlight it in the relevant view.',
      'Filter by severity (error, warning, info) to focus on critical issues first.',
      'Use DFM checks to validate your design against specific fabricator capabilities.',
    ],
    relatedViews: [
      { view: 'schematic', label: 'Schematic' },
      { view: 'pcb', label: 'PCB' },
      { view: 'output', label: 'Exports' },
    ],
  },

  simulation: {
    title: 'Simulation',
    description:
      'Run SPICE-based circuit simulations including DC operating point, AC frequency analysis, transient time-domain analysis, and Monte Carlo tolerance sweeps.',
    tips: [
      'Start with a DC operating point analysis to verify bias voltages.',
      'Use AC analysis to check frequency response and filter behavior.',
      'Monte Carlo runs show how component tolerances affect your circuit.',
    ],
    relatedViews: [
      { view: 'schematic', label: 'Schematic' },
      { view: 'calculators', label: 'Calculators' },
      { view: 'digital_twin', label: 'Digital Twin' },
    ],
  },

  output: {
    title: 'Exports',
    description:
      'Export your design in multiple formats: KiCad, Eagle, SPICE netlist, Gerber, drill files, pick-and-place, BOM, design report, FMEA, firmware scaffold, and PDF.',
    tips: [
      'Use Gerber + drill exports for PCB fabrication.',
      'Pick-and-place files are needed for automated assembly.',
      'The design report gives a comprehensive overview for review or documentation.',
    ],
    relatedViews: [
      { view: 'validation', label: 'Validation' },
      { view: 'ordering', label: 'Order PCB' },
      { view: 'pcb', label: 'PCB' },
    ],
  },

  design_history: {
    title: 'Design History',
    description:
      'View architecture snapshots over time and compare versions visually. See what changed between revisions with color-coded diffs.',
    tips: [
      'Compare any two snapshots to see added, removed, and modified elements.',
      'Use snapshots before major design changes as a safety net.',
    ],
    relatedViews: [
      { view: 'architecture', label: 'Architecture' },
      { view: 'dashboard', label: 'Dashboard' },
    ],
  },

  lifecycle: {
    title: 'Lifecycle',
    description:
      'Track component lifecycle status and supply chain risk. See which parts are active, end-of-life, obsolete, or at risk of discontinuation.',
    tips: [
      'Check lifecycle status before committing to a component choice.',
      'Set up alerts for parts approaching end-of-life.',
      'Review the lifecycle dashboard periodically, especially before production runs.',
    ],
    relatedViews: [
      { view: 'procurement', label: 'Procurement' },
      { view: 'storage', label: 'Inventory' },
    ],
  },

  comments: {
    title: 'Comments',
    description:
      'Leave design review comments and have discussions about specific parts of your project. Collaborate with teammates or leave notes for your future self.',
    tips: [
      'Reference specific components or views in your comments for context.',
      'Use comments to document design decisions and trade-offs.',
    ],
    relatedViews: [
      { view: 'architecture', label: 'Architecture' },
      { view: 'design_history', label: 'History' },
    ],
  },

  calculators: {
    title: 'Calculators',
    description:
      'Electronics engineering calculators for resistor dividers, RC time constants, Ohm\'s law, LED current limiting, filter design, and more.',
    tips: [
      'Use the resistor divider calculator when designing voltage regulation circuits.',
      'The RC calculator helps size decoupling capacitors and filter cutoffs.',
      'Results update in real-time as you change input values.',
    ],
    relatedViews: [
      { view: 'simulation', label: 'Simulation' },
      { view: 'schematic', label: 'Schematic' },
      { view: 'knowledge', label: 'Learn' },
    ],
  },

  design_patterns: {
    title: 'Design Patterns',
    description:
      'Browse reusable circuit design patterns and snippets with educational explanations. Apply proven solutions for common problems like voltage regulation, motor driving, and signal conditioning.',
    tips: [
      'Click a pattern to see its schematic, component list, and explanation.',
      'Use "Apply" to insert a pattern directly into your architecture.',
      'Great for learning standard approaches to common electronics challenges.',
    ],
    relatedViews: [
      { view: 'architecture', label: 'Architecture' },
      { view: 'knowledge', label: 'Learn' },
      { view: 'starter_circuits', label: 'Starter Circuits' },
    ],
  },

  storage: {
    title: 'Inventory',
    description:
      'Track your physical component inventory including storage locations, quantities on hand, and stock health. Scan barcodes and print QR labels for bins.',
    tips: [
      'Assign storage locations to keep your parts organized.',
      'Use the barcode scanner to quickly look up or add parts.',
      'Print QR labels for bins to speed up inventory management.',
    ],
    relatedViews: [
      { view: 'procurement', label: 'Procurement' },
      { view: 'lifecycle', label: 'Lifecycle' },
    ],
  },

  kanban: {
    title: 'Tasks (Kanban)',
    description:
      'Manage your design tasks with a drag-and-drop kanban board. Track what needs to be done, what is in progress, and what is complete.',
    tips: [
      'Drag cards between columns to update their status.',
      'Use filters to focus on specific task categories.',
      'Break large tasks into smaller, actionable items.',
    ],
    relatedViews: [
      { view: 'dashboard', label: 'Dashboard' },
      { view: 'comments', label: 'Comments' },
    ],
  },

  knowledge: {
    title: 'Learn',
    description:
      'Browse electronics reference articles covering fundamental concepts like Ohm\'s law, capacitor types, PCB design rules, and microcontroller basics.',
    tips: [
      'Search by keyword to find relevant articles quickly.',
      'Articles are written for makers and hobbyists, not just engineers.',
      'Use contextual links to jump to related topics.',
    ],
    relatedViews: [
      { view: 'calculators', label: 'Calculators' },
      { view: 'design_patterns', label: 'Patterns' },
      { view: 'starter_circuits', label: 'Starter Circuits' },
    ],
  },

  viewer_3d: {
    title: '3D Board Viewer',
    description:
      'Visualize your PCB in 3D with component models, layer visibility controls, and measurement tools. Check mechanical fit and board dimensions.',
    tips: [
      'Rotate with click-drag, zoom with scroll wheel.',
      'Toggle layer visibility to inspect inner layers.',
      'Use the measurement tool to verify enclosure clearances.',
    ],
    relatedViews: [
      { view: 'pcb', label: 'PCB' },
      { view: 'ordering', label: 'Order PCB' },
    ],
  },

  community: {
    title: 'Community Library',
    description:
      'Browse, search, and share component definitions with the community. Find ready-made parts instead of creating them from scratch.',
    tips: [
      'Search by part number or description to find existing components.',
      'Rate components to help others find high-quality definitions.',
      'Save frequently used parts to your favorites for quick access.',
    ],
    relatedViews: [
      { view: 'component_editor', label: 'Component Editor' },
      { view: 'procurement', label: 'Procurement' },
    ],
  },

  ordering: {
    title: 'Order PCB',
    description:
      'Order your PCB from supported fabricators. Configure board specs, run DFM validation, get instant pricing, and submit orders directly from ProtoPulse.',
    tips: [
      'Run DFM checks first to catch manufacturability issues.',
      'Compare pricing across fabricators before ordering.',
      'Export Gerber files as a backup before submitting an order.',
    ],
    relatedViews: [
      { view: 'pcb', label: 'PCB' },
      { view: 'output', label: 'Exports' },
      { view: 'viewer_3d', label: '3D View' },
    ],
  },

  serial_monitor: {
    title: 'Serial Monitor',
    description:
      'Connect to Arduino, ESP32, and other microcontrollers via USB serial. Send commands, view output, and debug your firmware in real-time.',
    tips: [
      'Select the correct baud rate to match your firmware configuration.',
      'Use the board presets for common DTR/RTS reset sequences.',
      'Enable auto-scroll to follow new output as it arrives.',
    ],
    relatedViews: [
      { view: 'arduino', label: 'Arduino' },
      { view: 'digital_twin', label: 'Digital Twin' },
      { view: 'breadboard', label: 'Breadboard' },
    ],
  },

  circuit_code: {
    title: 'Circuit Code',
    description:
      'Define circuits programmatically using a TypeScript-based DSL. Write code that generates schematics, with live preview, autocomplete, and AI-assisted generation.',
    tips: [
      'Use the built-in snippets to get started quickly.',
      'The live preview updates as you type.',
      'Ask the AI to generate circuit code from a natural language description.',
    ],
    relatedViews: [
      { view: 'schematic', label: 'Schematic' },
      { view: 'arduino', label: 'Arduino' },
      { view: 'simulation', label: 'Simulation' },
    ],
  },

  arduino: {
    title: 'Arduino Workbench',
    description:
      'Embedded firmware workbench with board and library management, code editing, compilation, and upload via the Arduino CLI. Manage your firmware alongside your hardware design.',
    tips: [
      'Install boards and libraries directly from the built-in manager.',
      'Use the compile button to check for errors before uploading.',
      'The error linker connects compile errors to knowledge articles.',
    ],
    relatedViews: [
      { view: 'serial_monitor', label: 'Serial Monitor' },
      { view: 'circuit_code', label: 'Circuit Code' },
      { view: 'breadboard', label: 'Breadboard' },
    ],
  },

  generative_design: {
    title: 'Generative Design',
    description:
      'Let AI evolve circuit designs for you. Specify constraints (cost, component count, power) and the evolutionary engine generates candidate circuits ranked by fitness.',
    tips: [
      'Start with clear constraints — the tighter your spec, the better the results.',
      'Review multiple candidates before selecting one to apply.',
      'Use this as inspiration, then refine the design by hand.',
    ],
    relatedViews: [
      { view: 'architecture', label: 'Architecture' },
      { view: 'simulation', label: 'Simulation' },
      { view: 'schematic', label: 'Schematic' },
    ],
  },

  digital_twin: {
    title: 'Digital Twin',
    description:
      'Create a live digital twin of your physical hardware. Compare real-time sensor telemetry against simulation predictions to catch deviations and validate your design.',
    tips: [
      'Connect your hardware via serial to stream live telemetry data.',
      'The comparison engine flags deviations larger than 5% as warnings.',
      'Use firmware templates to add telemetry reporting to your Arduino code.',
    ],
    relatedViews: [
      { view: 'serial_monitor', label: 'Serial Monitor' },
      { view: 'simulation', label: 'Simulation' },
      { view: 'arduino', label: 'Arduino' },
    ],
  },

  starter_circuits: {
    title: 'Starter Circuits',
    description:
      'Pre-built circuits with complete Arduino code for instant gratification. Load a circuit, upload the firmware, and see it work immediately — perfect for beginners.',
    tips: [
      'Each starter circuit includes a wiring diagram and ready-to-upload code.',
      'Use these as a starting point, then modify them to learn.',
      'Great for testing that your hardware setup works before building from scratch.',
    ],
    relatedViews: [
      { view: 'arduino', label: 'Arduino' },
      { view: 'breadboard', label: 'Breadboard' },
      { view: 'knowledge', label: 'Learn' },
    ],
  },

  audit_trail: {
    title: 'Audit Trail',
    description:
      'View a chronological log of all significant actions taken in the project. Track who changed what and when for accountability and debugging.',
    tips: [
      'Filter by action type to find specific changes.',
      'Use the audit trail to understand how the design evolved.',
      'Helpful for tracing back when and why a particular change was made.',
    ],
    relatedViews: [
      { view: 'design_history', label: 'History' },
      { view: 'comments', label: 'Comments' },
    ],
  },
};

/**
 * Look up the explanation for a given view. Returns undefined if
 * the view has no registered explanation (should never happen if
 * PANEL_EXPLANATIONS covers every ViewMode).
 */
export function getPanelExplanation(view: ViewMode): PanelExplanation | undefined {
  return PANEL_EXPLANATIONS[view];
}

/**
 * Returns all view modes that have registered explanations.
 */
export function getExplainedViews(): ViewMode[] {
  return Object.keys(PANEL_EXPLANATIONS) as ViewMode[];
}
