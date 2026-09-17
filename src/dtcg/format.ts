/**
 * Resolve-then-format path (kickoff §5, second bullet).
 *
 * Produces per-axis-combo CSS / SCSS / flat-map / Style-Dictionary output by
 * running the string emitters over `resolveTokens(source, selector)` — a
 * resolved *literal* tree. The key difference from the legacy formatters is that
 * **units come from each token's `$type` (+ `$extensions.handoff.unit`)**, not a
 * hardcoded `px`. The legacy styles-only formatters are left untouched; this is
 * an additive path over the DTCG source tree.
 */

import {
  AxisSelector,
  DtcgGroup,
  DtcgSource,
  DtcgToken,
  DtcgType,
  defaultUnitForType,
  isDtcgToken,
} from "../types/dtcg";
import { resolveTokens } from "./resolve";

export type DtcgFormat = "css" | "scss" | "map" | "style-dictionary";

/** Fields of a composite `typography` token → (suffix, sub-type) for expansion. */
const TYPOGRAPHY_FIELDS: Record<string, { suffix: string; type: DtcgType }> = {
  fontFamily: { suffix: "font-family", type: "fontFamily" },
  fontSize: { suffix: "font-size", type: "dimension" },
  fontWeight: { suffix: "font-weight", type: "fontWeight" },
  lineHeight: { suffix: "line-height", type: "dimension" },
  letterSpacing: { suffix: "letter-spacing", type: "dimension" },
  paragraphSpacing: { suffix: "paragraph-spacing", type: "dimension" },
};

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4)));
}

/** Format a scalar literal for output, appending the type's unit where relevant. */
function formatScalar(value: unknown, type: DtcgType, unit?: string): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "number") {
    // cubicBezier arrays, or already-stringified values.
    if (Array.isArray(value) && type === "cubicBezier") {
      return `cubic-bezier(${value.map((v) => formatNumber(Number(v))).join(", ")})`;
    }
    return String(value);
  }
  const u = unit ?? defaultUnitForType(type);
  return `${formatNumber(value)}${u}`;
}

/** Render a structural shadow (object or array) as a CSS `box-shadow` value. */
function formatShadow(value: unknown): string {
  const shadows = Array.isArray(value) ? value : [value];
  const parts = shadows
    .map((s) => {
      if (!s || typeof s !== "object") return String(s ?? "");
      const sh = s as Record<string, unknown>;
      const x = formatNumber(Number(sh.offsetX ?? 0));
      const y = formatNumber(Number(sh.offsetY ?? 0));
      const blur = formatNumber(Number(sh.blur ?? 0));
      const spread = sh.spread ? `${formatNumber(Number(sh.spread))}px ` : "";
      const inset = sh.inset ? " inset" : "";
      return `${x}px ${y}px ${blur}px ${spread}${sh.color ?? "transparent"}${inset}`;
    })
    .filter(Boolean);
  return parts.join(", ") || "none";
}

interface FlatEntry {
  /** Path segments (already resolved), e.g. `["color","brand","500"]`. */
  segments: string[];
  /** Additional composite-field suffix segments, e.g. `["font-size"]`. */
  suffix: string[];
  value: string;
  /** SD-style raw value (unformatted) for the style-dictionary emitter. */
  raw: unknown;
  type: DtcgType;
}

/** Flatten a resolved literal tree to formatted leaf entries (composites expanded). */
export function flattenResolved(tree: DtcgGroup): FlatEntry[] {
  const out: FlatEntry[] = [];
  const walk = (group: DtcgGroup, prefix: string[]): void => {
    for (const [key, node] of Object.entries(group)) {
      const segments = [...prefix, key];
      if (isDtcgToken(node)) {
        pushToken(out, node, segments);
      } else {
        walk(node as DtcgGroup, segments);
      }
    }
  };
  walk(tree, []);
  return out;
}

function pushToken(out: FlatEntry[], token: DtcgToken, segments: string[]): void {
  const unit = token.$extensions?.handoff?.unit;
  const value = token.$value;

  if (token.$type === "typography" && value && typeof value === "object") {
    for (const [field, spec] of Object.entries(TYPOGRAPHY_FIELDS)) {
      const fieldValue = (value as Record<string, unknown>)[field];
      if (fieldValue === undefined) continue;
      out.push({
        segments,
        suffix: [spec.suffix],
        value: formatScalar(fieldValue, spec.type),
        raw: fieldValue,
        type: spec.type,
      });
    }
    return;
  }

  if (token.$type === "shadow") {
    out.push({ segments, suffix: [], value: formatShadow(value), raw: value, type: token.$type });
    return;
  }

  out.push({
    segments,
    suffix: [],
    value: formatScalar(value, token.$type, unit),
    raw: value,
    type: token.$type,
  });
}

function entryName(entry: FlatEntry): string {
  return [...entry.segments, ...entry.suffix].join("-");
}

// ---------------------------------------------------------------------------
// Emitters
// ---------------------------------------------------------------------------

export interface FormatOptions {
  /** CSS selector for the `css` format. Default `":root"`. */
  cssSelector?: string;
}

function emitCss(entries: FlatEntry[], options: FormatOptions): string {
  const selector = options.cssSelector ?? ":root";
  const lines = entries.map((e) => `\t--${entryName(e)}: ${e.value};`);
  return `${selector} {\n${lines.join("\n")}\n}\n`;
}

function emitScss(entries: FlatEntry[]): string {
  return entries.map((e) => `$${entryName(e)}: ${e.value};`).join("\n") + "\n";
}

function emitMap(entries: FlatEntry[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of entries) map[entryName(e)] = e.value;
  return map;
}

/** Nested Style-Dictionary tree with `{ value }` leaves (composites kept nested). */
function emitStyleDictionary(tree: DtcgGroup): unknown {
  const walk = (group: DtcgGroup): unknown => {
    const out: Record<string, unknown> = {};
    for (const [key, node] of Object.entries(group)) {
      if (isDtcgToken(node)) {
        out[key] = { value: node.$value, type: node.$type };
      } else {
        out[key] = walk(node as DtcgGroup);
      }
    }
    return out;
  };
  return walk(tree);
}

/**
 * Resolve `source` for `selector`, then format. Returns a string for
 * css/scss/style-dictionary and a flat `Record<string,string>` for `map`.
 */
export function resolveAndFormat(
  source: DtcgSource,
  selector: AxisSelector,
  format: DtcgFormat,
  options: FormatOptions = {}
): string | Record<string, string> {
  const resolved = resolveTokens(source, selector);
  if (format === "style-dictionary") {
    return JSON.stringify(emitStyleDictionary(resolved), null, 2);
  }
  const entries = flattenResolved(resolved);
  switch (format) {
    case "css":
      return emitCss(entries, options);
    case "scss":
      return emitScss(entries);
    case "map":
      return emitMap(entries);
  }
}
