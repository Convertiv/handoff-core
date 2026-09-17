# handoff-core — DEVLOG

Reverse-chronological running journal (newest at top). Decisions, state, gotchas, learnings.
Complements `README`/types (stable) and `docs/` specs. Whoever works this repo appends here.

---

## 2026-09-16 — Figma-snapshot ingest: gradients flattened to `transparent`, human names dropped

Two defects in `buildDtcgSourceFromFigmaSnapshot`'s paint/variable handling, both measured on
the live SS&C registry: of the two token trees `GET /api/registry/dtcg` carries,
`payload.dtcg` (CLI-built) had 8 gradients intact and 169 descriptions, while
`payload.dtcgSource` (built here, and the tree the colours page renders) had 0 gradients,
7 `transparent` values and 6 descriptions.

**Gradients.** The paint-style branch read fills through a local `firstPaintColor` helper that
took the first `SOLID` paint and returned the literal `"transparent"` for everything else, so
every gradient style flattened. The package already contains the right converter —
`transformFigmaFillsToCssColor` in `src/utils/colors.ts`, the one the legacy/CLI path uses —
which emits real `linear-gradient()`/`radial-gradient()` values, reverses layer order (Figma
paints are bottom-first, CSS layers top-first) and keeps multi-layer fills whole.
`firstPaintColor` was a crippled reimplementation of it; deleted, and the branch now delegates.
`blend` from that converter is carried into `$extensions.handoff.blend`, omitted when every
layer is `normal` — the same rule the CLI path (`migrate-legacy.ts`) uses, so the two trees
agree on shape.

**Human names.** Path segments are slugified and slugification is lossy: `SS&C Blue` →
`ss-c-blue`, and the ampersand is not recoverable from the slug. The display layer had nothing
to print but a re-derivation of the key. `HandoffTokenMeta` gains `name?: string`, stamped
verbatim from `variable.name` / `style.name` at all four sites (variables, paint, text, effect).
Kept slash-delimited rather than flattened to spaces so a consumer can line the segments up
with the DTCG path and take the name of any *group* along it — which is what the colours page
needs, since `ss-c-blue` is a group key, not a leaf. `$description` was deliberately not reused:
it already carries genuine Figma description text on the 6 tokens that have one.

**Gotcha — the `.05` → `.003` alpha is NOT a bug in this repo.** The two-layer gradient's solid
layer came out as `rgba(29, 29, 29, .003)` (= 0.05², via `asCssNumber`). The squaring is real,
but its cause is upstream: `handoff-figma-plugin`'s `src/main/api/snapshot/styles.ts` `mapPaint()`
sets `color.a = paint.opacity ?? 1` *and* re-emits `opacity: paint.opacity ?? 1`, so the alpha
is present twice. handoff-core's snapshot `Paint` type is the REST shape, where `color.a` and
`opacity` are independent and multiplying them is correct — `transformFigmaPaintToCssColor` does
the same multiply. Do not "fix" the multiply here; it would break REST-sourced paints. The fix
belongs in the plugin: set one of the two to 1.

Tests: 7 added in `src/dtcg/ingest-figma.test.ts` (46 total, all passing), each verified to fail
when the corresponding bug is reintroduced. The plain-solid case is the regression guard — its
value is byte-identical before and after, because a single `SOLID` fill takes the same
`color.a * (opacity ?? 1)` path through the shared converter as it did through `firstPaintColor`.

---

## 2026-07-16 — P1.1–P1.5 built: reference-preserving multi-axis DTCG stage (unpushed)

