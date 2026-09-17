# P1 kickoff — multi-axis theming + reference-preserving DTCG (handoff-core)

**Branch:** `feature/multi-axis-theming` · **Profile:** A (Handoff) · **Date:** 2026-07-16
**Parent design:** RFC-001 in `handoff-figma-plugin/docs/rfc-001-multi-axis-theming-figma-sync.md`
(read it first — this spec is the handoff-core slice of that plan).

> **Hard rule:** do NOT commit or push without Brad's explicit approval. Leave changes in the
> working tree for review. Build incrementally; `resolveTokens` and the ingest/diff are pure
> and unit-testable — add tests as you go.

## Why this branch exists

`handoff-core` today reads **styles only** (no Figma Variables), has **no reference model, no
axis model, no `$extensions`**, and emits **terminal strings** (CSS/SCSS/SD) with hardcoded
`px` and early-flattened composites. P1 adds a **structured, reference-preserving, multi-axis
DTCG stage** that becomes the shared normalization engine for the Figma plugin (and later the
crawler + other sources). The existing string formatters stay, but are driven by *resolved*
output.

Decisions locked (RFC §5): resolution = **hybrid** (source-of-truth reference tree + resolver
for query/viz, precompiled bytes for the serving path); stage lives **here in handoff-core**;
axes are **generic `axes[]`**; per-tenant auth (no broker) — not a handoff-core concern.

## Target API surface (net-new in this repo)

All new types under `src/types/dtcg.ts`; logic under `src/dtcg/`. Keep the existing
`src/transformer(s)/` string formatters intact.

### 1. Structured DTCG model + generic axes (`src/types/dtcg.ts`)

```ts
export type DtcgType =
  | 'color' | 'dimension' | 'number' | 'duration' | 'cubicBezier'
  | 'fontFamily' | 'fontWeight' | 'typography' | 'shadow' | 'strokeStyle';

/** DTCG alias, e.g. "{color.brand.500}". Distinguished from literals at resolve time. */
export type DtcgReference = string;

export interface HandoffTokenMeta {
  originalId?: string;                 // Figma variable/style id — the idempotency key
  syncState?: 'in-sync' | 'added' | 'modified' | 'removed';
  source?: 'figma' | 'css' | 'manual';
  tier?: 'primitive' | 'shared' | 'semantic' | 'brand';
  scopes?: string[];                   // Figma scopes, carried for audit/inference trace
}

export interface DtcgToken {
  $type: DtcgType;
  $description?: string;
  $extensions?: { handoff?: HandoffTokenMeta };
  /** Invariant value (literal or reference) when the token does not vary by axis. */
  $value?: unknown | DtcgReference;
  /**
   * Sparse per-axis values. Key = canonical axis selector for the axes this token
   * actually varies on, e.g. "brand=resolvet" or "brand=resolvet;scheme=dark".
   * Value = literal or reference. Present iff the token varies on ≥1 axis.
   */
  $valuesByAxis?: Record<string, unknown | DtcgReference>;
}

export type DtcgGroup = { [key: string]: DtcgGroup | DtcgToken };

export interface Axis { name: string; values: string[]; default: string; }

export interface DtcgSource {
  schemaVersion: 1;
  axes: Axis[];        // ordered; brand & scheme are simply the first two by convention
  tokens: DtcgGroup;   // reference-preserving source tree
}
```

Canonical axis-key helpers (`src/dtcg/axis-key.ts`): `axisKey(sel)` sorts by axis order and
serializes `name=value` pairs joined by `;`; `matchAxisValue(token, sel, axes)` picks the best
`$valuesByAxis` entry for a (possibly partial) selector, falling back to axis defaults.

### 2. `resolveTokens` — the core new primitive (`src/dtcg/resolve.ts`)

```ts
export function resolveTokens(
  source: DtcgSource,
  selector: Partial<Record<string, string>>   // { brand: 'resolvet', scheme: 'dark' }
): DtcgGroup;   // fully-resolved LITERAL tree, references walked
```

- For each leaf: choose the value for `selector` (via `matchAxisValue`, defaulting unspecified
  axes), then walk `{group.path}` references to a literal. **Cycle-safe** (track visited paths;
  throw `DtcgReferenceCycleError`). Missing reference → `DtcgUnresolvedReferenceError`.
- **Output shape == today's per-brand literal tree**, so existing consumers
  (`dtcg-normalizer`, `theme.css`, brand switcher, string formatters) keep working by consuming
  resolver output. This is the back-compat contract — do not change the resolved leaf shape.
