/**
 * Guided Migration Flow
 *
 * MigrationWizard singleton that detects the source EDA tool from file
 * format/extension, generates step-by-step migration plans, assesses
 * compatibility, and tracks progress through the migration workflow.
 *
 * Supports: KiCad, Eagle, EasyEDA, Altium, Fritzing
 *
 * @module migration-wizard
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported source EDA tools */
export type SourceEdaTool = 'kicad' | 'eagle' | 'easyeda' | 'altium' | 'fritzing';

/** Overall migration complexity rating */
export type MigrationComplexity = 'simple' | 'moderate' | 'complex';

/** Status of a single migration step */
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';

/** Status of the overall migration */
export type MigrationStatus = 'not_started' | 'in_progress' | 'completed' | 'failed';

/** Feature support level in ProtoPulse */
export type SupportLevel = 'full' | 'partial' | 'unsupported' | 'manual';

/** A single step in the migration plan */
export interface MigrationStep {
  id: string;
  order: number;
  title: string;
  description: string;
  status: StepStatus;
  optional: boolean;
  /** Estimated effort in minutes */
  estimatedMinutes: number;
  /** Tips specific to this step */
  tips: string[];
  /** IDs of steps that must be completed before this one */
  prerequisites: string[];
}

/** Compatibility assessment for a single feature */
export interface FeatureCompatibility {
  feature: string;
  sourceSupport: boolean;
  protoSupport: SupportLevel;
  notes: string;
}

/** Overall compatibility assessment for a migration */
export interface CompatibilityAssessment {
  source: SourceEdaTool;
  overallScore: number; // 0-100
  complexity: MigrationComplexity;
  features: FeatureCompatibility[];
  /** Blockers that may prevent a clean migration */
  blockers: string[];
  /** Warnings about potential data loss */
  warnings: string[];
  /** Helpful tips for this migration path */
  tips: string[];
}

/** A complete migration plan */
export interface MigrationPlan {
  id: string;
  source: SourceEdaTool;
  sourceVersion: string;
  fileName: string;
  createdAt: number;
  status: MigrationStatus;
  steps: MigrationStep[];
  compatibility: CompatibilityAssessment;
  /** Current step index (0-based) */
  currentStepIndex: number;
}

/** File format detection result */
export interface FormatDetection {
  tool: SourceEdaTool | null;
  confidence: number; // 0-1
  matchedExtension: string | null;
  matchedSignature: string | null;
}

// ---------------------------------------------------------------------------
// Constants — file signatures and extensions
// ---------------------------------------------------------------------------

interface ToolSignature {
  tool: SourceEdaTool;
  extensions: string[];
  /** Substrings in file content that identify this tool */
  contentSignatures: string[];
  displayName: string;
}

const TOOL_SIGNATURES: ToolSignature[] = [
  {
    tool: 'kicad',
    extensions: ['.kicad_sch', '.kicad_pcb', '.kicad_sym', '.kicad_mod', '.kicad_pro'],
    contentSignatures: ['kicad_sch', 'kicad_pcb', 'kicad_symbol', 'ki_description', 'fp_name'],
    displayName: 'KiCad',
  },
  {
    tool: 'eagle',
    extensions: ['.sch', '.brd', '.lbr'],
    contentSignatures: ['<!DOCTYPE eagle', '<eagle version', '<schematic', '<board>'],
    displayName: 'Autodesk EAGLE',
  },
  {
    tool: 'easyeda',
    extensions: ['.json', '.easyeda'],
    contentSignatures: ['"docType"', '"editorVersion"', '"easyeda"', '"shape":['],
    displayName: 'EasyEDA / LCEDA',
  },
  {
    tool: 'altium',
    extensions: ['.SchDoc', '.PcbDoc', '.SchLib', '.PcbLib', '.PrjPcb'],
    contentSignatures: ['|RECORD=', 'ALTIUM', 'Protel', 'AdvancedPCB'],
    displayName: 'Altium Designer',
  },
  {
    tool: 'fritzing',
    extensions: ['.fzz', '.fzp', '.fzpz', '.svg'],
    contentSignatures: ['fritzing', '<module fritzingVersion', 'FritzingVersion', '<breadboardView>'],
    displayName: 'Fritzing',
  },
];

