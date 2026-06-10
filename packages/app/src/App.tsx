import { useEffect } from 'react';

import { MM } from '@protopulse/graph';

import { CanvasHost } from './editor/CanvasHost.js';
import { deleteSelectionOps } from './editor/tools.js';
import { AnalystPanel } from './panels/AnalystPanel.js';
import { BranchPanel } from './panels/BranchPanel.js';
import { ConceptViewer } from './panels/ConceptViewer.js';
import { DraftsmanPanel } from './panels/DraftsmanPanel.js';
import { ErcPanel } from './panels/ErcPanel.js';
import { ExportPanel } from './panels/ExportPanel.js';
import { Inspector } from './panels/Inspector.js';
import { Palette } from './panels/Palette.js';
import { ProfessorPanel } from './panels/ProfessorPanel.js';
import { ReviewPanel } from './panels/ReviewPanel.js';
import { SimPanel } from './panels/SimPanel.js';
import { getFindings, getGraph, getOpCount, useSession } from './state/session.js';
import { useUi  } from './state/ui.js';

import type {TabId} from './state/ui.js';

const TABS: { id: TabId; label: string }[] = [
  { id: 'inspector', label: 'Inspector' },
  { id: 'erc', label: 'ERC' },
  { id: 'review', label: 'Review' },
  { id: 'branches', label: 'Branches' },
  { id: 'export', label: 'Export' },
  { id: 'draftsman', label: 'Draftsman' },
  { id: 'sim', label: 'Sim' },
  { id: 'analyst', label: 'Analyst' },
  { id: 'professor', label: 'Professor' },
];

/** How long a narration flash stays on the status bar. */
const FLASH_MS = 4000;

function Toolbar() {
  const tool = useUi((s) => s.tool);
  const setTool = useUi((s) => s.setTool);
  const requestFit = useUi((s) => s.requestFit);
  const branch = useSession((s) => s.branch);
  const canUndo = useSession((s) => s.canUndo);
  const canRedo = useSession((s) => s.canRedo);
  const undo = useSession((s) => s.undo);
  const redo = useSession((s) => s.redo);
  const selection = useSession((s) => s.selection);

  const deleteSelection = () => {
    const session = useSession.getState();
    const ops = deleteSelectionOps(getGraph(session), session.selection);
    if (ops.length > 0) {
      session.dispatch(ops, 'delete selection');
      session.clearSelection();
    }
  };

  return (
    <div className="toolbar">
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

  return (
    <aside className="side-panel panel">
      <nav className="tab-bar">
        {TABS.map((tab) => (
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
      {activeTab === 'branches' && <BranchPanel />}
      {activeTab === 'export' && <ExportPanel />}
      {activeTab === 'draftsman' && <DraftsmanPanel />}
      {activeTab === 'sim' && <SimPanel />}
      {activeTab === 'analyst' && <AnalystPanel />}
      {activeTab === 'professor' && <ProfessorPanel />}
    </aside>
  );
}

export function App() {
  return (
    <div className="app-shell">
      <Palette />
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
