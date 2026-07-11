import { useRef, useState } from 'react';

import {
  BITE_DRILL_NM,
  exportBomCsv,
  exportEdgeCuts,
  exportExcellon,
  exportGerberLayer,
  exportKicadNetlist,
  exportPasteLayer,
  exportPickPlace,
  exportSilkscreenLayer,
  exportSoldermaskLayer,
  panelizeGraph,
} from '@protopulse/export';

import { ensureRoutingClearance, routingClearanceNm, routingMaskExpansionNm } from '../pcb/routing.js';
import { bundleFromCore, downloadText, exportFile, importFile } from '../state/persistence.js';
import { getFindings, getGraph, partDb, useSession } from '../state/session.js';
import { shareUrl } from '../state/share.js';
import { useUi } from '../state/ui.js';

import type { DesignGraph } from '@protopulse/graph';

/** Exports: KiCad netlist + BOM CSV, gated (softly) on ERC errors;
 *  a full fab set (copper, Edge.Cuts, soldermask, paste, silkscreen,
 *  drill, pick-and-place — 11 files) for the board or a panelized array
 *  (V-cut or mouse-bites); plus whole-design .ppx.json save/load. */

const MM = 1_000_000;

function parseMm(label: string, raw: string): number | string {
  const v = Number(raw);
  if (!Number.isFinite(v) || v < 0) return `${label} must be a non-negative number of mm`;
  return Math.round(v * MM);
}

