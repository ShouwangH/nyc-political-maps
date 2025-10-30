import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { LeafletMap, type MapLoadState } from './components/LeafletMap';
import Legend, { buildLegendEntries } from './components/Legend';
import type {
  DistrictDetail,
  IssueSummary,
  VoteActionContext,
  VoteResponse,
  VoteStatus
} from './types';

type AsyncState = 'idle' | 'loading' | 'ready' | 'error';

const DISTRICT_IDS = Array.from({ length: 51 }, (_, index) => String(index + 1));
const VOTE_COLOR_SCALE: Record<VoteStatus, string> = {
  Yes: '#2e8540',
  No: '#c22',
  Abstain: '#d4a017',
  Missing: '#777'
};

const App = () => {
  const [mapStatus, setMapStatus] = useState<MapLoadState>({ type: 'idle' });
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [issuesState, setIssuesState] = useState<AsyncState>('idle');
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [selectedMatterId, setSelectedMatterId] = useState<number | null>(null);

  const [votesState, setVotesState] = useState<AsyncState>('idle');
  const [votesError, setVotesError] = useState<string | null>(null);
  const [districtVotes, setDistrictVotes] = useState<Record<string, VoteStatus>>(
    createEmptyDistrictVotes()
  );
  const [districtDetails, setDistrictDetails] = useState<Record<string, DistrictDetail>>({});
  const [actionContext, setActionContext] = useState<VoteActionContext | null>(null);
  const [selectedIssueMeta, setSelectedIssueMeta] = useState<IssueSummary | null>(null);

  useEffect(() => {
    const fetchIssues = async () => {
      setIssuesState('loading');
      setIssuesError(null);
      try {
        const response = await fetch('/api/issues');
        if (!response.ok) {
          throw new Error(`Failed to fetch issues (${response.status})`);
        }
        const payload: { issues: IssueSummary[] } = await response.json();
        if (!payload.issues.length) {
          throw new Error('No issues with roll-call votes found.');
        }
        setIssues(payload.issues);
        setIssuesState('ready');
        const initial = payload.issues[0];
        setSelectedMatterId(initial.matterId);
        setSelectedIssueMeta(initial);
      } catch (error) {
        setIssuesState('error');
        setIssuesError(error instanceof Error ? error.message : 'Unexpected error');
      }
    };
    fetchIssues();
  }, []);

  useEffect(() => {
    const matterId = selectedMatterId;
    if (!matterId) {
      return;
    }
    const controller = new AbortController();
    const fetchVotes = async () => {
      setVotesState('loading');
      setVotesError(null);
      setDistrictVotes(createEmptyDistrictVotes());
      setDistrictDetails({});
      setActionContext(null);
      try {
        const response = await fetch(`/api/issues/${matterId}/votes`, {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch votes (${response.status})`);
        }
        const payload: VoteResponse = await response.json();
        setDistrictVotes(mergeWithDefault(payload.votes.districts));
        setDistrictDetails(payload.votes.districtDetails ?? {});
        setActionContext(payload.votes.action ?? null);
        setSelectedIssueMeta(payload.issue);
        setVotesState('ready');
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setVotesState('error');
        setVotesError(error instanceof Error ? error.message : 'Unexpected error');
      }
    };
    fetchVotes();
    return () => controller.abort();
  }, [selectedMatterId]);

  const handleMapStatus = (state: MapLoadState) => {
    setMapStatus(state);
  };

  const handleIssueChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(value)) {
      return;
    }
    setSelectedMatterId(value);
  };

  const selectedIssue = useMemo(
    () => issues.find((issue) => issue.matterId === selectedMatterId) ?? selectedIssueMeta,
    [issues, selectedMatterId, selectedIssueMeta]
  );

  const statusMessage = buildStatusMessage({ issuesState, votesState, mapStatus, issuesError, votesError });
  const legendEntries = useMemo(() => buildLegendEntries(VOTE_COLOR_SCALE), []);
  const isIssuesLoading = issuesState === 'loading';

  return (
    <div className="app">
      <LeafletMap
        votes={districtVotes}
        districtDetails={districtDetails}
        action={actionContext}
        onStatusChange={handleMapStatus}
      />
      <aside className="map-control-panel">
        <header>
          <h1>NYC Council Roll Calls</h1>
          <p>Choose a recently voted matter to recolor districts by council member vote.</p>
        </header>
        <label htmlFor="issue-select">Issue</label>
        <select
          id="issue-select"
          value={selectedMatterId ?? ''}
          onChange={handleIssueChange}
          disabled={isIssuesLoading || !issues.length}
          aria-busy={isIssuesLoading}
        >
          {issues.length === 0 ? (
            <option value="" disabled>
              {issuesState === 'error' ? 'Failed to load issues' : 'Loading issues…'}
            </option>
          ) : null}
          {issues.map((issue) => (
            <option key={issue.matterId} value={issue.matterId}>
              {issue.matterFile} · {issue.name}
            </option>
          ))}
        </select>

        <section className="issue-meta">
          <div>
            <span className="label">Status</span>
            <span>{selectedIssue?.status ?? '—'}</span>
          </div>
          <div>
            <span className="label">Vote date</span>
            <span>{formatDate(selectedIssue?.eventDate)}</span>
          </div>
          <div>
            <span className="label">Matter ID</span>
            <span>{selectedIssue?.matterId ?? '—'}</span>
          </div>
        </section>

        <section className={`status-line status-line--${statusMessage.variant}`} aria-live="polite">
          {statusMessage.text}
        </section>

        <Legend entries={legendEntries} />

        <footer className="data-source" aria-live="polite">
          <strong>Data:</strong>{' '}
          <a
            href="https://github.com/jehiah/nyc_legislation"
            target="_blank"
            rel="noreferrer"
          >
            intro.nyc mirror
          </a>{' '}
          · cached locally · refreshed &lt; 24h
        </footer>
      </aside>
    </div>
  );
};

export default App;

function createEmptyDistrictVotes(): Record<string, VoteStatus> {
  const map: Record<string, VoteStatus> = {};
  for (const id of DISTRICT_IDS) {
    map[id] = 'Missing';
  }
  return map;
}

function mergeWithDefault(source: Record<string, VoteStatus>): Record<string, VoteStatus> {
  const base = createEmptyDistrictVotes();
  for (const [district, status] of Object.entries(source)) {
    if (district in base) {
      base[district] = status;
    }
  }
  return base;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function buildStatusMessage({
  issuesState,
  votesState,
  mapStatus,
  issuesError,
  votesError
}: {
  issuesState: AsyncState;
  votesState: AsyncState;
  mapStatus: MapLoadState;
  issuesError: string | null;
  votesError: string | null;
}): { text: string; variant: 'info' | 'error' } {
  if (issuesState === 'error') {
    return { text: issuesError ?? 'Failed to load issues.', variant: 'error' };
  }
  if (votesState === 'error') {
    return { text: votesError ?? 'Failed to load vote data.', variant: 'error' };
  }
  if (mapStatus.type === 'error') {
    return { text: mapStatus.message, variant: 'error' };
  }
  if (issuesState === 'loading') {
    return { text: 'Loading recent council matters…', variant: 'info' };
  }
  if (votesState === 'loading') {
    return { text: 'Fetching roll-call votes…', variant: 'info' };
  }
  if (mapStatus.type === 'loading') {
    return { text: 'Preparing district geometries…', variant: 'info' };
  }
  return { text: 'Data ready. Select a different matter to compare votes.', variant: 'info' };
}
