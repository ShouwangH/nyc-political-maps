// ABOUTME: Express server wiring for the NYC vote visualization API and static assets.
// ABOUTME: Inputs = HTTP requests, Outputs = JSON responses and TopoJSON assets.
import express from 'express';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getIssueVotes,
  listIssues
} from './services/issuesService';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

const currentDir = dirname(fileURLToPath(import.meta.url));
const dataDirectory = join(currentDir, '../../public/data');
app.use('/data', express.static(dataDirectory));

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', phase: 2, timestamp: new Date().toISOString() });
});

app.get('/api/issues', async (_req, res) => {
  try {
    const issues = await listIssues();
    res.json({ issues });
  } catch (error) {
    handleError(res, error);
  }
});

app.get('/api/issues/:matterId/votes', async (req, res) => {
  const matterId = Number.parseInt(req.params.matterId, 10);
  if (Number.isNaN(matterId)) {
    res.status(400).json({ error: 'matterId must be a number' });
    return;
  }
  try {
    const payload = await getIssueVotes(matterId);
    res.json(payload);
  } catch (error) {
    handleError(res, error);
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Phase 2 server listening on http://localhost:${PORT}`);
});

function handleError(res: express.Response, error: unknown) {
  // eslint-disable-next-line no-console
  console.error('[api] request failed', error);
  if (error instanceof Error && error.message.includes('not found')) {
    res.status(404).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: 'Internal server error' });
}
