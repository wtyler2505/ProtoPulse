/* eslint-disable jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  useReducer,
  Suspense,
  useSyncExternalStore,
  type FocusEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useParams, useLocation, Redirect } from 'wouter';
import {
  ProjectProvider,
  useArchitecture,
  useBom,
  useProjectId,
  useProjectMeta,
  useValidation,
} from '@/lib/project-context';
import type { ViewMode } from '@/lib/project-context';

import { buildValidationContext } from '@/lib/pcb-tutorial';
import { MilestoneTracker } from '@/lib/progress-milestones';
import type { ProjectState as MilestoneProjectState } from '@/lib/progress-milestones';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/utils';
import { Menu, MessageCircle, Layers } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { DndProvider } from '@/lib/dnd-context';
import { TutorialProvider } from '@/lib/tutorial-context';
import { navItems, alwaysVisibleIds } from '@/components/layout/sidebar/sidebar-constants';
import { shouldIgnoreKeyboardShortcut } from '@/lib/keyboard-shortcuts';
import { createResizeKeyHandler, getResizeAriaProps } from '@/lib/keyboard-resize';
import type { KeyboardResizeConfig } from '@/lib/keyboard-resize';
import { getUrlWorkspaceView, normalizeWorkspacePath, parseWorkspaceProjectRoute } from '@/lib/workspace-route';
import { PCB_RUN_DRC_EVENT, type PcbRunDrcEventDetail } from '@/lib/pcb/pcb-surface-status';

import { useActionExecutor } from '@/components/panels/chat/hooks/useActionExecutor';
import PredictionPanel from '@/components/ui/PredictionPanel';
import { usePredictions } from '@/hooks/usePredictions';
import { useIsMobile } from '@/hooks/use-mobile';
import RadialMenu from '@/components/ui/RadialMenu';
import RadialMenuCustomizer from '@/components/ui/RadialMenuCustomizer';
import RadialCommandPreview from '@/components/ui/RadialCommandPreview';
import type { RadialCommandPreviewState } from '@/components/ui/RadialCommandPreview';
import RadialMarkingPreview from '@/components/ui/RadialMarkingPreview';
import type { RadialMarkingPreviewState } from '@/components/ui/RadialMarkingPreview';
import {
  buildPredictionAddNodeActions,
  getPredictionComponentCount,
  getPredictionComponentLabel,
} from '@/lib/prediction-actions';
import {
  dispatchRadialCommandDetail,
  dispatchRadialCommandPreview,
  getActionById,
  getActionsForContext,
} from '@/lib/radial-menu-actions';
import { recordRadialTelemetry } from '@/lib/radial-menu-telemetry';
import {
  applyRadialPreferences,
  getRadialPreferenceKey,
  radialPreferencesStore,
  useRadialPreferences,
} from '@/lib/radial-menu-preferences';
import {
  getLastRadialAiCommand,
  repeatLastRadialAiCommand,
  subscribeLastRadialAiCommand,
} from '@/lib/radial-ai-commands';
import type { RadialMenuPosition, RadialMenuSelectOptions } from '@/components/ui/RadialMenu';
import type { MenuContext, MenuContextType, RadialSlot, TargetKind } from '@/lib/radial-menu-actions';

import {
  Sidebar,
  ChatPanel,
  ShortcutsOverlay,
  CommandPalette as NavCommandPalette,
  PartsCommandPalette,
  GlobalSearchDialog,
  UnifiedComponentSearch,
  TutorialOverlay,
  LessonModeOverlay,
  ActivityFeedPanel,
  PcbTutorialPanel,
  SmartHintToast,
  startPrefetch,
} from './workspace/lazy-imports';
import {
  workspaceReducer,
  createInitialWorkspaceState,
  loadPersistedLayout,
  persistLayout,
} from './workspace/workspace-reducer';
import type { PersistedPanelLayout } from './workspace/workspace-reducer';
import { useHoverPeekPanel } from './workspace/useHoverPeekPanel';
import { ViewRenderer, ViewLoadingFallback } from './workspace/ViewRenderer';
import { WorkspaceHeader } from './workspace/WorkspaceHeader';
import { MobileNav } from './workspace/MobileNav';
import HardwareInspectionPanel from '@/components/circuit-editor/HardwareInspectionPanel';

/** All valid ViewMode values — used for URL deep link validation. */
const VALID_VIEW_MODES: ReadonlySet<string> = new Set<string>([
  ...navItems.map((i) => i.view),
  'project_explorer',
  'dashboard',
  'output',
  'design_history',
  'lifecycle',
  'comments',
]);

function ResizeHandle({
  side,
  onResize,
  keyboardConfig,
}: {
  side: 'left' | 'right';
  onResize: (delta: number) => void;
  keyboardConfig: KeyboardResizeConfig;
}) {
  const isDragging = useRef(false);
  const lastX = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      lastX.current = e.clientX;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) {
          return;
        }
        const delta = e.clientX - lastX.current;
        lastX.current = e.clientX;
        onResize(side === 'left' ? delta : -delta);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [onResize, side],
  );

  const handleKeyDown = useMemo(() => createResizeKeyHandler(keyboardConfig), [keyboardConfig]);
  const ariaProps = useMemo(() => getResizeAriaProps(keyboardConfig), [keyboardConfig]);
  const regionLabel = side === 'left' ? 'Sidebar resize control' : 'AI assistant resize control';

  return (
    <div role="region" aria-label={regionLabel} className="hidden lg:flex shrink-0">
      <div
        data-testid={`resize-handle-${side}`}
        className="flex w-1 cursor-col-resize items-center justify-center group hover:bg-primary/20 active:bg-primary/30 transition-colors relative z-30 shrink-0 hover:shadow-[0_0_8px_rgba(6,182,212,0.3)] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-0"
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        {...ariaProps}
      >
        <div className="w-px h-8 bg-border group-hover:bg-primary group-active:bg-primary transition-colors" />
      </div>
    </div>
  );
}

const HOVER_OPEN_DELAY_MS = 220;
const HOVER_CLOSE_DELAY_MS = 110;
const RADIAL_MARKING_THRESHOLD_PX = 42;