// ---------------------------------------------------------------------------
// Feature compatibility definitions per tool
// ---------------------------------------------------------------------------

const FEATURES: string[] = [
  'Schematic import',
  'PCB layout import',
  'Component library',
  'Net connectivity',
  'Design rule constraints',
  'Multi-sheet schematics',
  'Hierarchical designs',
  'Custom footprints',
  'SPICE simulation data',
  'BOM data',
  '3D models',
  'Manufacturing outputs',
  'Version history',
  'Collaboration data',
];

type ToolFeatureMap = Record<string, { sourceSupport: boolean; protoSupport: SupportLevel; notes: string }>;

const KICAD_FEATURES: ToolFeatureMap = {
  'Schematic import': { sourceSupport: true, protoSupport: 'full', notes: 'Full S-expression parser' },
  'PCB layout import': { sourceSupport: true, protoSupport: 'full', notes: 'Board outline, tracks, footprints' },
  'Component library': { sourceSupport: true, protoSupport: 'full', notes: '.kicad_sym → standard library' },
  'Net connectivity': { sourceSupport: true, protoSupport: 'full', notes: 'Net names and classes preserved' },
  'Design rule constraints': { sourceSupport: true, protoSupport: 'partial', notes: 'Basic DRC rules imported; advanced constraints need manual setup' },
  'Multi-sheet schematics': { sourceSupport: true, protoSupport: 'partial', notes: 'Sheets flattened into single view' },
  'Hierarchical designs': { sourceSupport: true, protoSupport: 'partial', notes: 'Hierarchy flattened; port names preserved' },
  'Custom footprints': { sourceSupport: true, protoSupport: 'full', notes: '.kicad_mod footprints converted' },
  'SPICE simulation data': { sourceSupport: true, protoSupport: 'partial', notes: 'Subcircuits may need manual review' },
  'BOM data': { sourceSupport: true, protoSupport: 'full', notes: 'Fields mapped to BOM items' },
  '3D models': { sourceSupport: true, protoSupport: 'partial', notes: 'STEP references noted; models not transferred' },
  'Manufacturing outputs': { sourceSupport: true, protoSupport: 'full', notes: 'Gerber/drill regenerated from imported layout' },
  'Version history': { sourceSupport: false, protoSupport: 'unsupported', notes: 'Not available in KiCad file format' },
  'Collaboration data': { sourceSupport: false, protoSupport: 'unsupported', notes: 'Not available in KiCad file format' },
};

const EAGLE_FEATURES: ToolFeatureMap = {
  'Schematic import': { sourceSupport: true, protoSupport: 'full', notes: 'XML schematic parser' },
  'PCB layout import': { sourceSupport: true, protoSupport: 'full', notes: '.brd board file import' },
  'Component library': { sourceSupport: true, protoSupport: 'full', notes: '.lbr library conversion' },
  'Net connectivity': { sourceSupport: true, protoSupport: 'full', notes: 'Signal/net names preserved' },
  'Design rule constraints': { sourceSupport: true, protoSupport: 'partial', notes: 'DRC rules need manual re-entry for advanced constraints' },
  'Multi-sheet schematics': { sourceSupport: true, protoSupport: 'partial', notes: 'Multi-sheet flattened' },
  'Hierarchical designs': { sourceSupport: true, protoSupport: 'partial', notes: 'Module instances flattened' },
  'Custom footprints': { sourceSupport: true, protoSupport: 'partial', notes: 'Package definitions converted; PAD shapes simplified' },
  'SPICE simulation data': { sourceSupport: false, protoSupport: 'unsupported', notes: 'EAGLE does not store SPICE data in project files' },
  'BOM data': { sourceSupport: true, protoSupport: 'full', notes: 'Attribute fields mapped' },
  '3D models': { sourceSupport: true, protoSupport: 'partial', notes: '3D package references not transferred' },
  'Manufacturing outputs': { sourceSupport: true, protoSupport: 'full', notes: 'Gerber/drill regenerated from imported layout' },
  'Version history': { sourceSupport: false, protoSupport: 'unsupported', notes: 'Not in EAGLE file format' },
  'Collaboration data': { sourceSupport: false, protoSupport: 'unsupported', notes: 'Not in EAGLE file format' },
};

