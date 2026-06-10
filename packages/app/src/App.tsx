import { useEffect } from 'react';

import { MM } from '@protopulse/graph';
import { pcbViewOf } from '@protopulse/renderer';

import { CanvasHost } from './editor/CanvasHost.js';
import { deleteSelectionOps } from './editor/tools.js';
import { AnalystPanel } from './panels/AnalystPanel.js';
import { BranchPanel } from './panels/BranchPanel.js';
import { ConceptViewer } from './panels/ConceptViewer.js';
import { DraftsmanPanel } from './panels/DraftsmanPanel.js';
import { DrcPanel } from './panels/DrcPanel.js';
import { ErcPanel } from './panels/ErcPanel.js';
import { ExportPanel } from './panels/ExportPanel.js';
import { FirmwarePanel } from './panels/FirmwarePanel.js';
import { Inspector } from './panels/Inspector.js';
import { Palette } from './panels/Palette.js';
import { PcbTray } from './panels/PcbTray.js';
import { ProfessorPanel } from './panels/ProfessorPanel.js';
import { ReviewPanel } from './panels/ReviewPanel.js';
import { SimPanel } from './panels/SimPanel.js';
import { pcbDeleteSelectionOps } from './pcb/tools.js';
import { asOpBodies, DEFAULT_TRACE_WIDTH_NM } from './pcb/types.js';
import { getFindings, getGraph, getOpCount, useSession } from './state/session.js';
import { useUi  } from './state/ui.js';

import type {TabId} from './state/ui.js';

const SCHEMATIC_TABS: { id: TabId; label: string }[] = [
  { id: 'inspector', label: 'Inspector' },
  { id: 'erc', label: 'ERC' },
  { id: 'review', label: 'Review' },
  { id: 'branches', label: 'Branches' },
  { id: 'export', label: 'Export' },
  { id: 'draftsman', label: 'Draftsman' },
  { id: 'sim', label: 'Sim' },
  { id: 'firmware', label: 'Firmware' },
  { id: 'analyst', label: 'Analyst' },
  { id: 'professor', label: 'Professor' },
];

/** The DRC tab exists only on the board side. */
const PCB_TABS: { id: TabId; label: string }[] = [
  ...SCHEMATIC_TABS.slice(0, 3),
  { id: 'drc', label: 'DRC' },
  ...SCHEMATIC_TABS.slice(3),
];

/** How long a narration flash stays on the status bar. */
const FLASH_MS = 4000;

function Toolbar() {
  const tool = useUi((s) => s.tool);
  const setTool = useUi((s) => s.setTool);
  const viewMode = useUi((s) => s.viewMode);
  const setViewMode = useUi((s) => s.setViewMode);
  const pcbTool = useUi((s) => s.pcbTool);
  const setPcbTool = useUi((s) => s.setPcbTool);
  const activeLayer = useUi((s) => s.activeLayer);
  const toggleLayer = useUi((s) => s.toggleLayer);
  const requestFit = useUi((s) => s.requestFit);
  const branch = useSession((s) => s.branch);
  const canUndo = useSession((s) => s.canUndo);
  const canRedo = useSession((s) => s.canRedo);
  const undo = useSession((s) => s.undo);
  const redo = useSession((s) => s.redo);
  const selection = useSession((s) => s.selection);
  const isPcb = viewMode === 'pcb';

  const deleteSelection = () => {
    const session = useSession.getState();
    const graph = getGraph(session);
    const ops = isPcb
      ? asOpBodies(pcbDeleteSelectionOps(pcbViewOf(graph), session.selection))
      : deleteSelectionOps(graph, session.selection);
    if (ops.length > 0) {
      if (!session.dispatch(ops, isPcb ? 'delete pcb selection' : 'delete selection') && isPcb) {
        useUi.getState().flashStatus('The graph engine rejected that PCB edit (pcb ops land soon).');
        return;
      }
      session.clearSelection();
    }
  };

  return (
    <div className="toolbar">
      <button
        type="button"
        className={!isPcb ? 'active' : ''}
        title="schematic canvas"
        onClick={() => { setViewMode('schematic'); }}
      >
        Schematic
      </button>
      <button
        type="button"
        className={isPcb ? 'active' : ''}
        title="board canvas (v0.4)"
        onClick={() => { setViewMode('pcb'); }}
      >
        PCB
      </button>
      <span className="toolbar-divider" />
      {isPcb ? (
        <>
          <button
            type="button"
            className={pcbTool === 'select' ? 'active' : ''}
            onClick={() => { setPcbTool('select'); }}
          >
            Select
          </button>
          <button
            type="button"
            className={pcbTool === 'trace' ? 'active' : ''}
            title="route copper on the active layer (click a pad to start)"
            onClick={() => { setPcbTool('trace'); }}
          >
            Trace
          </button>
          <button
            type="button"
            className={pcbTool === 'via' ? 'active' : ''}
            title="drop a via on a routed trace"
            onClick={() => { setPcbTool('via'); }}
          >
            Via
          </button>
          <button
            type="button"
            className={`layer-chip ${activeLayer === 'F.Cu' ? 'layer-f' : 'layer-b'}`}
            title="active copper layer — new traces route here"
            onClick={toggleLayer}
          >
            {activeLayer}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className={tool === 'select' ? 'active' : ''}
            onClick={() => { setTool('select'); }}
          >
            Select
          </button>
          <button
            type="button"
            className={tool === 'wire' ? 'active' : ''}
            onClick={() => { setTool('wire'); }}
          >
            Wire
          </button>
        </>
      )}
      <button type="button" disabled={selection.size === 0} onClick={deleteSelection}>
        Delete
      </button>
      <span className="toolbar-divider" />
      <button type="button" disabled={!canUndo} onClick={undo}>
        Undo
      </button>
      <button type="button" disabled={!canRedo} onClick={redo}>
        Redo
      </button>
      <button type="button" onClick={requestFit}>
        Zoom fit
      </button>
      <span className="toolbar-spacer" />
      <span className="branch-chip" title="active branch">
        ⎇ {branch}
      </span>
    </div>
  );
}

