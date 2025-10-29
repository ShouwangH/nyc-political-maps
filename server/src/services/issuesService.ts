import {
  ISSUE_CACHE_TTL_MS,
  VOTE_CACHE_TTL_MS
} from '../config';
import {
  listIntroductionFiles,
  fetchIntroductionFile,
  type IntroductionFileDescriptor
} from './nycLegislationSource';
import {
  getPersonDistrictMap,
  listDistrictIds
} from './districtService';
import type {
  IntroductionHistoryEntry,
  IntroductionRecord,
  IntroductionVoteEntry,
  IssueVotesResponse,
  NormalizedIssue,
  RollCallVote,
  VoteDistribution,
  VoteStatus
} from '../types';

const INTRODUCTION_YEARS = [2025, 2024, 2023, 2022];
const ISSUE_LIMIT = 10;

interface IssueDetail extends NormalizedIssue {
  sourceYear: number;
  sourceFile: string;
  sourceDownloadUrl: string;
}

let issuesCache: { expiresAt: number; data: IssueDetail[] } | null = null;
const issueIndex = new Map<number, IssueDetail>();
const introductionCache = new Map<number, { expiresAt: number; data: IntroductionRecord }>();
const voteCache = new Map<number, { expiresAt: number; data: IssueVotesResponse }>();

export async function listIssues(): Promise<NormalizedIssue[]> {
  const issues = await loadIssues();
  return issues.map(toPublicIssue);
}