function HoverPeekDock({
  side,
  collapsed,
  peekVisible,
  onPeekOpen,
  onPeekClose,
  children,
}: {
  side: 'left' | 'right';
  collapsed: boolean;
  peekVisible: boolean;
  onPeekOpen: () => void;
  onPeekClose: () => void;
  children: ReactNode;
}) {
  // Store the latest handlers in refs so scheduleOpen/scheduleClose can stay
  // stable across renders. This prevents the event listener identity on the
  // wrapper div from churning (which would re-attach on every parent render).
  const onPeekOpenRef = useRef(onPeekOpen);
  const onPeekCloseRef = useRef(onPeekClose);
  useEffect(() => {
    onPeekOpenRef.current = onPeekOpen;
  }, [onPeekOpen]);
  useEffect(() => {
    onPeekCloseRef.current = onPeekClose;
  }, [onPeekClose]);

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable (empty deps) — reads from refs at fire time.
  const scheduleOpen = useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    if (openTimer.current !== null) {
      return;
    }
    openTimer.current = setTimeout(() => {
      openTimer.current = null;
      onPeekOpenRef.current();
    }, HOVER_OPEN_DELAY_MS);
  }, []);

  const scheduleClose = useCallback(() => {
    if (openTimer.current !== null) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current !== null) {
      return;
    }
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      onPeekCloseRef.current();
    }, HOVER_CLOSE_DELAY_MS);
  }, []);

  // Cleanup on unmount — stable closure over the timer refs.
  useEffect(
    () => () => {
      if (openTimer.current !== null) {
        clearTimeout(openTimer.current);
        openTimer.current = null;
      }
      if (closeTimer.current !== null) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    },
    [],
  );

  const handleBlurCapture = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
        return;
      }
      scheduleClose();
    },
    [scheduleClose],
  );

  return (
    <div
      data-testid={`hover-peek-dock-${side}`}
      className={cn(
        'relative flex h-full shrink-0 overflow-visible',
        side === 'right' ? 'justify-end' : 'justify-start',
        collapsed ? 'w-10' : 'w-auto',
        peekVisible && collapsed && 'z-40',
      )}
      onMouseEnter={collapsed ? scheduleOpen : undefined}
      onMouseLeave={collapsed ? scheduleClose : undefined}
      onFocusCapture={collapsed ? scheduleOpen : undefined}
      onBlurCapture={collapsed ? handleBlurCapture : undefined}
    >
      <div
        data-testid={`hover-peek-panel-${side}`}
        className={cn('relative h-full transition-shadow duration-200', peekVisible && collapsed && 'shadow-2xl')}
      >
        {children}
      </div>

      {collapsed && !peekVisible && (
        <div
          data-testid={`hover-peek-hotspot-${side}`}
          aria-hidden="true"
          className={cn('absolute inset-y-0 z-10', side === 'left' ? 'left-0 w-3' : 'right-0 w-3')}
          onMouseEnter={scheduleOpen}
        />
      )}
    </div>
  );
}

function viewToRadialContextType(view: ViewMode): MenuContextType | null {
  switch (view) {
    case 'architecture':
      return 'architecture';
    case 'schematic':
      return 'schematic';
    case 'pcb':
      return 'pcb';
    case 'breadboard':
      return 'breadboard';
    case 'procurement':
      return 'bom';
    case 'validation':
      return 'validation';
    case 'simulation':
      return 'simulation';
    case 'starter_circuits':
      return 'starter_circuits';
    case 'viewer_3d':
    case 'digital_twin':
      return 'model_3d';
    case 'serial_monitor':
      return 'serial';
    case 'output':
      return 'exports';
    case 'arduino':
    case 'circuit_code':
      return 'firmware';
    case 'storage':
    case 'personal_inventory':
      return 'inventory';
    default:
      return null;
  }
}

function detectRadialTargetFromElement(target: EventTarget | null): {
  target: TargetKind;
  targetId?: string;
  targetLabel?: string;
} {
  let el = target instanceof HTMLElement ? target : null;
  while (el && el !== document.body) {
    const wireId = el.getAttribute('data-wire-id');
    if (wireId) {
      return {
        target: 'wire',
        targetId: wireId,
        targetLabel: el.getAttribute('data-node-label') ?? el.getAttribute('aria-label') ?? undefined,
      };
    }
    const nodeId = el.getAttribute('data-id') ?? el.getAttribute('data-nodeid');
    if (nodeId) {
      return {
        target: 'node',
        targetId: nodeId,
        targetLabel: el.getAttribute('data-node-label') ?? el.getAttribute('aria-label') ?? undefined,
      };
    }
    const bomRow = el.getAttribute('data-bom-id');
    if (bomRow) {
      return {
        target: 'bom_row',
        targetId: bomRow,
        targetLabel: el.getAttribute('data-bom-label') ?? el.textContent?.trim() ?? undefined,
      };
    }
    const issueId = el.getAttribute('data-issue-id');
    if (issueId) {
      return {
        target: 'issue',
        targetId: issueId,
        targetLabel: el.getAttribute('data-issue-label') ?? el.textContent?.trim() ?? undefined,
      };
    }
    const probeId = el.getAttribute('data-probe-id');
    if (probeId) {
      return {
        target: 'probe',
        targetId: probeId,
        targetLabel: el.getAttribute('data-probe-label') ?? el.textContent?.trim() ?? undefined,
      };
    }
    const starterCircuitId = el.getAttribute('data-starter-circuit-id');
    if (starterCircuitId) {
      return {
        target: 'starter_circuit',
        targetId: starterCircuitId,
        targetLabel: el.getAttribute('data-starter-circuit-label') ?? el.textContent?.trim() ?? undefined,
      };
    }
    const logLineId = el.getAttribute('data-log-line-id');
    if (logLineId) {
      return {
        target: 'log_line',
        targetId: logLineId,
        targetLabel: el.getAttribute('data-log-line-label') ?? el.textContent?.trim() ?? undefined,
      };
    }
    const modelId = el.getAttribute('data-model-id');
    if (modelId) {
      return {
        target: 'model',
        targetId: modelId,
        targetLabel: el.getAttribute('data-model-label') ?? el.getAttribute('aria-label') ?? undefined,
      };
    }
    const fileId = el.getAttribute('data-file-id');
    if (fileId) {
      return {
        target: 'file',
        targetId: fileId,
        targetLabel: el.getAttribute('data-file-label') ?? el.textContent?.trim() ?? undefined,
      };
    }
    const partId = el.getAttribute('data-part-id');
    if (partId) {
      return {
        target: 'part',
        targetId: partId,
        targetLabel: el.getAttribute('data-part-label') ?? el.textContent?.trim() ?? undefined,
      };
    }
    el = el.parentElement;
  }
  return { target: 'canvas' };
}

function detectRadialTarget(e: MouseEvent): { target: TargetKind; targetId?: string; targetLabel?: string } {
  return detectRadialTargetFromElement(e.target);
}

function isKeyboardRadialOpenShortcut(event: KeyboardEvent): boolean {
  return (
    event.key === 'ContextMenu' ||
    (event.key === 'F10' && event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey)
  );
}

