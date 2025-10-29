import {
  DISTRICT_CACHE_TTL_MS
} from '../config';
import {
  fetchOfficeRecords,
  LegistarOfficeRecord
} from '../legistar';

export type PersonDistrictMap = Map<number, string>;

const DISTRICT_REGEX = /District\s+(\d+)/i;
const DISTRICT_IDS = Array.from({ length: 51 }, (_, index) => String(index + 1));

let cachedMap: { expiresAt: number; map: PersonDistrictMap } | null = null;

export function listDistrictIds(): string[] {
  return DISTRICT_IDS;
}

export async function getPersonDistrictMap(): Promise<PersonDistrictMap> {
  const now = Date.now();
  if (cachedMap && cachedMap.expiresAt > now) {
    return cachedMap.map;
  }

  const records = await fetchOfficeRecords();
  const byPerson = new Map<number, { district: string; start: number; end: number }>();

  for (const record of records) {
    const district = extractDistrict(record);
    if (!district) continue;
    const personId = record.OfficeRecordPersonId;
    const start = parseDate(record.OfficeRecordStartDate) ?? 0;
    const end = parseDate(record.OfficeRecordEndDate) ?? Number.POSITIVE_INFINITY;
    const existing = byPerson.get(personId);

    if (!existing || start >= existing.start) {
      byPerson.set(personId, { district, start, end });
    }
  }

  const map: PersonDistrictMap = new Map();
  for (const [personId, info] of byPerson.entries()) {
    map.set(personId, info.district);
  }

  cachedMap = {
    map,
    expiresAt: now + DISTRICT_CACHE_TTL_MS
  };

  return map;
}

function parseDate(value: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

function extractDistrict(record: LegistarOfficeRecord): string | null {
  if (!record.OfficeRecordMemberType?.toLowerCase().includes('primary')) {
    return null;
  }
  const text = record.OfficeRecordExtraText ?? '';
  const match = text.match(DISTRICT_REGEX);
  if (!match) return null;
  return match[1].trim();
}