const EASYEDA_FEATURES: ToolFeatureMap = {
  'Schematic import': { sourceSupport: true, protoSupport: 'full', notes: 'JSON document parser' },
  'PCB layout import': { sourceSupport: true, protoSupport: 'full', notes: 'Tracks, pads, board outline' },
  'Component library': { sourceSupport: true, protoSupport: 'partial', notes: 'Standard packages mapped; custom symbols need review' },
  'Net connectivity': { sourceSupport: true, protoSupport: 'full', notes: 'Net labels and pad nets preserved' },
  'Design rule constraints': { sourceSupport: true, protoSupport: 'partial', notes: 'Basic clearance rules; JLCPCB-specific rules need manual setup' },
  'Multi-sheet schematics': { sourceSupport: true, protoSupport: 'partial', notes: 'Sheets flattened' },
  'Hierarchical designs': { sourceSupport: false, protoSupport: 'unsupported', notes: 'EasyEDA Standard does not support hierarchy' },
  'Custom footprints': { sourceSupport: true, protoSupport: 'partial', notes: 'EasyEDA footprint shapes converted where possible' },
  'SPICE simulation data': { sourceSupport: true, protoSupport: 'partial', notes: 'SPICE model references preserved; subcircuits need import' },
  'BOM data': { sourceSupport: true, protoSupport: 'full', notes: 'LCSC part numbers carried through' },
  '3D models': { sourceSupport: true, protoSupport: 'unsupported', notes: '3D model data not transferable' },
  'Manufacturing outputs': { sourceSupport: true, protoSupport: 'full', notes: 'Gerber/drill regenerated; JLCPCB CPL export available' },
  'Version history': { sourceSupport: false, protoSupport: 'unsupported', notes: 'Cloud history not exportable' },
  'Collaboration data': { sourceSupport: false, protoSupport: 'unsupported', notes: 'Cloud collaboration not exportable' },
};

const ALTIUM_FEATURES: ToolFeatureMap = {
  'Schematic import': { sourceSupport: true, protoSupport: 'partial', notes: 'ASCII SchDoc only; binary format requires manual export' },
  'PCB layout import': { sourceSupport: true, protoSupport: 'partial', notes: 'ASCII PcbDoc only; advanced features may be lost' },
  'Component library': { sourceSupport: true, protoSupport: 'partial', notes: 'SchLib/PcbLib basic conversion; integrated libraries need unpacking' },
  'Net connectivity': { sourceSupport: true, protoSupport: 'full', notes: 'Net names preserved' },
  'Design rule constraints': { sourceSupport: true, protoSupport: 'partial', notes: 'Complex rule system partially mapped' },
  'Multi-sheet schematics': { sourceSupport: true, protoSupport: 'partial', notes: 'Sheets flattened; sheet entries noted' },
  'Hierarchical designs': { sourceSupport: true, protoSupport: 'partial', notes: 'Hierarchy flattened' },
  'Custom footprints': { sourceSupport: true, protoSupport: 'partial', notes: 'Pad stacks and regions simplified' },
  'SPICE simulation data': { sourceSupport: true, protoSupport: 'partial', notes: 'Sim model references may need update' },
  'BOM data': { sourceSupport: true, protoSupport: 'full', notes: 'Component parameters mapped' },
  '3D models': { sourceSupport: true, protoSupport: 'partial', notes: 'STEP body references noted but not transferred' },
  'Manufacturing outputs': { sourceSupport: true, protoSupport: 'full', notes: 'Gerber/drill regenerated from imported layout' },
  'Version history': { sourceSupport: true, protoSupport: 'unsupported', notes: 'Altium Vault history not exportable' },
  'Collaboration data': { sourceSupport: true, protoSupport: 'unsupported', notes: 'Altium 365 data not transferable' },
};

