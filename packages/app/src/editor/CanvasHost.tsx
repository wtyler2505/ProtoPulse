import { useEffect, useRef } from 'react';
import { diff, type DesignGraph, type GraphDelta } from '@protopulse/graph';
import {
  applyDelta,
  buildScene,
  Camera,
  PickIndex,
  WebGL2Renderer,
  type OverlayState,
} from '@protopulse/renderer';
import { getDiffDelta, getGraph, partDb, useSession } from '../state/session.js';
import { useUi } from '../state/ui.js';
import {
  deleteSelectionOps,
  PICK_TOLERANCE_NM,
  PlaceTool,
  SelectTool,
  WireTool,
  type Tool,
  type ToolEnv,
  type ToolResult,
} from './tools.js';

/**
 * Owns the <canvas>: WebGL2Renderer + Camera + PickIndex + the rAF loop.
 * Renders only when one of the tracked versions changes (graph, scene,
 * camera, overlay, selection, diff target, canvas size).
 */

function diffOverlayMap(
  delta: GraphDelta | null,
): Map<string, 'added' | 'removed' | 'changed'> | undefined {
  if (!delta) return undefined;
  const m = new Map<string, 'added' | 'removed' | 'changed'>();
  for (const id of delta.components.added) m.set(id, 'added');
  for (const id of delta.components.changed.keys()) m.set(id, 'changed');
  for (const id of delta.schematicView.placed) if (!m.has(id)) m.set(id, 'added');
  for (const id of delta.schematicView.moved) if (!m.has(id)) m.set(id, 'changed');
  for (const id of delta.nets.added) m.set(id, 'added');
  for (const id of delta.schematicView.wiresChanged) if (!m.has(id)) m.set(id, 'changed');
  // Removed entities aren't in the current branch's scene. M1 cut: the
  // BranchPanel lists them textually instead of rendering red ghosts.
  return m;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  );
}

