// ABOUTME: Loads and caches council member metadata from the nyc_legislation people dataset.
// ABOUTME: Inputs = member slug or ID, Outputs = normalized profile with URL for tooltips.
import {
  PEOPLE_CACHE_TTL_MS,
  GITHUB_REPO
} from '../config';
import {
  readCachedPeopleFile,
  writeCachedPeopleFile,
  type CachedPeopleFile,
  type CachedPersonEntry
} from './cacheService';
import {
  fetchPersonFile,
  getPersonDescriptor,
  type PersonFileDescriptor
} from './nycLegislationSource';
import type { PersonRecord } from '../types';

export interface PersonProfile {
  personId: number | null;
  slug: string;
  fullName: string;
  www: string | null;
}

const memoryCache = new Map<string, { expiresAt: number; profile: PersonProfile }>();
const personIdToSlug = new Map<number, string>();
let cachedPeopleFile: CachedPeopleFile | null = null;
let cacheLoaded = false;

export async function getPersonProfileBySlug(slug: string | null | undefined): Promise<PersonProfile | null> {
  const normalized = normalizeSlug(slug);
  if (!normalized) {
    return null;
  }

  const now = Date.now();
  const cached = memoryCache.get(normalized);
  if (cached && cached.expiresAt > now) {
    return cached.profile;
  }

  await ensureCacheLoaded();
  const fileEntry = getCachedPersonEntry(normalized);
  if (fileEntry) {
    const profile = toProfileFromEntry(fileEntry);
    rememberProfile(normalized, profile, now);
    return profile;
  }

  const descriptor = await getPersonDescriptor(normalized);
  if (!descriptor) {
    return null;
  }

  try {
    const record = await fetchPersonFile(descriptor);
    const profile = toProfileFromRecord(record, normalized);
    await persistProfile(normalized, descriptor, profile);
    rememberProfile(normalized, profile, now);
    return profile;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[people] Failed to fetch profile for', normalized, error);
    return null;
  }
}

export async function getPersonProfileById(
  personId: number,
  fallbackSlug?: string | null
): Promise<PersonProfile | null> {
  if (personId <= 0) {
    return getPersonProfileBySlug(fallbackSlug);
  }

  const knownSlug = personIdToSlug.get(personId);
  if (knownSlug) {
    const profile = await getPersonProfileBySlug(knownSlug);
    if (profile) {
      return profile;
    }
  }

  const fallbackProfile = await getPersonProfileBySlug(fallbackSlug);
  if (fallbackProfile && fallbackProfile.personId && fallbackProfile.personId > 0) {
    personIdToSlug.set(fallbackProfile.personId, fallbackProfile.slug);
  } else if (fallbackProfile && personId > 0) {
    personIdToSlug.set(personId, fallbackProfile.slug);
  }
  return fallbackProfile;
}

async function ensureCacheLoaded(): Promise<void> {
  if (cacheLoaded) {
    return;
  }
  cachedPeopleFile = await readCachedPeopleFile();
  cacheLoaded = true;

  if (cachedPeopleFile?.people) {
    for (const entry of Object.values(cachedPeopleFile.people)) {
      if (entry.personId && entry.personId > 0) {
        personIdToSlug.set(entry.personId, normalizeSlug(entry.slug) ?? entry.slug);
      }
    }
  }
}

function getCachedPersonEntry(slug: string): CachedPersonEntry | null {
  if (!cachedPeopleFile?.people) {
    return null;
  }
  const entry = cachedPeopleFile.people[slug];
  return entry ?? null;
}

function rememberProfile(slug: string, profile: PersonProfile, now: number) {
  memoryCache.set(slug, {
    profile,
    expiresAt: now + PEOPLE_CACHE_TTL_MS
  });
  if (profile.personId && profile.personId > 0) {
    personIdToSlug.set(profile.personId, slug);
  }
}

async function persistProfile(
  slug: string,
  descriptor: PersonFileDescriptor,
  profile: PersonProfile
): Promise<void> {
  const nowIso = new Date().toISOString();
  const entry: CachedPersonEntry = {
    slug: profile.slug,
    personId: profile.personId,
    fullName: profile.fullName,
    www: profile.www,
    source_file: `people/${descriptor.name}`,
    sha: descriptor.sha ?? null,
    fetched_at: nowIso
  };

  if (!cachedPeopleFile) {
    cachedPeopleFile = {
      source: `https://github.com/${GITHUB_REPO}`,
      fetched_at: nowIso,
      people: {}
    };
  }

  cachedPeopleFile.people[slug] = entry;
  cachedPeopleFile.fetched_at = nowIso;

  await writeCachedPeopleFile(cachedPeopleFile).catch((error) => {
    // eslint-disable-next-line no-console
    console.warn('[people] Failed to persist people cache', error);
  });
}

function toProfileFromEntry(entry: CachedPersonEntry): PersonProfile {
  return {
    personId: entry.personId ?? null,
    slug: entry.slug,
    fullName: entry.fullName ?? 'Unknown member',
    www: normalizeUrl(entry.www)
  };
}

function toProfileFromRecord(record: PersonRecord, fallbackSlug: string): PersonProfile {
  const personId = typeof record.ID === 'number' ? record.ID : null;
  const slug = normalizeSlug(record.Slug) ?? fallbackSlug;
  return {
    personId,
    slug,
    fullName: record.FullName ?? record.Slug ?? 'Unknown member',
    www: normalizeUrl(record.WWW)
  };
}

function normalizeSlug(slug: string | null | undefined): string | null {
  if (!slug) {
    return null;
  }
  const trimmed = slug.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  const trimmed = url.trim();
  return trimmed ? trimmed : null;
}
