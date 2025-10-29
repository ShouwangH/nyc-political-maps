## NYC Council Vote Map — Phase 0 Snapshot

This repository is staged for **Phase 0**: proving that NYC Council district shapes render correctly and can be colored with static vote data. The codebase now matches the agreed tech stack so we can move quickly into Phase 1 once the phase exit criteria are confirmed.

### Prerequisites

- [Bun](https://bun.sh) `>= 1.0` (project was aligned on Bun 1.3.0)

Install dependencies (requires network access):

```bash
bun install
```

### Front-end (React + TypeScript + Leaflet)

- Entry: `client/index.html`
- Source: `client/src`
- Dev server: `bun run dev:client` (Vite on port 5173)
- Build output: `dist-client/` (via `bun run build:client`)

The Leaflet map expects the TopoJSON asset at `/data/nyc_council_districts.topo.json`, which is served from `public/data/`.

### Back-end (Express on Bun runtime)

- Entry: `server/src/index.ts`
- Dev server: `bun run dev:server` (Express on port 3000)
- Sample endpoints:
  - `GET /healthz` → simple readiness check
  - `GET /api/phase0/sample-votes` → static vote payload that mirrors the map coloring
  - `/data/**` → serves static geometry assets from `public/data`

No persistence or Legistar integration is wired yet; everything remains in-memory as required for Phase 0.

### Shared Assets

- Raw shapefile: `nyccdistrictmap/`
- Derived TopoJSON (EPSG:4326): `public/data/nyc_council_districts.topo.json`

### Next Steps (Once Phase 0 Is Accepted)

1. Swap sample votes for real Legistar normalization in the server.
2. Drive the React map from API responses instead of local constants.
3. Wire dropdown + issue selection workflow (Phase 1 scope).
