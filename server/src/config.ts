// ABOUTME: Centralized configuration constants for server services and data sources.
// ABOUTME: Inputs = environment variables, Outputs = exported constants for other modules.
export const LEGISTAR_BASE_URL = 'https://webapi.legistar.com/v1/nyc';

export const LEGISTAR_TOKEN = process.env.NYC_LEGISTAR_TOKEN ?? '';

if (!LEGISTAR_TOKEN) {
  // eslint-disable-next-line no-console
  console.warn(
    '[legistar] NYC_LEGISTAR_TOKEN is not set. Legistar requests will fail until the token is provided.'
  );
}

export const REQUEST_TIMEOUT_MS = 25_000;
export const ISSUE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const VOTE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
export const DISTRICT_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export const GITHUB_REPO = 'jehiah/nyc_legislation';
export const GITHUB_DEFAULT_BRANCH = 'master';
export const GITHUB_API_BASE = 'https://api.github.com/repos';
export const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? '';

export const CACHE_FILE_PATH = `${process.cwd()}/data/nyc_legislation_cache.json`;
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PEOPLE_CACHE_FILE_PATH = `${process.cwd()}/data/nyc_legislation_people_cache.json`;
export const PEOPLE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