- Pure function; heavy unit coverage here (aliases, cross-axis, defaults, cycles, missing refs).

### 3. `buildDtcgSourceFromFigmaSnapshot` — ingest (`src/dtcg/ingest-figma.ts`)

```ts
export function buildDtcgSourceFromFigmaSnapshot(
  snapshot: FigmaFoundationsSnapshot,   // shared type — see RFC §3b; define in src/types/figma-snapshot.ts
  mapping: AxisMappingConfig            // collection→axis, category/tier hints, include/excludes
): { source: DtcgSource; diagnostics: Diagnostic[] };
```

Responsibilities:
- Build a **variable-id → DTCG-path** table across the whole snapshot (references need the full
  set), then emit aliases as `{group.path}` — **do not resolve/flatten** (fixes the plugin's
  first-mode-only alias behavior).
- **Project collections/modes → axes** per `mapping` (collection "Brand" → brand axis, etc.);
  populate `$valuesByAxis` sparsely (only axes a variable actually varies on).
- Infer `$type` + unit from Figma `resolvedType` + `scopes` (CORNER_RADIUS→dimension/px,
  OPACITY→number, FONT_WEIGHT→fontWeight, …). Ambiguous FLOATs → diagnostic for curate-UI override.
- Assemble composite `typography` / `shadow` tokens (from text/effect styles) rather than
  decomposing.
- Infer `tier` (literal value = primitive; aliased = semantic) — designer-confirmable upstream.
- Write `$extensions.handoff` = `{ originalId, source:'figma', tier, scopes }`.

### 4. `diffDtcgSource` — two-phase preview support (`src/dtcg/diff.ts`)

```ts
export function diffDtcgSource(next: DtcgSource, prev: DtcgSource): DtcgChangeset;
// keyed by originalId (idempotency). Marks added/modified/removed; stamps syncState on `next`.
```

Backs `/api/figma-plugin/foundations/preview` (built in handoff-app). Pure + testable.

### 5. Structured output stage + resolve-then-format (`src/transformer/`)

- Add a **structured DTCG transformer** that serializes `DtcgSource` (references preserved) —
  this is the artifact the workspace persists as the source-of-truth tree.
- Wire existing string formatters (`CssTransformer`/`ScssTransformer`/`StyleDictionary`/`Map`)
  to run over **`resolveTokens(source, combo)`** per known axis-combo, so per-(brand,scheme)
  CSS/SCSS bytes are produced without changing formatter internals. Units come from `$type`
  now, not hardcoded `px`.
- Export the new surface from `src/index.ts` (extend the `Transformers`/`Types` exports; add a
  `Dtcg` namespace: `{ resolveTokens, buildDtcgSourceFromFigmaSnapshot, diffDtcgSource }`).

## Sub-sequencing (this branch)

1. **P1.1** types (`dtcg.ts`, `figma-snapshot.ts`) + axis-key helpers.
2. **P1.2** `resolveTokens` + reference walker + errors + tests. *(Independent, do first.)*
3. **P1.3** `buildDtcgSourceFromFigmaSnapshot` + inference + diagnostics + tests.
4. **P1.4** `diffDtcgSource` + tests.
5. **P1.5** structured transformer + resolve-then-format wiring + index exports.

Then P1.6 (separate, in **handoff-app** on a matching branch): storage migration (source-tree
column; `brands` → axis-aware; persist `originalId`/`syncState`), resolver used for MCP/REST
query slices + visualization, and `/api/figma-plugin/foundations/{preview,commit}` routes.
The plugin work (P3/P4) is a third branch. **Use the same branch name — `feature/multi-axis-theming`
— in all three repos** so they're easy to cross-reference.

## Cross-repo referencing (how app + plugin consume this branch)

`handoff-core` is `name: "handoff-core"`, remote `github.com/Convertiv/handoff-core`.

- **Active local co-dev (recommended during P1):** the three repos are siblings under
  `Projects/Handoff/`. In `handoff-app` / `handoff-figma-plugin`, point the dependency at the
  local working tree so changes flow without publishing:
  `"handoff-core": "file:../handoff-core"` (or a workspace/`npm link`). Fast loop, no pushing.
- **Git-branch pin (checkpoints / CI / another machine):** requires the branch **pushed to
  origin** — which needs Brad's approval per the hard rule. Once pushed:
  `"handoff-core": "git+https://github.com/Convertiv/handoff-core.git#feature/multi-axis-theming"`.

Until then this branch is local-only; use the `file:` link for development.
