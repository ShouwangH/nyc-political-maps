// ABOUTME: Shared TypeScript interfaces for server-side data models and external payloads.
// ABOUTME: Inputs = none (type definitions), Outputs = reusable type aliases for services.
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
  personSlug: string | null;
  memberUrl: string | null;
  isSponsor: boolean;
  district: string | null;
  vote: VoteStatus;
  rawValue: string;
}

export interface DistrictVoteDetail {
  district: string;
  memberId: number;
  memberName: string;
  memberSlug: string | null;
  memberUrl: string | null;
  vote: VoteStatus;
  rawValue: string;
  isSponsor: boolean;
}

export interface VoteActionContext {
  name: string | null;
  body: string | null;
  date: string | null;
}

export interface VoteDistribution {
  districts: Record<string, VoteStatus>;
  rollCall: RollCallVote[];
  districtDetails: Record<string, DistrictVoteDetail>;
  action: VoteActionContext;
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
  Sponsors?: SponsorEntry[] | null;
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

export interface SponsorEntry {
  ID?: number | null;
  Slug?: string | null;
  FullName?: string | null;
}

export interface PersonRecord {
  ID?: number | null;
  Slug?: string | null;
  FullName?: string | null;
  WWW?: string | null;
  Email?: string | null;
}
