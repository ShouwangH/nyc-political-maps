import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

const STATIC_VOTE_SET = {
  issueId: 'phase-0-static-demo',
  label: 'Static Sample Rollcall',
  updatedAt: '2024-01-01T00:00:00Z'
} as const;

const STATIC_VOTES: Record<string, 'Yes' | 'No' | 'Abstain' | 'Missing'> = {
  '1': 'Yes',
  '2': 'No',
  '3': 'Abstain',
  '4': 'Yes',
  '5': 'Missing'
};

// Serve the TopoJSON asset so the client can load it without bundler assistance.
const currentDir = dirname(fileURLToPath(import.meta.url));
const dataDirectory = join(currentDir, '../../public/data');
app.use('/data', express.static(dataDirectory));

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', phase: 0, timestamp: new Date().toISOString() });
});

app.get('/api/phase0/sample-votes', (_req, res) => {
  res.json({
    meta: STATIC_VOTE_SET,
    votes: STATIC_VOTES
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Phase 0 server listening on http://localhost:${PORT}`);
});
