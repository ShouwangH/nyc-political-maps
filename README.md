## NYC Council Vote Map — Phase 1 Snapshot

The project now delivers the **Phase 1 MVP**: a Leaflet choropleth backed by in-memory normalization of NYC Council roll-call votes. We currently source historical data via Legistar to prove the end-to-end flow; newer sessions are inaccessible through their public API, so the next iteration will point at the community-maintained dataset below.

### Prerequisites

- [Bun](https://bun.sh) `>= 1.0` (project was aligned on Bun 1.3.0)
- `.env` with `NYC_LEGISTAR_TOKEN=<token>` (token stays on the server; never expose it to the client)
- Optional: `GITHUB_TOKEN=<token>` if you hit GitHub’s unauthenticated rate limits when pulling the mirror dataset

Install dependencies (requires network access):

```bash
bun install
```

### Running the MVP locally

1. **Start the API server**

   ```bash
   bun run dev:server
   ```

   - Express listens on port `3000`
   - `/api/issues` → current list of roll-call matters (top 10 sourced from the cached `jehiah/nyc_legislation` snapshot)
   - `/api/issues/:matterId/votes` → district-level vote map + raw roll-call detail
   - `/data/**` → serves the TopoJSON asset needed by Leaflet

2. **Start the client**

   ```bash
   bun run dev:client
   ```

   - Vite dev server on `http://127.0.0.1:5173`
   - Vite proxies `/api`, `/healthz`, and `/data` to the Bun server for same-origin fetches

3. **Open the map**

   Visit `http://127.0.0.1:5173` and pick a matter from the dropdown to recolor districts by vote.

### Front-end (React + TypeScript + Leaflet)

- Entry: `client/index.html`
- Source: `client/src`
- Dev server: `bun run dev:client`
- Build output: `dist-client/`

The Leaflet map expects the TopoJSON asset at `/data/nyc_council_districts.topo.json`, which is served from `public/data/`.

### Back-end (Express on Bun runtime)

- Entry: `server/src/index.ts`
- Dev server: `bun run dev:server`
- Sample endpoints:
  - `GET /healthz` → simple readiness check
  - `GET /api/issues` → catalog of roll-call matters
  - `GET /api/issues/:matterId/votes` → normalized district votes
  - `/data/**` → static geometry assets

The server keeps everything in memory (per phase-1 constraints); no persistence layer yet.

### Shared Assets

- Raw shapefile: `nyccdistrictmap/`
- Derived TopoJSON (EPSG:4326): `public/data/nyc_council_districts.topo.json`

### Roadmap / Data Plan

Legistar’s NYC tenant does not currently expose modern (2020s) council roll calls via the public API. For the demo we surface the most recent accessible records from the cached snapshot maintained by [Jehiah Czebotar](https://github.com/jehiah/nyc_legislation). We appreciate their work making recent council votes accessible.

As part of that pivot we expect to introduce a lightweight persistence layer sooner than planned—polling GitHub on every request is wasteful, and neither the maintainer nor our API budget should bear that cost. Phase 2 will explore:

- syncing the latest data from `intro.nyc` into an internal cache (or hosted database)
- refreshing data on a schedule / webhook rather than per request
- providing attribution wherever that dataset is surfaced in the UI

### References

- `LegistarApi.md` documents the existing Legistar integration attempts and current limitations.
