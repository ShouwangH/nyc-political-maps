// ABOUTME: Normalizes introduction vote data and exposes API-friendly issue/vote payloads.
// ABOUTME: Inputs = cached GitHub datasets + Legistar mappings, Outputs = issue lists and vote distributions.
import {
  CACHE_MAX_AGE_MS,
  ISSUE_CACHE_TTL_MS,
  VOTE_CACHE_TTL_MS,
  GITHUB_REPO
} from '../config';
import {
  listIntroductionFiles,
  fetchIntroductionFile,
  type IntroductionFileDescriptor
} from './nycLegislationSource';
import {
  readCachedIssuesFile,
  writeCachedIssuesFile,
  type CachedIssueEntry
} from './cacheService';
import {
  getPersonDistrictMap,
  listDistrictIds
} from './districtService';
import {
  getPersonProfileById,
  getPersonProfileBySlug,
  type PersonProfile
} from './personService';
import type {
  IntroductionHistoryEntry,
  IntroductionRecord,
  IntroductionVoteEntry,
  SponsorEntry,
  IssueVotesResponse,
  NormalizedIssue,
  RollCallVote,
  DistrictVoteDetail,
  VoteActionContext,
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
  const voteEntries = getVoteEntries(introduction);

  if (!voteEntries.length) {
    throw new Error('No roll-call vote recorded for the selected matter.');
  }

  const districtMap = await getPersonDistrictMap();
  const sponsorLookup = buildSponsorLookup(introduction);
  const primaryAction = voteEntries[0] ?? null;
  const distribution = await buildVoteDistribution(
    voteEntries,
    districtMap,
    sponsorLookup,
    primaryAction
  );

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

  const cachedFile = await readCachedIssuesFile().catch(() => null);
  if (cachedFile) {
    const fetchedAt = Date.parse(cachedFile.fetched_at ?? '');
    if (!Number.isNaN(fetchedAt) && now - fetchedAt <= CACHE_MAX_AGE_MS) {
      const cachedIssues = buildIssuesFromEntries(
        cachedFile.entries,
        now + ISSUE_CACHE_TTL_MS
      );
      if (cachedIssues.length) {
        issuesCache = {
          data: cachedIssues,
          expiresAt: now + ISSUE_CACHE_TTL_MS
        };
        issueIndex.clear();
        cachedIssues.forEach((issue) => issueIndex.set(issue.matterId, issue));
        return cachedIssues;
      }
    }
  }

  const entries = await fetchIssuesFromGitHub(ISSUE_LIMIT);
  if (!entries.length) {
    throw new Error('No roll-call votes could be retrieved from the nyc_legislation dataset.');
  }

  const issues = buildIssuesFromEntries(entries, now + ISSUE_CACHE_TTL_MS);
  if (!issues.length) {
    throw new Error('Unable to normalize roll-call votes from the nyc_legislation dataset.');
  }

  const fetchedAt = new Date().toISOString();
  const commit = entries.find((entry) => entry.sha)?.sha ?? null;
  await writeCachedIssuesFile({
    source: `https://github.com/${GITHUB_REPO}`,
    fetched_at: fetchedAt,
    commit,
    entries
  }).catch((error) => {
    // eslint-disable-next-line no-console
    console.warn('[issues] Failed to write cache file', error);
  });

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

async function fetchIssuesFromGitHub(limit: number): Promise<CachedIssueEntry[]> {
  const collected: CachedIssueEntry[] = [];

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
          const voteEntries = getVoteEntries(record);
          if (!voteEntries.length) {
            continue;
          }

          collected.push({
            year,
            file: file.name,
            downloadUrl: file.downloadUrl,
            sha: file.sha ?? null,
            record
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
  primaryEntry: IntroductionHistoryEntry & { Votes: IntroductionVoteEntry[] },
  year: number,
  file: IntroductionFileDescriptor
): IssueDetail {
  return {
    matterId: record.ID,
    matterFile: record.File ?? `Intro ${record.ID}`,
    name: record.Name ?? record.Title ?? record.File ?? `Matter ${record.ID}`,
    title: record.Title ?? record.Name ?? null,
    status: record.StatusName ?? 'Unknown',
    passedDate: record.PassedDate ?? primaryEntry.Date ?? null,
    eventId: typeof primaryEntry.EventID === 'number' ? primaryEntry.EventID : 0,
    eventDate: primaryEntry.Date ?? record.PassedDate ?? null,
    sourceYear: year,
    sourceFile: file.name,
    sourceDownloadUrl: file.downloadUrl
  };
}

function buildIssuesFromEntries(
  entries: CachedIssueEntry[],
  introductionExpiry: number
): IssueDetail[] {
  const issues: IssueDetail[] = [];

  for (const entry of entries) {
    const voteEntries = getVoteEntries(entry.record);
    if (!voteEntries.length) {
      continue;
    }

    const descriptor: IntroductionFileDescriptor = {
      name: entry.file,
      downloadUrl: entry.downloadUrl,
      sha: entry.sha ?? null
    };

    const detail = buildIssueDetail(entry.record, voteEntries[0], entry.year, descriptor);
    issues.push(detail);
    introductionCache.set(entry.record.ID, {
      data: entry.record,
      expiresAt: introductionExpiry
    });
  }

  return issues;
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

function getVoteEntries(
  record: IntroductionRecord
): Array<IntroductionHistoryEntry & { Votes: IntroductionVoteEntry[] }> {
  const history = Array.isArray(record.History) ? record.History : [];
  const entries = history.filter(hasVotes) as Array<
    IntroductionHistoryEntry & { Votes: IntroductionVoteEntry[] }
  >;
  return entries.sort(compareVoteEntries);
}

function compareVoteEntries(
  a: IntroductionHistoryEntry,
  b: IntroductionHistoryEntry
): number {
  const priorityA = getEntryPriority(a);
  const priorityB = getEntryPriority(b);
  if (priorityA.tier !== priorityB.tier) {
    return priorityA.tier - priorityB.tier;
  }
  return priorityB.timestamp - priorityA.timestamp;
}

function getEntryPriority(entry: IntroductionHistoryEntry): { tier: number; timestamp: number } {
  const body = (entry.BodyName ?? '').toLowerCase();
  const action = (entry.Action ?? '').toLowerCase();
  const timestamp = parseDate(entry.Date)?.getTime() ?? 0;

  if (body.includes('city council')) {
    return { tier: 0, timestamp };
  }
  if (action.includes('approved by council') || action.includes('adopted by council')) {
    return { tier: 0, timestamp };
  }
  if (body.includes('committee') && action.includes('approved')) {
    return { tier: 1, timestamp };
  }
  if (body.includes('committee')) {
    return { tier: 2, timestamp };
  }
  return { tier: 3, timestamp };
}

function hasVotes(entry: IntroductionHistoryEntry): entry is IntroductionHistoryEntry & {
  Votes: IntroductionVoteEntry[];
} {
  return Array.isArray(entry.Votes) && entry.Votes.length > 0;
}

interface AggregatedVote {
  personId: number;
  slug: string | null;
  fullName: string;
  vote: VoteStatus;
  rawValue: string;
}

interface SponsorLookup {
  ids: Set<number>;
  slugs: Set<string>;
  names: Set<string>;
}

function aggregateVotes(
  entries: Array<IntroductionHistoryEntry & { Votes: IntroductionVoteEntry[] }>
): AggregatedVote[] {
  const aggregated = new Map<string, {
    personId: number;
    slug: string | null;
    fullName: string;
    vote: VoteStatus;
    rawValue: string;
  }>();

  for (const entry of entries) {
    for (const vote of entry.Votes) {
      const key = getVoteKey(vote);
      if (!key) {
        continue;
      }

      if (aggregated.has(key)) {
        continue;
      }

      aggregated.set(key, {
        personId: typeof vote.ID === 'number' ? vote.ID : -1,
        slug: vote.Slug ?? null,
        fullName: vote.FullName ?? 'Unknown',
        vote: normalizeVote(vote.Vote),
        rawValue: vote.Vote ?? 'Unknown'
      });
    }
  }

  return Array.from(aggregated.values());
}

function getVoteKey(vote: IntroductionVoteEntry): string | null {
  if (typeof vote.ID === 'number') {
    return `id:${vote.ID}`;
  }
  if (vote.Slug) {
    return `slug:${vote.Slug}`;
  }
  if (vote.FullName) {
    return `name:${vote.FullName.toLowerCase()}`;
  }
  return null;
}

function buildSponsorLookup(record: IntroductionRecord): SponsorLookup {
  const sponsors = Array.isArray(record.Sponsors) ? record.Sponsors : [];
  const ids = new Set<number>();
  const slugs = new Set<string>();
  const names = new Set<string>();

  for (const sponsor of sponsors) {
    if (typeof sponsor.ID === 'number') {
      ids.add(sponsor.ID);
    }
    if (sponsor.Slug) {
      slugs.add(sponsor.Slug.trim().toLowerCase());
    }
    if (sponsor.FullName) {
      names.add(sponsor.FullName.trim().toLowerCase());
    }
  }

  return { ids, slugs, names };
}

async function resolvePersonProfile(vote: AggregatedVote): Promise<PersonProfile | null> {
  if (vote.personId >= 0) {
    const profile = await getPersonProfileById(vote.personId, vote.slug);
    if (profile) {
      return profile;
    }
  }
  if (vote.slug) {
    return getPersonProfileBySlug(vote.slug);
  }
  return null;
}

function isSponsorVote(
  vote: AggregatedVote,
  lookup: SponsorLookup,
  memberSlug: string | null,
  memberName: string,
  personId: number
): boolean {
  if (personId >= 0 && lookup.ids.has(personId)) {
    return true;
  }
  if (memberSlug && lookup.slugs.has(memberSlug.trim().toLowerCase())) {
    return true;
  }
  const normalizedVoteSlug = vote.slug ? vote.slug.trim().toLowerCase() : null;
  if (normalizedVoteSlug && lookup.slugs.has(normalizedVoteSlug)) {
    return true;
  }
  const normalizedName = memberName?.trim().toLowerCase();
  if (normalizedName && lookup.names.has(normalizedName)) {
    return true;
  }
  const normalizedVoteName = vote.fullName.trim().toLowerCase();
  return lookup.names.has(normalizedVoteName);
}

function buildDistrictUrl(district: string | null): string | null {
  if (!district) {
    return null;
  }
  const normalized = district.trim();
  if (!normalized) {
    return null;
  }
  return `https://council.nyc.gov/district-${normalized}`;
}

function buildActionContext(
  entry: (IntroductionHistoryEntry & { Votes: IntroductionVoteEntry[] }) | null
): VoteActionContext {
  if (!entry) {
    return {
      name: null,
      body: null,
      date: null
    };
  }
  return {
    name: entry.Action ?? null,
    body: entry.BodyName ?? null,
    date: entry.Date ?? null
  };
}

async function buildVoteDistribution(
  voteEntries: Array<IntroductionHistoryEntry & { Votes: IntroductionVoteEntry[] }>,
  districtMap: Map<number, string>,
  sponsorLookup: SponsorLookup,
  actionEntry: (IntroductionHistoryEntry & { Votes: IntroductionVoteEntry[] }) | null
): Promise<VoteDistribution> {
  const aggregatedVotes = aggregateVotes(voteEntries);
  const profiles = await Promise.all(
    aggregatedVotes.map((vote) => resolvePersonProfile(vote))
  );

  const districts: Record<string, VoteStatus> = {};
  const districtDetails: Record<string, DistrictVoteDetail> = {};
  for (const id of listDistrictIds()) {
    districts[id] = 'Missing';
  }

  const rollCall: RollCallVote[] = [];

  aggregatedVotes.forEach((vote, index) => {
    const profile = profiles[index];
    const normalizedId = profile?.personId ?? vote.personId;
    const memberName = profile?.fullName ?? vote.fullName;
    const memberSlug = profile?.slug ?? vote.slug ?? null;
    const memberUrl = profile?.www ?? null;
    const district = normalizedId >= 0 ? districtMap.get(normalizedId) ?? null : null;
    const sponsor = isSponsorVote(vote, sponsorLookup, memberSlug, memberName, normalizedId);

    if (district && vote.vote !== 'Missing') {
      districts[district] = vote.vote;
    }

    const detail: DistrictVoteDetail = {
      district: district ?? 'Unknown',
      memberId: normalizedId,
      memberName,
      memberSlug,
      memberUrl: memberUrl ?? buildDistrictUrl(district),
      vote: vote.vote,
      rawValue: vote.rawValue,
      isSponsor: sponsor
    };

    if (district) {
      districtDetails[district] = detail;
    }

    rollCall.push({
      personId: normalizedId,
      personName: memberName,
      personSlug: memberSlug,
      memberUrl: detail.memberUrl,
      isSponsor: sponsor,
      district,
      vote: vote.vote,
      rawValue: vote.rawValue
    });
  });

  return {
    districts,
    rollCall,
    districtDetails,
    action: buildActionContext(actionEntry),
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
    normalized.includes('approved') ||
    normalized.includes('adopted') ||
    normalized === 'in favor' ||
    normalized === 'yes'
  ) {
    return 'Yes';
  }

  if (
    normalized.includes('negative') ||
    normalized.includes('disapproved') ||
    normalized === 'no' ||
    normalized === 'against' ||
    normalized === 'nay'
  ) {
    return 'No';
  }

  if (
    normalized.includes('abstain') ||
    normalized.includes('recuse') ||
    normalized.includes('conflict')
  ) {
    return 'Abstain';
  }

  if (
    normalized.includes('present') ||
    normalized.includes('absent') ||
    normalized.includes('medical') ||
    normalized.includes('parental') ||
    normalized.includes('bereavement') ||
    normalized.includes('excused') ||
    normalized.includes('maternity') ||
    normalized.includes('jury duty')
  ) {
    return 'Missing';
  }

  return 'Missing';
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time);
}