function getKeyboardRadialPosition(mainEl: HTMLElement, targetEl: HTMLElement | null): RadialMenuPosition {
  const rect =
    targetEl && targetEl !== mainEl && mainEl.contains(targetEl)
      ? targetEl.getBoundingClientRect()
      : mainEl.getBoundingClientRect();

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function slotFromPointerDelta(dx: number, dy: number): RadialSlot {
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const slot = Math.round((angle + 90) / 45);
  return (((slot % 8) + 8) % 8) as RadialSlot;
}

export function RadialMenuController({
  mainRef,
  activeView,
}: {
  mainRef: RefObject<HTMLElement | null>;
  activeView: ViewMode;
}) {
  const { runValidation } = useValidation();
  const { toast } = useToast();
  const radialPreferences = useRadialPreferences();
  const lastRadialAiCommand = useSyncExternalStore(
    subscribeLastRadialAiCommand,
    getLastRadialAiCommand,
    getLastRadialAiCommand,
  );
  const [radialMenu, setRadialMenu] = useState<{
    position: RadialMenuPosition;
    context: MenuContext;
    openedAt: number;
    confirmItemId?: string;
  } | null>(null);
  const [customizer, setCustomizer] = useState<{
    position: RadialMenuPosition;
    context: MenuContext;
  } | null>(null);
  const [markingPreview, setMarkingPreview] = useState<RadialMarkingPreviewState | null>(null);
  const [commandPreview, setCommandPreview] = useState<RadialCommandPreviewState | null>(null);
  const pendingMarkRef = useRef<{
    origin: RadialMenuPosition;
    context: MenuContext;
    actions: ReturnType<typeof getActionsForContext>;
    marking: boolean;
    thresholdRecorded: boolean;
    startedAt: number;
    lastDistance: number;
    lastSlot?: RadialSlot;
    lastCommandId?: string;
  } | null>(null);
  const pendingPreviewRef = useRef<RadialMarkingPreviewState | null>(null);
  const previewFrameRef = useRef<number | null>(null);
  const suppressNextContextMenuRef = useRef<{
    x: number;
    y: number;
    until: number;
  } | null>(null);

  const updateCommandPreview = useCallback((preview: RadialCommandPreviewState | null) => {
    setCommandPreview(preview);
    if (preview) {
      dispatchRadialCommandPreview({
        phase: 'show',
        commandId: preview.item.id,
        context: preview.context,
      });
      return;
    }
    dispatchRadialCommandPreview({ phase: 'clear' });
  }, []);

  useEffect(
    () => () => {
      dispatchRadialCommandPreview({ phase: 'clear' });
    },
    [],
  );

  const closeRadialMenu = useCallback(() => {
    setRadialMenu(null);
    updateCommandPreview(null);
  }, [updateCommandPreview]);
  const closeCustomizer = useCallback(() => setCustomizer(null), []);
  const scheduleMarkingPreview = useCallback((preview: RadialMarkingPreviewState) => {
    pendingPreviewRef.current = preview;
    if (previewFrameRef.current !== null) {
      return;
    }
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = null;
      setMarkingPreview(pendingPreviewRef.current);
    });
  }, []);
  const clearMarkingPreview = useCallback(() => {
    pendingPreviewRef.current = null;
    if (previewFrameRef.current !== null) {
      cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }
    setMarkingPreview(null);
  }, []);

  useEffect(() => {
    setRadialMenu(null);
    setCustomizer(null);
    updateCommandPreview(null);
    pendingMarkRef.current = null;
    clearMarkingPreview();
  }, [activeView, clearMarkingPreview, updateCommandPreview]);

  useEffect(
    () => () => {
      if (previewFrameRef.current !== null) {
        cancelAnimationFrame(previewFrameRef.current);
      }
    },
    [],
  );

  const showDestructiveUndoToast = useCallback(
    (
      context: MenuContext,
      item: NonNullable<ReturnType<typeof getActionById>>,
      undo: NonNullable<ReturnType<typeof dispatchRadialCommandDetail>['undo']>,
    ) => {
      let dismissUndoToast: (() => void) | undefined;
      const handleUndo = () => {
        void Promise.resolve(undo.run()).then(() => {
          recordRadialTelemetry({
            name: 'destructive-undo-run',
            view: context.view,
            target: context.target,
            commandId: item.id,
            slot: item.slot,
          });
          dismissUndoToast?.();
        });
      };
      const undoToast = toast({
        variant: 'warning',
        title: `${item.label} complete`,
        description: undo.description ?? `${undo.label} is available.`,
        action: (
          <ToastAction altText={undo.label} onClick={handleUndo}>
            Undo
          </ToastAction>
        ),
      });
      dismissUndoToast = undoToast.dismiss;
      recordRadialTelemetry({
        name: 'destructive-undo-offered',
        view: context.view,
        target: context.target,
        commandId: item.id,
        slot: item.slot,
      });
    },
    [toast],
  );

  const executeRadialCommand = useCallback(
    (context: MenuContext, itemId: string, activation: RadialMenuSelectOptions = { input: 'marking' }) => {
      const item = getActionById(context, itemId);
      const detail = dispatchRadialCommandDetail({
        commandId: itemId,
        context,
        activation,
      });

      if (detail.handled) {
        if (item?.destructive && detail.undo) {
          showDestructiveUndoToast(context, item, detail.undo);
        } else if (item?.destructive) {
          toast({
            variant: 'warning',
            title: `${item.label} complete`,
            description: 'This destructive radial command completed.',
          });
        }
        return;
      }

      if (!detail.handled) {
        if (itemId === 'run_drc' || itemId === 'run_erc' || itemId === 'rerun_validation') {
          runValidation();
          toast({ title: 'Validation running', description: item?.description ?? 'Running design checks.' });
        } else {
          toast({
            title: item ? `${item.label} queued` : `Action: ${itemId}`,
            description: item
              ? `${item.description} This view adapter is next in the radial rollout.`
              : `"${itemId}" triggered on ${context.view} view.`,
          });
        }
      }
    },
    [runValidation, showDestructiveUndoToast, toast],
  );

  const completeMarkingGesture = useCallback(
    (clientX: number, clientY: number, suppressNextContextMenu: boolean) => {
      const pending = pendingMarkRef.current;
      if (!pending) {
        return;
      }

      const dx = clientX - pending.origin.x;
      const dy = clientY - pending.origin.y;
      const distance = Math.hypot(dx, dy);
      const slot = slotFromPointerDelta(dx, dy);
      const slotItem = pending.actions.find((action) => action.slot === slot);
      const item = slotItem && !slotItem.disabled ? slotItem : undefined;
      pendingMarkRef.current = null;
      suppressNextContextMenuRef.current = suppressNextContextMenu
        ? { x: clientX, y: clientY, until: performance.now() + 750 }
        : null;
      setCustomizer(null);
      setRadialMenu(null);
      updateCommandPreview(null);
      clearMarkingPreview();
      if (item) {
        recordRadialTelemetry({
          name: item.destructive ? 'mark-confirm-required' : 'mark-select',
          view: pending.context.view,
          target: pending.context.target,
          commandId: item.id,
          slot,
          durationMs: performance.now() - pending.startedAt,
          distancePx: distance,
          actionCount: pending.actions.length,
        });
        if (item.destructive) {
          setRadialMenu({
            position: pending.origin,
            context: { ...pending.context, pointer: pending.origin },
            openedAt: performance.now(),
            confirmItemId: item.id,
          });
          toast({
            title: `Confirm ${item.label}`,
            description: 'Destructive radial gestures open the wheel for a second confirmation.',
          });
          return;
        }
        executeRadialCommand({ ...pending.context, pointer: pending.origin }, item.id, { input: 'marking' });
        return;
      }

      recordRadialTelemetry({
        name: 'mark-cancel',
        view: pending.context.view,
        target: pending.context.target,
        commandId: slotItem?.id,
        slot,
        durationMs: performance.now() - pending.startedAt,
        distancePx: distance,
        actionCount: pending.actions.length,
        reason: slotItem ? 'disabled-command-in-slot' : 'no-command-in-slot',
      });
    },
    [clearMarkingPreview, executeRadialCommand, toast, updateCommandPreview],
  );

  useEffect(() => {
    const mainEl = mainRef.current;
    if (!mainEl) {
      return;
    }

    const buildContextForTarget = (
      target: EventTarget | null,
      position: RadialMenuPosition,
    ): { context: MenuContext; actions: ReturnType<typeof getActionsForContext> } | null => {
      const contextType = viewToRadialContextType(activeView);
      if (!contextType) {
        return null;
      }

      const { target: radialTarget, targetId, targetLabel } = detectRadialTargetFromElement(target);
      const context: MenuContext = {
        view: contextType,
        target: radialTarget,
        targetId,
        targetLabel,
        pointer: position,
      };
      const actions = applyRadialPreferences(
        getActionsForContext(context),
        getRadialPreferenceKey(context),
        radialPreferences,
      );
      return actions.length > 0 ? { context, actions } : null;
    };

    const buildContext = (
      e: MouseEvent | PointerEvent,
    ): { context: MenuContext; actions: ReturnType<typeof getActionsForContext> } | null =>
      buildContextForTarget(e.target, { x: e.clientX, y: e.clientY });

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 2) {
        return;
      }
      const built = buildContext(e);
      if (!built) {
        return;
      }
      const startedAt = performance.now();
      pendingMarkRef.current = {
        origin: { x: e.clientX, y: e.clientY },
        context: built.context,
        actions: built.actions,
        marking: false,
        thresholdRecorded: false,
        startedAt,
        lastDistance: 0,
      };
      recordRadialTelemetry({
        name: 'mark-start',
        view: built.context.view,
        target: built.context.target,
        actionCount: built.actions.length,
      });
    };

    const handlePointerMove = (e: PointerEvent) => {
      const pending = pendingMarkRef.current;
      if (!pending || (e.buttons & 2) !== 2) {
        return;
      }

      const dx = e.clientX - pending.origin.x;
      const dy = e.clientY - pending.origin.y;
      const distance = Math.hypot(dx, dy);
      pending.lastDistance = distance;
      if (distance >= RADIAL_MARKING_THRESHOLD_PX) {
        const slot = slotFromPointerDelta(dx, dy);
        const slotItem = pending.actions.find((action) => action.slot === slot);
        const item = slotItem && !slotItem.disabled ? slotItem : undefined;
        pending.marking = true;
        pending.lastSlot = slot;
        pending.lastCommandId = slotItem?.id;
        if (!pending.thresholdRecorded) {
          pending.thresholdRecorded = true;
          recordRadialTelemetry({
            name: 'mark-threshold',
            view: pending.context.view,
            target: pending.context.target,
            commandId: slotItem?.id,
            slot,
            durationMs: performance.now() - pending.startedAt,
            distancePx: distance,
            actionCount: pending.actions.length,
          });
        }
        scheduleMarkingPreview({
          origin: pending.origin,
          current: { x: e.clientX, y: e.clientY },
          slot,
          commandId: slotItem?.id,
          label: slotItem?.label,
          disabled: !item,
        });
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const pending = pendingMarkRef.current;
      if (!pending || e.button !== 2) {
        return;
      }

      if (pending.marking) {
        e.preventDefault();
        completeMarkingGesture(e.clientX, e.clientY, true);
        return;
      }

      pendingMarkRef.current = null;
      updateCommandPreview(null);
      recordRadialTelemetry({
        name: 'mark-cancel',
        view: pending.context.view,
        target: pending.context.target,
        durationMs: performance.now() - pending.startedAt,
        distancePx: pending.lastDistance,
        actionCount: pending.actions.length,
        reason: 'below-threshold',
      });
      clearMarkingPreview();
    };

    const cancelPendingMark = (reason: string) => {
      const pending = pendingMarkRef.current;
      if (!pending) {
        return;
      }
      pendingMarkRef.current = null;
      recordRadialTelemetry({
        name: 'mark-cancel',
        view: pending.context.view,
        target: pending.context.target,
        commandId: pending.lastCommandId,
        slot: pending.lastSlot,
        durationMs: performance.now() - pending.startedAt,
        distancePx: pending.lastDistance,
        actionCount: pending.actions.length,
        reason,
      });
      clearMarkingPreview();
    };
    const handlePointerCancel = () => cancelPendingMark('pointer-cancel');
    const handleWindowBlur = () => cancelPendingMark('window-blur');

    const handleContextMenu = (e: MouseEvent) => {
      const suppressNextContextMenu = suppressNextContextMenuRef.current;
      if (suppressNextContextMenu && performance.now() > suppressNextContextMenu.until) {
        suppressNextContextMenuRef.current = null;
      }
      if (
        suppressNextContextMenuRef.current &&
        Math.hypot(
          e.clientX - suppressNextContextMenuRef.current.x,
          e.clientY - suppressNextContextMenuRef.current.y,
        ) <= 16
      ) {
        e.preventDefault();
        suppressNextContextMenuRef.current = null;
        return;
      }

      const pending = pendingMarkRef.current;
      if (pending?.marking) {
        e.preventDefault();
        completeMarkingGesture(e.clientX, e.clientY, false);
        return;
      }

      const built = buildContext(e);
      if (!built) {
        return;
      }

      e.preventDefault();
      setCustomizer(null);
      updateCommandPreview(null);
      clearMarkingPreview();
      const openedAt = performance.now();
      setRadialMenu({ position: { x: e.clientX, y: e.clientY }, context: built.context, openedAt });
      recordRadialTelemetry({
        name: 'visible-open',
        view: built.context.view,
        target: built.context.target,
        actionCount: built.actions.length,
      });
    };

    const handleKeyboardOpen = (e: KeyboardEvent) => {
      if (!isKeyboardRadialOpenShortcut(e) || shouldIgnoreKeyboardShortcut(e)) {
        return;
      }

      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const targetElement = activeElement && mainEl.contains(activeElement) ? activeElement : mainEl;
      const position = getKeyboardRadialPosition(mainEl, targetElement);
      const built = buildContextForTarget(targetElement, position);
      if (!built) {
        return;
      }

      e.preventDefault();
      setCustomizer(null);
      updateCommandPreview(null);
      clearMarkingPreview();
      pendingMarkRef.current = null;
      const openedAt = performance.now();
      setRadialMenu({ position, context: built.context, openedAt });
      recordRadialTelemetry({
        name: 'keyboard-open',
        view: built.context.view,
        target: built.context.target,
        actionCount: built.actions.length,
      });
    };

    mainEl.addEventListener('pointerdown', handlePointerDown);
    mainEl.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyboardOpen);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      mainEl.removeEventListener('pointerdown', handlePointerDown);
      mainEl.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyboardOpen);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [
    activeView,
    clearMarkingPreview,
    completeMarkingGesture,
    mainRef,
    radialPreferences,
    scheduleMarkingPreview,
    updateCommandPreview,
  ]);

  const radialItems = useMemo(
    () =>
      radialMenu
        ? applyRadialPreferences(
            getActionsForContext(radialMenu.context),
            getRadialPreferenceKey(radialMenu.context),
            radialPreferences,
          )
        : [],
    [radialMenu, radialPreferences],
  );
  const customizerItems = useMemo(
    () =>
      customizer
        ? applyRadialPreferences(
            getActionsForContext(customizer.context),
            getRadialPreferenceKey(customizer.context),
            radialPreferences,
          )
        : [],
    [customizer, radialPreferences],
  );
  const handleRadialSelect = useCallback(
    (itemId: string, activation: RadialMenuSelectOptions) => {
      if (!radialMenu) {
        return;
      }

      recordRadialTelemetry({
        name: 'visible-select',
        view: radialMenu.context.view,
        target: radialMenu.context.target,
        commandId: itemId,
        actionCount: radialItems.length,
      });
      executeRadialCommand(radialMenu.context, itemId, activation);
      setRadialMenu(null);
      updateCommandPreview(null);
    },
    [executeRadialCommand, radialItems.length, radialMenu, updateCommandPreview],
  );

  const handleRepeatLastAi = useCallback(() => {
    const repeated = repeatLastRadialAiCommand();
    if (!repeated) {
      return;
    }

    const telemetryContext = radialMenu?.context ?? repeated.context;
    if (telemetryContext) {
      recordRadialTelemetry({
        name: 'visible-repeat-ai',
        view: telemetryContext.view,
        target: telemetryContext.target,
        commandId: 'repeat_last_ai',
        actionCount: radialItems.length,
      });
    }
    toast({ title: 'AI Prompt Repeated', description: repeated.label });
  }, [radialItems.length, radialMenu, toast]);

  const handleCustomize = useCallback(() => {
    if (!radialMenu) {
      return;
    }
    recordRadialTelemetry({
      name: 'customize-open',
      view: radialMenu.context.view,
      target: radialMenu.context.target,
      actionCount: radialItems.length,
    });
    setCustomizer(radialMenu);
    setRadialMenu(null);
    updateCommandPreview(null);
  }, [radialItems.length, radialMenu, updateCommandPreview]);
  const handleMoveCommand = useCallback(
    (commandId: string, slot: RadialSlot) => {
      if (!customizer) {
        return;
      }
      radialPreferencesStore.setCommandSlot(
        getRadialPreferenceKey(customizer.context),
        commandId,
        slot,
        getActionsForContext(customizer.context),
      );
    },
    [customizer],
  );
  const handleResetLayout = useCallback(() => {
    if (!customizer) {
      return;
    }
    radialPreferencesStore.resetLayout(getRadialPreferenceKey(customizer.context));
  }, [customizer]);

  return (
    <>
      {markingPreview && <RadialMarkingPreview preview={markingPreview} />}
      {commandPreview && <RadialCommandPreview preview={commandPreview} />}
      {radialMenu && (
        <RadialMenu
          items={radialItems}
          context={radialMenu.context}
          position={radialMenu.position}
          openedAt={radialMenu.openedAt}
          confirmItemId={radialMenu.confirmItemId}
          onClose={closeRadialMenu}
          onSelect={handleRadialSelect}
          onCustomize={handleCustomize}
          onRepeatLastAi={lastRadialAiCommand ? handleRepeatLastAi : undefined}
          repeatLastAiLabel={lastRadialAiCommand ? `Repeat AI: ${lastRadialAiCommand.label}` : undefined}
          repeatLastAiDescription={
            lastRadialAiCommand ? `Resend ${lastRadialAiCommand.label} to AI chat.` : undefined
          }
          onPreviewChange={updateCommandPreview}
        />
      )}
      {customizer && (
        <RadialMenuCustomizer
          items={customizerItems}
          context={customizer.context}
          position={customizer.position}
          onMove={handleMoveCommand}
          onReset={handleResetLayout}
          onClose={closeCustomizer}
        />
      )}
    </>
  );
}

