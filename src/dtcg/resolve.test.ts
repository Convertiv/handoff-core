import { test } from "node:test";
import assert from "node:assert/strict";
import type { DtcgSource } from "../types/dtcg";
import { resolveTokens, getTokenAtPath } from "./resolve";
import {
  DtcgReferenceCycleError,
  DtcgUnresolvedReferenceError,
} from "./errors";

const axes = [
  { name: "brand", values: ["resolvet", "hagyard"], default: "resolvet" },
  { name: "scheme", values: ["light", "dark"], default: "light" },
];

test("resolves a simple alias chain to a literal", () => {
  const source: DtcgSource = {
    schemaVersion: 1,
    axes,
    tokens: {
      primitive: { color: { blue: { $type: "color", $value: "#048bbb" } } },
      shared: { accent: { $type: "color", $value: "{primitive.color.blue}" } },
      semantic: { link: { $type: "color", $value: "{shared.accent}" } },
    },
  };
  const out = resolveTokens(source, {});
  assert.equal((out.semantic as any).link.$value, "#048bbb");
  assert.equal((out.shared as any).accent.$value, "#048bbb");
});

test("resolves cross-axis: brand selects primitive, scheme selects semantic mapping", () => {
  const source: DtcgSource = {
    schemaVersion: 1,
    axes,
    tokens: {
      primitive: {
        color: {
          gray50: { $type: "color", $value: "#f9fafb" },
          gray900: { $type: "color", $value: "#111827" },
          brand: {
            $type: "color",
            $valuesByAxis: { "brand=resolvet": "#048bbb", "brand=hagyard": "#8b0000" },
          },
        },
      },
      semantic: {
        surface: {
          $type: "color",
          $valuesByAxis: {
            "scheme=light": "{primitive.color.gray50}",
            "scheme=dark": "{primitive.color.gray900}",
          },
        },
        accent: { $type: "color", $value: "{primitive.color.brand}" },
      },
    },
  };

  const light = resolveTokens(source, { brand: "hagyard", scheme: "light" });
  assert.equal((light.semantic as any).surface.$value, "#f9fafb");
  assert.equal((light.semantic as any).accent.$value, "#8b0000");

  const dark = resolveTokens(source, { brand: "resolvet", scheme: "dark" });
  assert.equal((dark.semantic as any).surface.$value, "#111827");
  assert.equal((dark.semantic as any).accent.$value, "#048bbb");
});

test("preserves $type/$description/$extensions but drops $valuesByAxis in output", () => {
  const source: DtcgSource = {
    schemaVersion: 1,
    axes,
    tokens: {
      c: {
        $type: "color",
        $description: "brand color",
        $extensions: { handoff: { originalId: "VariableID:1", source: "figma" } },
        $valuesByAxis: { "brand=resolvet": "#r", "brand=hagyard": "#h" },
      },
    },
  };
  const out = resolveTokens(source, { brand: "hagyard" });
  const leaf = out.c as any;
  assert.equal(leaf.$type, "color");
  assert.equal(leaf.$value, "#h");
  assert.equal(leaf.$description, "brand color");
  assert.equal(leaf.$extensions.handoff.originalId, "VariableID:1");
  assert.ok(!("$valuesByAxis" in leaf));
});

test("resolves references inside composite (typography) values", () => {
  const source: DtcgSource = {
    schemaVersion: 1,
    axes,
    tokens: {
      primitive: { size: { md: { $type: "dimension", $value: 16 } } },
      body: {
        $type: "typography",
        $value: { fontFamily: "Inter", fontSize: "{primitive.size.md}", fontWeight: 400 },
      },
    },
  };
  const out = resolveTokens(source, {});
  assert.deepEqual((out.body as any).$value, {
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: 400,
  });
});

test("throws DtcgUnresolvedReferenceError for a missing reference", () => {
  const source: DtcgSource = {
    schemaVersion: 1,
    axes,
    tokens: { a: { $type: "color", $value: "{does.not.exist}" } },
  };
  assert.throws(() => resolveTokens(source, {}), DtcgUnresolvedReferenceError);
});

test("throws DtcgReferenceCycleError on a reference loop", () => {
  const source: DtcgSource = {
    schemaVersion: 1,
    axes,
    tokens: {
      a: { $type: "color", $value: "{b}" },
      b: { $type: "color", $value: "{a}" },
    },
  };
  assert.throws(() => resolveTokens(source, {}), DtcgReferenceCycleError);
});

test("a diamond (two refs to the same token) is not a cycle", () => {
  const source: DtcgSource = {
    schemaVersion: 1,
    axes,
    tokens: {
      base: { $type: "color", $value: "#333" },
      a: { $type: "color", $value: "{base}" },
      b: { $type: "color", $value: "{base}" },
      composite: {
        $type: "shadow",
        $value: { colorA: "{a}", colorB: "{b}" },
      },
    },
  };
  const out = resolveTokens(source, {});
  assert.deepEqual((out.composite as any).$value, { colorA: "#333", colorB: "#333" });
});

test("getTokenAtPath returns undefined for group paths and misses", () => {
  const source: DtcgSource = {
    schemaVersion: 1,
    axes,
    tokens: { grp: { leaf: { $type: "color", $value: "#000" } } },
  };
  assert.ok(getTokenAtPath(source.tokens, "grp.leaf"));
  assert.equal(getTokenAtPath(source.tokens, "grp"), undefined); // group, not token
  assert.equal(getTokenAtPath(source.tokens, "grp.nope"), undefined);
});
