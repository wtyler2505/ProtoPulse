export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'type' | 'observe';
  viewRequired?: string;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  steps: TutorialStep[];
  estimatedMinutes: number;
  category: 'getting-started' | 'design' | 'simulation' | 'export';
}

export const TUTORIALS: Tutorial[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics of ProtoPulse by building your first design.',
    estimatedMinutes: 3,
    category: 'getting-started',
    steps: [
      {
        id: 'gs-welcome',
        title: 'Welcome to ProtoPulse',
        content:
          'Welcome to ProtoPulse! This guided walkthrough will introduce you to the key areas of the design workspace. Let\'s build your first design.',
        action: 'observe',
      },
      {
        id: 'gs-architecture',
        title: 'Architecture View',
        content:
          'This is the Architecture canvas where you design your system\'s high-level block diagram. Drag blocks to rearrange, and connect them with edges to define relationships.',
        targetSelector: '[data-testid="tab-architecture"]',
        position: 'bottom',
        action: 'click',
        viewRequired: 'architecture',
      },
      {
        id: 'gs-add-component',
        title: 'Add a Component',
        content:
          'Click on the canvas to add your first component, or use the AI chat to generate an entire architecture. Try right-clicking for the context menu.',
        targetSelector: '[data-testid="architecture-canvas"]',
        position: 'top',
        action: 'click',
      },
      {
        id: 'gs-component-tree',
        title: 'Component Tree',
        content:
          'Your components appear in the sidebar tree on the left. You can select, rename, and organize components from here.',
        targetSelector: '[data-testid="sidebar-component-tree"]',
        position: 'right',
        action: 'observe',
      },
      {
        id: 'gs-ai-assistant',
        title: 'AI Assistant',
        content:
          'The AI chat panel is your design co-pilot. Ask it to generate architectures, add components, manage your BOM, or run validation. Try: "Design a temperature monitoring system".',
        targetSelector: '[data-testid="chat-panel"]',
        position: 'left',
        action: 'observe',
      },
      {
        id: 'gs-validation',
        title: 'Run Validation',
        content:
          'Switch to the Validation view to run Design Rule Checks (DRC) and catch issues like missing connections, orphaned nodes, or incomplete specifications.',
        targetSelector: '[data-testid="tab-validation"]',
        position: 'bottom',
        action: 'click',
      },
      {
        id: 'gs-export',
        title: 'Export Your Design',
        content:
          'When you\'re ready, export your design in multiple formats: KiCad, Eagle, SPICE, Gerber, PDF reports, and more. The Output view has everything you need.',
        targetSelector: '[data-testid="tab-output"]',
        position: 'bottom',
        action: 'click',
      },
    ],
  },
  {
    id: 'circuit-design',
    title: 'Circuit Design',
    description: 'Learn to create and simulate circuit schematics in ProtoPulse.',
    estimatedMinutes: 5,
    category: 'design',
    steps: [
      {
        id: 'cd-schematic',
        title: 'Open Schematic View',
        content:
          'Switch to the Schematic view to start designing your circuit. This is where you place components, draw wires, and define nets.',
        targetSelector: '[data-testid="tab-schematic"]',
        position: 'bottom',
        action: 'click',
        viewRequired: 'schematic',
      },
      {
        id: 'cd-add-components',
        title: 'Add Circuit Components',
        content:
          'Browse the component library in the sidebar to find resistors, capacitors, ICs, and more. Click a component to place it on the canvas.',
        targetSelector: '[data-testid="sidebar-component-library"]',
        position: 'right',
        action: 'click',
      },
      {
        id: 'cd-wire',
        title: 'Wire Components Together',
        content:
          'Use the wire tool (press W) to connect component pins. Click on a pin to start a wire, then click on another pin to complete the connection.',
        targetSelector: '[data-testid="schematic-canvas"]',
        position: 'top',
        action: 'click',
      },
      {
        id: 'cd-nets',
        title: 'Assign Net Names',
        content:
          'Give meaningful names to your nets (like VCC, GND, SDA) to make the schematic readable and to enable proper netlist generation.',
        targetSelector: '[data-testid="net-panel"]',
        position: 'left',
        action: 'observe',
      },
      {
        id: 'cd-erc',
        title: 'Run Electrical Rules Check',
        content:
          'Run ERC to catch electrical errors: unconnected pins, shorted outputs, missing power connections, and more. Fix issues before simulating.',
        targetSelector: '[data-testid="erc-button"]',
        position: 'bottom',
        action: 'click',
      },
      {
        id: 'cd-simulate',
        title: 'Simulate Your Circuit',
        content:
          'Run a SPICE simulation to verify your circuit\'s behavior. View voltage waveforms, current flows, and frequency responses to validate your design.',
        targetSelector: '[data-testid="simulation-panel"]',
        position: 'left',
        action: 'click',
      },
    ],
  },
  {
    id: 'ai-assistant',
    title: 'AI Assistant',
    description: 'Learn to use the AI design assistant to accelerate your workflow.',
    estimatedMinutes: 2,
    category: 'getting-started',
    steps: [
      {
        id: 'ai-open-chat',
        title: 'Meet the AI Assistant',
        content:
          'The AI chat panel on the right is your design assistant. It understands electronics and can manipulate your project directly using 82 built-in tools.',
        targetSelector: '[data-testid="chat-panel"]',
        position: 'left',
        action: 'observe',
      },
      {
        id: 'ai-ask-question',
        title: 'Ask a Design Question',
        content:
          'Try typing a design prompt like "Design a temperature sensor circuit with an ESP32" or "Add a 10k pull-up resistor to SDA". The AI will suggest specific changes.',
        targetSelector: '[data-testid="chat-input"]',
        position: 'top',
        action: 'type',
      },
      {
        id: 'ai-review-actions',
        title: 'Review AI Actions',
        content:
          'The AI suggests actions as colored badges in its response. Each badge represents a change to your project: adding nodes, updating BOM, running validation, etc. Review them before applying.',
        targetSelector: '[data-testid="chat-messages"]',
        position: 'left',
        action: 'observe',
      },
      {
        id: 'ai-apply-actions',
        title: 'Apply Actions',
        content:
          'Click an action badge to apply that change to your design. You can apply actions individually or all at once. The AI keeps your project state in sync automatically.',
        targetSelector: '[data-testid="chat-messages"]',
        position: 'left',
        action: 'click',
      },
    ],
  },
];

export function getTutorialById(id: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.id === id);
}

export const TUTORIAL_CATEGORIES = [
  { id: 'getting-started' as const, label: 'Getting Started' },
  { id: 'design' as const, label: 'Design' },
  { id: 'simulation' as const, label: 'Simulation' },
  { id: 'export' as const, label: 'Export' },
];
