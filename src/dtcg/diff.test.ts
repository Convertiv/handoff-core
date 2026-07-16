import { test } from "node:test";
import assert from "node:assert/strict";
import type { DtcgSource, DtcgToken } from "../types/dtcg";
import { diffDtcgSource } from "./diff";

function tok(originalId: string, value: unknown): DtcgToken {
  return {
    $type: "color",
    $value: value,
    $extensions: { handoff: { originalId, source: "figma" } },
  };
}

function src(tokens: Record<string, DtcgToken>): DtcgSource {
  return { schemaVersion: 1, axes: [], tokens };
}

test("classifies added / modified / removed / in-sync keyed by originalId", () => {
  const prev = src({
    a: tok("id:a", "#111"),
    b: tok("id:b", "#222"),
    c: tok("id:c", "#333"),
  });
  const next = src({
    a: tok("id:a", "#111"), // unchanged
    b: tok("id:b", "#999"), // modified
    d: tok("id:d", "#444"), // added
    // c removed
  });

  const cs = diffDtcgSource(next, prev);
  assert.deepEqual(cs.added.map((e) => e.originalId), ["id:d"]);
  assert.deepEqual(cs.modified.map((e) => e.originalId), ["id:b"]);
  assert.deepEqual(cs.removed.map((e) => e.originalId), ["id:c"]);
  assert.deepEqual(cs.unchanged.map((e) => e.originalId), ["id:a"]);
});

test("matches by originalId even when the DTCG path (rename) changed", () => {
  const prev = src({ oldName: tok("id:a", "#111") });
  const next = src({ newName: tok("id:a", "#111") });
  const cs = diffDtcgSource(next, prev);
  assert.equal(cs.unchanged.length, 1);
  assert.equal(cs.unchanged[0]!.path, "newName");
});

test("stamps syncState onto next tokens in place", () => {
  const prev = src({ a: tok("id:a", "#111") });
  const next = src({ a: tok("id:a", "#999"), b: tok("id:b", "#000") });
  const cs = diffDtcgSource(next, prev);
  assert.equal(cs.next, next);
  assert.equal((next.tokens.a as DtcgToken).$extensions!.handoff!.syncState, "modified");
  assert.equal((next.tokens.b as DtcgToken).$extensions!.handoff!.syncState, "added");
});

test("value signature ignores provenance and $valuesByAxis key order", () => {
  const prev: DtcgSource = {
    schemaVersion: 1,
    axes: [],
    tokens: {
      a: {
        $type: "color",
        $valuesByAxis: { "brand=x": "#1", "brand=y": "#2" },
        $extensions: { handoff: { originalId: "id:a", source: "figma", tier: "primitive" } },
      },
    },
  };
  const next: DtcgSource = {
    schemaVersion: 1,
    axes: [],
    tokens: {
      a: {
        $type: "color",
        $valuesByAxis: { "brand=y": "#2", "brand=x": "#1" }, // reordered
        $extensions: { handoff: { originalId: "id:a", source: "manual" } }, // different provenance
      },
    },
  };
  const cs = diffDtcgSource(next, prev);
  assert.equal(cs.unchanged.length, 1);
});

test("falls back to path key when originalId is absent", () => {
  const prev: DtcgSource = {
    schemaVersion: 1,
    axes: [],
    tokens: { a: { $type: "color", $value: "#111" } },
  };
  const next: DtcgSource = {
    schemaVersion: 1,
    axes: [],
    tokens: { a: { $type: "color", $value: "#222" } },
  };
  const cs = diffDtcgSource(next, prev);
  assert.equal(cs.modified.length, 1);
  assert.equal(cs.modified[0]!.key, "path:a");
});
