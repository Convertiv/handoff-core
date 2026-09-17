/**
 * Canonical axis-selector keys for `DtcgToken.$valuesByAxis`.
 *
 * A key is a deterministic serialization of a selector over a subset of axes,
 * ordered by the source's axis order:  `"brand=resolvet"`,
 * `"brand=resolvet;scheme=dark"`. Canonicalization is what lets ingest, resolve
 * and diff agree on the same string for the same combination.
 */

import type { Axis, AxisSelector, DtcgToken } from "../types/dtcg";

/**
 * Serialize a (possibly partial) selector into a canonical key.
 *
 * Only axes present in `selector` are emitted, ordered by `axes`. Axes not in
 * `axes` are dropped (they cannot be canonically ordered). An empty selector
 * yields `""` — the invariant key.
 */
export function axisKey(selector: AxisSelector, axes: Axis[]): string {
  const parts: string[] = [];
  for (const axis of axes) {
    const value = selector[axis.name];
    if (value !== undefined) {
      parts.push(`${axis.name}=${value}`);
    }
  }
  return parts.join(";");
}

/** Parse a canonical key back into a selector map. Inverse of {@link axisKey}. */
export function parseAxisKey(key: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!key) return out;
  for (const pair of key.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    out[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return out;
}

/** The axis names a token actually varies on, ordered by `axes`. */
export function tokenVaryingAxes(token: DtcgToken, axes: Axis[]): string[] {
  if (!token.$valuesByAxis) return [];
  const present = new Set<string>();
  for (const key of Object.keys(token.$valuesByAxis)) {
    for (const name of Object.keys(parseAxisKey(key))) {
      present.add(name);
    }
  }
  return axes.filter((a) => present.has(a.name)).map((a) => a.name);
}

/**
 * Pick the best `$valuesByAxis` entry (or the invariant `$value`) for `selector`.
 *
 * Resolution order for a token that varies on axes A:
 *  1. exact combo — `selector[a]` (or the axis default) for every a ∈ A;
 *  2. all-defaults combo — every a ∈ A at its axis default;
 *  3. the invariant `$value`.
 *
 * Returns `undefined` only when the token defines neither a matching axis entry
 * nor an invariant value (the caller — the resolver — reports it as unresolved).
 */
export function matchAxisValue(
  token: DtcgToken,
  selector: AxisSelector,
  axes: Axis[]
): unknown {
  const varying = tokenVaryingAxes(token, axes);

  if (varying.length === 0 || !token.$valuesByAxis) {
    return token.$value;
  }

  const defaults = new Map(axes.map((a) => [a.name, a.default]));

  // 1. requested combo (falling back to per-axis default where unspecified)
  const requested: AxisSelector = {};
  for (const name of varying) {
    requested[name] = selector[name] ?? defaults.get(name);
  }
  const requestedKey = axisKey(requested, axes);
  if (requestedKey in token.$valuesByAxis) {
    return token.$valuesByAxis[requestedKey];
  }

  // 2. all-defaults combo
  const fallback: AxisSelector = {};
  for (const name of varying) {
    fallback[name] = defaults.get(name);
  }
  const fallbackKey = axisKey(fallback, axes);
  if (fallbackKey in token.$valuesByAxis) {
    return token.$valuesByAxis[fallbackKey];
  }

  // 3. invariant value (may itself be undefined)
  return token.$value;
}
