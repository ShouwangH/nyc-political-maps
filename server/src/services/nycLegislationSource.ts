import {
  GITHUB_API_BASE,
  GITHUB_DEFAULT_BRANCH,
  GITHUB_RAW_BASE,
  GITHUB_REPO,
  GITHUB_TOKEN
} from '../config';
import type { IntroductionRecord } from '../types';

interface GitHubContentEntry {
  name: string;
  path: string;
  type: string;
  download_url?: string | null;
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
        `${GITHUB_RAW_BASE}/${GITHUB_REPO}/${GITHUB_DEFAULT_BRANCH}/introduction/${year}/${entry.name}`
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
