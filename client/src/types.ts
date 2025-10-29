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
  district: string | null;
  vote: VoteStatus;
  rawValue: string;
}

export interface VoteResponse {
  issue: IssueSummary;
  votes: {
    districts: Record<string, VoteStatus>;
    rollCall: RollCallEntry[];
    updatedAt: string;
  };
}
