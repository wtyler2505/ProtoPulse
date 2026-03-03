/**
 * Drag-and-drop context provider using @dnd-kit.
 *
 * Wrap `<WorkspaceContent>` (or a common ancestor of Sidebar + main view)
 * with `<DndProvider>` to enable dragging components from the ComponentTree
 * sidebar onto the ArchitectureView canvas.
 *
 * The provider exposes the currently active drag data via React context so
 * that both the drag overlay and the drop target can read it without prop
 * drilling.
 */
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { Cpu } from 'lucide-react';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Payload attached to each draggable component item. */
export interface ComponentDragData {
  /** The node type string (e.g. "mcu", "sensor"). */
  nodeType: string;
  /** Human-readable label. */
  label: string;
  /** Drag source — helps drop targets decide how to handle the data. */
  source: 'component-tree';
}

interface DndContextValue {
  /** Currently active drag payload (null when not dragging). */
  activeDrag: ComponentDragData | null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DndStateContext = createContext<DndContextValue>({ activeDrag: null });
DndStateContext.displayName = 'DndStateContext';

export function useDndState(): DndContextValue {
  return useContext(DndStateContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface DndProviderProps {
  children: ReactNode;
  /** Called when a component is dropped on a valid drop zone. */
  onComponentDrop?: (data: ComponentDragData, dropId: string) => void;
}

export function DndProvider({ children, onComponentDrop }: DndProviderProps) {
  const [activeDrag, setActiveDrag] = useState<ComponentDragData | null>(null);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as ComponentDragData | undefined;
    if (data?.source === 'component-tree') {
      setActiveDrag(data);
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const data = event.active.data.current as ComponentDragData | undefined;
    if (data?.source === 'component-tree' && event.over) {
      onComponentDrop?.(data, String(event.over.id));
    }
    setActiveDrag(null);
  }, [onComponentDrop]);

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  const contextValue = useMemo(() => ({ activeDrag }), [activeDrag]);

  return (
    <DndStateContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        modifiers={[restrictToWindowEdges]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}

        {/* Drag overlay — renders the ghost element that follows the cursor */}
        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <div
              data-testid="drag-overlay-component"
              className="flex items-center gap-2 px-3 py-2 bg-card/90 backdrop-blur-xl border border-primary/50 shadow-lg shadow-primary/20 text-xs font-medium text-foreground pointer-events-none select-none"
            >
              <Cpu className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate max-w-[160px]">{activeDrag.label}</span>
              <span className="text-[10px] text-muted-foreground/60">({activeDrag.nodeType})</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </DndStateContext.Provider>
  );
}
