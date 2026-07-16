/**
 * Reference-preserving, multi-axis DTCG model (P1).
 *
 * This is the shared normalization target for every Handoff source (Figma plugin,
 * crawler, …). Unlike the legacy string formatters, the DTCG source tree keeps
 * `{group.path}` aliases *unresolved* and carries per-axis (brand × scheme × …)
 * values sparsely, so a single tree can be resolved against any axis combination.
 *
 * See RFC-001 §3a and docs/p1-kickoff-multi-axis-theming.md.
 */

/** The DTCG `$type`s Handoff understands. Closed set — drives unit/format inference. */
export type DtcgType =
  | "color"
  | "dimension"
  | "number"
  | "duration"
  | "cubicBezier"
  | "fontFamily"
  | "fontWeight"
  | "typography"
  | "shadow"
  | "strokeStyle";

/**
 * A DTCG alias, e.g. `"{color.brand.500}"`. Represented as a plain string; it is
 * distinguished from a literal string value at resolve time by {@link isDtcgReference}.
 */
export type DtcgReference = string;

/** Sync state of a token relative to its last-committed snapshot. */
export type DtcgSyncState = "in-sync" | "added" | "modified" | "removed";

/** Provenance / curation metadata Handoff attaches under `$extensions.handoff`. */
export interface HandoffTokenMeta {
  /** Figma variable/style id — the idempotency key for diff/commit. */
  originalId?: string;
  syncState?: DtcgSyncState;
  source?: "figma" | "css" | "manual";
  tier?: "primitive" | "shared" | "semantic" | "brand";
  /** Figma scopes, carried for audit and to trace type/unit inference. */
  scopes?: string[];
  /**
   * Unit inferred for numeric `$type`s (e.g. `"px"`, `"ms"`). Absent means the
   * formatter derives a default from `$type` ({@link defaultUnitForType}).
   */
  unit?: string;
}

export interface DtcgExtensions {
  handoff?: HandoffTokenMeta;
  [key: string]: unknown;
}

export interface DtcgToken {
  $type: DtcgType;
  $description?: string;
  $extensions?: DtcgExtensions;
  /** Invariant value (literal or reference) when the token does not vary by axis. */
  $value?: unknown | DtcgReference;
  /**
   * Sparse per-axis values. Key = canonical axis selector for the axes this token
   * actually varies on, e.g. `"brand=resolvet"` or `"brand=resolvet;scheme=dark"`.
   * Value = literal or reference. Present iff the token varies on ≥1 axis.
   */
  $valuesByAxis?: Record<string, unknown | DtcgReference>;
}

/** A recursive DTCG group: either nested groups or leaf tokens. */
export interface DtcgGroup {
  [key: string]: DtcgGroup | DtcgToken;
}

/** An ordered, named theming axis (brand, scheme, density, …). */
export interface Axis {
  name: string;
  values: string[];
  default: string;
}

export interface DtcgSource {
  schemaVersion: 1;
  /** Ordered; `brand` & `scheme` are simply the first two by convention. */
  axes: Axis[];
  /** Reference-preserving source tree (aliases NOT flattened). */
  tokens: DtcgGroup;
}

/** A partial axis selector, e.g. `{ brand: "resolvet", scheme: "dark" }`. */
export type AxisSelector = Partial<Record<string, string>>;

// ---------------------------------------------------------------------------
// Guards & small helpers
// ---------------------------------------------------------------------------

/** True if `value` is a whole-value DTCG alias like `"{a.b.c}"`. */
export function isDtcgReference(value: unknown): value is DtcgReference {
  return (
    typeof value === "string" &&
    value.length > 2 &&
    value.charCodeAt(0) === 0x7b /* { */ &&
    value.charCodeAt(value.length - 1) === 0x7d /* } */
  );
}

/** Extract the dot-path from a reference (`"{a.b.c}"` → `"a.b.c"`). */
export function referencePath(reference: DtcgReference): string {
  return reference.slice(1, -1).trim();
}

/** Distinguish a leaf token from a nested group. A token always has `$type`. */
export function isDtcgToken(node: DtcgGroup | DtcgToken): node is DtcgToken {
  return (
    typeof node === "object" &&
    node !== null &&
    typeof (node as DtcgToken).$type === "string" &&
    ("$value" in node || "$valuesByAxis" in node)
  );
}

/** Conventional default unit per numeric `$type` when meta.unit is absent. */
export function defaultUnitForType(type: DtcgType): string {
  switch (type) {
    case "dimension":
      return "px";
    case "duration":
      return "ms";
    default:
      return "";
  }
}

/** A non-fatal note produced during ingest/diff for the curate UI. */
export interface Diagnostic {
  level: "info" | "warning" | "error";
  code: string;
  message: string;
  /** DTCG dot-path or Figma id the diagnostic concerns, when applicable. */
  path?: string;
  originalId?: string;
}
