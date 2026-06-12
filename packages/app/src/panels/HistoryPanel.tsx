import { useEffect, useRef, useState } from 'react';

import { describeOp, REPLAY_SPEEDS } from '../state/replay.js';
import { useSession } from '../state/session.js';

/**
 * Time-lapse replay: the design IS its op-log, so any moment in its
 * history is a prefix materialization — this panel scrubs that prefix.
 * The canvas (and every other graph reader) follows the scrub position;
 * the session is read-only until "Back to live".
 *
 * ERC/Review/Sim panels intentionally keep reporting the LIVE head —
 * replay answers "how did this design get here", not "what was wrong
 * at op 12".
 */

export function HistoryPanel() {
  const opsVersion = useSession((s) => s.opsVersion);
  void opsVersion;
  const branch = useSession((s) => s.branch);
  const replayIndex = useSession((s) => s.replayIndex);
  const setReplayIndex = useSession((s) => s.setReplayIndex);
  const state = useSession.getState();
  const envelopes = state.core.log.opsFor(branch);
  const total = envelopes.length;

  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const listRef = useRef<HTMLOListElement | null>(null);

  const live = replayIndex === null;
  const position = replayIndex ?? total;

  // Playback: advance one op per tick at the chosen speed; stop at the
  // head (and stay in replay there so the user sees the landing).
  useEffect(() => {
    if (!playing) return;
    const speed = REPLAY_SPEEDS[speedIdx] ?? REPLAY_SPEEDS[1];
    const timer = setInterval(() => {
      const s = useSession.getState();
      const at = s.replayIndex;
      if (at === null || at >= s.core.opCount(s.branch)) {
        setPlaying(false);
        return;
      }
      s.setReplayIndex(at + 1);
    }, 1000 / speed.opsPerSec);
    return () => { clearInterval(timer); };
  }, [playing, speedIdx]);

  // Keep the current row visible while scrubbing or playing.
  useEffect(() => {
    const row = listRef.current?.querySelector('.history-row.current');
    row?.scrollIntoView({ block: 'nearest' });
  }, [position]);

  const play = () => {
    // From live (or the head), a fresh play restarts the story.
    if (live || position >= total) setReplayIndex(0);
    setPlaying(true);
  };

  const pause = () => { setPlaying(false); };

  const backToLive = () => {
    setPlaying(false);
    setReplayIndex(null);
  };

  return (
    <div className="panel-body history-panel">
      <p className="muted">
        Replay the op-log: scrub through every operation that built this
        design. Editing is paused while replaying.
      </p>

      <div className="history-controls">
        {playing ? (
          <button type="button" onClick={pause}>⏸ Pause</button>
        ) : (
          <button type="button" className="primary-button" onClick={play} disabled={total === 0}>
            ▶ Play
          </button>
        )}
        <select
          aria-label="playback speed"
          value={speedIdx}
          onChange={(e) => { setSpeedIdx(Number(e.target.value)); }}
        >
          {REPLAY_SPEEDS.map((s, i) => (
            <option key={s.label} value={i}>
              {s.label} ({s.opsPerSec} ops/s)
            </option>
          ))}
        </select>
        <button type="button" onClick={backToLive} disabled={live}>
          Back to live
        </button>
      </div>

      <label className="history-scrub">
        <span className="history-position">
          {live ? `live — ${String(total)} ops` : `op ${String(position)} / ${String(total)}`}
        </span>
        <input
          type="range"
          min={0}
          max={total}
          value={position}
          disabled={total === 0}
          aria-label="replay position"
          onChange={(e) => {
            setPlaying(false);
            setReplayIndex(Number(e.target.value));
          }}
        />
      </label>

      <ol className="history-list" ref={listRef}>
        {envelopes.map((env, i) => {
          const reached = i < position;
          const isCurrent = !live && i === position - 1;
          return (
            <li
              key={`${String(env.lamport)}:${env.actor}`}
              className={`history-row${isCurrent ? ' current' : ''}${reached ? '' : ' future'}`}
            >
              <button
                type="button"
                className="history-jump"
                title={`jump to just after op ${String(i + 1)}`}
                onClick={() => {
                  setPlaying(false);
                  setReplayIndex(i + 1);
                }}
              >
                <span className="history-index">{i + 1}</span>
                <span className="history-desc">{describeOp(env.op)}</span>
                {env.meta?.agent !== undefined && (
                  <span className="history-agent">{env.meta.agent}</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      {total === 0 && <p className="muted">No operations yet — the log is empty.</p>}
    </div>
  );
}
