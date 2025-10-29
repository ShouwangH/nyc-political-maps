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


**Prime Directive**
- If any rule needs an exception → **STOP** and ask Shouwang first.  
  No silent overrides.

**Autonomous Mode (demo)**
- Enabled with `CODEX_AUTONOMOUS=true` or `--autonomous`.  
- When a “must ask” rule triggers:  

**Working Style**
- Do it right, not fast. Systematic > clever. Be honest.  
- Address Shouwang directly. Disagree with reasoning, not emotion.  
- Discuss architecture before code unless trivial.

**Decision Heuristics**
- YAGNI first; design for extensibility only when cheap.  
- Make smallest necessary change. Match local style. Remove duplication.  
- Never rewrite or delete core logic without approval.

**Testing (map scope)**
- Smoke tests: `/health`, `/topojson`, `/issues`, `/votes`.  
- Confirm:  
  - topojson loads  
  - vote JSON normalizes correctly  
  - 3 districts color as expected  
- Skip UI/tooltip tests unless requested.

**Comments & Naming**
- Names describe **what**, not **how/when**.  
  e.g., `VoteFetcher`, `DistrictLayer`, `normalizeVotes()`.  
- Each file starts with:
// ABOUTME: purpose
// ABOUTME: primary inputs/outputs

- If file can’t hold comments (e.g. JSON), create `file.json.aboutme`.

**Version Control**
- Commit per major step; message = step heading.  
- If local changes exist outside Codex edits → add TODO, proceed.

**Tracking**
- TODOs: append-only `TODO.md` with `[ ]`/`[x]` + ISO timestamp.  
- Journal: `Journal/YYYY-MM-DD.md` entries like  
`## HH:MM topic` → key points / lessons / decisions.

**Debugging Loop**
- Reproduce → read → hypothesize → minimal fix → verify → rollback if wrong.  
Never stack speculative fixes.

**Deterministic Defaults**
- Runtime: Bun (fallback npm).  
- Server port: `3000`.  
- Client port: `5173`.  
- Data: static JSON / TopoJSON only (no DB).  
- Skip stretch features unless `CODEX_STRETCH=1`.

**LLM Practices**
- Show prompts in code when used. Structured JSON outputs only.  
- Never suppress errors. Use modular prompt chains.  
- Fixed temperature + schema for reproducibility.

**Collaboration**
- Be direct, analytical, and concise.  
- Ask before changing architecture or data flow.  
- Record all key lessons in the journal.

---

## non-negotiables (mvp)

* front-end: React + TypeScript + Leaflet
* back-end: Node + Express (in-memory cache only)
* runtime / package manager: Bun
* map library: leaflet (polygon layer only)
* geometry format: topojson served as static asset
* join key: district number (string value)
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

## execution_controls (phase 2 — data correctness + ux polish)

current_phase: 2

focus:
- ensure vote data and member→district mappings are correct and reproducible
- refine user experience (legend, loading/error states)
- introduce light analytics for iteration feedback

allowed_actions:
- normalize multiple rollcalls into one deterministic vote per issue
- auto-map members to districts from reliable source
- add legend, loading, and error UI states
- capture minimal analytics events (no third-party trackers)
- document data normalization assumptions inline

forbidden_actions:
- introducing new frameworks, state managers, or caching layers
- optimizing fetch logic beyond clarity or correctness
- adding database or external storage beyond caching for GitHub content
- building production metrics or auth systems
- speculative refactors unrelated to current data correctness work

guardrails:
- prioritize clarity over optimization
- refactor only to improve data accuracy or readability
- annotate normalization logic with assumptions and provenance
- each file change must have a clear link to either data integrity or UX clarity


## roadmap

### phase 0 — map + data groundwork (prove feasibility) ✅

* convert shapefile → geojson (reproject to EPSG:4326)
* **use leaflet for MVP** (simplest polygon workflow)
* pick join key between shapes and legistar (validate mapping for 3 districts)
* commit static shapes into repo (public asset)

### phase 1 — mvp product (end‑to‑end working demo) ✅

* ui: map + dropdown populated from live roll-call data (currently via [jehiah/nyc_legislation](https://github.com/jehiah/nyc_legislation))
* server: fetch + normalize issues + votes (hardcoded member→district mapping ok)
* color districts by vote outcome (yes/no/abstain/missing)
* verified locally as staging proxy; ready for external host when needed
* attribution: “Data from intro.nyc (Jehiah Czebotar), derived from NYC Council Legistar”

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
* good citizen: minimize load on `jehiah/nyc_legislation` mirror (local cache, metadata, <24h refresh)
* basic analytics: log user interactions for iteration

### good_citizen_note (data sourcing & caching)

- respect upstream limits on public civic data
- all data pulled from external sources (e.g. jehiah/nyc_legislation) **must be pre-cached locally**
- fetch frequency: **no more than once per 24h**
- write result to a local JSON file (`/data/*.json`)
- include minimal metadata:

  ```json
  {
    "source": "https://github.com/jehiah/nyc_legislation",
    "fetched_at": "2025-10-29T12:00:00Z",
    "commit": "abc123",
    "file": "votes/votes.json"
  }

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
