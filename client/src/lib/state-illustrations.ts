/**
 * State Illustrations
 *
 * Provides context-aware empty/error/loading state illustrations for use
 * across all ProtoPulse views. Each StateType maps to a StateIllustration
 * containing inline SVG art, title, description, and optional action CTA.
 *
 * Context-aware: `getStateIllustration(type, context?)` customises messaging
 * per-view (e.g. empty BOM vs empty schematic vs empty architecture).
 *
 * Usage:
 *   import { getStateIllustration } from '@/lib/state-illustrations';
 *
 *   const illustration = getStateIllustration('empty', 'bom');
 *   // → { type: 'empty', title: 'No BOM items yet', ... svgContent }
 *
 *   const generic = getStateIllustration('error');
 *   // → { type: 'error', title: 'Something went wrong', ... }
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StateType =
  | 'empty'
  | 'error'
  | 'offline'
  | 'loading'
  | 'success'
  | 'no_results'
  | 'permission_denied'
  | 'first_use';

export type StateContext =
  | 'bom'
  | 'schematic'
  | 'architecture'
  | 'pcb'
  | 'simulation'
  | 'chat'
  | 'validation'
  | 'components'
  | 'projects'
  | 'history'
  | 'export';

export interface StateIllustration {
  type: StateType;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  svgContent: string;
}

// ---------------------------------------------------------------------------
// SVG Art — minimal geometric line-art, neon-cyan (#00F0FF) on dark theme
// ---------------------------------------------------------------------------

const SVG_EMPTY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="#00F0FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="20" y="30" width="80" height="60" rx="4" opacity="0.3"/><line x1="40" y1="50" x2="80" y2="50" opacity="0.25"/><line x1="40" y1="60" x2="70" y2="60" opacity="0.15"/><line x1="40" y1="70" x2="60" y2="70" opacity="0.1"/><circle cx="60" cy="60" r="20" stroke-dasharray="4 4" opacity="0.4"/><line x1="53" y1="60" x2="67" y2="60" stroke-width="2" opacity="0.6"/></svg>`;

const SVG_ERROR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="#00F0FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="60,20 105,95 15,95" opacity="0.3"/><line x1="60" y1="50" x2="60" y2="70" stroke-width="2" opacity="0.7"/><circle cx="60" cy="80" r="2" fill="#00F0FF" opacity="0.7" stroke="none"/><line x1="30" y1="10" x2="35" y2="18" opacity="0.15"/><line x1="90" y1="10" x2="85" y2="18" opacity="0.15"/></svg>`;

const SVG_OFFLINE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="#00F0FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M30 70 Q60 40 90 70" opacity="0.2"/><path d="M40 78 Q60 58 80 78" opacity="0.3"/><path d="M50 86 Q60 72 70 86" opacity="0.4"/><circle cx="60" cy="94" r="3" fill="#00F0FF" opacity="0.5" stroke="none"/><line x1="20" y1="30" x2="100" y2="100" stroke-width="2" opacity="0.6"/></svg>`;

const SVG_LOADING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="#00F0FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="60" r="30" opacity="0.15"/><path d="M60 30 A30 30 0 0 1 90 60" stroke-width="2" opacity="0.6"/><circle cx="60" cy="60" r="15" stroke-dasharray="3 5" opacity="0.25"/><circle cx="60" cy="60" r="4" fill="#00F0FF" opacity="0.4" stroke="none"/></svg>`;

const SVG_SUCCESS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="#00F0FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="60" r="35" opacity="0.3"/><polyline points="42,62 54,74 78,48" stroke-width="2.5" opacity="0.7"/><circle cx="60" cy="60" r="42" stroke-dasharray="6 4" opacity="0.15"/></svg>`;

const SVG_NO_RESULTS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="#00F0FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="52" cy="52" r="25" opacity="0.3"/><line x1="70" y1="70" x2="95" y2="95" stroke-width="2" opacity="0.5"/><line x1="42" y1="52" x2="62" y2="52" opacity="0.3"/><line x1="52" y1="42" x2="52" y2="62" opacity="0.15" stroke-dasharray="3 3"/></svg>`;

const SVG_PERMISSION_DENIED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="#00F0FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="40" y="50" width="40" height="35" rx="3" opacity="0.3"/><path d="M48 50 V40 A12 12 0 0 1 72 40 V50" opacity="0.4"/><circle cx="60" cy="65" r="4" fill="#00F0FF" opacity="0.5" stroke="none"/><line x1="60" y1="69" x2="60" y2="76" stroke-width="2" opacity="0.5"/></svg>`;

const SVG_FIRST_USE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" fill="none" stroke="#00F0FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="50" r="25" opacity="0.2"/><line x1="60" y1="35" x2="60" y2="55" stroke-width="2" opacity="0.6"/><polygon points="55,55 65,55 60,62" fill="#00F0FF" opacity="0.5" stroke="none"/><rect x="30" y="80" width="60" height="12" rx="3" opacity="0.25"/><line x1="40" y1="86" x2="80" y2="86" opacity="0.3"/></svg>`;

// ---------------------------------------------------------------------------
// Default Illustrations (no context)
// ---------------------------------------------------------------------------

export const STATE_ILLUSTRATIONS: Record<StateType, StateIllustration> = {
  empty: {
    type: 'empty',
    title: 'Nothing here yet',
    description: 'This space is waiting for content. Add your first item to get started.',
    actionLabel: 'Get started',
    svgContent: SVG_EMPTY,
  },
  error: {
    type: 'error',
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Try refreshing the page or contact support if the problem persists.',
    actionLabel: 'Retry',
    svgContent: SVG_ERROR,
  },
  offline: {
    type: 'offline',
    title: 'You are offline',
    description: 'Check your internet connection and try again. Some features may still work in offline mode.',
    actionLabel: 'Try again',
    svgContent: SVG_OFFLINE,
  },
  loading: {
    type: 'loading',
    title: 'Loading...',
    description: 'Fetching your data. This should only take a moment.',
    svgContent: SVG_LOADING,
  },
  success: {
    type: 'success',
    title: 'All done!',
    description: 'Everything completed successfully.',
    svgContent: SVG_SUCCESS,
  },
  no_results: {
    type: 'no_results',
    title: 'No results found',
    description: 'Try adjusting your search terms or filters to find what you are looking for.',
    actionLabel: 'Clear filters',
    svgContent: SVG_NO_RESULTS,
  },
  permission_denied: {
    type: 'permission_denied',
    title: 'Access denied',
    description: 'You do not have permission to view this content. Sign in or request access from the project owner.',
    actionLabel: 'Sign in',
    actionHref: '/auth',
    svgContent: SVG_PERMISSION_DENIED,
  },
  first_use: {
    type: 'first_use',
    title: 'Welcome to ProtoPulse',
    description: 'Your all-in-one EDA workspace is ready. Create your first project to start designing.',
    actionLabel: 'Create project',
    svgContent: SVG_FIRST_USE,
  },
};

// ---------------------------------------------------------------------------
// Context-specific overrides
// ---------------------------------------------------------------------------

interface ContextOverride {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

const CONTEXT_OVERRIDES: Partial<Record<StateType, Partial<Record<StateContext, ContextOverride>>>> = {
  empty: {
    bom: {
      title: 'No BOM items yet',
      description: 'Your Bill of Materials is empty. Add components from the schematic or use AI to generate a parts list.',
      actionLabel: 'Add component',
    },
    schematic: {
      title: 'Empty schematic',
      description: 'Start building your circuit by placing components from the library or describing your design to AI.',
      actionLabel: 'Open component library',
    },
    architecture: {
      title: 'No architecture blocks',
      description: 'Define your system architecture by adding blocks and connecting them. AI can help generate a starting layout.',
      actionLabel: 'Add first block',
    },
    pcb: {
      title: 'No PCB layout',
      description: 'Create a circuit schematic first, then generate the PCB layout from the netlist.',
      actionLabel: 'Go to schematic',
    },
    simulation: {
      title: 'No simulation results',
      description: 'Run a simulation to see voltage, current, and frequency analysis for your circuit.',
      actionLabel: 'Run simulation',
    },
    chat: {
      title: 'No messages yet',
      description: 'Start a conversation with AI to get help with your design, troubleshoot issues, or learn electronics concepts.',
      actionLabel: 'Ask AI',
    },
    validation: {
      title: 'No validation issues',
      description: 'Your design is clean. Run DRC or ERC to verify design rules, or keep building.',
    },
    components: {
      title: 'No components found',
      description: 'The component library is empty. Import components or seed the standard library.',
      actionLabel: 'Seed library',
    },
    projects: {
      title: 'No projects yet',
      description: 'Create your first project to start designing circuits, managing BOMs, and exporting manufacturing files.',
      actionLabel: 'Create project',
    },
    history: {
      title: 'No design history',
      description: 'Your design history will appear here as you make changes. Every edit is automatically tracked.',
    },
    export: {
      title: 'Nothing to export',
      description: 'Add components and create a schematic before exporting to KiCad, Eagle, Gerber, or other formats.',
      actionLabel: 'Go to schematic',
    },
  },
  error: {
    bom: {
      title: 'Failed to load BOM',
      description: 'Could not retrieve the Bill of Materials. Check your connection and try again.',
      actionLabel: 'Retry',
    },
    schematic: {
      title: 'Schematic load error',
      description: 'Failed to load the circuit schematic. The design data may be corrupted.',
      actionLabel: 'Retry',
    },
    architecture: {
      title: 'Architecture load error',
      description: 'Failed to load the architecture diagram. Try refreshing the page.',
      actionLabel: 'Retry',
    },
    pcb: {
      title: 'PCB layout error',
      description: 'Failed to render the PCB layout. The netlist or footprint data may be invalid.',
      actionLabel: 'Retry',
    },
    simulation: {
      title: 'Simulation failed',
      description: 'The simulation could not complete. Check your circuit for open nodes or missing ground references.',
      actionLabel: 'Fix circuit',
    },
    chat: {
      title: 'Chat unavailable',
      description: 'Could not connect to the AI service. Verify your API key is configured and try again.',
      actionLabel: 'Check settings',
    },
    validation: {
      title: 'Validation error',
      description: 'The design rule check encountered an error. Some rules may not have been evaluated.',
      actionLabel: 'Retry DRC',
    },
    components: {
      title: 'Component library error',
      description: 'Failed to load the component library. Try refreshing the page.',
      actionLabel: 'Retry',
    },
    projects: {
      title: 'Projects unavailable',
      description: 'Could not load your projects. Check your connection and authentication status.',
      actionLabel: 'Retry',
    },
    history: {
      title: 'History load error',
      description: 'Could not retrieve design history entries. Try refreshing.',
      actionLabel: 'Retry',
    },
    export: {
      title: 'Export failed',
      description: 'The export operation encountered an error. Check the output format settings and try again.',
      actionLabel: 'Retry export',
    },
  },
  no_results: {
    bom: {
      title: 'No matching parts',
      description: 'No BOM items match your current search or filter criteria.',
      actionLabel: 'Clear filters',
    },
    schematic: {
      title: 'No matching components',
      description: 'No schematic components match your search. Try different keywords.',
      actionLabel: 'Clear search',
    },
    components: {
      title: 'No components match',
      description: 'No components in the library match your search criteria. Try broader terms or check spelling.',
      actionLabel: 'Clear search',
    },
    projects: {
      title: 'No matching projects',
      description: 'No projects match your search. Try different keywords or create a new project.',
      actionLabel: 'Clear search',
    },
    history: {
      title: 'No matching history',
      description: 'No history entries match your filter. Try a different date range or action type.',
      actionLabel: 'Clear filters',
    },
  },
  first_use: {
    bom: {
      title: 'Bill of Materials',
      description: 'Track every component your project needs. Add parts manually, import from a schematic, or let AI suggest them.',
      actionLabel: 'Add first part',
    },
    schematic: {
      title: 'Circuit Schematic Editor',
      description: 'Design your circuit visually. Drag components from the library, wire them together, and run simulations.',
      actionLabel: 'Place a component',
    },
    architecture: {
      title: 'System Architecture',
      description: 'Map out your project at a high level. Add blocks for each subsystem and connect them to show data flow.',
      actionLabel: 'Add a block',
    },
    pcb: {
      title: 'PCB Layout',
      description: 'Arrange components on a physical board. Route traces, set design rules, and generate manufacturing files.',
      actionLabel: 'Start layout',
    },
    simulation: {
      title: 'Circuit Simulation',
      description: 'Test your design without hardware. Run DC, AC, and transient analyses to verify behaviour before building.',
      actionLabel: 'Run first sim',
    },
    chat: {
      title: 'AI Design Assistant',
      description: 'Ask questions about electronics, get component suggestions, or let AI help debug your circuits.',
      actionLabel: 'Start chatting',
    },
    projects: {
      title: 'Your Projects',
      description: 'Each project is a self-contained workspace with schematics, BOM, PCB layout, and more.',
      actionLabel: 'Create first project',
    },
  },
  loading: {
    simulation: {
      title: 'Running simulation...',
      description: 'Solving the circuit matrix. Complex circuits with many nodes may take a few seconds.',
    },
    export: {
      title: 'Generating export...',
      description: 'Building the output files. This may take a moment for large designs.',
    },
    chat: {
      title: 'AI is thinking...',
      description: 'Your AI assistant is analysing the request and preparing a response.',
    },
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a `StateIllustration` for the given state type, optionally
 * contextualised to a specific view. Context overrides only the messaging
 * (title, description, actionLabel, actionHref) — the SVG art stays the same
 * per state type.
 */