function StatusBar() {
  const cursor = useUi((s) => s.cursorWorld);
  const statusFlash = useUi((s) => s.statusFlash);
  const statusFlashSeq = useUi((s) => s.statusFlashSeq);
  const viewMode = useUi((s) => s.viewMode);
  const activeLayer = useUi((s) => s.activeLayer);
  const opsVersion = useSession((s) => s.opsVersion);
  void opsVersion;
  const state = useSession.getState();
  const opCount = getOpCount(state);
  const findings = getFindings(state);
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warns = findings.filter((f) => f.severity === 'warn').length;

  // Auto-clear: each flash arms a timer keyed on its seq; a newer flash
  // makes the stale timer a no-op (clearStatusFlash checks the seq).
  useEffect(() => {
    if (statusFlash === null) return;
    const timer = setTimeout(() => {
      useUi.getState().clearStatusFlash(statusFlashSeq);
    }, FLASH_MS);
    return () => { clearTimeout(timer); };
  }, [statusFlash, statusFlashSeq]);

  return (
    <div className="status-bar">
      <span className="status-cell">
        {cursor
          ? `x ${(cursor.x / MM).toFixed(2)} mm   y ${(cursor.y / MM).toFixed(2)} mm`
          : '—'}
      </span>
      <span className="status-cell">{opCount} ops</span>
      {viewMode === 'pcb' && (
        <span className="status-cell" title="active layer · width new traces route at">
          {activeLayer} · trace {(DEFAULT_TRACE_WIDTH_NM / MM).toFixed(2)} mm
        </span>
      )}
      <span className={`status-cell${errors > 0 ? ' status-error' : ''}`}>
        ERC: {errors} errors, {warns} warnings
      </span>
      {statusFlash !== null && (
        <span className="status-cell status-flash" role="status">
          {statusFlash}
        </span>
      )}
    </div>
  );
}

function SidePanel() {
  const activeTab = useUi((s) => s.activeTab);
  const setTab = useUi((s) => s.setTab);
  const viewMode = useUi((s) => s.viewMode);
  const tabs = viewMode === 'pcb' ? PCB_TABS : SCHEMATIC_TABS;

  return (
    <aside className="side-panel panel">
      <nav className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => { setTab(tab.id); }}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {activeTab === 'inspector' && <Inspector />}
      {activeTab === 'erc' && <ErcPanel />}
      {activeTab === 'review' && <ReviewPanel />}
      {activeTab === 'drc' && <DrcPanel />}
      {activeTab === 'branches' && <BranchPanel />}
      {activeTab === 'export' && <ExportPanel />}
      {activeTab === 'draftsman' && <DraftsmanPanel />}
      {activeTab === 'sim' && <SimPanel />}
      {activeTab === 'firmware' && <FirmwarePanel />}
      {activeTab === 'analyst' && <AnalystPanel />}
      {activeTab === 'professor' && <ProfessorPanel />}
    </aside>
  );
}

export function App() {
  const viewMode = useUi((s) => s.viewMode);
  return (
    <div className="app-shell">
      {viewMode === 'pcb' ? <PcbTray /> : <Palette />}
      <main className="editor-column">
        <Toolbar />
        <div className="canvas-wrap">
          <CanvasHost />
        </div>
        <StatusBar />
      </main>
      <SidePanel />
      <ConceptViewer />
    </div>
  );
}
