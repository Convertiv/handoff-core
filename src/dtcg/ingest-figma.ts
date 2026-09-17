/**
 * `buildDtcgSourceFromFigmaSnapshot` — snapshot → reference-preserving DTCG source
 * (RFC-001 §3c, kickoff §3).
 *
 * The snapshot is raw Figma. This stage is where ALL Figma→DTCG mapping happens:
 *  - build a variable-id → DTCG-path table across the *whole* snapshot, then emit
 *    aliases as `{group.path}` — never resolved/flattened (fixes the plugin's
 *    first-mode-only alias bug);
 *  - project collections/modes → generic axes per `mapping`, populating
 *    `$valuesByAxis` sparsely (only axes a variable actually varies on);
 *  - infer `$type` + unit from `resolvedType` + `scopes`;
 *  - assemble composite `typography`/`shadow` tokens from styles (not decomposed);
 *  - infer `tier` (literal = primitive, aliased = semantic);
 *  - stamp `$extensions.handoff = { originalId, name, source:'figma', tier, scopes }`,
 *    where `name` is the verbatim Figma name — DTCG path segments are slugified and
 *    slugification is lossy (`SS&C Blue` → `ss-c-blue`), so the human name has to
 *    travel with the token for the display layer to have anything to print.
 */

import {
  Axis,
  Diagnostic,
  DtcgGroup,
  DtcgSource,
  DtcgToken,
  DtcgType,
  HandoffTokenMeta,
  isDtcgToken,
} from "../types/dtcg";
import {
  FigmaEffectStyle,
  FigmaFoundationsSnapshot,
  FigmaPaintStyle,
  FigmaTextStyle,
  FigmaVariable,
  FigmaVariableCollection,
} from "../types/figma-snapshot";
import { Color, Effect } from "../types/figma";
import {
  transformFigmaColorToCssColor,
  transformFigmaFillsToCssColor,
} from "../utils/colors";
import { slugify } from "../utils/strings";
import { axisKey } from "./axis-key";

// ---------------------------------------------------------------------------
// Public config
// ---------------------------------------------------------------------------

export interface AxisMappingEntry {
  /** Target axis name, e.g. `"brand"`. */
  axis: string;
  /** Figma collection id OR name (case-insensitive) this axis is projected from. */
  collection: string;
  /** modeId or mode name → axis value. Default: slugified mode name. */
  modeValues?: Record<string, string>;
  /** Default axis value. Default: the axis value of the collection's first mode. */
  default?: string;
}

export interface TypeOverride {
  $type: DtcgType;
  unit?: string;
}

export interface AxisMappingConfig {
  /** Ordered axis projections. Order defines canonical axis-key ordering. */
  axes: AxisMappingEntry[];
  /** DTCG path prefixes to include (everything if omitted). */
  include?: string[];
  /** DTCG path prefixes to exclude. */
  exclude?: string[];
  /** Per-Figma-id `$type`/unit overrides — resolves ambiguous FLOATs. */
  typeOverrides?: Record<string, TypeOverride>;
}

// ---------------------------------------------------------------------------
// Type / unit inference
// ---------------------------------------------------------------------------

const DIMENSION_SCOPES = new Set([
  "CORNER_RADIUS",
  "WIDTH_HEIGHT",
  "GAP",
  "STROKE_FLOAT",
  "FONT_SIZE",
  "LINE_HEIGHT",
  "LETTER_SPACING",
  "PARAGRAPH_SPACING",
  "PARAGRAPH_INDENT",
]);

/** Infer `$type` + unit from Figma `resolvedType` + `scopes`. */
function inferType(
  variable: FigmaVariable,
  override: TypeOverride | undefined,
  diagnostics: Diagnostic[],
  path: string
): { $type: DtcgType; unit?: string } {
  if (override) return { $type: override.$type, unit: override.unit };

  switch (variable.resolvedType) {
    case "COLOR":
      return { $type: "color" };
    case "STRING":
      if (variable.scopes.includes("FONT_FAMILY")) {
        return { $type: "fontFamily" };
      }
      diagnostics.push({
        level: "info",
        code: "string-type-fallback",
        message: `STRING variable "${variable.name}" is not scoped FONT_FAMILY; defaulting $type to fontFamily.`,
        path,
        originalId: variable.id,
      });
      return { $type: "fontFamily" };
    case "BOOLEAN":
      diagnostics.push({
        level: "warning",
        code: "boolean-unsupported",
        message: `BOOLEAN variable "${variable.name}" mapped to number (0/1); DTCG has no boolean type.`,
        path,
        originalId: variable.id,
      });
      return { $type: "number" };
    case "FLOAT": {
      const scopes = variable.scopes;
      if (scopes.includes("OPACITY")) return { $type: "number" };
      if (scopes.includes("FONT_WEIGHT")) return { $type: "fontWeight" };
      if (scopes.some((s) => DIMENSION_SCOPES.has(s))) {
        return { $type: "dimension", unit: "px" };
      }
      // No informative scope → ambiguous. Best-effort dimension/px + diagnostic.
      diagnostics.push({
        level: "warning",
        code: "ambiguous-float",
        message: `FLOAT variable "${variable.name}" has no type-bearing scope (${
          scopes.join(", ") || "none"
        }); defaulted to dimension/px — confirm in curate UI.`,
        path,
        originalId: variable.id,
      });
      return { $type: "dimension", unit: "px" };
    }
    default:
      return { $type: "number" };
  }
}

