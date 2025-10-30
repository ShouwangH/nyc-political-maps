// ABOUTME: Utility helpers for persisting the nyc_legislation snapshot to disk and reading it back.
// ABOUTME: Inputs = cache payload (JSON), Outputs = normalized cache records for the issues service.
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import {
  CACHE_FILE_PATH,
  PEOPLE_CACHE_FILE_PATH,
  GITHUB_REPO
} from '../config';
import type { IntroductionRecord } from '../types';

export interface CachedIssueEntry {
  year: number;
  file: string;
  downloadUrl: string;
  sha?: string | null;
  record: IntroductionRecord;
}

export interface CachedIssuesFile {
  source: string;
  fetched_at: string;
  commit?: string | null;
  entries: CachedIssueEntry[];
}

export interface CachedPersonEntry {
  slug: string;
  personId: number | null;
  fullName: string | null;
  www: string | null;
  source_file: string;
  sha?: string | null;
  fetched_at: string;
}

export interface CachedPeopleFile {
  source: string;
  fetched_at: string;
  people: Record<string, CachedPersonEntry>;
}

export async function readCachedIssuesFile(): Promise<CachedIssuesFile | null> {
  try {
    const content = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(content) as CachedIssuesFile;
    if (!parsed || !Array.isArray(parsed.entries)) {
      return null;
    }
    return parsed;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err && err.code === 'ENOENT') {
      return null;
    }
    // eslint-disable-next-line no-console
    console.warn('[cache] Failed to read cached issues file', err);
    return null;
  }
}

export async function writeCachedIssuesFile(data: CachedIssuesFile): Promise<void> {
  const directory = dirname(CACHE_FILE_PATH);
  await fs.mkdir(directory, { recursive: true });
  const payload = {
    source: data.source ?? `https://github.com/${GITHUB_REPO}`,
    fetched_at: data.fetched_at,
    commit: data.commit ?? null,
    entries: data.entries
  } satisfies CachedIssuesFile;

  await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}

export async function readCachedPeopleFile(): Promise<CachedPeopleFile | null> {
  try {
    const content = await fs.readFile(PEOPLE_CACHE_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(content) as CachedPeopleFile;
    if (!parsed || typeof parsed.people !== 'object' || parsed.people === null) {
      return null;
    }
    return parsed;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err && err.code === 'ENOENT') {
      return null;
    }
    // eslint-disable-next-line no-console
    console.warn('[cache] Failed to read cached people file', err);
    return null;
  }
}

export async function writeCachedPeopleFile(data: CachedPeopleFile): Promise<void> {
  const directory = dirname(PEOPLE_CACHE_FILE_PATH);
  await fs.mkdir(directory, { recursive: true });
  const payload = {
    source: data.source ?? `https://github.com/${GITHUB_REPO}`,
    fetched_at: data.fetched_at,
    people: data.people
  } satisfies CachedPeopleFile;

  await fs.writeFile(PEOPLE_CACHE_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}
