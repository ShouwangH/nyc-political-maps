import { useCallback, useMemo, useState } from 'react';
import { LeafletMap } from './components/LeafletMap';
import { SAMPLE_VOTES, SAMPLE_VOTE_SET } from './sampleVotes';
import type { VoteStatus } from './types';

type LoadState =
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'ready' }
  | { type: 'error'; message: string };

const COLOR_SCALE: Record<VoteStatus, string> = {
  Yes: '#2e8540',
  No: '#c22',
  Abstain: '#d4a017',
  Missing: '#777'
};

const App = () => {
  const [status, setStatus] = useState<LoadState>({ type: 'idle' });

  const handleStatusChange = useCallback((state: LoadState) => {
    setStatus(state);
  }, []);

  const legendEntries = useMemo(
    () =>
      Object.entries(COLOR_SCALE).map(([label, swatch]) => ({
        label,
        swatch
      })),
    []
  );

  return (
    <div className="app">
      <LeafletMap votes={SAMPLE_VOTES} onStatusChange={handleStatusChange} />
      <aside className="map-overlay">
        <h1>Phase 0 · Static Rollcall</h1>
        <p>
          Rendering NYC council districts from TopoJSON using Leaflet. Sample vote data highlights
          five districts across three statuses.
        </p>
        <section className="legend" aria-label="Vote legend">
          {legendEntries.map((item) => (
            <div className="legend-item" key={item.label}>
              <span className="legend-swatch" style={{ backgroundColor: item.swatch }} />
              {item.label}
            </div>
          ))}
        </section>
        <section className="status" aria-live="polite">
          <div>Dataset: {SAMPLE_VOTE_SET.label}</div>
          <div>
            Map:{' '}
            {status.type === 'error'
              ? 'Error loading districts'
              : status.type === 'ready'
                ? 'Ready'
                : status.type === 'loading'
                  ? 'Loading districts…'
                  : 'Idle'}
          </div>
          {status.type === 'error' ? (
            <div className="status status--error">{status.message}</div>
          ) : null}
        </section>
      </aside>
    </div>
  );
};

export default App;