// ---------------------------------------------------------------------------
// Value conversion
// ---------------------------------------------------------------------------

function isFigmaColor(value: unknown): value is Color {
  return (
    typeof value === "object" &&
    value !== null &&
    "r" in value &&
    "g" in value &&
    "b" in value
  );
}

/** Convert a Figma literal value to its DTCG literal, per inferred `$type`. */
function convertLiteral(value: unknown, type: DtcgType): unknown {
  if (type === "color" && isFigmaColor(value)) {
    return transformFigmaColorToCssColor({
      r: value.r,
      g: value.g,
      b: value.b,
      a: "a" in value && typeof value.a === "number" ? value.a : 1,
    });
  }
  return value;
}

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

/** Figma name (`"color/brand/500"`) → slugified DTCG path segments. */
function pathSegments(name: string): string[] {
  return name
    .split("/")
    .map((s) => slugify(s.trim()))
    .filter((s) => s.length > 0);
}

function matchesPrefixes(path: string, prefixes: string[] | undefined): boolean {
  if (!prefixes || prefixes.length === 0) return false;
  return prefixes.some((p) => path === p || path.startsWith(p + "."));
}

/** Place `token` at `segments` in `tree`, or record a collision diagnostic. */
function placeToken(
  tree: DtcgGroup,
  segments: string[],
  token: DtcgToken,
  diagnostics: Diagnostic[],
  originalId?: string
): void {
  const path = segments.join(".");
  let node: DtcgGroup = tree;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]!;
    const existing = node[key];
    if (existing === undefined) {
      const group: DtcgGroup = {};
      node[key] = group;
      node = group;
    } else if (isDtcgToken(existing)) {
      diagnostics.push({
        level: "error",
        code: "path-collision",
        message: `Path "${path}" collides with token at "${segments
          .slice(0, i + 1)
          .join(".")}"; skipped.`,
        path,
        originalId,
      });
      return;
    } else {
      node = existing as DtcgGroup;
    }
  }
  const leaf = segments[segments.length - 1]!;
  if (node[leaf] !== undefined) {
    diagnostics.push({
      level: "error",
      code: "path-collision",
      message: `Duplicate DTCG path "${path}"; later token skipped.`,
      path,
      originalId,
    });
    return;
  }
  node[leaf] = token;
}

// ---------------------------------------------------------------------------
// Axis resolution from mapping
// ---------------------------------------------------------------------------

interface CollectionAxis {
  axisName: string;
  /** modeId → axis value. */
  modeToValue: Map<string, string>;
}

function buildAxes(
  snapshot: FigmaFoundationsSnapshot,
  mapping: AxisMappingConfig,
  diagnostics: Diagnostic[]
): { axes: Axis[]; collectionAxes: Map<string, CollectionAxis> } {
  const axes: Axis[] = [];
  const collectionAxes = new Map<string, CollectionAxis>();

  for (const entry of mapping.axes) {
    const collection = snapshot.collections.find(
      (c) =>
        c.id === entry.collection ||
        c.name.toLowerCase() === entry.collection.toLowerCase()
    );
    if (!collection) {
      diagnostics.push({
        level: "warning",
        code: "axis-collection-missing",
        message: `Axis "${entry.axis}" maps to collection "${entry.collection}" which is not in the snapshot.`,
      });
      continue;
    }

    const modeToValue = new Map<string, string>();
    const values: string[] = [];
    for (const mode of collection.modes) {
      const mapped =
        entry.modeValues?.[mode.modeId] ??
        entry.modeValues?.[mode.name] ??
        slugify(mode.name);
      modeToValue.set(mode.modeId, mapped);
      if (!values.includes(mapped)) values.push(mapped);
    }

    const def = entry.default ?? values[0] ?? "";
    axes.push({ name: entry.axis, values, default: def });
    collectionAxes.set(collection.id, { axisName: entry.axis, modeToValue });
  }

  return { axes, collectionAxes };
}