export function CanvasHost() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new WebGL2Renderer();
    try {
      renderer.attach(canvas);
    } catch (err) {
      console.error('WebGL2 unavailable:', err);
      return;
    }

    const camera = new Camera();
    const pickIndex = new PickIndex();

    let graph: DesignGraph = getGraph(useSession.getState());
    let graphKey = '';
    const scene = buildScene(graph, partDb);
    pickIndex.rebuild(scene);

    const sizeOf = () => ({
      width: canvas.clientWidth || 1,
      height: canvas.clientHeight || 1,
    });
    const initialBounds = scene.bounds();
    if (initialBounds) camera.fitBounds(initialBounds, sizeOf());

    // ── Mutable loop state ──
    let tool: Tool = new SelectTool();
    let toolKey = 'select';
    let ghost: Float32Array | null = null;
    let overlayVersion = 0;
    let lastCameraCommandSeq = useUi.getState().cameraCommandSeq;
    let panning = false;
    let spaceDown = false;
    let lastPointer: { x: number; y: number } | null = null;
    let disposed = false;

    const last = {
      graphKey: '',
      cameraV: -1,
      sceneV: -1,
      overlayV: -1,
      selection: null as ReadonlySet<string> | null,
      highlight: null as readonly string[] | null,
      diffAgainst: null as string | null,
      w: 0,
      h: 0,
    };

    const toolEnv = (): ToolEnv => ({
      graph,
      parts: partDb,
      selection: useSession.getState().selection,
      pick: (pt, tol) => pickIndex.pick(pt, tol),
      queryRect: (min, max) => pickIndex.queryRect(min, max),
    });

    const applyResult = (res: ToolResult): void => {
      const session = useSession.getState();
      if (res.selection) session.setSelection(res.selection);
      if (res.ops && res.ops.length > 0) session.dispatch(res.ops, res.opsLabel);
      if (res.ghost !== undefined) {
        ghost = res.ghost;
        overlayVersion++;
      }
    };

    const worldOf = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return camera.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, sizeOf());
    };

    // ── Tool lifecycle (driven by ui store inside the frame loop) ──
    const syncTool = (): void => {
      const ui = useUi.getState();
      const key = ui.tool === 'place' ? `place:${ui.placePartId ?? ''}` : ui.tool;
      if (key === toolKey) return;
      applyResult(tool.cancel());
      toolKey = key;
      if (ui.tool === 'place' && ui.placePartId) tool = new PlaceTool(ui.placePartId);
      else if (ui.tool === 'wire') tool = new WireTool();
      else tool = new SelectTool();
    };

    // ── Pointer / wheel / keyboard ──
    const onPointerDown = (e: PointerEvent): void => {
      canvas.setPointerCapture(e.pointerId);
      if (e.button === 1 || (e.button === 0 && spaceDown)) {
        panning = true;
        lastPointer = { x: e.clientX, y: e.clientY };
        return;
      }
      if (e.button === 0) applyResult(tool.pointerDown(worldOf(e), toolEnv()));
    };

    const onPointerMove = (e: PointerEvent): void => {
      const world = worldOf(e);
      useUi.getState().setCursorWorld(world);
      if (panning && lastPointer) {
        camera.pan(e.clientX - lastPointer.x, e.clientY - lastPointer.y);
        lastPointer = { x: e.clientX, y: e.clientY };
        return;
      }
      applyResult(tool.pointerMove(world, toolEnv()));
    };

    const onPointerUp = (e: PointerEvent): void => {
      if (panning) {
        panning = false;
        lastPointer = null;
        return;
      }
      if (e.button === 0) applyResult(tool.pointerUp(worldOf(e), toolEnv()));
    };

    const onPointerLeave = (): void => {
      useUi.getState().setCursorWorld(null);
    };

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      camera.zoomAt({ x: e.clientX - rect.left, y: e.clientY - rect.top }, factor, sizeOf());
    };

    const deleteSelection = (): void => {
      const session = useSession.getState();
      const ops = deleteSelectionOps(graph, session.selection);
      if (ops.length > 0) {
        session.dispatch(ops, 'delete selection');
        session.clearSelection();
      }
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (isEditableTarget(e.target)) return;
      if (e.code === 'Space') {
        spaceDown = true;
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        applyResult(tool.cancel());
        useUi.getState().setTool('select');
        useSession.getState().clearSelection();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useSession.getState().redo();
        else useSession.getState().undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        useSession.getState().redo();
      }
    };

    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') spaceDown = false;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ── Frame loop ──
    const frame = (): void => {
      if (disposed) return;

      syncTool();

      // Graph → scene sync (incremental, via diff + applyDelta).
      const session = useSession.getState();
      const key = `${session.branch}@${String(session.opsVersion)}`;
      if (key !== graphKey) {
        const next = getGraph(session);
        applyDelta(scene, diff(graph, next), next, partDb);
        graph = next;
        graphKey = key;
        pickIndex.rebuild(scene);
      }

      // Camera commands from panels/toolbar.
      const ui = useUi.getState();
      if (ui.cameraCommandSeq !== lastCameraCommandSeq) {
        lastCameraCommandSeq = ui.cameraCommandSeq;
        const cmd = ui.cameraCommand;
        if (cmd?.kind === 'fit') {
          const b = scene.bounds();
          if (b) camera.fitBounds(b, sizeOf());
        } else if (cmd?.kind === 'center') {
          camera.centerOn(cmd.at);
        }
      }

      const size = sizeOf();
      const sizeChanged = size.width !== last.w || size.height !== last.h;
      if (sizeChanged) renderer.resize();

      const needsRender =
        sizeChanged ||
        graphKey !== last.graphKey ||
        camera.version !== last.cameraV ||
        scene.version !== last.sceneV ||
        overlayVersion !== last.overlayV ||
        session.selection !== last.selection ||
        ui.highlight !== last.highlight ||
        session.diffAgainst !== last.diffAgainst;

      if (needsRender) {
        const overlay: OverlayState = {
          selection: new Set(session.selection),
          highlight: new Set(ui.highlight),
          diff: diffOverlayMap(getDiffDelta(session)),
          ...(ghost ? { ghost: { lines: ghost } } : {}),
          gridVisible: camera.showGrid(),
        };
        renderer.render(scene, camera, overlay);
        last.graphKey = graphKey;
        last.cameraV = camera.version;
        last.sceneV = scene.version;
        last.overlayV = overlayVersion;
        last.selection = session.selection;
        last.highlight = ui.highlight;
        last.diffAgainst = session.diffAgainst;
        last.w = size.width;
        last.h = size.height;
      }

      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    return () => {
      disposed = true;
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="canvas-host" data-pick-tolerance={PICK_TOLERANCE_NM} />;
}