function WorkspaceContent() {
  const projectId = useProjectId();
  const isMobile = useIsMobile();
  const { activeView, setActiveView, projectName } = useProjectMeta();
  const { runValidation, issues } = useValidation();
  const { nodes, edges, hasResolvedInitialGraph } = useArchitecture();
  const { bom } = useBom();
  const hasDesignContent = (nodes ?? []).length > 0;
  const { toast } = useToast();
  const mainRef = useRef<HTMLElement>(null);
  const [location, setLocation] = useLocation();
  const initialUrlApplied = useRef(false);
  const initialViewSyncComplete = useRef(false);
  const activeViewRef = useRef(activeView);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  const normalizeRequestedView = useCallback(
    (view: ViewMode): ViewMode => {
      if (hasResolvedInitialGraph && !alwaysVisibleIds.has(view) && !hasDesignContent) {
        return 'architecture';
      }
      return view;
    },
    [hasDesignContent, hasResolvedInitialGraph],
  );

  const switchView = useCallback(
    (view: ViewMode) => {
      const normalized = normalizeRequestedView(view);
      if (normalized !== activeViewRef.current) {
        setActiveView(normalized);
      }
    },
    [normalizeRequestedView, setActiveView],
  );

  // Set browser tab title to project name + active view
  useEffect(() => {
    const viewLabel = navItems.find((n) => n.view === activeView)?.label ?? activeView;
    document.title = `${viewLabel} — ${projectName} — ProtoPulse`;
    return () => {
      document.title = 'ProtoPulse';
    };
  }, [activeView, projectName]);

  // Initialize prediction engine
  const executeActions = useActionExecutor();
  const { predictions, dismiss, accept, clearAll, isAnalyzing } = usePredictions(
    nodes.map((n) => ({
      id: n.id,
      type: n.type ?? 'generic',
      label:
        n.data != null && typeof n.data === 'object' && 'label' in n.data
          ? String((n.data as Record<string, unknown>).label)
          : n.id,
    })),
    edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label as string })),
    bom.map((b) => ({ id: String(b.id), partNumber: b.partNumber, description: b.description, quantity: b.quantity })),
  );
  const shouldShowPredictionPanel = isAnalyzing || predictions.length > 0;

  const handlePredictionAccept = useCallback(
    (id: string) => {
      const pred = predictions.find((p) => p.id === id);
      if (pred && pred.action) {
        const { type, payload } = pred.action;

        if (type === 'add_component') {
          const label = getPredictionComponentLabel(payload);
          const count = getPredictionComponentCount(payload);
          executeActions(buildPredictionAddNodeActions(payload));
          toast({
            title: count === 1 ? 'Component added' : 'Components added',
            description:
              count === 1 ? `Added ${label} to architecture.` : `Added ${count} ${label} components to architecture.`,
          });
        } else if (type === 'open_view') {
          const view = typeof payload.view === 'string' ? payload.view : null;
          if (view && VALID_VIEW_MODES.has(view)) {
            switchView(view as ViewMode);
            toast({ title: 'View switched', description: `Opened ${view.replace(/_/g, ' ')} view.` });
          }
        } else if (type === 'show_info') {
          const topic = typeof payload.topic === 'string' ? payload.topic : null;
          if (topic) {
            switchView('knowledge');
            toast({ title: 'Knowledge Hub', description: `Showing information about ${topic.replace(/[-_]/g, ' ')}.` });
          }
        }
      }
      accept(id);
    },
    [predictions, executeActions, accept, toast, switchView],
  );

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.focus({ preventScroll: true });
    }
  }, [activeView]);

  // Prefetch lazy-loaded view chunks after initial render
  useEffect(() => {
    startPrefetch();
  }, []);

  const persistedLayout = useMemo(() => loadPersistedLayout(projectId), [projectId]);
  const [ws, dispatch] = useReducer(workspaceReducer, projectId, createInitialWorkspaceState);
  const {
    peekVisible: sidebarPeekVisible,
    openPeek: openSidebarPeek,
    closePeek: closeSidebarPeek,
  } = useHoverPeekPanel({
    collapsed: ws.sidebarCollapsed,
    isMobile,
  });
  const {
    peekVisible: chatPeekVisible,
    openPeek: openChatPeek,
    closePeek: closeChatPeek,
  } = useHoverPeekPanel({
    collapsed: ws.chatCollapsed,
    isMobile,
  });
  const sidebarCollapsed = ws.sidebarCollapsed && !sidebarPeekVisible;
  const chatCollapsed = ws.chatCollapsed && !chatPeekVisible;

  // Parts catalog search palette (Ctrl+K)
  const [partsSearchOpen, setPartsSearchOpen] = useState(false);
  const [hardwareInspectionOpen, setHardwareInspectionOpen] = useState(false);

  // BL-0114 + BL-0234: Bootstrap the first active view from the URL (or
  // persisted layout) before enabling the steady-state URL<->view sync.
  useEffect(() => {
    if (initialUrlApplied.current) {
      return;
    }

    const urlViewName = getUrlWorkspaceView(location);

    if (urlViewName && VALID_VIEW_MODES.has(urlViewName)) {
      const requestedView = normalizeRequestedView(urlViewName as ViewMode);
      if (requestedView !== activeView) {
        setActiveView(requestedView);
        return;
      }

      initialUrlApplied.current = true;
      initialViewSyncComplete.current = true;
      return;
    }

    // First mount only: fallback to localStorage if no viewName in URL.
    const saved = persistedLayout.activeView;
    if (saved && saved !== activeView && VALID_VIEW_MODES.has(saved)) {
      setActiveView(normalizeRequestedView(saved as ViewMode));
      return;
    }
    initialUrlApplied.current = true;
    initialViewSyncComplete.current = true;
    setLocation(`/projects/${String(projectId)}/${activeView}`, { replace: true });
  }, [activeView, location, normalizeRequestedView, persistedLayout.activeView, projectId, setActiveView, setLocation]);

  // Important: this must only react to real location changes, not local
  // activeView updates, or it can race against the companion activeView->URL
  // effect and bounce between the old and new view during tab clicks.
  useEffect(() => {
    if (!initialViewSyncComplete.current) {
      return;
    }

    const normalizedPath = normalizeWorkspacePath(location);
    const parsedRoute = parseWorkspaceProjectRoute(normalizedPath);
    if (parsedRoute && parsedRoute.projectId !== projectId) {
      return;
    }
    if (parsedRoute && parsedRoute.canonicalPath !== normalizedPath) {
      setLocation(parsedRoute.canonicalPath, { replace: true });
      return;
    }

    const urlViewName = parsedRoute?.viewName;

    if (urlViewName && VALID_VIEW_MODES.has(urlViewName)) {
      const requestedView = normalizeRequestedView(urlViewName as ViewMode);
      if (requestedView !== activeViewRef.current) {
        setActiveView(requestedView);
      }
    }
  }, [location, normalizeRequestedView, projectId, setActiveView]);

  // UX-011 + BL-0234: Persist panel sizes, collapsed states, and activeView to localStorage (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const layout: PersistedPanelLayout = {
        sidebarCollapsed: ws.sidebarCollapsed,
        chatCollapsed: ws.chatCollapsed,
        sidebarWidth: ws.sidebarWidth,
        chatWidth: ws.chatWidth,
        activeView,
      };
      persistLayout(projectId, layout);
    }, 500);
    return () => clearTimeout(timer);
  }, [ws.sidebarCollapsed, ws.chatCollapsed, ws.sidebarWidth, ws.chatWidth, activeView, projectId]);

  // BL-0114: Sync URL when activeView changes (after initial mount)
  useEffect(() => {
    if (!initialUrlApplied.current || !initialViewSyncComplete.current) {
      return;
    }
    const normalizedView = normalizeRequestedView(activeView);
    const expectedPath = `/projects/${String(projectId)}/${normalizedView}`;
    if (normalizeWorkspacePath(location) !== expectedPath) {
      setLocation(expectedPath, { replace: true });
    }
  }, [activeView, location, normalizeRequestedView, projectId, setLocation]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreKeyboardShortcut(e)) {
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_SHORTCUTS' });
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Ctrl+K / Cmd+K: Open parts catalog search palette
  useEffect(() => {
    const handlePartsSearch = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPartsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handlePartsSearch);
    return () => window.removeEventListener('keydown', handlePartsSearch);
  }, []);

  useEffect(() => {
    const handleOpenChatPanel = () => {
      dispatch({ type: 'SET_CHAT_OPEN', open: true });
      dispatch({ type: 'SET_CHAT_COLLAPSED', collapsed: false });
    };

    window.addEventListener('protopulse:open-chat-panel', handleOpenChatPanel);
    return () => window.removeEventListener('protopulse:open-chat-panel', handleOpenChatPanel);
  }, []);

  useEffect(() => {
    const handlePcbRunDrc = (event: Event) => {
      const detail =
        event instanceof CustomEvent ? (event.detail as Partial<PcbRunDrcEventDetail> | undefined) : undefined;
      const safetyGate = detail?.safetyGate;

      if (safetyGate?.severity === 'blocked') {
        toast({
          variant: 'destructive',
          title: 'PCB fabrication gate blocked',
          description: safetyGate.summary,
        });
      } else if (safetyGate?.severity === 'warning') {
        toast({
          title: 'PCB fabrication gate needs review',
          description: safetyGate.summary,
        });
      }

      runValidation();
    };

    window.addEventListener(PCB_RUN_DRC_EVENT, handlePcbRunDrc);
    return () => window.removeEventListener(PCB_RUN_DRC_EVENT, handlePcbRunDrc);
  }, [runValidation, toast]);

  /* RS-03: Auto-collapse sidebar at tablet landscape (<=1024px) */
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1024px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        dispatch({ type: 'SET_SIDEBAR_COLLAPSED', collapsed: true });
      }
    };
    handler(mql);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  /* RS-04: Auto-collapse chat at narrow desktop (<=1280px) to avoid cramped 3-panel layout */
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1280px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        dispatch({ type: 'SET_CHAT_COLLAPSED', collapsed: true });
      }
    };
    handler(mql);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const handleSidebarResize = useCallback(
    (delta: number) => {
      dispatch({ type: 'SET_SIDEBAR_WIDTH', width: Math.max(220, Math.min(480, ws.sidebarWidth + delta)) });
    },
    [ws.sidebarWidth],
  );

  const handleChatResize = useCallback(
    (delta: number) => {
      dispatch({ type: 'SET_CHAT_WIDTH', width: Math.max(280, Math.min(600, ws.chatWidth + delta)) });
    },
    [ws.chatWidth],
  );

  const validationErrorCount = (issues ?? []).filter((i) => i.severity === 'error').length;
  const activeTabId = `tab-${activeView}`;

  /* BL-0314: Check milestones when project state changes */
  useEffect(() => {
    const safeBom = bom ?? [];
    const safeNodes = nodes ?? [];
    const safeEdges = edges ?? [];
    const milestoneState: MilestoneProjectState = {
      hasNodes: safeNodes.length > 0,
      nodeCount: safeNodes.length,
      hasEdges: safeEdges.length > 0,
      edgeCount: safeEdges.length,
      hasBom: safeBom.length > 0,
      bomItemCount: safeBom.length,
      bomItemsWithPartNumbers: safeBom.filter((b) => b.partNumber && b.partNumber.trim() !== '').length,
      bomItemsWithPrices: safeBom.filter((b) => Number(b.unitPrice) > 0).length,
      hasCircuit: false,
      circuitInstanceCount: 0,
      circuitWireCount: 0,
      hasDrc: false,
      drcErrors: validationErrorCount,
      drcCleanRunCount: 0,
      drcTotalRunCount: 0,
      hasSimulation: false,
      hasExport: false,
      exportFormats: [],
      hasPcbLayout: false,
      pcbTraceCount: 0,
      hasFabOrder: false,
      hasDesignVariables: false,
      sheetCount: 1,
      ercClean: false,
      hasGerberExport: false,
      projectCount: 1,
      hasCommunityContribution: false,
      validationErrorCount,
    };
    const tracker = MilestoneTracker.getInstance();
    const newlyUnlocked = tracker.checkMilestones(milestoneState);
    if (newlyUnlocked.length > 0) {
      for (const id of newlyUnlocked) {
        const milestone = tracker.getMilestone(id);
        if (milestone) {
          toast({ title: `Milestone Unlocked: ${milestone.name}`, description: milestone.reward });
        }
      }
    }
  }, [nodes, edges, bom, validationErrorCount, toast]);

  /* UI-18: Redirect hidden deep links by resetting activeView AND changing the URL.
   * BL-0615: Must update activeView in the same commit as setLocation; otherwise the
   * activeView<->URL sync effects race and bounce between the old (hidden) view and
   * architecture, triggering "Maximum update depth exceeded". */
  useEffect(() => {
    if (!hasResolvedInitialGraph) {
      return;
    }
    if (!alwaysVisibleIds.has(activeView) && !hasDesignContent) {
      const fallbackPath = `/projects/${String(projectId)}/architecture`;
      if (activeView !== 'architecture') {
        setActiveView('architecture');
      }
      if (normalizeWorkspacePath(location) !== fallbackPath) {
        setLocation(fallbackPath, { replace: true });
      }
    }
  }, [activeView, hasDesignContent, hasResolvedInitialGraph, location, projectId, setActiveView, setLocation]);

  return (
    <div className="flex flex-col h-screen w-full bg-background overflow-hidden font-sans text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:text-sm"
        data-testid="skip-to-main"
      >
        Skip to main content
      </a>
      <a
        href="#chat-panel"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-20 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:text-sm"
        data-testid="skip-to-chat"
      >
        Skip to AI assistant
      </a>
      {isMobile && (
        <div
          data-testid="mobile-header"
          className="h-11 border-b border-border bg-card/60 backdrop-blur-xl flex items-center justify-between px-3 lg:hidden"
        >
          <StyledTooltip content="Open menu" side="bottom">
            <button
              data-testid="mobile-menu-toggle"
              aria-label="Open menu"
              className="min-w-[40px] min-h-[40px] p-1.5 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => dispatch({ type: 'SET_SIDEBAR_OPEN', open: true })}
            >
              <Menu className="w-4.5 h-4.5" />
            </button>
          </StyledTooltip>
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span className="font-display font-bold text-sm tracking-tight">ProtoPulse</span>
          </div>
          <StyledTooltip content="Open AI assistant" side="bottom">
            <button
              data-testid="mobile-chat-toggle"
              aria-label="Open AI assistant"
              className="min-w-[40px] min-h-[40px] p-1.5 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => dispatch({ type: 'SET_CHAT_OPEN', open: true })}
            >
              <MessageCircle className="w-4.5 h-4.5" />
            </button>
          </StyledTooltip>
        </div>
      )}

      <DndProvider>
        <div className="flex flex-1 min-h-0">
          <ErrorBoundary
            fallback={
              <div
                data-testid="diag-sidebar-error"
                className="w-64 shrink-0 border-r border-border bg-card/60 p-4 text-xs text-destructive"
              >
                Sidebar region error
              </div>
            }
          >
            <Suspense fallback={null}>
              <HoverPeekDock
                side="left"
                collapsed={ws.sidebarCollapsed}
                peekVisible={sidebarPeekVisible}
                onPeekOpen={openSidebarPeek}
                onPeekClose={closeSidebarPeek}
              >
                <Sidebar
                  isOpen={ws.sidebarOpen}
                  onClose={() => dispatch({ type: 'SET_SIDEBAR_OPEN', open: false })}
                  collapsed={sidebarCollapsed}
                  width={ws.sidebarWidth}
                  onToggleCollapse={() => dispatch({ type: 'SET_SIDEBAR_COLLAPSED', collapsed: false })}
                />
              </HoverPeekDock>
            </Suspense>
          </ErrorBoundary>

          {!ws.sidebarCollapsed && (
            <ResizeHandle
              side="left"
              onResize={handleSidebarResize}
              keyboardConfig={{
                currentValue: ws.sidebarWidth,
                min: 220,
                max: 480,
                onResize: handleSidebarResize,
                orientation: 'horizontal',
                positiveDirection: 'grow',
              }}
            />
          )}

          <main
            id="main-content"
            data-testid="workspace-main"
            ref={mainRef}
            tabIndex={-1}
            aria-live="polite"
            className="flex-1 flex flex-col min-w-0 relative bg-background"
          >
            <h1 className="sr-only">ProtoPulse</h1>
            <h2 className="sr-only">Design workspace</h2>
            <ErrorBoundary
              fallback={
                <div
                  data-testid="diag-header-error"
                  className="border-b border-border bg-card/60 p-3 text-xs text-destructive"
                >
                  Header region error
                </div>
              }
            >
              <WorkspaceHeader
                ws={ws}
                dispatch={dispatch}
                activeView={activeView}
                setActiveView={switchView}
                onOpenHardwareInspection={() => setHardwareInspectionOpen(true)}
              />
            </ErrorBoundary>

            <div
              key={activeView}
              role="tabpanel"
              id="main-panel"
              aria-labelledby={activeTabId}
              className="view-enter flex-1 relative overflow-hidden flex flex-col bg-[radial-gradient(rgba(122,132,146,0.18)_1px,transparent_1px)] [background-size:24px_24px]"
            >
              <div className="flex-1 relative overflow-hidden">
                <ViewRenderer activeView={activeView} projectId={projectId} />
              </div>
            </div>

            {shouldShowPredictionPanel &&
              (ws.predictionPanelOpen ? (
                <div
                  data-testid="prediction-panel-dock"
                  className="absolute bottom-3 right-3 z-20 w-full max-w-[22rem] max-h-[38vh] overflow-y-auto"
                >
                  <PredictionPanel
                    predictions={predictions}
                    onAccept={handlePredictionAccept}
                    onDismiss={dismiss}
                    onClearAll={clearAll}
                    isAnalyzing={isAnalyzing}
                  />
                </div>
              ) : (
                <button
                  data-testid="prediction-panel-badge"
                  onClick={() => dispatch({ type: 'TOGGLE_PREDICTION_PANEL' })}
                  className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-md border border-border/60 bg-card/90 px-2.5 py-1.5 text-[11px] font-medium text-foreground shadow-lg backdrop-blur-xl hover:bg-card transition-colors"
                >
                  <span className="text-[var(--color-editor-accent)]">{predictions.length}</span>
                  <span>Design Suggestions</span>
                </button>
              ))}

            {/* BL-0186: Activity feed slide-over */}
            {ws.activityFeedOpen && (
              <div
                data-testid="activity-feed-overlay"
                className="absolute top-0 right-0 z-30 w-[19rem] h-full bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl"
              >
                <ErrorBoundary>
                  <Suspense fallback={<ViewLoadingFallback label="Loading activity feed..." />}>
                    <ActivityFeedPanel />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}

            {/* BL-0301: PCB Tutorial panel */}
            {ws.pcbTutorialOpen && (
              <div data-testid="pcb-tutorial-overlay" className="absolute top-0 right-0 z-30 h-full">
                <ErrorBoundary>
                  <Suspense fallback={<ViewLoadingFallback label="Loading PCB tutorial..." />}>
                    <PcbTutorialPanel
                      open={ws.pcbTutorialOpen}
                      onClose={() => dispatch({ type: 'SET_PCB_TUTORIAL_OPEN', open: false })}
                      onNavigate={(view: string) => {
                        if (VALID_VIEW_MODES.has(view)) {
                          switchView(view as ViewMode);
                        }
                      }}
                      validationContext={buildValidationContext({})}
                    />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}

            {/* BL-0231: Radial context menu */}
            <RadialMenuController mainRef={mainRef} activeView={activeView} />

            {/* BL-0311: Smart hints triggered by repeated mistakes */}
            <ErrorBoundary
              fallback={
                <div
                  data-testid="diag-smart-hint-error"
                  className="fixed bottom-4 left-4 z-50 rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  Smart hint error
                </div>
              }
            >
              <Suspense fallback={null}>
                <SmartHintToast />
              </Suspense>
            </ErrorBoundary>
            <ErrorBoundary
              fallback={
                <div
                  data-testid="diag-hardware-inspection-error"
                  className="fixed inset-x-4 top-52 z-[100] rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  Hardware inspection error
                </div>
              }
            >
              <HardwareInspectionPanel
                open={hardwareInspectionOpen}
                onOpenChange={setHardwareInspectionOpen}
                projectId={projectId}
              />
            </ErrorBoundary>
          </main>

          {!ws.chatCollapsed && (
            <ResizeHandle
              side="right"
              onResize={handleChatResize}
              keyboardConfig={{
                currentValue: ws.chatWidth,
                min: 280,
                max: 600,
                onResize: handleChatResize,
                orientation: 'horizontal',
                positiveDirection: 'shrink',
              }}
            />
          )}

          <ErrorBoundary
            fallback={
              <div
                data-testid="diag-chat-error"
                className="w-[350px] shrink-0 border-l border-border bg-card/60 p-4 text-xs text-destructive"
              >
                Chat region error
              </div>
            }
          >
            <aside id="chat-panel" aria-labelledby="chat-panel-heading">
              <h2 id="chat-panel-heading" className="sr-only">
                AI Assistant
              </h2>
              <Suspense fallback={null}>
                <HoverPeekDock
                  side="right"
                  collapsed={ws.chatCollapsed}
                  peekVisible={chatPeekVisible}
                  onPeekOpen={openChatPeek}
                  onPeekClose={closeChatPeek}
                >
                  <ChatPanel
                    isOpen={ws.chatOpen}
                    onClose={() => dispatch({ type: 'SET_CHAT_OPEN', open: false })}
                    collapsed={chatCollapsed}
                    width={ws.chatWidth}
                    onToggleCollapse={() => dispatch({ type: 'SET_CHAT_COLLAPSED', collapsed: false })}
                  />
                </HoverPeekDock>
              </Suspense>
            </aside>
          </ErrorBoundary>
        </div>
      </DndProvider>

      <ErrorBoundary
        fallback={
          <div
            data-testid="diag-shortcuts-error"
            className="fixed inset-x-4 top-4 z-[100] rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
          >
            Shortcuts overlay error
          </div>
        }
      >
        <Suspense fallback={null}>
          <ShortcutsOverlay
            open={ws.shortcutsOpen}
            onClose={() => dispatch({ type: 'SET_SHORTCUTS_OPEN', open: false })}
            activeView={activeView}
          />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary
        fallback={
          <div
            data-testid="diag-command-error"
            className="fixed inset-x-4 top-16 z-[100] rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
          >
            Command/search region error
          </div>
        }
      >
        <Suspense fallback={null}>
          <PartsCommandPalette open={partsSearchOpen} onOpenChange={setPartsSearchOpen} />
          <NavCommandPalette
            onNavigate={setActiveView}
            onToggleSidebar={() => dispatch({ type: 'SET_SIDEBAR_COLLAPSED', collapsed: !ws.sidebarCollapsed })}
            onToggleChat={() => dispatch({ type: 'SET_CHAT_COLLAPSED', collapsed: !ws.chatCollapsed })}
            onRunDrc={runValidation}
            sidebarCollapsed={ws.sidebarCollapsed}
            chatCollapsed={ws.chatCollapsed}
          />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary
        fallback={
          <div
            data-testid="diag-global-search-error"
            className="fixed inset-x-4 top-28 z-[100] rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
          >
            Global search error
          </div>
        }
      >
        <Suspense fallback={null}>
          <GlobalSearchDialog onNavigate={setActiveView} />
        </Suspense>
      </ErrorBoundary>

      {/*
        E2E-225, E2E-856: UnifiedComponentSearch is the part-picker palette.
        It listens for the `protopulse:focus-component-search` event (dispatched
        by the Schematic empty-state "Add Component" CTA and the Ctrl+K shortcut)
        and, on selection, dispatches `protopulse:place-component-instance` which
        is handled by useSchematicKeyboardShortcuts to actually insert the part.
        Without this mount, the empty-state CTA appeared "dead" — handler fired
        into the void, leaving the user in an implicit place-mode with no part.
      */}
      <ErrorBoundary
        fallback={
          <div
            data-testid="diag-unified-search-error"
            className="fixed inset-x-4 top-40 z-[100] rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
          >
            Component search error
          </div>
        }
      >
        <Suspense fallback={null}>
          <UnifiedComponentSearch />
        </Suspense>
      </ErrorBoundary>

      {/* RS-02 + RS-08: Mobile bottom nav with primary tabs + More menu + active indicators */}
      <ErrorBoundary
        fallback={
          <div
            data-testid="diag-mobile-nav-error"
            className="h-16 border-t border-border bg-card/60 p-3 text-xs text-destructive lg:hidden"
          >
            Mobile nav error
          </div>
        }
      >
        <MobileNav ws={ws} dispatch={dispatch} activeView={activeView} setActiveView={switchView} />
      </ErrorBoundary>
    </div>
  );
}

export default function ProjectWorkspace() {
  const params = useParams<{ projectId: string }>();
  const rawId = Number(params.projectId);

  if (!Number.isInteger(rawId) || rawId <= 0) {
    return <Redirect to="/projects/1" />;
  }

  return (
    <ProjectProvider key={rawId} projectId={rawId}>
      <TutorialProvider>
        <WorkspaceContent />
        <Suspense fallback={null}>
          <TutorialOverlay />
        </Suspense>
        <Suspense fallback={null}>
          <LessonModeOverlay />
        </Suspense>
      </TutorialProvider>
    </ProjectProvider>
  );
}
