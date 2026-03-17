/**
 * Design System Documentation Registry
 *
 * Centralised, searchable reference for ProtoPulse's design system tokens,
 * component conventions, icon guidelines, motion presets, and UI patterns.
 * Each DocEntry captures a single design-system concept with human-readable
 * prose, concrete Tailwind / CSS examples, and optional cross-references.
 *
 * The search implementation is intentionally lightweight — a case-insensitive
 * substring match across title, description, examples, and relatedTokens — so
 * that it works without external dependencies and stays fast in-browser.
 *
 * Usage:
 *   const entry = getDocById('neon-cyan');
 *   const results = searchDocs('card border');
 *   const typo = getDocsByCategory('typography');
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DesignSystemCategory =
  | 'colors'
  | 'typography'
  | 'spacing'
  | 'components'
  | 'icons'
  | 'motion'
  | 'patterns';

export interface DocEntry {
  /** Unique, kebab-case identifier. */
  id: string;
  /** Which design-system pillar this belongs to. */
  category: DesignSystemCategory;
  /** Human-readable title. */
  title: string;
  /** Prose explanation of the concept (one to three sentences). */
  description: string;
  /** Concrete Tailwind classes, CSS variables, or code snippets. */
  examples: string[];
  /** Optional list of related CSS variable / token names for cross-reference. */
  relatedTokens?: string[];
}

// ---------------------------------------------------------------------------
// Built-in docs (30+ entries)
// ---------------------------------------------------------------------------

