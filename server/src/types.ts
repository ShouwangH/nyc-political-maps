export type VoteStatus = 'Yes' | 'No' | 'Abstain' | 'Missing';

export interface NormalizedIssue {
  matterId: number;
  matterFile: string;
  name: string;
  title: string | null;
  status: string;
  passedDate: string | null;
  eventId: number;
  eventDate: string | null;
}

export interface RollCallVote {
  personId: number;
  personName: string;
  district: string | null;
  vote: VoteStatus;
  rawValue: string;
}

export interface VoteDistribution {
  districts: Record<string, VoteStatus>;
  rollCall: RollCallVote[];
  updatedAt: string;
}

export interface IssueVotesResponse {
  issue: NormalizedIssue;
  votes: VoteDistribution;
}

export interface IntroductionRecord {
  ID: number;
  File?: string | null;
  Name?: string | null;
  Title?: string | null;
  StatusName?: string | null;
  PassedDate?: string | null;
  History?: IntroductionHistoryEntry[] | null;
}

export interface IntroductionHistoryEntry {
  ID?: number;
  Date?: string | null;
  Action?: string | null;
  BodyName?: string | null;
  EventID?: number | null;
  Votes?: IntroductionVoteEntry[] | null;
}

export interface IntroductionVoteEntry {
  ID?: number;
  Slug?: string | null;
  FullName?: string | null;
  VoteID?: number | null;
  Vote?: string | null;
  Result?: number | null;
  Sort?: number | null;
}
