import { useRef } from 'react';

import { exportBomCsv, exportKicadNetlist } from '@protopulse/export';

import {
  bundleFromCore,
  downloadText,
  exportFile,
  importFile,
} from '../state/persistence.js';
import { getFindings, getGraph, partDb, useSession } from '../state/session.js';
import { shareUrl } from '../state/share.js';
import { useUi } from '../state/ui.js';

/** Exports: KiCad netlist + BOM CSV, gated (softly) on ERC errors; plus
 *  whole-design .ppx.json save/load. */

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
      useUi
        .getState()
        .flashStatus(`Share link failed: ${err instanceof Error ? err.message : String(err)}`);
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
          ⚠ {errorCount} ERC error{errorCount === 1 ? '' : 's'} outstanding — exports are allowed,
          but fix them before fabbing.
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
      <p className="muted">
        Branch: {branch}. Exports reflect the current branch head.
      </p>
    </div>
  );
}
