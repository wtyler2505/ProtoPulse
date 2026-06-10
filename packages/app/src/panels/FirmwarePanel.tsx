import { useEffect, useRef, useState } from 'react';

import { createEmuSession } from '../emu/runner.js';
import { buildPinTraces, traceToPlotXY } from '../emu/timeline.js';
import { Plot, traceColor } from '../sim/Plot.js';
import { engNotation } from '../sim/scales.js';
import { useUi } from '../state/ui.js';

import type { PlotTrace } from '../sim/Plot.js';

/**
 * The Firmware panel — v0.5 "logic analyzer lite". Paste or pick an
 * Intel-HEX file, load it into the lazily booted MCU core, and run it in
 * real time: one requestAnimationFrame per emulated frame, budgeted in
 * runner.ts so heavy firmware can't freeze the editor. The serial
 * monitor shows the rolling UART text (and feeds typed lines back in);
 * the pin traces render every pin the firmware has toggled as stacked
 * square waves over a selectable virtual-time window.
 */

/** Module-level session: firmware, cycles, and serial history survive
 *  tab switches; only the run loop pauses while the panel is unmounted. */
const session = createEmuSession();

/** How far back the pin-trace window looks, in virtual seconds. */
const WINDOWS = [
  { id: '1m', label: '1 ms', seconds: 1e-3 },
  { id: '10m', label: '10 ms', seconds: 1e-2 },
  { id: '100m', label: '100 ms', seconds: 0.1 },
  { id: '1', label: '1 s', seconds: 1 },
  { id: '10', label: '10 s', seconds: 10 },
] as const;

/** Stacked-trace geometry: a logic 1 is 1 high, rows sit 1.5 apart. */
const TRACE_AMPLITUDE = 1;
const TRACE_SPACING = 1.5;

/** Auto-selected pins before the user touches the checkboxes. */
const AUTO_VISIBLE_PINS = 2;