export function ExportPanel() {
  const opsVersion = useSession((s) => s.opsVersion);
  const branch = useSession((s) => s.branch);
  void opsVersion;
  const fileInput = useRef<HTMLInputElement | null>(null);

  const state = useSession.getState();
  const findings = getFindings(state);
  const errorCount = findings.filter((f) => f.severity === 'error').length;

  const exportNetlist = () => {
    const graph = getGraph(useSession.getState());
    const text = exportKicadNetlist(graph, partDb, { date: new Date().toISOString() });
    downloadText(`${state.designId}.net`, text, 'text/plain');
  };

  const exportBom = () => {
    const graph = getGraph(useSession.getState());
    downloadText(`${state.designId}-bom.csv`, exportBomCsv(graph, partDb), 'text/csv');
  };

  const exportDesign = () => {
    const s = useSession.getState();
    exportFile(bundleFromCore(s.core, s.branch));
  };

  // ── Fab outputs ──
  const [rows, setRows] = useState('2');
  const [cols, setCols] = useState('2');
  const [railMm, setRailMm] = useState('5');
  const [separation, setSeparation] = useState<'v-cut' | 'mouse-bites'>('v-cut');
  const [gapMm, setGapMm] = useState('2');
  const [tabMm, setTabMm] = useState('5');

  /** The full fab set for one graph: copper ×2, Edge.Cuts (+ scores or
   *  piece outlines), drill (+ bites), pick-and-place. */
  const downloadFabSet = (
    graph: DesignGraph,
    name: string,
    extras: {
      vCuts?: { a: { x: number; y: number }; b: { x: number; y: number } }[];
      edgeSegments?: { a: { x: number; y: number }; b: { x: number; y: number } }[];
      bites?: { x: number; y: number }[];
    } = {},
  ): boolean => {
    ensureRoutingClearance();
    const clearance = routingClearanceNm();
    const maskExpansion = routingMaskExpansionNm();
    const hasZones = graph.pcb.zones.size > 0;
    if (hasZones && clearance === null) {
      useUi
        .getState()
        .flashStatus('The rule deck has not loaded yet — zone pours need its clearance. Try again in a moment.');
      return false;
    }
    if (maskExpansion === null) {
      useUi
        .getState()
        .flashStatus('The rule deck has not loaded yet — soldermask needs its clearance. Try again in a moment.');
      return false;
    }
    const date = new Date().toISOString();
    const gerberOpts = { date, ...(clearance !== null ? { pourClearanceNm: clearance } : {}) };
    const edge = exportEdgeCuts(graph, { date }, [...(extras.vCuts ?? []), ...(extras.edgeSegments ?? [])]);
    if (edge === null) {
      useUi.getState().flashStatus('No board outline — draw one with the Outline tool (PCB mode) first.');
      return false;
    }
    downloadText(`${name}-F_Cu.gbr`, exportGerberLayer(graph, partDb, 'F.Cu', gerberOpts), 'text/plain');
    downloadText(`${name}-B_Cu.gbr`, exportGerberLayer(graph, partDb, 'B.Cu', gerberOpts), 'text/plain');
    downloadText(`${name}-Edge_Cuts.gbr`, edge, 'text/plain');
    downloadText(
      `${name}-F_Mask.gbr`,
      exportSoldermaskLayer(graph, partDb, 'F.Mask', { date, clearanceNm: maskExpansion }),
      'text/plain',
    );
    downloadText(
      `${name}-B_Mask.gbr`,
      exportSoldermaskLayer(graph, partDb, 'B.Mask', { date, clearanceNm: maskExpansion }),
      'text/plain',
    );
    downloadText(`${name}-F_Paste.gbr`, exportPasteLayer(graph, partDb, 'F.Paste', { date }), 'text/plain');
    downloadText(`${name}-B_Paste.gbr`, exportPasteLayer(graph, partDb, 'B.Paste', { date }), 'text/plain');
    downloadText(`${name}-F_SilkS.gbr`, exportSilkscreenLayer(graph, partDb, 'F.SilkS', { date }), 'text/plain');
    downloadText(`${name}-B_SilkS.gbr`, exportSilkscreenLayer(graph, partDb, 'B.SilkS', { date }), 'text/plain');
    downloadText(
      `${name}.drl`,
      exportExcellon(
        graph,
        partDb,
        { date },
        (extras.bites ?? []).map((at) => ({ at, drillNm: BITE_DRILL_NM })),
      ),
      'text/plain',
    );
    downloadText(`${name}-pos.csv`, exportPickPlace(graph, partDb), 'text/csv');
    return true;
  };

  const exportBoardFab = () => {
    const graph = getGraph(useSession.getState());
    if (downloadFabSet(graph, state.designId)) {
      useUi
        .getState()
        .flashStatus(
          'Fab set downloaded: F/B copper, Edge.Cuts, F/B mask, F/B paste, F/B silkscreen, drill, pick-and-place (11 files).',
        );
    }
  };

  const exportPanelFab = () => {
    const r = Number(rows);
    const c = Number(cols);
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 1 || c < 1 || r > 20 || c > 20) {
      useUi.getState().flashStatus('rows and cols must be whole numbers between 1 and 20');
      return;
    }
    const rail = parseMm('rail', railMm);
    const gap = parseMm('gap', gapMm);
    const tab = parseMm('tab', tabMm);
    for (const v of [rail, gap, tab]) {
      if (typeof v === 'string') {
        useUi.getState().flashStatus(v);
        return;
      }
    }
    const graph = getGraph(useSession.getState());
    const result = panelizeGraph(graph, {
      rows: r,
      cols: c,
      railNm: rail as number,
      separation,
      ...(separation === 'mouse-bites' && (gap as number) > 0 ? { gapNm: gap as number } : {}),
      ...(separation === 'mouse-bites' && (tab as number) > 0 ? { tabWidthNm: tab as number } : {}),
    });
    if (!result.ok) {
      useUi.getState().flashStatus(`Panelize refused: ${result.reason}`);
      return;
    }
    const done = downloadFabSet(result.graph, `${state.designId}-panel-${String(r)}x${String(c)}`, {
      vCuts: result.vCuts,
      edgeSegments: result.edgeSegments,
      bites: result.bites,
    });
    if (done) {
      useUi
        .getState()
        .flashStatus(
          `Panel ${String(r)}×${String(c)} (${String(result.copies)} boards, ${separation}) downloaded — 11 files.`,
        );
    }
  };

  const copyShareLink = async () => {
    const s = useSession.getState();
    try {
      const url = await shareUrl(bundleFromCore(s.core, s.branch), window.location);
      await navigator.clipboard.writeText(url);
      useUi
        .getState()
        .flashStatus(
          `Share link copied (${String(url.length)} chars) — the whole design lives in the URL, no server involved.`,
        );
    } catch (err) {
      useUi.getState().flashStatus(`Share link failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const onImport = async (file: File) => {
    try {
      const bundle = await importFile(file);
      useSession.getState().replaceWithBundle(bundle);
    } catch (err) {
      // eslint-disable-next-line no-alert -- M1 error surface; toast post-M1
      window.alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="panel-body">
      {errorCount > 0 && (
        <p className="export-warning">
          ⚠ {errorCount} ERC error{errorCount === 1 ? '' : 's'} outstanding — exports are allowed, but fix them before
          fabbing.
        </p>
      )}
      <div className="export-buttons">
        <button type="button" className="primary-button" onClick={exportNetlist}>
          Download netlist (.net)
        </button>
        <button type="button" className="primary-button" onClick={exportBom}>
          Download BOM (.csv)
        </button>
      </div>
      <h3 className="panel-subtitle">Fab outputs</h3>
      <div className="export-buttons">
        <button
          type="button"
          className="primary-button"
          title="F/B copper, Edge.Cuts, F/B soldermask, F/B paste, F/B silkscreen gerbers, Excellon drill, pick-and-place CSV"
          onClick={exportBoardFab}
        >
          Download fab set (11 files)
        </button>
      </div>
      <h3 className="panel-subtitle">Panelize</h3>
      <label className="sim-field">
        <span className="sim-field-label">rows × cols</span>
        <input
          value={rows}
          onChange={(e) => {
            setRows(e.target.value);
          }}
          style={{ width: '3em' }}
          aria-label="panel rows"
        />
        <input
          value={cols}
          onChange={(e) => {
            setCols(e.target.value);
          }}
          style={{ width: '3em' }}
          aria-label="panel cols"
        />
      </label>
      <label className="sim-field">
        <span className="sim-field-label">rail (mm)</span>
        <input
          value={railMm}
          onChange={(e) => {
            setRailMm(e.target.value);
          }}
        />
      </label>
      <label className="sim-field">
        <span className="sim-field-label">separation</span>
        <select
          value={separation}
          onChange={(e) => {
            setSeparation(e.target.value === 'mouse-bites' ? 'mouse-bites' : 'v-cut');
          }}
        >
          <option value="v-cut">V-cut (copies butt, straight scores)</option>
          <option value="mouse-bites">mouse-bites (routed channel + tabs)</option>
        </select>
      </label>
      {separation === 'mouse-bites' && (
        <>
          <label className="sim-field">
            <span className="sim-field-label">gap (mm)</span>
            <input
              value={gapMm}
              onChange={(e) => {
                setGapMm(e.target.value);
              }}
            />
          </label>
          <label className="sim-field">
            <span className="sim-field-label">tab (mm)</span>
            <input
              value={tabMm}
              onChange={(e) => {
                setTabMm(e.target.value);
              }}
            />
          </label>
        </>
      )}
      <div className="export-buttons">
        <button type="button" className="primary-button" onClick={exportPanelFab}>
          Download panel fab set
        </button>
      </div>
      <p className="muted">
        The panel is the same design replicated as one graph — the standard exporters and even DRC run on it unchanged.
        Mouse-bite perforations join the drill file (one file — KiCad would split PTH/NPTH); fabs like JLC add their own
        panel fiducials on request.
      </p>
      <h3 className="panel-subtitle">Design file</h3>
      <div className="export-buttons">
        <button
          type="button"
          className="primary-button"
          title="the whole design (op-log, branches and all) compressed into a URL — no server, no upload"
          onClick={() => {
            void copyShareLink();
          }}
        >
          Copy share link
        </button>
        <button type="button" onClick={exportDesign}>
          Save design (.ppx.json)
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>
          Load design…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,.ppx.json,application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImport(file);
            e.target.value = '';
          }}
        />
      </div>
      <p className="muted">Branch: {branch}. Exports reflect the current branch head.</p>
    </div>
  );
}
