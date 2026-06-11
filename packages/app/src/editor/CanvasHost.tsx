import { useEffect, useRef } from 'react';

import { diff   } from '@protopulse/graph';
import {
  applyDelta,
  buildPcbScene,
  buildScene,
  Camera,
  pcbViewOf,
  PickIndex,
  rebuildPcbScene,
  syncPcbScene,
  WebGL2Renderer

} from '@protopulse/renderer';

import { dashedLines, ratsnestSegments } from '../pcb/ratsnest.js';
import { ensureRoutingClearance, routingClearanceNm } from '../pcb/routing.js';
import { withSpringBack } from '../pcb/springback.js';
import {
  PcbPlaceTool,
  pcbDeleteSelectionOps,
  pcbFlipSelectionOps,
  PcbSelectTool,
  PcbTraceTool,
  PcbViaTool,
  PcbZoneTool

} from '../pcb/tools.js';
import { asOpBodies, DEFAULT_TRACE_WIDTH_NM } from '../pcb/types.js';
import { ghostTint } from '../sim/ghost.js';
import { getDiffDelta, getGraph, partDb, useSession } from '../state/session.js';
import { useUi } from '../state/ui.js';

import {
  deleteSelectionOps,
  PICK_TOLERANCE_NM,
  PlaceTool,
  SelectTool,
  WireTool



} from './tools.js';

import type {Tool, ToolEnv, ToolResult} from './tools.js';
import type { PadSource, PcbTool, PcbToolEnv, PcbToolResult } from '../pcb/tools.js';
import type { SimGhost } from '../sim/ghost.js';
import type {DesignGraph, GraphDelta, OpBody, Vec} from '@protopulse/graph';
import type {OverlayState, RGBA} from '@protopulse/renderer';
import type { FootprintSource } from '@protopulse/route';