export const DESIGN_SYSTEM_DOCS: DocEntry[] = [
  // ── Colors ──────────────────────────────────────────────────────────────
  {
    id: 'neon-cyan',
    category: 'colors',
    title: 'Neon Cyan Accent',
    description:
      'The signature accent colour used for primary interactive elements, focused rings, and highlighted borders. Derived from the ProtoPulse brand identity.',
    examples: [
      '--color-primary: hsl(190 100% 43%)',
      '--color-accent: hsl(190 100% 43%)',
      '--color-editor-accent: #00F0FF',
      'bg-primary text-primary-foreground',
    ],
    relatedTokens: ['--color-primary', '--color-accent', '--color-editor-accent', '--color-ring'],
  },
  {
    id: 'background-surface',
    category: 'colors',
    title: 'Background & Surface Colors',
    description:
      'The dark-theme background hierarchy. Background is the deepest layer, card is the surface, popover matches card.',
    examples: [
      '--color-background: hsl(225 20% 3%)',
      '--color-card: hsl(225 18% 5%)',
      '--color-popover: hsl(225 18% 5%)',
      'bg-background',
      'bg-card text-card-foreground',
    ],
    relatedTokens: ['--color-background', '--color-card', '--color-popover'],
  },
  {
    id: 'muted-colors',
    category: 'colors',
    title: 'Muted & Secondary Text',
    description:
      'Used for de-emphasized text, labels, placeholders, and subtle backgrounds.',
    examples: [
      '--color-muted: hsl(225 12% 10%)',
      '--color-muted-foreground: hsl(215 15% 63%)',
      'text-muted-foreground',
      'bg-muted',
    ],
    relatedTokens: ['--color-muted', '--color-muted-foreground'],
  },
  {
    id: 'secondary-purple',
    category: 'colors',
    title: 'Secondary Purple',
    description:
      'A vibrant purple used as the secondary colour for differentiation — badges, toggles, and secondary actions.',
    examples: [
      '--color-secondary: hsl(260 100% 65%)',
      '--color-secondary-foreground: hsl(210 20% 98%)',
      'bg-secondary text-secondary-foreground',
    ],
    relatedTokens: ['--color-secondary', '--color-secondary-foreground'],
  },
  {
    id: 'destructive-red',
    category: 'colors',
    title: 'Destructive Red',
    description:
      'Reserved for error states, delete confirmations, and critical validation warnings.',
    examples: [
      '--color-destructive: hsl(0 85% 55%)',
      'text-destructive',
      'bg-destructive text-destructive-foreground',
      'border-destructive',
    ],
    relatedTokens: ['--color-destructive', '--color-destructive-foreground'],
  },
  {
    id: 'border-input',
    category: 'colors',
    title: 'Borders & Input Outlines',
    description:
      'Consistent border and input outline colour used across all UI elements — subtle against the dark surfaces.',
    examples: [
      '--color-border: hsl(225 12% 20%)',
      '--color-input: hsl(225 12% 20%)',
      'border-border',
      'border-input',
    ],
    relatedTokens: ['--color-border', '--color-input'],
  },
  {
    id: 'sidebar-colors',
    category: 'colors',
    title: 'Sidebar Surface & Border',
    description:
      'The sidebar uses its own surface and border tokens so it can differ subtly from the main content area.',
    examples: [
      '--color-sidebar: hsl(225 20% 4%)',
      '--color-sidebar-border: hsl(225 12% 18%)',
      'bg-sidebar',
    ],
    relatedTokens: ['--color-sidebar', '--color-sidebar-border'],
  },
  {
    id: 'high-contrast-mode',
    category: 'colors',
    title: 'High-Contrast Mode',
    description:
      'WCAG AAA (>=7:1) overrides activated by toggling .high-contrast on <html>. Bumps primary cyan brightness, raises muted foreground contrast, and increases border widths to 2px.',
    examples: [
      '.high-contrast { --color-primary: hsl(190 100% 55%); }',
      '.high-contrast { --color-border: hsl(0 0% 35%); }',
      'localStorage key: protopulse-high-contrast',
    ],
    relatedTokens: ['--color-primary', '--color-border', '--color-muted-foreground'],
  },

  // ── Typography ──────────────────────────────────────────────────────────
  {
    id: 'font-families',
    category: 'typography',
    title: 'Font Families',
    description:
      'Three font stacks: Inter for body, Rajdhani for headings/display text, JetBrains Mono for code and monospaced UI elements.',
    examples: [
      '--font-sans: "Inter", sans-serif',
      '--font-display: "Rajdhani", sans-serif',
      '--font-mono: "JetBrains Mono", monospace',
      'font-sans',
      'font-display',
      'font-mono',
    ],
    relatedTokens: ['--font-sans', '--font-display', '--font-mono'],
  },
  {
    id: 'heading-sizes',
    category: 'typography',
    title: 'Heading Scale',
    description:
      'Use Tailwind\'s text-* utilities. Large headings pair with font-display and font-semibold or font-bold. Body uses font-sans at text-sm or text-base.',
    examples: [
      'text-2xl font-display font-bold',
      'text-xl font-display font-semibold',
      'text-lg font-semibold',
      'text-base',
      'text-sm text-muted-foreground',
    ],
  },
  {
    id: 'monospace-usage',
    category: 'typography',
    title: 'Monospace / Code Text',
    description:
      'Use font-mono for code snippets, serial output, IDs, values, net names, pin references, and any technical data.',
    examples: [
      'font-mono text-xs',
      'font-mono text-sm text-primary',
      '<code className="font-mono bg-muted px-1 rounded">R1</code>',
    ],
    relatedTokens: ['--font-mono'],
  },
  {
    id: 'text-truncation',
    category: 'typography',
    title: 'Text Truncation',
    description:
      'Use Tailwind truncation utilities for labels that might overflow — especially in sidebar items and table cells.',
    examples: [
      'truncate',
      'line-clamp-2',
      'overflow-hidden text-ellipsis whitespace-nowrap',
    ],
  },

  // ── Spacing ─────────────────────────────────────────────────────────────
  {
    id: 'spacing-scale',
    category: 'spacing',
    title: 'Spacing Scale',
    description:
      'Prefer Tailwind\'s default 4px base scale. Use p-2 (8px) for tight padding, p-3 (12px) for standard panels, p-4 (16px) for cards, and gap-2/gap-3 in flex/grid containers.',
    examples: [
      'p-2 (8px)',
      'p-3 (12px)',
      'p-4 (16px)',
      'gap-2',
      'gap-3',
      'space-y-2',
    ],
  },
  {
    id: 'border-radius',
    category: 'spacing',
    title: 'Border Radius (Sharp)',
    description:
      'All radius tokens are set to 0px — ProtoPulse uses a deliberately sharp, angular aesthetic. Do not add rounded corners unless a specific component requires them.',
    examples: [
      '--radius-sm: 0px',
      '--radius-md: 0px',
      '--radius-lg: 0px',
      '--radius-xl: 0px',
      'rounded-none',
    ],
    relatedTokens: ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-2xl'],
  },
  {
    id: 'panel-layout',
    category: 'spacing',
    title: 'Panel & Section Spacing',
    description:
      'Three-panel layout: sidebar | tabbed views | chat panel. Panels use flex column with gap-2 or gap-3 internally. Section dividers use border-b border-border.',
    examples: [
      'flex flex-col gap-2 p-3',
      'border-b border-border pb-2 mb-2',
      'h-full overflow-y-auto',
    ],
  },

  // ── Components ──────────────────────────────────────────────────────────
  {
    id: 'button-variants',
    category: 'components',
    title: 'Button Variants',
    description:
      'shadcn/ui Button with variant and size props. Variants: default (primary cyan), secondary (purple), destructive (red), outline (bordered), ghost (transparent). Always add data-testid.',
    examples: [
      '<Button variant="default">Save</Button>',
      '<Button variant="secondary" size="sm">Toggle</Button>',
      '<Button variant="ghost" size="icon"><IconComponent /></Button>',
      '<Button variant="destructive">Delete</Button>',
      '<Button variant="outline">Cancel</Button>',
    ],
  },
  {
    id: 'card-pattern',
    category: 'components',
    title: 'Card Component',
    description:
      'shadcn/ui Card for content grouping. Uses CardHeader + CardTitle + CardContent. Background is bg-card, border is border-border.',
    examples: [
      '<Card><CardHeader><CardTitle>Title</CardTitle></CardHeader><CardContent>...</CardContent></Card>',
      'bg-card text-card-foreground border border-border',
    ],
  },
  {
    id: 'dialog-pattern',
    category: 'components',
    title: 'Dialog / Modal',
    description:
      'shadcn/ui Dialog for modals. Use DialogTrigger + DialogContent + DialogHeader + DialogFooter. Dismiss with Escape. Add confirm dialogs (ConfirmDialog) for destructive actions.',
    examples: [
      '<Dialog><DialogTrigger asChild><Button>Open</Button></DialogTrigger><DialogContent>...</DialogContent></Dialog>',
      '<ConfirmDialog title="Delete?" onConfirm={handleDelete}>Are you sure?</ConfirmDialog>',
    ],
  },
  {
    id: 'toast-usage',
    category: 'components',
    title: 'Toast Notifications',
    description:
      'Use sonner for toast notifications. Success for confirmations, error for failures, warning for caution, info for neutral status updates.',
    examples: [
      'toast.success("Saved successfully")',
      'toast.error("Failed to export")',
      'toast.warning("Unsaved changes")',
      'toast.info("Processing...")',
    ],
  },
  {
    id: 'badge-usage',
    category: 'components',
    title: 'Badge Component',
    description:
      'shadcn/ui Badge for status labels, categories, and counts. Variants: default, secondary, destructive, outline.',
    examples: [
      '<Badge>Active</Badge>',
      '<Badge variant="secondary">P2</Badge>',
      '<Badge variant="destructive">Error</Badge>',
      '<Badge variant="outline">3 items</Badge>',
    ],
  },
  {
    id: 'tooltip-pattern',
    category: 'components',
    title: 'Tooltip Usage',
    description:
      'Wrap icon buttons and abbreviated labels with shadcn/ui Tooltip. Prefer TooltipTrigger + TooltipContent with short text. Delay defaults to 200ms.',
    examples: [
      '<Tooltip><TooltipTrigger asChild><Button size="icon">...</Button></TooltipTrigger><TooltipContent>Label</TooltipContent></Tooltip>',
    ],
  },
  {
    id: 'tabs-component',
    category: 'components',
    title: 'Tabs Navigation',
    description:
      'shadcn/ui Tabs for switching between related views within a panel. Use TabsList + TabsTrigger + TabsContent. Active tab gets primary colour underline.',
    examples: [
      '<Tabs defaultValue="tab1"><TabsList><TabsTrigger value="tab1">One</TabsTrigger></TabsList><TabsContent value="tab1">...</TabsContent></Tabs>',
    ],
  },
  {
    id: 'empty-state',
    category: 'components',
    title: 'Empty State Pattern',
    description:
      'Use the EmptyState component for views with no data. Includes icon, title, description, and optional action button.',
    examples: [
      '<EmptyState icon={<InboxIcon />} title="No items" description="Add your first item to get started." />',
    ],
  },
  {
    id: 'skeleton-loading',
    category: 'components',
    title: 'Skeleton Loading',
    description:
      'Use PanelSkeleton or the Skeleton primitive for loading placeholders. Animate with a subtle pulse. Match the expected content shape.',
    examples: [
      '<PanelSkeleton />',
      '<Skeleton className="h-4 w-3/4" />',
      '<Skeleton className="h-8 w-full" />',
    ],
  },

  // ── Icons ───────────────────────────────────────────────────────────────
  {
    id: 'lucide-icons',
    category: 'icons',
    title: 'Lucide React Icons',
    description:
      'All icons come from the lucide-react package. Import individual icons by name. Use size={16} for inline, size={20} for buttons, size={24} for headings.',
    examples: [
      'import { Plus, Trash2, Settings } from "lucide-react";',
      '<Plus className="h-4 w-4" />',
      '<Settings className="h-5 w-5 text-muted-foreground" />',
    ],
  },
  {
    id: 'icon-button-pattern',
    category: 'icons',
    title: 'Icon Button Pattern',
    description:
      'Pair icon-only buttons with variant="ghost" size="icon" and always wrap in a Tooltip for accessibility.',
    examples: [
      '<Button variant="ghost" size="icon" data-testid="btn-settings"><Settings className="h-4 w-4" /></Button>',
      'Always add aria-label or Tooltip for screen readers',
    ],
  },
  {
    id: 'icon-colors',
    category: 'icons',
    title: 'Icon Color Conventions',
    description:
      'Icons inherit text colour by default. Use text-primary for active states, text-muted-foreground for inactive, text-destructive for delete/danger.',
    examples: [
      'text-primary (active, accent cyan)',
      'text-muted-foreground (inactive, secondary)',
      'text-destructive (danger, delete)',
      'text-foreground (default, high contrast)',
    ],
  },

  // ── Motion ──────────────────────────────────────────────────────────────
  {
    id: 'transition-defaults',
    category: 'motion',
    title: 'Transition Defaults',
    description:
      'Standard CSS transitions for interactive state changes. Use transition-colors for hover effects, transition-all for size/position changes. Duration 150ms for micro-interactions, 200ms for panels.',
    examples: [
      'transition-colors duration-150',
      'transition-all duration-200',
      'transition-opacity duration-200 ease-in-out',
    ],
  },
  {
    id: 'animation-enter-exit',
    category: 'motion',
    title: 'Enter / Exit Animations',
    description:
      'Use tw-animate-css classes for enter/exit. Dialogs and popovers use fade+zoom. Slide-in for side panels. Avoid jarring animations — keep durations under 300ms.',
    examples: [
      'animate-in fade-in-0 zoom-in-95',
      'animate-out fade-out-0 zoom-out-95',
      'animate-in slide-in-from-right',
      'animate-in slide-in-from-bottom-2',
    ],
  },
  {
    id: 'reduced-motion',
    category: 'motion',
    title: 'Reduced Motion',
    description:
      'Respect prefers-reduced-motion. Tailwind\'s motion-safe: and motion-reduce: variants are available. Animations should degrade to instant state changes.',
    examples: [
      'motion-safe:animate-in motion-safe:fade-in-0',
      'motion-reduce:transition-none',
      '@media (prefers-reduced-motion: reduce) { animation: none; }',
    ],
  },
  {
    id: 'pulse-skeleton',
    category: 'motion',
    title: 'Pulse Animation',
    description:
      'The animate-pulse class is used for skeleton loading indicators. Use sparingly — only on placeholder shapes while data loads.',
    examples: [
      'animate-pulse bg-muted rounded-none h-4 w-full',
    ],
  },

  // ── Patterns ────────────────────────────────────────────────────────────
  {
    id: 'data-testid-convention',
    category: 'patterns',
    title: 'data-testid Convention',
    description:
      'Every interactive and display element MUST have a data-testid attribute. Pattern: {action}-{target} for buttons, {noun}-{detail} for display elements.',
    examples: [
      'data-testid="button-submit"',
      'data-testid="input-search"',
      'data-testid="badge-status"',
      'data-testid="card-component"',
    ],
  },
  {
    id: 'cn-utility',
    category: 'patterns',
    title: 'cn() Class Merging',
    description:
      'Always use the cn() utility (clsx + tailwind-merge) for conditional class names. Never concatenate class strings manually.',
    examples: [
      'import { cn } from "@/lib/utils";',
      'className={cn("text-sm", isActive && "text-primary", className)}',
    ],
  },
  {
    id: 'dark-first-design',
    category: 'patterns',
    title: 'Dark-First Design',
    description:
      'ProtoPulse is dark-theme only. All colours are designed for dark backgrounds. There is no light mode. Do not add dark: variants — all styles are the base case.',
    examples: [
      'No light mode exists',
      'bg-background is always dark (hsl 225 20% 3%)',
      'Never use dark: prefixed Tailwind classes',
    ],
  },
  {
    id: 'focus-ring-style',
    category: 'patterns',
    title: 'Focus Ring Style',
    description:
      'Focus rings use the ring colour token (primary cyan). All interactive elements must be keyboard-focusable with a visible ring.',
    examples: [
      '--color-ring: hsl(190 100% 43%)',
      'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
    ],
    relatedTokens: ['--color-ring'],
  },
  {
    id: 'responsive-panels',
    category: 'patterns',
    title: 'Responsive Panel Collapse',
    description:
      'On narrow viewports the sidebar collapses to icons-only, and the chat panel can be toggled off. Use the useMobile hook to detect breakpoint.',
    examples: [
      'const isMobile = useMobile();',
      'isMobile ? <CollapsedSidebar /> : <FullSidebar />',
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Search docs by a free-text query. Matches case-insensitively against
 * title, description, examples, and relatedTokens.
 */
export function searchDocs(query: string): DocEntry[] {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (terms.length === 0) {
    return [];
  }

  return DESIGN_SYSTEM_DOCS.filter((entry) => {
    const haystack = [
      entry.title,
      entry.description,
      ...entry.examples,
      ...(entry.relatedTokens ?? []),
    ]
      .join(' ')
      .toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });
}

/**
 * Get all docs belonging to a specific category.
 */
export function getDocsByCategory(category: DesignSystemCategory): DocEntry[] {
  return DESIGN_SYSTEM_DOCS.filter((entry) => entry.category === category);
}

/**
 * Look up a single doc entry by its unique ID.
 */
export function getDocById(id: string): DocEntry | undefined {
  return DESIGN_SYSTEM_DOCS.find((entry) => entry.id === id);
}
