import type { VoteStatus } from './types';

export const SAMPLE_VOTE_SET = {
  id: 'phase-0-static-demo',
  label: 'Static Sample Rollcall',
  createdAt: '2024-01-01T00:00:00Z'
};

export const SAMPLE_VOTES: Record<string, VoteStatus> = {
  '1': 'Yes',
  '2': 'No',
  '3': 'Abstain',
  '4': 'Yes',
  '5': 'Missing'
};