export function FirmwarePanel() {
  const flashStatus = useUi((s) => s.flashStatus);

  const [hexText, setHexText] = useState('');
  const [loadInfo, setLoadInfo] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [serialIn, setSerialIn] = useState('');
  /** null until the user toggles a checkbox — first pins auto-select. */
  const [visiblePins, setVisiblePins] = useState<ReadonlySet<string> | null>(null);
  const [windowId, setWindowId] = useState<(typeof WINDOWS)[number]['id']>('100m');
  // Bumped per emulated frame — the session mutates outside React.
  const [frameSeq, setFrameSeq] = useState(0);
  void frameSeq;

  const serialFeedRef = useRef<HTMLDivElement | null>(null);

  // ── The run loop: one budgeted emulation frame per animation frame. ──
  useEffect(() => {
    if (!running) return undefined;
    let raf = requestAnimationFrame(function frame() {
      session.runFrame();
      setFrameSeq((s) => s + 1);
      raf = requestAnimationFrame(frame);
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [running]);

  // Serial monitor autoscroll: pin to the bottom as text arrives.
  const serialText = session.serialText;
  useEffect(() => {
    const el = serialFeedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [serialText]);

  const onLoad = async () => {
    setRunning(false);
    const out = await session.load(hexText);
    if (out.ok) {
      setLoadError(null);
      setLoadInfo(`Firmware loaded — ATmega328P @ ${engNotation(out.clockHz)}Hz`);
      setVisiblePins(null);
    } else {
      setLoadInfo(null);
      setLoadError(out.error);
      flashStatus(`Firmware load failed: ${out.error}`);
    }
    setFrameSeq((s) => s + 1);
  };

  const onPickFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    setHexText(await file.text());
    input.value = ''; // re-picking the same file fires onChange again
  };

  const onSerialSend = () => {
    const line = serialIn;
    if (!session.loaded) return;
    session.sendSerial(`${line}\n`);
    setSerialIn('');
  };

  const togglePin = (pin: string, effective: ReadonlySet<string>) => {
    const next = new Set(effective);
    if (next.has(pin)) {
      next.delete(pin);
    } else {
      next.add(pin);
    }
    setVisiblePins(next);
  };

  // ── Derive the readouts and traces for this render. ──
  const loaded = session.loaded;
  const cycles = session.cycles;
  const clockHz = session.clockHz;
  const pins = session.pins();
  const effectiveVisible: ReadonlySet<string> =
    visiblePins ?? new Set(pins.slice(0, AUTO_VISIBLE_PINS));
  const windowSeconds = WINDOWS.find((w) => w.id === windowId)?.seconds ?? 0.1;

  let plotTraces: PlotTrace[] = [];
  if (clockHz !== null) {
    const windowEndCycle = cycles;
    const windowStartCycle = Math.max(0, windowEndCycle - Math.round(windowSeconds * clockHz));
    const selected = pins.filter((p) => effectiveVisible.has(p));
    plotTraces = buildPinTraces(session.events, {
      clockHz,
      pins: selected,
      windowStartCycle,
      windowEndCycle,
    }).map((trace, i, all) => {
      const { xs, ys } = traceToPlotXY(trace, {
        yOffset: (all.length - 1 - i) * TRACE_SPACING,
        amplitude: TRACE_AMPLITUDE,
      });
      return { name: trace.pin, xs, ys, color: traceColor(pins.indexOf(trace.pin)) };
    });
  }

  return (
    <div className="panel-body firmware-panel">
      <h3 className="panel-subtitle">Firmware (Intel HEX)</h3>
      <textarea
        className="firmware-hex"
        spellCheck={false}
        placeholder=":100000000C9434000C943E000C943E000C943E0082&#10;…paste a compiled .hex here, or pick a file below."
        value={hexText}
        aria-label="Intel HEX firmware"
        onChange={(e) => {
          setHexText(e.target.value);
        }}
      />
      <label className="firmware-file">
        <span className="sim-field-label">.hex file</span>
        <input
          type="file"
          accept=".hex,.ihex,.eep,text/plain"
          onChange={(e) => {
            void onPickFile(e.currentTarget);
          }}
        />
      </label>

      <div className="firmware-controls">
        <button
          type="button"
          className="primary-button"
          disabled={hexText.trim() === ''}
          onClick={() => {
            void onLoad();
          }}
        >
          Load
        </button>
        <button
          type="button"
          disabled={!loaded}
          onClick={() => {
            setRunning((r) => !r);
          }}
        >
          {running ? 'Pause' : 'Run'}
        </button>
        <button
          type="button"
          disabled={!loaded}
          onClick={() => {
            session.reset();
            setFrameSeq((s) => s + 1);
          }}
        >
          Reset
        </button>
      </div>

      {loadError !== null && <p className="sim-error">{loadError}</p>}
      {loadInfo !== null && <p className="muted">{loadInfo}</p>}

      {loaded && clockHz !== null && (
        <p className="firmware-readout">
          <span title="cycles executed since load/reset">{cycles.toLocaleString()} cycles</span>
          <span title="virtual time = cycles / clock">t = {engNotation(cycles / clockHz, 4)}s</span>
          <span title="core clock">{engNotation(clockHz)}Hz</span>
        </p>
      )}

      {loaded && (
        <>
          <h3 className="panel-subtitle">Serial monitor</h3>
          <div className="serial-feed" ref={serialFeedRef}>
            {serialText === '' ? (
              <span className="muted">— no UART output yet —</span>
            ) : (
              serialText
            )}
          </div>
          <form
            className="serial-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              onSerialSend();
            }}
          >
            <input
              type="text"
              className="serial-input"
              placeholder="Send a line (LF appended)…"
              value={serialIn}
              aria-label="Serial input line"
              onChange={(e) => {
                setSerialIn(e.target.value);
              }}
            />
            <button type="submit" disabled={!loaded}>
              Send
            </button>
          </form>

          <h3 className="panel-subtitle">Pin traces</h3>
          {pins.length === 0 ? (
            <p className="muted">No pin activity yet — Run the firmware to capture transitions.</p>
          ) : (
            <>
              <ul className="trace-list">
                {pins.map((pin, i) => (
                  <li key={pin} className="trace-row">
                    <label className="trace-toggle">
                      <input
                        type="checkbox"
                        checked={effectiveVisible.has(pin)}
                        onChange={() => {
                          togglePin(pin, effectiveVisible);
                        }}
                      />
                      <span className="trace-swatch" style={{ background: traceColor(i) }} />
                      <span className="trace-name">{pin}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <label className="sim-field">
                <span className="sim-field-label">window</span>
                <select
                  value={windowId}
                  onChange={(e) => {
                    setWindowId(e.target.value as (typeof WINDOWS)[number]['id']);
                  }}
                >
                  {WINDOWS.map((w) => (
                    <option key={w.id} value={w.id}>
                      last {w.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="plot-wrap">
                <Plot traces={plotTraces} xLabel="t (s)" yLabel="pin level (stacked)" />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