// ---------------------------------------------------------------------------
// Variable → token
// ---------------------------------------------------------------------------

function buildVariableToken(
  variable: FigmaVariable,
  collection: FigmaVariableCollection,
  collectionAxis: CollectionAxis | undefined,
  idToPath: Map<string, string>,
  allAxes: Axis[],
  mapping: AxisMappingConfig,
  diagnostics: Diagnostic[]
): { segments: string[]; token: DtcgToken } | undefined {
  const segments = pathSegments(variable.name);
  if (segments.length === 0) return undefined;
  const path = segments.join(".");

  if (mapping.exclude && matchesPrefixes(path, mapping.exclude)) return undefined;
  if (
    mapping.include &&
    mapping.include.length > 0 &&
    !matchesPrefixes(path, mapping.include)
  ) {
    return undefined;
  }

  const { $type, unit } = inferType(
    variable,
    mapping.typeOverrides?.[variable.id],
    diagnostics,
    path
  );

  // Convert each mode's value to a DTCG literal or `{ref}`.
  const modeValues = new Map<string, unknown>();
  let sawAlias = false;
  for (const mode of collection.modes) {
    const raw = variable.valuesByMode[mode.modeId];
    if (raw === undefined) continue;
    if (raw.type === "alias") {
      const target = idToPath.get(raw.variableId);
      if (!target) {
        diagnostics.push({
          level: "error",
          code: "unresolved-alias",
          message: `Variable "${variable.name}" (mode "${mode.name}") aliases unknown variable id ${raw.variableId}; value omitted.`,
          path,
          originalId: variable.id,
        });
        continue;
      }
      sawAlias = true;
      modeValues.set(mode.modeId, `{${target}}`);
    } else {
      modeValues.set(mode.modeId, convertLiteral(raw.value, $type));
    }
  }

  const meta: HandoffTokenMeta = {
    originalId: variable.id,
    name: variable.name,
    source: "figma",
    tier: sawAlias ? "semantic" : "primitive",
    scopes: variable.scopes,
  };
  if (unit) meta.unit = unit;

  const token: DtcgToken = { $type, $extensions: { handoff: meta } };
  if (variable.description) token.$description = variable.description;

  const distinct = new Set(
    [...modeValues.values()].map((v) => JSON.stringify(v))
  );
  const varies = collectionAxis !== undefined && distinct.size > 1;

  if (varies && collectionAxis) {
    const byAxis: Record<string, unknown> = {};
    for (const [modeId, value] of modeValues) {
      const axisValue = collectionAxis.modeToValue.get(modeId);
      if (axisValue === undefined) continue;
      byAxis[axisKey({ [collectionAxis.axisName]: axisValue }, allAxes)] = value;
    }
    token.$valuesByAxis = byAxis;
  } else {
    // Invariant: identical across modes, or collection not axis-mapped.
    if (!collectionAxis && collection.modes.length > 1) {
      diagnostics.push({
        level: "warning",
        code: "unmapped-multimode-collection",
        message: `Collection "${collection.name}" has ${collection.modes.length} modes but no axis mapping; using first mode for "${variable.name}".`,
        path,
        originalId: variable.id,
      });
    }
    const first = collection.modes[0];
    const invariant =
      first && modeValues.has(first.modeId)
        ? modeValues.get(first.modeId)
        : modeValues.values().next().value;
    token.$value = invariant;
  }

  return { segments, token };
}

// ---------------------------------------------------------------------------
// Styles → composite tokens
// ---------------------------------------------------------------------------

function buildTypographyToken(style: FigmaTextStyle): DtcgToken {
  const s = style.style;
  const value: Record<string, unknown> = {};
  if (s.fontFamily !== undefined) value.fontFamily = s.fontFamily;
  if (s.fontSize !== undefined) value.fontSize = s.fontSize;
  if (s.fontWeight !== undefined) value.fontWeight = s.fontWeight;
  if (s.lineHeightPx !== undefined) value.lineHeight = s.lineHeightPx;
  if (s.letterSpacing !== undefined) value.letterSpacing = s.letterSpacing;
  if (s.paragraphSpacing !== undefined) value.paragraphSpacing = s.paragraphSpacing;
  return {
    $type: "typography",
    $value: value,
    $extensions: {
      handoff: {
        originalId: style.id,
        name: style.name,
        source: "figma",
        tier: "primitive",
      },
    },
  };
}

const SHADOW_TYPES = new Set<Effect["type"]>(["DROP_SHADOW", "INNER_SHADOW"]);

