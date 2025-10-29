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

intent:
Keep Codex tightly constrained — no speculative architecture, no scalability work.  
Deliver only what is required for an end-to-end, demo-ready visualization using static assets and live Legistar fetches.

---

### action_scope

**allowed_actions**
- fetch and normalize Legistar vote + issue data directly from github repository intro.nyc
- create a local store at /server/data for data fetched from repository so as to alleviate any hosting costs
- convert existing shapefile → topojson (EPSG:4326)
- serve static topojson via Express
- render topojson polygons in Leaflet with color scale {Yes, No, Abstain, Missing}
- hardcode minimal member→district mapping (JSON file acceptable)
- create dropdown of issues populated from Legistar
- implement single “recolor on issue change” interaction
- deploy static + server bundle to staging (no build optimizations required)

**forbidden_actions**
- creating reusable data pipelines or ETL layers
- adding vector tiles, Mapbox, DeckGL, or tile servers
- any tooltip, popup, legend, or analytics
- introducing auth, user sessions, or feature flags
- adding state management libraries (Redux, Zustand, etc.)
- writing build-time scripts for shapefile processing (must run manually for now)
- any “production hardening” (CDN, reverse proxy, etc.)

---

### operating_rules
1. All outputs must be **directly inspectable** (no opaque abstractions or generated code).
2. Codegen proposals must include 1-sentence justification referencing the **phase goal**.
3. Each new file or function must answer: *“Does this directly help render the map?”*
4. If uncertain whether an action fits the phase, Codex must halt and emit:  
   `⚠️ requires phase escalation`
5. PRs may not expand action_scope without updating this section.

---

### exit_criteria
- topojson served and rendered correctly in browser map
- at least 3 council districts recolor correctly for one issue
- dropdown populates from Legistar API with real data
- staging deployment loads externally with no runtime errors
- client can interactively change issue and see vote recolor

---

### transition_gate → phase 2
- human review confirms correctness of Legistar integration
- no hardcoded data beyond minimal mapping
- visual + data integrity demonstrated live to client


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
* data fallback: latest roll-call votes sourced from [jehiah/nyc_legislation](https://github.com/jehiah/nyc_legislation) until Legistar exposes current sessions

**Known data limitation**: Legistar’s NYC tenant currently returns only late-1990s events for all query permutations (`startdate`, `$filter`, `$orderby`). Phase 1 therefore surfaces the latest available roll-call (historical) until a reliable path to present-day data is identified.

**alternate data source (phase 1–2):**
- intro.nyc (https://github.com/jehiah/intro.nyc)
  - public Legistar mirror by Jehiah Czebotar
  - nightly-updated CSV/JSON data of bills, votes, and members
  - stable join keys and simplified structure
  - use locally for deterministic MVP; replace with live Legistar API later
  - attribution: “Data from intro.nyc (Jehiah Czebotar), derived from NYC Council Legistar”


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
