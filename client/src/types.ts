// ABOUTME: Client-side counterparts to server API payloads for issues and votes.
// ABOUTME: Inputs = API JSON responses, Outputs = typed contracts for React components.
export type VoteStatus = 'Yes' | 'No' | 'Abstain' | 'Missing';

export interface IssueSummary {
  matterId: number;
  matterFile: string;
  name: string;
  title: string | null;
  status: string;
  passedDate: string | null;
  eventId: number;
  eventDate: string | null;
}

export interface RollCallEntry {
  personId: number;
  personName: string;
  personSlug?: string | null;
  district: string | null;
  vote: VoteStatus;
  rawValue: string;
  isSponsor: boolean;
  memberUrl: string | null;
}

export interface VoteResponse {
  issue: IssueSummary;
  votes: {
    districts: Record<string, VoteStatus>;
    rollCall: RollCallEntry[];
    districtDetails: Record<string, DistrictDetail>;
    action: VoteActionContext;
    updatedAt: string;
  };
}

export interface DistrictDetail {
  district: string;
  memberId: number;
  memberName: string;
  memberSlug?: string | null;
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