const FRITZING_FEATURES: ToolFeatureMap = {
  'Schematic import': { sourceSupport: true, protoSupport: 'full', notes: 'FZPZ/FZZ component + schematic views' },
  'PCB layout import': { sourceSupport: true, protoSupport: 'partial', notes: 'Simple PCB layouts; complex routing may need rework' },
  'Component library': { sourceSupport: true, protoSupport: 'full', notes: 'FZPZ parts imported via component library' },
  'Net connectivity': { sourceSupport: true, protoSupport: 'full', notes: 'Connector/wire connectivity preserved' },
  'Design rule constraints': { sourceSupport: false, protoSupport: 'unsupported', notes: 'Fritzing has minimal DRC support' },
  'Multi-sheet schematics': { sourceSupport: false, protoSupport: 'unsupported', notes: 'Fritzing does not support multiple sheets' },
  'Hierarchical designs': { sourceSupport: false, protoSupport: 'unsupported', notes: 'Not supported in Fritzing' },
  'Custom footprints': { sourceSupport: true, protoSupport: 'partial', notes: 'SVG-based parts partially converted' },
  'SPICE simulation data': { sourceSupport: false, protoSupport: 'unsupported', notes: 'Fritzing does not include SPICE data' },
  'BOM data': { sourceSupport: true, protoSupport: 'full', notes: 'Part properties mapped to BOM' },
  '3D models': { sourceSupport: false, protoSupport: 'unsupported', notes: 'Fritzing uses 2D SVG views only' },
  'Manufacturing outputs': { sourceSupport: true, protoSupport: 'full', notes: 'Gerber export regenerated from imported layout' },
  'Version history': { sourceSupport: false, protoSupport: 'unsupported', notes: 'Not in Fritzing file format' },
  'Collaboration data': { sourceSupport: false, protoSupport: 'unsupported', notes: 'Not in Fritzing file format' },
};

const TOOL_FEATURE_MAPS: Record<SourceEdaTool, ToolFeatureMap> = {
  kicad: KICAD_FEATURES,
  eagle: EAGLE_FEATURES,
  easyeda: EASYEDA_FEATURES,
  altium: ALTIUM_FEATURES,
  fritzing: FRITZING_FEATURES,
};

// ---------------------------------------------------------------------------
// Migration step templates per tool
// ---------------------------------------------------------------------------

interface StepTemplate {
  id: string;
  title: string;
  description: string;
  optional: boolean;
  estimatedMinutes: number;
  tips: string[];
  prerequisites: string[];
}

