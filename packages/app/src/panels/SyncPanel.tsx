import { useState } from 'react';

import { useSession } from '../state/session.js';
import { DEFAULT_RELAY_URL, useSync } from '../state/sync.js';

/**
 * Live sync: connect this editor to a relay room and the op-log flows
 * both ways — same envelope set, same graph, no merge dialogs because
 * the total order resolves everything at this layer. The relay carries
 * designs, it never owns them.
 */

export function SyncPanel() {
  const designId = useSession((s) => s.designId);
  const sync = useSync();
  const [url, setUrl] = useState(sync.url);
  const [room, setRoom] = useState('');
  const [token, setToken] = useState('');

  const effectiveRoom = room.trim() === '' ? designId : room.trim();
  const live =
    sync.status === 'on' || sync.status === 'connecting' || sync.status === 'reconnecting';

  return (
    <div className="panel-body">
      <p className="muted">
        Share this design live. Run the relay (<code>npm run -w @protopulse/relay dev</code>),
        point another editor at the same room, and every edit flows both ways.
      </p>

      <label className="sim-field">
        <span className="sim-field-label">relay</span>
        <input
          value={url}
          disabled={live}
          onChange={(e) => {
            setUrl(e.target.value);
          }}
          placeholder={DEFAULT_RELAY_URL}
        />
      </label>
      <label className="sim-field">
        <span className="sim-field-label">room</span>
        <input
          value={room}
          disabled={live}
          onChange={(e) => {
            setRoom(e.target.value);
          }}
          placeholder={designId}
        />
      </label>
      <label className="sim-field">
        <span className="sim-field-label">token</span>
        <input
          type="password"
          value={token}
          disabled={live}
          onChange={(e) => {
            setToken(e.target.value);
          }}
          placeholder="only if the relay requires one"
          aria-label="relay token"
        />
      </label>

      {live ? (
        <button type="button" onClick={sync.disconnect}>
          Disconnect
        </button>
      ) : (
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            sync.connect(url.trim() === '' ? DEFAULT_RELAY_URL : url.trim(), effectiveRoom, token.trim());
          }}
        >
          Connect
        </button>
      )}

      <div className={`sync-status sync-${sync.status}`}>
        <span className="sync-dot" />
        {sync.status === 'on' && (
          <span>
            live · {sync.peers} peer{sync.peers === 1 ? '' : 's'} in “{sync.room}” · {sync.sent}{' '}
            sent / {sync.received} received
          </span>
        )}
        {sync.status === 'connecting' && <span>connecting to {sync.url}…</span>}
        {sync.status === 'reconnecting' && (
          <span>connection lost — reconnecting (your edits keep working; they sync on rejoin)</span>
        )}
        {sync.status === 'off' && <span>offline</span>}
        {sync.status === 'error' && <span>error: {sync.error ?? 'unknown'}</span>}
      </div>
      {sync.note !== null && <p className="muted">note: {sync.note}</p>}

      <p className="muted">
        Honest notes: ALL branches sync (a same-named branch with a different fork point stays
        local — watch the note line). Every
        editor keeps its own copy — the relay only carries; with <code>PP_RELAY_DATA</code> set it
        also remembers rooms across restarts, and with <code>PP_RELAY_TOKEN</code> set it requires
        the token above. Dropped connections rejoin automatically with backoff; edits made
        offline union back in.
      </p>
    </div>
  );
}