Landed the whole handoff-core slice of P1 in the working tree (not committed — awaiting
Brad's review per Profile A). New engine lives under `src/dtcg/`, new types under
`src/types/`, exported as a `Dtcg` namespace from `src/index.ts`. Legacy styles-only
formatters untouched — everything is additive.

**What shipped (all pure + unit-tested, 39 tests):**
- **P1.1 types** — [`src/types/dtcg.ts`](src/types/dtcg.ts) (`DtcgSource`, `DtcgToken` with
  sparse `$valuesByAxis`, generic `Axis[]`, `HandoffTokenMeta`, guards) and
  [`src/types/figma-snapshot.ts`](src/types/figma-snapshot.ts) (the RFC §3b faithful
  snapshot). Axis-key helpers in [`src/dtcg/axis-key.ts`](src/dtcg/axis-key.ts):
  `axisKey`/`parseAxisKey`/`matchAxisValue` — canonical `brand=…;scheme=…` keys ordered by
  the source's axis order.
- **P1.2 `resolveTokens`** — [`src/dtcg/resolve.ts`](src/dtcg/resolve.ts). Per-leaf value
  selection via `matchAxisValue`, then reference walking to literals. Cycle-safe (visited
  path stack, unwound so diamonds ≠ cycles); typed errors
  [`DtcgReferenceCycleError`/`DtcgUnresolvedReferenceError`](src/dtcg/errors.ts). Output leaf
  shape == today's per-brand literal tree (back-compat contract). Also resolves refs embedded
  in composite (typography/shadow) values.
- **P1.3 `buildDtcgSourceFromFigmaSnapshot`** — [`src/dtcg/ingest-figma.ts`](src/dtcg/ingest-figma.ts).
  Whole-snapshot id→path table → aliases emitted as `{group.path}` (never flattened, fixes
  plugin's first-mode-only bug); collection→axis projection with sparse `$valuesByAxis`
  (collapses to invariant `$value` when identical across modes); `$type`+unit inference from
  `resolvedType`+`scopes`; composite typography/shadow assembly from styles; tier inference
  (literal=primitive, aliased=semantic); `$extensions.handoff` provenance. Emits `Diagnostic[]`
  for ambiguous FLOATs, unresolved aliases, unmapped multi-mode collections, path collisions,
  unsupported grid styles.
- **P1.4 `diffDtcgSource`** — [`src/dtcg/diff.ts`](src/dtcg/diff.ts). Keyed by
  `originalId` (path fallback), classifies added/modified/removed/in-sync, stamps `syncState`
  onto `next` in place. Value signature ignores provenance and `$valuesByAxis` key order, so
  renames (path change, same id) read as in-sync.
- **P1.5 structured output + resolve-then-format** —
  [`serialize.ts`](src/dtcg/serialize.ts) (`serializeDtcgSource`, refs preserved, stable key
  order for content-hashing) and [`format.ts`](src/dtcg/format.ts) (`resolveAndFormat` →
  css/scss/map/style-dictionary over `resolveTokens` output; **units derived from `$type`**,
  e.g. duration→ms, dimension→px, number→unitless).

**Gotchas / decisions for the next person:**
- **Test harness, zero-runtime-dep.** Node 24 runs `.ts` via native type-stripping + has
  `node:test`, but its ESM loader can't resolve *extensionless* relative imports (which the
  whole codebase uses). So `npm test` compiles via `tsconfig.test.json` → `dist-test/` (CJS,
  extensionless `require` works) then `node --test "dist-test/**/*.test.js"`. Tests are
  colocated `*.test.ts` (excluded from the prod build). Added `@types/node` (devDep) for the
  `node:test` typings; `dist-test/` gitignored. `npm install` was needed (node_modules was
  empty) — this pulled `@types/node`/`undici-types` into the lockfile, the only lock churn.
- **"Wire the *existing* string formatters over resolveTokens" — interpreted, not literal.**
  The legacy formatters take extractor shapes (`IColorObject[]` …) and hardcode `px` *inside*
  them; reusing them unchanged would contradict "units from `$type`." So `format.ts` is a new
  resolve-then-format emitter over the resolved DTCG tree, leaving the legacy formatters fully
  intact (their output contract is unchanged). Revisit if a true adapter into the old
  `IColorObject`/`ITypographyObject` path is wanted.
- **Ambiguous inference is deferred to curate UI, not guessed silently.** Scopeless FLOATs
  default to dimension/px *with* an `ambiguous-float` diagnostic; STRING w/o FONT_FAMILY and
  BOOLEAN also emit diagnostics. `typeOverrides` (by Figma id) in `AxisMappingConfig` is the
  override channel P4 will drive.
- **lineHeight/letterSpacing** ingested as raw px numbers and emitted as `px`; DTCG often
  wants unitless lineHeight. Flagged here — confirm desired unit when the app renders typography.
- **Grid styles** not ingested in P1 (no clean single DTCG `$type`) — emitted as an `info`
  diagnostic so the curate UI knows they were seen and skipped.

**Verified:** `npm run build` (prod, declarations) clean; 39/39 tests green; end-to-end smoke
via `dist` (ingest → alias preserved → cross-axis resolve → unit-correct CSS → diff → serialize).
Clean API surface left for handoff-app P1.6 and plugin P3/P4 to consume via `Dtcg.*`.

---

## 2026-07-16 — Branch `feature/multi-axis-theming` opened (P1 of the Figma-sync initiative)

Kicked off P1 of the multi-axis theming + reference-preserving DTCG work. handoff-core is the
home for the new structured normalization stage (decision: reused by the Figma plugin, crawler,
and future sources). Full plan + concrete target API in
[`docs/p1-kickoff-multi-axis-theming.md`](docs/p1-kickoff-multi-axis-theming.md); parent design
is RFC-001 in the `handoff-figma-plugin` repo.

**State today:** engine reads styles only (no Variables), no reference/axis model, emits
terminal strings. P1 adds: `DtcgSource` (reference-preserving, generic `axes[]`),
`resolveTokens(source, {axis…})`, `buildDtcgSourceFromFigmaSnapshot`, `diffDtcgSource`, and a
structured output stage that drives the existing string formatters via resolve-then-format.

**Working agreement:** no commit/push without Brad's approval (Profile A hard rule). Sibling
repos reference this branch via `file:../handoff-core` during dev; git-branch pin only after
the branch is pushed (needs approval). Same branch name across handoff-core / handoff-app /
handoff-figma-plugin.
