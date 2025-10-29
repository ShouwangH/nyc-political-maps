# agents.md

## project overview

mvp: nyc city council vote visualization.

* choropleth map of nyc council districts
* dropdown of legislative issues from current session
* on issue selection: recolor districts based on vote
* stretch: hover tooltips with district metadata + vote breakdown

**data sources**

* votes + issues: legistar api (nyc council)
* geometry: unsure. start with topojson or geojson. vector tiles later.

**principles**

* deliver mvp fast
* no premature optimization
* build clear path to tile-based maps later

---

## ai ruleset

1. be terse, factual, and pragmatic.
2. prefer disagreement to empty agreement. critique assumptions.
3. if uncertain about correctness, explicitly state uncertainty.
4. expose tradeoffs: performance, complexity, scalability.
5. propose multiple architectural options before choosing.
6. enforce mvp focus: features must tie directly to demo value.
7. future-proof but do not build future today.

---

## non-negotiables (mvp)

* front-end: React + TypeScript + Leaflet
* back-end: Node + Express (in-memory cache only)
* runtime / package manager: Bun
* map library: leaflet (polygon layer only)
* geometry format: topojson served as static asset
* join key: district number (string value)
* server: in-memory cache only, **no database**
* rollcall resolution: latest vote event wins
* vote statuses: { Yes, No, Abstain, Missing }
* colors: Yes=green, No=red, Abstain=yellow, Missing=gray
* backend boundaries: normalization isolated in server (no legistar logic in ui)

## explicit assumptions (validate in phase 0)

1. each issue has a single relevant rollcall for final outcome
2. each council member maps 1:1 to a district
3. yes/no/abstain are sufficient categories for mvp
4. missing values do not block ui
5. projection conversion (to EPSG:4326) preserves geometry integrity

## contribution rules

* each PR must state **which phase** it advances and cite relevant allowed_actions
* if a change requires shifting phases → update agents.md in the **same PR**
* changes violating forbidden_actions are rejected
* codex agents must check execution_controls before generating code

## execution_controls

current_phase: 1

action_scope:
allowed_actions:
- convert shapefile → topojson (reproject to EPSG:4326)
- verify district join key on sample (≥3 districts)
- minimal leaflet polygon render using topojson
- basic color mapping from static sample data
forbidden_actions:
- database introduction of any kind
- vector tiles / tile server integration
- tooltip implementation
- caching beyond simple in-memory
- ui polish beyond minimal usability
exit_criteria:
- topojson loads in browser map
- 3 districts color correctly for one issue
- deployed staging build accessible externally

## roadmap

### phase 0 — map + data groundwork (prove feasibility) ✅

* convert shapefile → geojson (reproject to EPSG:4326)
* **use leaflet for MVP** (simplest polygon workflow)
* pick join key between shapes and legistar (validate mapping for 3 districts)
* commit static shapes into repo (public asset)

### phase 1 — mvp product (end‑to‑end working demo)

* ui: map + dropdown populated from legistar
* server: fetch + normalize issues + votes (hardcoded member→district mapping ok)
* color districts by vote outcome (yes/no/abstain/missing)
* deploy to staging

### phase 2 — data correctness + ux polish

* improve normalization: auto member→district mapping
* unify multiple rollcalls → deterministic vote
* add legend + loading/error states
* basic analytics: log user interactions for iteration

### phase 3 — durability + performance

* introduce persistence (db) for caching legistar data
* nightly refresh job or triggered sync
* request deduplication + caching policy
* error recovery strategies for legistar downtime

### phase 4 — locked (do not start)

* spatial infrastructure upgrade TBD
* vector tiles + tile server only after architectural validation

### phase 5 — feature extensions (only after stability)

* hover/click tooltips with vote breakdown
* contextual overlays (e.g. demographics)
* export/share screenshots

---

## open questions

* topojson vs mvt for mvp? (lean topojson)
* reliability of arcgis endpoints? probably self‑host soon
* do we need full precinct granularity later?