function getStepTemplates(tool: SourceEdaTool): StepTemplate[] {
  const commonPreSteps: StepTemplate[] = [
    {
      id: 'backup',
      title: 'Back up your original project',
      description: 'Create a backup copy of your original project files before starting the migration.',
      optional: false,
      estimatedMinutes: 2,
      tips: [
        'Keep the backup until you have verified the migration is complete',
        'Include all library files and project settings in the backup',
      ],
      prerequisites: [],
    },
  ];

  const commonPostSteps: StepTemplate[] = [
    {
      id: 'verify-bom',
      title: 'Verify BOM data',
      description: 'Check that all components, quantities, and part numbers were imported correctly.',
      optional: false,
      estimatedMinutes: 10,
      tips: [
        'Compare component count with the original project',
        'Check that part numbers and values match',
        'Look for missing or duplicate entries',
      ],
      prerequisites: ['import-design'],
    },
    {
      id: 'run-drc',
      title: 'Run Design Rule Check',
      description: 'Run DRC/ERC to verify connectivity and catch any issues introduced during import.',
      optional: false,
      estimatedMinutes: 5,
      tips: [
        'Some violations may be expected if DRC rules differ between tools',
        'Fix any unconnected net warnings first',
      ],
      prerequisites: ['verify-bom'],
    },
    {
      id: 'review-warnings',
      title: 'Review import warnings',
      description: 'Go through any warnings generated during import and address them.',
      optional: false,
      estimatedMinutes: 15,
      tips: [
        'Warnings about unsupported features may require manual recreation',
        'Component mapping warnings may need library updates',
      ],
      prerequisites: ['import-design'],
    },
    {
      id: 'test-export',
      title: 'Test manufacturing export',
      description: 'Generate Gerber/drill files and verify they match expectations.',
      optional: true,
      estimatedMinutes: 10,
      tips: [
        'Compare generated Gerbers with originals in a Gerber viewer',
        'Check drill file for correct hole sizes',
      ],
      prerequisites: ['run-drc'],
    },
  ];

  const toolSpecificSteps: Record<SourceEdaTool, StepTemplate[]> = {
    kicad: [
      {
        id: 'export-kicad',
        title: 'Export from KiCad',
        description: 'Save your KiCad project files (.kicad_sch, .kicad_pcb). Ensure all libraries are local (not referencing global lib table).',
        optional: false,
        estimatedMinutes: 5,
        tips: [
          'Use "File → Save As" to create a standalone copy',
          'Check that all symbols/footprints are embedded or in the project library',
          'KiCad 7+ uses updated S-expression format — verify version compatibility',
        ],
        prerequisites: ['backup'],
      },
      {
        id: 'import-design',
        title: 'Import schematic and PCB',
        description: 'Use ProtoPulse\'s Import Design feature to load the .kicad_sch and/or .kicad_pcb files.',
        optional: false,
        estimatedMinutes: 5,
        tips: [
          'Import schematic first, then PCB for best net matching',
          'Multi-sheet schematics will be flattened into a single view',
        ],
        prerequisites: ['export-kicad'],
      },
    ],
    eagle: [
      {
        id: 'export-eagle',
        title: 'Export from EAGLE',
        description: 'Open your project in EAGLE and ensure the .sch and .brd files are saved. If using managed libraries, run "Library → Update All" first.',
        optional: false,
        estimatedMinutes: 5,
        tips: [
          'EAGLE 9.x XML format is fully supported',
          'Older binary formats (pre-6.0) may need conversion in EAGLE first',
          'Run ERC/DRC in EAGLE to establish a baseline before migration',
        ],
        prerequisites: ['backup'],
      },
      {
        id: 'import-design',
        title: 'Import schematic and board',
        description: 'Use ProtoPulse\'s Import Design feature to load the .sch and .brd files.',
        optional: false,
        estimatedMinutes: 5,
        tips: [
          'EAGLE library (.lbr) files can also be imported to bring in custom parts',
          'Package names will be normalized to standard footprint names',
        ],
        prerequisites: ['export-eagle'],
      },
      {
        id: 'remap-libraries',
        title: 'Remap component libraries',
        description: 'Map EAGLE library parts to ProtoPulse standard library or custom components.',
        optional: true,
        estimatedMinutes: 20,
        tips: [
          'Start with the most-used components',
          'Check that pin mappings match between libraries',
        ],
        prerequisites: ['import-design'],
      },
    ],
    easyeda: [
      {
        id: 'export-easyeda',
        title: 'Export from EasyEDA',
        description: 'In EasyEDA, go to File → Export → EasyEDA JSON to save the project as a .json file.',
        optional: false,
        estimatedMinutes: 3,
        tips: [
          'Export each sheet separately if the project has multiple sheets',
          'EasyEDA Pro and Standard use slightly different JSON formats — both are supported',
          'LCSC part numbers will be preserved for BOM integration',
        ],
        prerequisites: ['backup'],
      },
      {
        id: 'import-design',
        title: 'Import EasyEDA JSON',
        description: 'Use ProtoPulse\'s Import Design feature to load the exported .json file.',
        optional: false,
        estimatedMinutes: 5,
        tips: [
          'Coordinate system converts automatically (10mil → mm, Y-axis flip)',
          'Package names are normalized (e.g., SOP8 → SOIC-8)',
          'JLCPCB-specific DRC rules will need manual setup',
        ],
        prerequisites: ['export-easyeda'],
      },
      {
        id: 'verify-jlcpcb',
        title: 'Verify JLCPCB/LCSC mappings',
        description: 'Check that LCSC part numbers are correctly carried over for ordering.',
        optional: true,
        estimatedMinutes: 10,
        tips: [
          'ProtoPulse supports LCSC/JLCPCB BOM and CPL export',
          'Verify part availability — stock changes frequently',
        ],
        prerequisites: ['import-design'],
      },
    ],
    altium: [
      {
        id: 'export-altium',
        title: 'Export from Altium Designer',
        description: 'Save project files as ASCII format: File → Save As → ASCII (.SchDoc / .PcbDoc). Binary format is not supported.',
        optional: false,
        estimatedMinutes: 10,
        tips: [
          'Binary Altium files cannot be imported directly — ASCII export is required',
          'Unpack any integrated libraries (.IntLib) to .SchLib + .PcbLib first',
          'Complex rule hierarchies will be simplified during import',
        ],
        prerequisites: ['backup'],
      },
      {
        id: 'import-design',
        title: 'Import Altium ASCII files',
        description: 'Use ProtoPulse\'s Import Design feature to load the ASCII .SchDoc and .PcbDoc files.',
        optional: false,
        estimatedMinutes: 5,
        tips: [
          'Import schematic before PCB for proper cross-referencing',
          'Advanced PCB features (blind/buried vias, impedance-controlled traces) may need manual setup',
        ],
        prerequisites: ['export-altium'],
      },
      {
        id: 'recreate-rules',
        title: 'Recreate design rules',
        description: 'Altium\'s complex rule system cannot be fully mapped. Manually set up critical DRC/clearance rules.',
        optional: false,
        estimatedMinutes: 30,
        tips: [
          'Focus on clearance, trace width, and via rules first',
          'Use ProtoPulse net classes to replicate Altium net-level rules',
          'Manufacturer presets can fast-track common rule sets',
        ],
        prerequisites: ['import-design'],
      },
    ],
    fritzing: [
      {
        id: 'export-fritzing',
        title: 'Export from Fritzing',
        description: 'Save your Fritzing project as .fzz (File → Save As). For individual parts, export as .fzpz.',
        optional: false,
        estimatedMinutes: 3,
        tips: [
          'Fritzing .fzz files are ZIP archives containing SVG and metadata',
          'Custom parts should be exported individually as .fzpz',
          'Breadboard view layouts are informational — they will not carry routing data',
        ],
        prerequisites: ['backup'],
      },
      {
        id: 'import-design',
        title: 'Import Fritzing project',
        description: 'Use ProtoPulse\'s Import Design feature to load the .fzz or .fzpz files.',
        optional: false,
        estimatedMinutes: 5,
        tips: [
          'Component SVGs are converted to ProtoPulse component shapes',
          'Breadboard wiring is converted to schematic net connections',
          'You may want to recreate the PCB layout from scratch using ProtoPulse\'s PCB editor',
        ],
        prerequisites: ['export-fritzing'],
      },
      {
        id: 'upgrade-components',
        title: 'Upgrade to standard library components',
        description: 'Replace Fritzing community parts with ProtoPulse standard library components for better simulation and export support.',
        optional: true,
        estimatedMinutes: 20,
        tips: [
          'Standard library components have verified footprints and SPICE models',
          'Use the component search to find equivalents by value or function',
        ],
        prerequisites: ['import-design'],
      },
    ],
  };

  const toolSteps = toolSpecificSteps[tool];
  return [...commonPreSteps, ...toolSteps, ...commonPostSteps];
}

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// MigrationWizard
// ---------------------------------------------------------------------------

