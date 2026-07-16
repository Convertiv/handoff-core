/**
 * `diffDtcgSource` — two-phase preview support (RFC-001 §3d, kickoff §4).
 *
 * Compares a freshly-ingested source (`next`) against the last committed source
 * (`prev`), keyed by `$extensions.handoff.originalId` (the Figma id — the
 * idempotency key). Marks each token added / modified / removed / in-sync and
 * **stamps `syncState` onto `next`** so the plugin can render a diff, not a dump.
 *
 * Pure aside from the deliberate in-place stamping of `next` (also returned).
 */

import {
  DtcgGroup,
  DtcgSource,
  DtcgSyncState,
  DtcgToken,
  isDtcgToken,
} from "../types/dtcg";

export interface DtcgChangeEntry {
  /** The identity key used for matching: `originalId`, or `path:<path>` fallback. */
  key: string;
  originalId?: string;
  path: string;
  syncState: DtcgSyncState;
}

export interface DtcgChangeset {
  added: DtcgChangeEntry[];
  modified: DtcgChangeEntry[];
  removed: DtcgChangeEntry[];
  unchanged: DtcgChangeEntry[];
  /** `next`, with `syncState` stamped on every token (same reference). */
  next: DtcgSource;
}

interface Collected {
  path: string;
  token: DtcgToken;
  originalId?: string;
  key: string;
}

function collect(source: DtcgSource): Map<string, Collected> {
  const out = new Map<string, Collected>();
  const walk = (group: DtcgGroup, prefix: string): void => {
    for (const [k, node] of Object.entries(group)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (isDtcgToken(node)) {
        const originalId = node.$extensions?.handoff?.originalId;
        const key = originalId ?? `path:${path}`;
        out.set(key, { path, token: node, originalId, key });
      } else {
        walk(node as DtcgGroup, path);
      }
    }
  };
  walk(source.tokens, "");
  return out;
}

/** Order-independent value signature; provenance (`$extensions`) is ignored. */
function valueSignature(token: DtcgToken): string {
  return JSON.stringify({
    $type: token.$type,
    $value: token.$value ?? null,
    $valuesByAxis: sortObject(token.$valuesByAxis),
  });
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortObject((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value ?? null;
}

function stamp(token: DtcgToken, state: DtcgSyncState): void {
  const ext = token.$extensions ?? (token.$extensions = {});
  const handoff = ext.handoff ?? (ext.handoff = {});
  handoff.syncState = state;
}

export function diffDtcgSource(
  next: DtcgSource,
  prev: DtcgSource
): DtcgChangeset {
  const nextMap = collect(next);
  const prevMap = collect(prev);

  const added: DtcgChangeEntry[] = [];
  const modified: DtcgChangeEntry[] = [];
  const removed: DtcgChangeEntry[] = [];
  const unchanged: DtcgChangeEntry[] = [];

  for (const [key, cur] of nextMap) {
    const before = prevMap.get(key);
    let state: DtcgSyncState;
    if (!before) {
      state = "added";
    } else {
      state =
        valueSignature(cur.token) === valueSignature(before.token)
          ? "in-sync"
          : "modified";
    }
    stamp(cur.token, state);
    const entry: DtcgChangeEntry = {
      key,
      originalId: cur.originalId,
      path: cur.path,
      syncState: state,
    };
    if (state === "added") added.push(entry);
    else if (state === "modified") modified.push(entry);
    else unchanged.push(entry);
  }

  for (const [key, before] of prevMap) {
    if (!nextMap.has(key)) {
      removed.push({
        key,
        originalId: before.originalId,
        path: before.path,
        syncState: "removed",
      });
    }
  }

  return { added, modified, removed, unchanged, next };
}