export async function getIssueVotes(matterId: number): Promise<IssueVotesResponse> {
  const now = Date.now();
  const cached = voteCache.get(matterId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const detail = await ensureIssueDetail(matterId);
  const introduction = await loadIntroductionRecord(detail);
  const voteEntry = selectLatestVoteEntry(introduction);

  if (!voteEntry) {
    throw new Error('No roll-call vote recorded for the selected matter.');
  }

  const districtMap = await getPersonDistrictMap();
  const distribution = buildVoteDistribution(voteEntry, districtMap);

  const response: IssueVotesResponse = {
    issue: toPublicIssue(detail),
    votes: distribution
  };

  voteCache.set(matterId, {
    data: response,
    expiresAt: now + VOTE_CACHE_TTL_MS
  });

  return response;
}

async function loadIssues(): Promise<IssueDetail[]> {
  const now = Date.now();
  if (issuesCache && issuesCache.expiresAt > now) {
    return issuesCache.data;
  }

  introductionCache.clear();
  const issues = await fetchIssuesFromGitHub(ISSUE_LIMIT);
  if (!issues.length) {
    throw new Error('No roll-call votes could be retrieved from the nyc_legislation dataset.');
  }

  issuesCache = {
    data: issues,
    expiresAt: now + ISSUE_CACHE_TTL_MS
  };

  issueIndex.clear();
  issues.forEach((issue) => issueIndex.set(issue.matterId, issue));

  return issues;
}

async function ensureIssueDetail(matterId: number): Promise<IssueDetail> {
  let detail = issueIndex.get(matterId);
  if (detail) {
    return detail;
  }

  await loadIssues();
  detail = issueIndex.get(matterId);

  if (!detail) {
    throw new Error(`Matter ${matterId} is not available in the cached dataset.`);
  }

  return detail;
}

async function fetchIssuesFromGitHub(limit: number): Promise<IssueDetail[]> {
  const collected: IssueDetail[] = [];

  for (const year of INTRODUCTION_YEARS) {
    try {
      const files = await listIntroductionFiles(year);
      const sorted = files
        .filter((entry) => entry.name.endsWith('.json'))
        .sort((a, b) => parseInt(b.name, 10) - parseInt(a.name, 10));

      for (const file of sorted) {
        if (collected.length >= limit) {
          break;
        }

        try {
          const record = await fetchIntroductionFile(file);
          const voteEntry = selectLatestVoteEntry(record);
          if (!voteEntry) {
            continue;
          }

          const detail = buildIssueDetail(record, voteEntry, year, file);
          collected.push(detail);
          introductionCache.set(record.ID, {
            data: record,
            expiresAt: Date.now() + ISSUE_CACHE_TTL_MS
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('[issues] Failed to read introduction', year, file.name, error);
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[issues] Failed to list introductions for', year, error);
    }

    if (collected.length >= limit) {
      break;
    }
  }

  return collected;
}

function buildIssueDetail(
  record: IntroductionRecord,
  voteEntry: IntroductionHistoryEntry,
  year: number,
  file: IntroductionFileDescriptor
): IssueDetail {
  return {
    matterId: record.ID,
    matterFile: record.File ?? `Intro ${record.ID}`,
    name: record.Name ?? record.Title ?? record.File ?? `Matter ${record.ID}`,
    title: record.Title ?? record.Name ?? null,
    status: record.StatusName ?? 'Unknown',
    passedDate: record.PassedDate ?? voteEntry.Date ?? null,
    eventId: typeof voteEntry.EventID === 'number' ? voteEntry.EventID : 0,
    eventDate: voteEntry.Date ?? record.PassedDate ?? null,
    sourceYear: year,
    sourceFile: file.name,
    sourceDownloadUrl: file.downloadUrl
  };
}

function toPublicIssue(detail: IssueDetail): NormalizedIssue {
  const { sourceYear, sourceFile, sourceDownloadUrl, ...rest } = detail;
  return rest;
}

async function loadIntroductionRecord(detail: IssueDetail): Promise<IntroductionRecord> {
  const cached = introductionCache.get(detail.matterId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const descriptor: IntroductionFileDescriptor = {
    name: detail.sourceFile,
    downloadUrl: detail.sourceDownloadUrl
  };

  const record = await fetchIntroductionFile(descriptor);
  introductionCache.set(detail.matterId, {
    data: record,
    expiresAt: now + ISSUE_CACHE_TTL_MS
  });

  return record;
}

function selectLatestVoteEntry(
  record: IntroductionRecord
): (IntroductionHistoryEntry & { Votes: IntroductionVoteEntry[] }) | null {
  const history = Array.isArray(record.History) ? record.History : [];
  if (!history.length) {
    return null;
  }

  const reversed = [...history].reverse();

  for (const entry of reversed) {
    if (hasVotes(entry) && bodyIsCouncil(entry)) {
      return entry;
    }
  }

  for (const entry of reversed) {
    if (hasVotes(entry)) {
      return entry;
    }
  }

  return null;
}

function hasVotes(entry: IntroductionHistoryEntry): entry is IntroductionHistoryEntry & {
  Votes: IntroductionVoteEntry[];
} {
  return Array.isArray(entry.Votes) && entry.Votes.length > 0;
}

function bodyIsCouncil(entry: IntroductionHistoryEntry): boolean {
  return (entry.BodyName ?? '').toLowerCase().includes('city council');
}

function buildVoteDistribution(
  voteEntry: IntroductionHistoryEntry & { Votes: IntroductionVoteEntry[] },
  districtMap: Map<number, string>
): VoteDistribution {
  const districts: Record<string, VoteStatus> = {};
  for (const id of listDistrictIds()) {
    districts[id] = 'Missing';
  }

  const rollCall: RollCallVote[] = voteEntry.Votes.map((vote) => {
    const personId = typeof vote.ID === 'number' ? vote.ID : -1;
    const resolvedVote = normalizeVote(vote.Vote);
    const district = personId >= 0 ? districtMap.get(personId) ?? null : null;

    if (district && resolvedVote !== 'Missing') {
      districts[district] = resolvedVote;
    }

    return {
      personId,
      personName: vote.FullName ?? 'Unknown',
      district,
      vote: resolvedVote,
      rawValue: vote.Vote ?? 'Unknown'
    };
  });

  return {
    districts,
    rollCall,
    updatedAt: new Date().toISOString()
  };
}

function normalizeVote(value: string | null | undefined): VoteStatus {
  if (!value) {
    return 'Missing';
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized.includes('affirmative') ||
    normalized === 'approved' ||
    normalized === 'in favor' ||
    normalized === 'yes'
  ) {
    return 'Yes';
  }

  if (
    normalized.includes('negative') ||
    normalized === 'no' ||
    normalized === 'against' ||
    normalized === 'disapproved' ||
    normalized === 'nay'
  ) {
    return 'No';
  }

  if (normalized.includes('abstain') || normalized === 'present') {
    return 'Abstain';
  }

  return 'Missing';
}