function buildShadowToken(
  style: FigmaEffectStyle,
  diagnostics: Diagnostic[],
  path: string
): DtcgToken | undefined {
  const shadows = style.effects
    .filter((e) => SHADOW_TYPES.has(e.type) && e.visible)
    .map((e) => ({
      inset: e.type === "INNER_SHADOW",
      offsetX: e.offset?.x ?? 0,
      offsetY: e.offset?.y ?? 0,
      blur: e.radius ?? 0,
      spread: e.spread ?? 0,
      color: e.color ? transformFigmaColorToCssColor(e.color) : "transparent",
    }));

  if (shadows.length === 0) {
    diagnostics.push({
      level: "info",
      code: "effect-no-shadow",
      message: `Effect style "${style.name}" has no visible shadow effects; skipped.`,
      path,
      originalId: style.id,
    });
    return undefined;
  }

  return {
    $type: "shadow",
    $value: shadows.length === 1 ? shadows[0] : shadows,
    $extensions: {
      handoff: {
        originalId: style.id,
        name: style.name,
        source: "figma",
        tier: "primitive",
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function buildDtcgSourceFromFigmaSnapshot(
  snapshot: FigmaFoundationsSnapshot,
  mapping: AxisMappingConfig
): { source: DtcgSource; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];

  // 1. id → path table across the whole snapshot (references need the full set).
  const idToPath = new Map<string, string>();
  for (const collection of snapshot.collections) {
    for (const variable of collection.variables) {
      const segments = pathSegments(variable.name);
      if (segments.length > 0) idToPath.set(variable.id, segments.join("."));
    }
  }

  // 2. Axes from mapping.
  const { axes, collectionAxes } = buildAxes(snapshot, mapping, diagnostics);

  // 3. Variables → tokens.
  const tokens: DtcgGroup = {};
  for (const collection of snapshot.collections) {
    const collectionAxis = collectionAxes.get(collection.id);
    for (const variable of collection.variables) {
      const built = buildVariableToken(
        variable,
        collection,
        collectionAxis,
        idToPath,
        axes,
        mapping,
        diagnostics
      );
      if (built) {
        placeToken(tokens, built.segments, built.token, diagnostics, variable.id);
      }
    }
  }

  // 4. Styles → composite/color tokens.
  const styles = snapshot.styles ?? {};
  for (const style of styles.paint ?? []) {
    const segments = pathSegments(style.name);
    if (segments.length === 0) continue;
    const token = buildPaintToken(style);
    if (style.description) token.$description = style.description;
    placeToken(tokens, segments, token, diagnostics, style.id);
  }
  for (const style of styles.text ?? []) {
    const segments = pathSegments(style.name);
    if (segments.length === 0) continue;
    const token = buildTypographyToken(style);
    if (style.description) token.$description = style.description;
    placeToken(tokens, segments, token, diagnostics, style.id);
  }
  for (const style of styles.effect ?? []) {
    const segments = pathSegments(style.name);
    if (segments.length === 0) continue;
    const token = buildShadowToken(style, diagnostics, segments.join("."));
    if (!token) continue;
    if (style.description) token.$description = style.description;
    placeToken(tokens, segments, token, diagnostics, style.id);
  }
  for (const style of styles.grid ?? []) {
    diagnostics.push({
      level: "info",
      code: "grid-unsupported",
      message: `Grid style "${style.name}" has no single DTCG type; not ingested in P1.`,
      path: pathSegments(style.name).join("."),
      originalId: style.id,
    });
  }

  return { source: { schemaVersion: 1, axes, tokens }, diagnostics };
}

/**
 * A paint style's fills as one CSS color value, plus its blend modes.
 *
 * Delegates to {@link transformFigmaFillsToCssColor} — the same converter the
 * legacy/CLI token path uses — rather than reading the fills here. The previous
 * local helper took the first `SOLID` paint and returned the literal
 * `"transparent"` for everything else, so every gradient style flattened to
 * `transparent`. The shared converter emits real `linear-gradient()` /
 * `radial-gradient()` values, reverses layer order (Figma paints are
 * bottom-first, CSS layers are top-first) and keeps multi-layer fills whole.
 */
function buildPaintToken(style: FigmaPaintStyle): DtcgToken {
  const { color, blend } = transformFigmaFillsToCssColor(style.paints ?? []);
  const meta: HandoffTokenMeta = {
    originalId: style.id,
    name: style.name,
    source: "figma",
    tier: "primitive",
  };
  // `normal` is the CSS initial value; omitting it matches the CLI token path.
  if (blend && blend !== "normal") meta.blend = blend;
  return {
    $type: "color",
    $value: color,
    $extensions: { handoff: meta },
  };
}
