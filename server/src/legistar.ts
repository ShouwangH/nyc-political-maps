import { setTimeout as delay } from 'node:timers/promises';
import {
  LEGISTAR_BASE_URL,
  LEGISTAR_TOKEN,
  REQUEST_TIMEOUT_MS
} from './config';

type QueryParams = Record<string, string | number | undefined>;

interface RequestOptions {
  query?: QueryParams;
  allowNotFound?: boolean;
  retry?: number;
}

class LegistarRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'LegistarRequestError';
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!LEGISTAR_TOKEN) {
    throw new LegistarRequestError('Legistar token is not configured', 401);
  }

  const { query, allowNotFound = false, retry = 0 } = options;
  const url = new URL(
    path.startsWith('/') ? `${LEGISTAR_BASE_URL}${path}` : `${LEGISTAR_BASE_URL}/${path}`
  );
  const params = new URLSearchParams();
  params.set('token', LEGISTAR_TOKEN);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      params.set(key, String(value));
    }
  }
  url.search = params.toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });

    if (response.status === 404 && allowNotFound) {
      return null as T;
    }

    if (!response.ok) {
      const text = await response.text();
      if (retry < 2 && response.status >= 500) {
        await delay(200 * (retry + 1));
        return request<T>(path, { query, allowNotFound, retry: retry + 1 });
      }
      throw new LegistarRequestError(
        `Legistar request failed (${response.status}) ${text || ''}`.trim(),
        response.status
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof LegistarRequestError) {
      throw error;
    }
    if ((error as Error).name === 'AbortError') {
      throw new LegistarRequestError('Legistar request timed out', 504);
    }
    throw new LegistarRequestError(
      `Legistar request error: ${(error as Error).message}`,
      500
    );
  } finally {
    clearTimeout(timeout);
  }
}

export interface LegistarMatter {
  MatterId: number;
  MatterFile: string | null;
  MatterName: string | null;
  MatterTitle: string | null;
  MatterStatusName: string | null;
  MatterPassedDate: string | null;
}

export interface LegistarMatterHistory {
  MatterHistoryId: number;
  MatterHistoryEventId: number | null;
  MatterHistoryRollCallFlag: number;
  MatterHistoryActionDate: string | null;
}

export interface LegistarEventItem {
  EventItemId: number;
  EventItemMatterId: number | null;
  EventItemMatterFile: string | null;
  EventItemMatterName: string | null;
  EventItemRollCallFlag: number;
}

export interface LegistarRollCall {
  RollCallId: number;
  RollCallPersonId: number | null;
  RollCallPersonName: string | null;
  RollCallValueName: string | null;
  RollCallResult: number | null;
}

export interface LegistarOfficeRecord {
  OfficeRecordId: number;
  OfficeRecordPersonId: number;
  OfficeRecordFirstName: string | null;
  OfficeRecordLastName: string | null;
  OfficeRecordFullName: string | null;
  OfficeRecordStartDate: string | null;
  OfficeRecordEndDate: string | null;
  OfficeRecordMemberType: string | null;
  OfficeRecordExtraText: string | null;
}

export interface LegistarEvent {
  EventId: number;
  EventBodyName: string | null;
  EventDate: string | null;
}

export async function fetchMatters(
  top: number,
  skip = 0
): Promise<LegistarMatter[]> {
  return request<LegistarMatter[]>('/Matters', {
    query: {
      $top: top,
      $skip: skip,
      $orderby: 'MatterIntroDate desc'
    }
  });
}

export async function fetchMatter(
  matterId: number
): Promise<LegistarMatter | null> {
  return request<LegistarMatter | null>(`/Matters/${matterId}`, {
    allowNotFound: true
  });
}

export async function fetchMatterHistories(
  matterId: number
): Promise<LegistarMatterHistory[]> {
  return request<LegistarMatterHistory[]>(`/Matters/${matterId}/Histories`);
}

export async function fetchEvent(
  eventId: number
): Promise<LegistarEvent | null> {
  return request<LegistarEvent | null>(`/events/${eventId}`, {
    allowNotFound: true
  });
}

export async function fetchEventItems(
  eventId: number
): Promise<LegistarEventItem[]> {
  return request<LegistarEventItem[]>(`/events/${eventId}/eventitems`);
}

export async function fetchRollCalls(
  eventItemId: number
): Promise<LegistarRollCall[]> {
  return request<LegistarRollCall[]>(`/eventitems/${eventItemId}/rollcalls`);
}

export async function fetchOfficeRecords(): Promise<LegistarOfficeRecord[]> {
  return request<LegistarOfficeRecord[]>(`/Bodies/1/OfficeRecords`);
}

export async function fetchEventsSince(startDate: string): Promise<LegistarEvent[]> {
  return request<LegistarEvent[]>(`/events`, {
    query: { startdate: startDate }
  });
}