/**
 * Singleton that manages migration plans from other EDA tools to ProtoPulse.
 * Uses the singleton + subscribe pattern for React integration.
 */
export class MigrationWizard {
  private static instance: MigrationWizard | null = null;
  private listeners: Set<Listener> = new Set();
  private plans: Map<string, MigrationPlan> = new Map();
  private idCounter = 0;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): MigrationWizard {
    if (!MigrationWizard.instance) {
      MigrationWizard.instance = new MigrationWizard();
    }
    return MigrationWizard.instance;
  }

  /** Reset singleton — for testing only */
  static resetInstance(): void {
    MigrationWizard.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscribe / notify
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  // -----------------------------------------------------------------------
  // Format detection
  // -----------------------------------------------------------------------

  /**
   * Detect the source EDA tool from a file name and optional content snippet.
   */
  detectSource(fileName: string, content?: string): FormatDetection {
    const lower = fileName.toLowerCase();
    let bestTool: SourceEdaTool | null = null;
    let bestConfidence = 0;
    let matchedExtension: string | null = null;
    let matchedSignature: string | null = null;

    // Check file extensions
    for (const sig of TOOL_SIGNATURES) {
      for (const ext of sig.extensions) {
        if (lower.endsWith(ext.toLowerCase())) {
          const confidence = ext === '.json' || ext === '.sch' || ext === '.svg' ? 0.5 : 0.9;
          if (confidence > bestConfidence) {
            bestTool = sig.tool;
            bestConfidence = confidence;
            matchedExtension = ext;
          }
        }
      }
    }

    // Check content signatures for higher confidence
    if (content) {
      for (const sig of TOOL_SIGNATURES) {
        for (const pattern of sig.contentSignatures) {
          if (content.includes(pattern)) {
            const contentConf = 0.95;
            if (contentConf > bestConfidence) {
              bestTool = sig.tool;
              bestConfidence = contentConf;
              matchedSignature = pattern;
            }
          }
        }
      }
    }

    return {
      tool: bestTool,
      confidence: bestConfidence,
      matchedExtension,
      matchedSignature,
    };
  }

  // -----------------------------------------------------------------------
  // Compatibility assessment
  // -----------------------------------------------------------------------

  /**
   * Assess compatibility between a source EDA tool and ProtoPulse.
   */
  assessCompatibility(source: SourceEdaTool): CompatibilityAssessment {
    const featureMap = TOOL_FEATURE_MAPS[source];
    const features: FeatureCompatibility[] = [];
    let supportedCount = 0;
    let partialCount = 0;
    const blockers: string[] = [];
    const warnings: string[] = [];
    const tips: string[] = [];

    FEATURES.forEach((feature) => {
      const data = featureMap[feature];
      if (!data) {
        features.push({
          feature,
          sourceSupport: false,
          protoSupport: 'unsupported',
          notes: 'Feature data not available',
        });
        return;
      }

      features.push({
        feature,
        sourceSupport: data.sourceSupport,
        protoSupport: data.protoSupport,
        notes: data.notes,
      });

      if (data.sourceSupport) {
        if (data.protoSupport === 'full') {
          supportedCount++;
        } else if (data.protoSupport === 'partial') {
          partialCount++;
          warnings.push(`${feature}: ${data.notes}`);
        } else if (data.protoSupport === 'unsupported') {
          blockers.push(`${feature}: ${data.notes}`);
        }
      }
    });

    // Calculate overall score
    const totalSourceFeatures = features.filter((f) => f.sourceSupport).length;
    const score =
      totalSourceFeatures > 0
        ? Math.round(((supportedCount + partialCount * 0.5) / totalSourceFeatures) * 100)
        : 100;

    // Determine complexity
    let complexity: MigrationComplexity;
    if (score >= 80 && blockers.length === 0) {
      complexity = 'simple';
    } else if (score >= 50) {
      complexity = 'moderate';
    } else {
      complexity = 'complex';
    }

    // Add tool-specific tips
    const toolSig = TOOL_SIGNATURES.find((s) => s.tool === source);
    if (toolSig) {
      tips.push(`${toolSig.displayName} files are imported via the Import Design panel`);
    }

    if (source === 'altium') {
      tips.push('Export as ASCII format before importing — binary Altium files are not supported');
    }
    if (source === 'easyeda') {
      tips.push('LCSC/JLCPCB part numbers will be preserved for procurement');
    }
    if (source === 'fritzing') {
      tips.push('Consider upgrading community parts to standard library components for better simulation support');
    }

    return { source, overallScore: score, complexity, features, blockers, warnings, tips };
  }

  // -----------------------------------------------------------------------
  // Migration plan management
  // -----------------------------------------------------------------------

  /**
   * Create a new migration plan for the given source tool.
   */
  createPlan(source: SourceEdaTool, fileName: string, sourceVersion = ''): MigrationPlan {
    const id = `migration-${++this.idCounter}`;
    const templates = getStepTemplates(source);
    const steps: MigrationStep[] = templates.map((t, index) => ({
      ...t,
      order: index + 1,
      status: 'pending' as StepStatus,
    }));

    const plan: MigrationPlan = {
      id,
      source,
      sourceVersion,
      fileName,
      createdAt: Date.now(),
      status: 'not_started',
      steps,
      compatibility: this.assessCompatibility(source),
      currentStepIndex: 0,
    };

    this.plans.set(id, plan);
    this.notify();
    return plan;
  }

  /**
   * Get a migration plan by ID.
   */
  getPlan(planId: string): MigrationPlan | null {
    return this.plans.get(planId) ?? null;
  }

  /**
   * Get all migration plans.
   */
  getAllPlans(): MigrationPlan[] {
    return Array.from(this.plans.values());
  }

  /**
   * Delete a migration plan.
   */
  deletePlan(planId: string): boolean {
    const deleted = this.plans.delete(planId);
    if (deleted) {
      this.notify();
    }
    return deleted;
  }

  // -----------------------------------------------------------------------
  // Step progression
  // -----------------------------------------------------------------------

  /**
   * Advance to the next step, marking the current step as completed.
   * Returns the new current step, or null if all steps are done.
   */
  advanceStep(planId: string): MigrationStep | null {
    const plan = this.plans.get(planId);
    if (!plan) {
      return null;
    }

    // Mark current step as completed
    const currentStep = plan.steps[plan.currentStepIndex];
    if (currentStep && currentStep.status !== 'completed' && currentStep.status !== 'skipped') {
      currentStep.status = 'completed';
    }

    // Mark migration as in progress
    if (plan.status === 'not_started') {
      plan.status = 'in_progress';
    }

    // Move to next non-skipped step
    let nextIndex = plan.currentStepIndex + 1;
    while (nextIndex < plan.steps.length && plan.steps[nextIndex].status === 'skipped') {
      nextIndex++;
    }

    if (nextIndex >= plan.steps.length) {
      // All steps done
      plan.status = 'completed';
      plan.currentStepIndex = plan.steps.length - 1;
      this.notify();
      return null;
    }

    plan.currentStepIndex = nextIndex;
    plan.steps[nextIndex].status = 'in_progress';
    this.notify();
    return plan.steps[nextIndex];
  }

  /**
   * Update the status of a specific step.
   */
  updateStepStatus(planId: string, stepId: string, status: StepStatus): boolean {
    const plan = this.plans.get(planId);
    if (!plan) {
      return false;
    }

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) {
      return false;
    }

    step.status = status;

    // Update migration status
    if (status === 'failed') {
      plan.status = 'failed';
    } else if (status === 'in_progress' && plan.status === 'not_started') {
      plan.status = 'in_progress';
    }

    // Check if all non-skipped steps are done
    const allDone = plan.steps.every(
      (s) => s.status === 'completed' || s.status === 'skipped',
    );
    if (allDone) {
      plan.status = 'completed';
    }

    this.notify();
    return true;
  }

  /**
   * Skip an optional step.
   */
  skipStep(planId: string, stepId: string): boolean {
    const plan = this.plans.get(planId);
    if (!plan) {
      return false;
    }

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step || !step.optional) {
      return false;
    }

    step.status = 'skipped';
    this.notify();
    return true;
  }

  /**
   * Get the current step of a migration plan.
   */
  getCurrentStep(planId: string): MigrationStep | null {
    const plan = this.plans.get(planId);
    if (!plan) {
      return null;
    }
    return plan.steps[plan.currentStepIndex] ?? null;
  }

  /**
   * Check if a step's prerequisites are met.
   */
  arePrerequisitesMet(planId: string, stepId: string): boolean {
    const plan = this.plans.get(planId);
    if (!plan) {
      return false;
    }

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) {
      return false;
    }

    if (step.prerequisites.length === 0) {
      return true;
    }

    return step.prerequisites.every((prereqId) => {
      const prereq = plan.steps.find((s) => s.id === prereqId);
      return prereq && (prereq.status === 'completed' || prereq.status === 'skipped');
    });
  }

  // -----------------------------------------------------------------------
  // Progress calculation
  // -----------------------------------------------------------------------

  /**
   * Get progress percentage for a migration plan (0-100).
   */
  getProgress(planId: string): number {
    const plan = this.plans.get(planId);
    if (!plan || plan.steps.length === 0) {
      return 0;
    }

    const doneCount = plan.steps.filter(
      (s) => s.status === 'completed' || s.status === 'skipped',
    ).length;

    return Math.round((doneCount / plan.steps.length) * 100);
  }

  /**
   * Get estimated remaining time in minutes.
   */
  getEstimatedRemainingMinutes(planId: string): number {
    const plan = this.plans.get(planId);
    if (!plan) {
      return 0;
    }

    return plan.steps
      .filter((s) => s.status !== 'completed' && s.status !== 'skipped')
      .reduce((sum, s) => sum + s.estimatedMinutes, 0);
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  /**
   * Get the display name for a source EDA tool.
   */
  getToolDisplayName(tool: SourceEdaTool): string {
    const sig = TOOL_SIGNATURES.find((s) => s.tool === tool);
    return sig?.displayName ?? tool;
  }

  /**
   * Get all supported source EDA tools.
   */
  getSupportedTools(): Array<{ tool: SourceEdaTool; displayName: string; extensions: string[] }> {
    return TOOL_SIGNATURES.map((s) => ({
      tool: s.tool,
      displayName: s.displayName,
      extensions: [...s.extensions],
    }));
  }
}