/**
 * Owns the <canvas>: WebGL2Renderer + Camera + PickIndex + the rAF loop.
 * Renders only when one of the tracked versions changes (graph, scene,
 * camera, overlay, selection, diff target, canvas size).
 *
 * Two canvases live here, keyed on ui.viewMode: the schematic scene
 * (incremental delta sync, schematic tools) and the v0.4 PCB scene
 * (incremental delta sync + ratsnest overlay, pcb tools; branch
 * switches fall back to a full rebuild — no delta relates two heads).
 * Switching modes tears the GL state down and rebuilds it — the effect
 * re-runs.
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
  const viewMode = useUi((s) => s.viewMode);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const isPcb = viewMode === 'pcb';

    const renderer = new WebGL2Renderer();
    try {
      renderer.attach(canvas);
    } catch (err) {
      console.error('WebGL2 unavailable:', err);
      return;
    }

    const camera = new Camera();
    const pickIndex = new PickIndex();

    // Part footprints are a pinned in-flight contract (@protopulse/parts
    // grows Part.footprint on a parallel track) — bridge structurally.
    const padSource = partDb as unknown as PadSource;

    let graph: DesignGraph = getGraph(useSession.getState());
    let graphKey = '';
    let lastBranch = useSession.getState().branch;
    const scene = isPcb
      ? buildPcbScene(graph, partDb, routingClearanceNm())
      : buildScene(graph, partDb);
    pickIndex.rebuild(scene);

    let ratsnest: Float32Array | null = isPcb
      ? dashedLines(ratsnestSegments(graph, pcbViewOf(graph), padSource))
      : null;

    const sizeOf = () => ({
      width: canvas.clientWidth || 1,
      height: canvas.clientHeight || 1,
    });
    const initialBounds = scene.bounds();
    if (initialBounds) camera.fitBounds(initialBounds, sizeOf());

    // ── Mutable loop state ──
    let tool: Tool | PcbTool = isPcb ? new PcbSelectTool() : new SelectTool();
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
      simGhost: null as SimGhost | null,
      w: 0,
      h: 0,
    };

    // Tint map cached per ghost identity — rebuilt only on a new run.
    let tintCache: { ghost: SimGhost; map: Map<string, RGBA> } | null = null;
    const tintFor = (g: SimGhost): Map<string, RGBA> => {
      if (tintCache?.ghost !== g) tintCache = { ghost: g, map: ghostTint(g) };
      return tintCache.map;
    };

    const toolEnv = (): ToolEnv => ({
      graph,
      parts: partDb,
      selection: useSession.getState().selection,
      pick: (pt, tol) => pickIndex.pick(pt, tol),
      queryRect: (min, max) => pickIndex.queryRect(min, max),
    });

    if (isPcb) ensureRoutingClearance(); // walk/shove need the deck's clearance

    const pcbToolEnv = (): PcbToolEnv => ({
      graph,
      view: pcbViewOf(graph),
      parts: padSource,
      pick: (pt, tol) => pickIndex.pick(pt, tol),
      activeLayer: useUi.getState().activeLayer,
      traceWidthNm: DEFAULT_TRACE_WIDTH_NM,
      traceMode: useUi.getState().traceMode,
      clearanceNm: routingClearanceNm(),
    });

    const applyResult = (res: ToolResult | PcbToolResult): void => {
      const session = useSession.getState();
      if (res.selection) session.setSelection(res.selection);
      if (res.ops && res.ops.length > 0) {
        // Pcb ops are the pinned v0.4 contract — same dispatch path.
        const ops = res.ops as unknown as OpBody[];
        if (!session.dispatch(ops, res.opsLabel) && isPcb) {
          useUi.getState().flashStatus('The graph engine rejected that PCB edit (pcb ops land soon).');
        }
      }
      if (res.ghost !== undefined) {
        ghost = res.ghost;
        overlayVersion++;
      }
      if ('status' in res && res.status !== undefined) {
        useUi.getState().flashStatus(res.status);
      }
      if ('resetTool' in res && res.resetTool === true) {
        useUi.getState().setPcbTool('select');
      }
    };

    const worldOf = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return camera.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, sizeOf());
    };

    // ── Tool lifecycle (driven by ui store inside the frame loop) ──
    const syncTool = (): void => {
      const ui = useUi.getState();
      let key: string;
      if (isPcb) {
        key = ui.pcbTool === 'place' ? `place:${ui.pcbPlaceComponentId ?? ''}` : ui.pcbTool;
      } else {
        key = ui.tool === 'place' ? `place:${ui.placePartId ?? ''}` : ui.tool;
      }
      if (key === toolKey) return;
      applyResult(tool.cancel());
      toolKey = key;
      if (isPcb) {
        if (ui.pcbTool === 'place' && ui.pcbPlaceComponentId) {
          tool = new PcbPlaceTool(ui.pcbPlaceComponentId);
        } else if (ui.pcbTool === 'trace') tool = new PcbTraceTool();
        else if (ui.pcbTool === 'via') tool = new PcbViaTool();
        else if (ui.pcbTool === 'zone') tool = new PcbZoneTool();
        else tool = new PcbSelectTool();
      } else {
        if (ui.tool === 'place' && ui.placePartId) tool = new PlaceTool(ui.placePartId);
        else if (ui.tool === 'wire') tool = new WireTool();
        else tool = new SelectTool();
      }
    };

    // isPcb is fixed for this effect run, so the casts are sound: the
    // tool union always matches the mode the env builders serve.
    const toolDown = (pt: Vec): ToolResult | PcbToolResult =>
      isPcb
        ? (tool as PcbTool).pointerDown(pt, pcbToolEnv())
        : (tool as Tool).pointerDown(pt, toolEnv());
    const toolMove = (pt: Vec): ToolResult | PcbToolResult =>
      isPcb
        ? (tool as PcbTool).pointerMove(pt, pcbToolEnv())
        : (tool as Tool).pointerMove(pt, toolEnv());
    const toolUp = (pt: Vec): ToolResult | PcbToolResult =>
      isPcb
        ? (tool as PcbTool).pointerUp(pt, pcbToolEnv())
        : (tool as Tool).pointerUp(pt, toolEnv());

    // ── Pointer / wheel / keyboard ──
    const onPointerDown = (e: PointerEvent): void => {
      canvas.setPointerCapture(e.pointerId);
      if (e.button === 1 || (e.button === 0 && spaceDown)) {
        panning = true;
        lastPointer = { x: e.clientX, y: e.clientY };
        return;
      }
      if (e.button === 0) applyResult(toolDown(worldOf(e)));
    };

    const onPointerMove = (e: PointerEvent): void => {
      const world = worldOf(e);
      useUi.getState().setCursorWorld(world);
      if (panning && lastPointer) {
        camera.pan(e.clientX - lastPointer.x, e.clientY - lastPointer.y);
        lastPointer = { x: e.clientX, y: e.clientY };
        return;
      }
      applyResult(toolMove(world));
    };

    const onPointerUp = (e: PointerEvent): void => {
      if (panning) {
        panning = false;
        lastPointer = null;
        return;
      }
      if (e.button === 0) applyResult(toolUp(worldOf(e)));
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
      const ops = isPcb
        ? asOpBodies(
            withSpringBack(
              pcbDeleteSelectionOps(pcbViewOf(graph), session.selection),
              session.core.log.opsFor(session.branch),
              graph,
              padSource as unknown as FootprintSource,
            ),
          )
        : deleteSelectionOps(graph, session.selection);
      if (ops.length > 0) {
        if (!session.dispatch(ops, isPcb ? 'delete pcb selection' : 'delete selection') && isPcb) {
          useUi.getState().flashStatus('The graph engine rejected that PCB edit (pcb ops land soon).');
          return;
        }
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
        if (isPcb) useUi.getState().setPcbTool('select');
        else useUi.getState().setTool('select');
        useSession.getState().clearSelection();
        return;
      }
      if (isPcb && (e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
        if (tool instanceof PcbPlaceTool) {
          applyResult(tool.rotate(pcbToolEnv()));
          e.preventDefault();
        }
        return;
      }
      if (isPcb && (e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
        // Flip the selected footprint(s) top<->bottom in place.
        const session = useSession.getState();
        const flip = pcbFlipSelectionOps(graph, pcbViewOf(graph), session.selection);
        if (flip.ops.length > 0) {
          if (session.dispatch(asOpBodies(flip.ops), 'flip footprint side')) {
            if (flip.status !== null) useUi.getState().flashStatus(flip.status);
          } else {
            useUi.getState().flashStatus('The graph engine rejected that flip.');
          }
        } else if (flip.status !== null) {
          useUi.getState().flashStatus(flip.status);
        }
        e.preventDefault();
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

      // Graph → scene sync — incremental via diff + the per-view delta
      // appliers; ratsnest still recomputes whole (it is net-global).
      // Branch switches have no delta relating the two heads, so the
      // pcb path falls back to a full rebuild there.
      const session = useSession.getState();
      const replay = session.replayIndex === null ? 'live' : String(session.replayIndex);
      const key = `${session.branch}@${String(session.opsVersion)}#${replay}`;
      if (key !== graphKey) {
        const next = getGraph(session);
        if (isPcb) {
          if (session.branch === lastBranch) {
            syncPcbScene(scene, diff(graph, next), next, partDb, routingClearanceNm());
          } else {
            rebuildPcbScene(scene, next, partDb, routingClearanceNm());
          }
          ratsnest = dashedLines(ratsnestSegments(next, pcbViewOf(next), padSource));
          overlayVersion++;
        } else {
          applyDelta(scene, diff(graph, next), next, partDb);
        }
        graph = next;
        graphKey = key;
        lastBranch = session.branch;
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

      // Sim ghost: only drawn on the schematic, at the live head, and
      // only while its (branch, opsVersion) stamp matches the session.
      const freshGhost =
        !isPcb &&
        session.replayIndex === null &&
        ui.simGhost !== null &&
        ui.simGhost.branch === session.branch &&
        ui.simGhost.opsVersion === session.opsVersion
          ? ui.simGhost
          : null;

      const needsRender =
        sizeChanged ||
        graphKey !== last.graphKey ||
        camera.version !== last.cameraV ||
        scene.version !== last.sceneV ||
        overlayVersion !== last.overlayV ||
        session.selection !== last.selection ||
        ui.highlight !== last.highlight ||
        session.diffAgainst !== last.diffAgainst ||
        freshGhost !== last.simGhost;

      if (needsRender) {
        const overlay: OverlayState = {
          selection: new Set(session.selection),
          highlight: new Set(ui.highlight),
          diff: isPcb ? undefined : diffOverlayMap(getDiffDelta(session)),
          ...(freshGhost ? { tint: tintFor(freshGhost) } : {}),
          ...(ghost ? { ghost: { lines: ghost } } : {}),
          ...(isPcb && ratsnest && ratsnest.length > 0 ? { ratsnest: { lines: ratsnest } } : {}),
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
        last.simGhost = freshGhost;
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
  }, [viewMode]);

  return <canvas ref={canvasRef} className="canvas-host" data-pick-tolerance={PICK_TOLERANCE_NM} />;
}
