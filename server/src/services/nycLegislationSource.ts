// ABOUTME: Fetches nyc_legislation JSON assets via GitHub API for introductions and people records.
// ABOUTME: Inputs = file descriptors (year/slug), Outputs = parsed JSON records for downstream services.
import {
  GITHUB_API_BASE,
  GITHUB_DEFAULT_BRANCH,
  GITHUB_RAW_BASE,
  GITHUB_REPO,
  GITHUB_TOKEN
} from '../config';
import type { IntroductionRecord, PersonRecord } from '../types';

interface GitHubContentEntry {
  name: string;
  path: string;
  type: string;
  download_url?: string | null;
  sha?: string;
}

const API_HEADERS: HeadersInit = {
  'User-Agent': 'nyc-council-maps-mvp',
  Accept: 'application/vnd.github+json'
};

if (GITHUB_TOKEN) {
  (API_HEADERS as Record<string, string>).Authorization = `Bearer ${GITHUB_TOKEN}`;
}

async function requestJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: API_HEADERS,
    ...init
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub request failed (${response.status}) ${text}`.trim());
  }

  return (await response.json()) as T;
}

export interface IntroductionFileDescriptor {
  name: string;
  downloadUrl: string;
  sha?: string | null;
}

export interface PersonFileDescriptor {
  name: string;
  downloadUrl: string;
  sha?: string | null;
}

export async function listIntroductionFiles(year: number): Promise<IntroductionFileDescriptor[]> {
  const url = `${GITHUB_API_BASE}/${GITHUB_REPO}/contents/introduction/${year}`;
  const entries = await requestJSON<GitHubContentEntry[]>(url);

  return entries
    .filter((entry) => entry.type === 'file' && entry.name.endsWith('.json'))
    .map((entry) => ({
      name: entry.name,
      downloadUrl:
        entry.download_url ??
        `${GITHUB_RAW_BASE}/${GITHUB_REPO}/${GITHUB_DEFAULT_BRANCH}/introduction/${year}/${entry.name}`,
      sha: entry.sha ?? null
    }));
}

export async function fetchIntroductionFile(
  descriptor: IntroductionFileDescriptor
): Promise<IntroductionRecord> {
  return requestJSON<IntroductionRecord>(descriptor.downloadUrl, {
    headers: {
      ...API_HEADERS,
      Accept: 'application/json'
    }
  });
}

export async function getPersonDescriptor(slug: string): Promise<PersonFileDescriptor | null> {
  const normalized = slug.endsWith('.json') ? slug : `${slug}.json`;
  const path = `people/${normalized}`;
  const url = `${GITHUB_API_BASE}/${GITHUB_REPO}/contents/${path}`;

  try {
    const entry = await requestJSON<GitHubContentEntry>(url);
    return {
      name: entry.name,
      downloadUrl:
        entry.download_url ??
        `${GITHUB_RAW_BASE}/${GITHUB_REPO}/${GITHUB_DEFAULT_BRANCH}/${path}`,
      sha: entry.sha ?? null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('404')) {
      return null;
    }
    throw error;
  }
}

export async function fetchPersonFile(
  descriptor: PersonFileDescriptor
): Promise<PersonRecord> {
  return requestJSON<PersonRecord>(descriptor.downloadUrl, {
    headers: {
      ...API_HEADERS,
      Accept: 'application/json'
    }
  });
}