export function getStateIllustration(type: StateType, context?: StateContext): StateIllustration {
  const base = STATE_ILLUSTRATIONS[type];

  if (!context) {
    return { ...base };
  }

  const override = CONTEXT_OVERRIDES[type]?.[context];
  if (!override) {
    return { ...base };
  }

  // When a context override exists, it fully replaces the messaging fields.
  // Optional fields (actionLabel, actionHref) that are absent in the override
  // must NOT leak through from the base — they are context-irrelevant.
  const result: StateIllustration = {
    type: base.type,
    title: override.title,
    description: override.description,
    svgContent: base.svgContent,
  };

  if (override.actionLabel !== undefined) {
    result.actionLabel = override.actionLabel;
  }
  if (override.actionHref !== undefined) {
    result.actionHref = override.actionHref;
  }

  return result;
}

/**
 * Returns all available state types.
 */
export function getAvailableStateTypes(): StateType[] {
  return Object.keys(STATE_ILLUSTRATIONS) as StateType[];
}

/**
 * Returns all context keys that have at least one override for the given state type.
 */
export function getAvailableContexts(type: StateType): StateContext[] {
  const overrides = CONTEXT_OVERRIDES[type];
  if (!overrides) {
    return [];
  }
  return Object.keys(overrides) as StateContext[];
}
