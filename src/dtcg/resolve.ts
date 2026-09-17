/**
 * `resolveTokens` — the core new primitive (RFC-001 §3a, kickoff §2).
 *
 * Collapse a reference-preserving, multi-axis {@link DtcgSource} into a fully
 * resolved **literal** tree for one axis selector: pick each leaf's value for the
 * selector (via {@link matchAxisValue}), then walk `{group.path}` aliases to a
 * literal (cycle-safe).
 *
 * Back-compat contract: the resolved leaf shape equals today's per-brand literal
 * tree — `{ $type, $value(literal), $description?, $extensions? }`, no
 * `$valuesByAxis` — so existing consumers keep working over resolver output.
 */

import {
  AxisSelector,
  DtcgGroup,
  DtcgSource,
  DtcgToken,
  isDtcgReference,
  isDtcgToken,
  referencePath,
} from "../types/dtcg";
import { matchAxisValue } from "./axis-key";
import {
  DtcgReferenceCycleError,
  DtcgUnresolvedReferenceError,
} from "./errors";

/** Look up a leaf token by dot-path (`"primitive.color.blue.500"`). */
export function getTokenAtPath(
  tokens: DtcgGroup,
  path: string
): DtcgToken | undefined {
  const segments = path.split(".");
  let node: DtcgGroup | DtcgToken | undefined = tokens;
  for (const segment of segments) {
    if (node === undefined || isDtcgToken(node)) return undefined;
    node = (node as DtcgGroup)[segment];
  }
  return node !== undefined && isDtcgToken(node) ? node : undefined;
}

/**
 * Resolve one token's selected value to a literal, following references.
 *
 * `visiting` tracks the reference-path chain to detect cycles; it is unwound on
 * return so a diamond (two refs to the same token) is not mistaken for a cycle.
 */
function resolveValue(
  value: unknown,
  source: DtcgSource,
  selector: AxisSelector,
  visiting: string[]
): unknown {
  if (isDtcgReference(value)) {
    const path = referencePath(value);
    if (visiting.includes(path)) {
      throw new DtcgReferenceCycleError([...visiting, path]);
    }
    const target = getTokenAtPath(source.tokens, path);
    if (!target) {
      throw new DtcgUnresolvedReferenceError(
        value,
        visiting[visiting.length - 1]
      );
    }
    const selected = matchAxisValue(target, selector, source.axes);
    if (selected === undefined) {
      throw new DtcgUnresolvedReferenceError(value, path);
    }
    visiting.push(path);
    const resolved = resolveValue(selected, source, selector, visiting);
    visiting.pop();
    return resolved;
  }

  // Composite values (typography/shadow) may embed references in fields/items.
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, source, selector, visiting));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveValue(v, source, selector, visiting);
    }
    return out;
  }

  return value;
}

/** Resolve a single token against a selector, returning a literal leaf token. */
export function resolveToken(
  token: DtcgToken,
  source: DtcgSource,
  selector: AxisSelector,
  path: string
): DtcgToken {
  const selected = matchAxisValue(token, selector, source.axes);
  if (selected === undefined) {
    throw new DtcgUnresolvedReferenceError(`{${path}}`, path);
  }
  const literal = resolveValue(selected, source, selector, [path]);

  const resolved: DtcgToken = { $type: token.$type, $value: literal };
  if (token.$description !== undefined) {
    resolved.$description = token.$description;
  }
  if (token.$extensions !== undefined) {
    resolved.$extensions = token.$extensions;
  }
  return resolved;
}

/**
 * Resolve an entire source tree against `selector`, returning a literal tree in
 * today's per-brand shape. Unspecified axes fall back to their axis default.
 *
 * @throws {DtcgUnresolvedReferenceError} on a missing reference.
 * @throws {DtcgReferenceCycleError} on a reference loop.
 */
export function resolveTokens(
  source: DtcgSource,
  selector: AxisSelector = {}
): DtcgGroup {
  const walk = (group: DtcgGroup, prefix: string): DtcgGroup => {
    const out: DtcgGroup = {};
    for (const [key, node] of Object.entries(group)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (isDtcgToken(node)) {
        out[key] = resolveToken(node, source, selector, path);
      } else {
        out[key] = walk(node as DtcgGroup, path);
      }
    }
    return out;
  };
  return walk(source.tokens, "");
}
