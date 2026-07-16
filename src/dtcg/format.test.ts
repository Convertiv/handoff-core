import { test } from "node:test";
import assert from "node:assert/strict";
import type { DtcgSource } from "../types/dtcg";
import { resolveAndFormat, flattenResolved } from "./format";
import { resolveTokens } from "./resolve";
import { serializeDtcgSource } from "./serialize";

const axes = [
  { name: "brand", values: ["resolvet", "hagyard"], default: "resolvet" },
  { name: "scheme", values: ["light", "dark"], default: "light" },
];

const source: DtcgSource = {
  schemaVersion: 1,
  axes,
  tokens: {
    color: {
      brand: {
        $type: "color",
        $valuesByAxis: { "brand=resolvet": "#048bbb", "brand=hagyard": "#8b0000" },
        $extensions: { handoff: { source: "figma", tier: "primitive" } },
      },
    },
    radius: {
      md: {
        $type: "dimension",
        $value: 8,
        $extensions: { handoff: { source: "figma", unit: "px" } },
      },
    },
    motion: {
      fast: { $type: "duration", $value: 150 },
    },
    opacity: {
      disabled: { $type: "number", $value: 0.5 },
    },
  },
};

test("CSS emits units from $type/meta, not hardcoded px", () => {
  const css = resolveAndFormat(source, { brand: "hagyard" }, "css") as string;
  assert.match(css, /--color-brand: #8b0000;/);
  assert.match(css, /--radius-md: 8px;/); // dimension → px
  assert.match(css, /--motion-fast: 150ms;/); // duration → ms, NOT px
  assert.match(css, /--opacity-disabled: 0.5;/); // number → unitless
});

test("SCSS uses $-prefixed names over the resolved tree", () => {
  const scss = resolveAndFormat(source, {}, "scss") as string;
  assert.match(scss, /\$color-brand: #048bbb;/); // default brand = resolvet
  assert.match(scss, /\$motion-fast: 150ms;/);
});

test("map format returns a flat name→value record", () => {
  const map = resolveAndFormat(source, { brand: "hagyard" }, "map") as Record<string, string>;
  assert.equal(map["color-brand"], "#8b0000");
  assert.equal(map["radius-md"], "8px");
});

test("typography composites expand into per-field entries with correct units", () => {
  const typoSource: DtcgSource = {
    schemaVersion: 1,
    axes,
    tokens: {
      body: {
        $type: "typography",
        $value: { fontFamily: "Inter", fontSize: 16, fontWeight: 400, lineHeight: 24 },
      },
    },
  };
  const map = resolveAndFormat(typoSource, {}, "map") as Record<string, string>;
  assert.equal(map["body-font-family"], "Inter");
  assert.equal(map["body-font-size"], "16px");
  assert.equal(map["body-font-weight"], "400");
  assert.equal(map["body-line-height"], "24px");
});

test("shadow composites render as a box-shadow value", () => {
  const shadowSource: DtcgSource = {
    schemaVersion: 1,
    axes,
    tokens: {
      shadow: {
        sm: {
          $type: "shadow",
          $value: { offsetX: 0, offsetY: 2, blur: 4, spread: 0, inset: false, color: "rgba(0, 0, 0, 0.25)" },
        },
      },
    },
  };
  const map = resolveAndFormat(shadowSource, {}, "map") as Record<string, string>;
  assert.equal(map["shadow-sm"], "0px 2px 4px rgba(0, 0, 0, 0.25)");
});

test("style-dictionary emits a nested tree with { value, type } leaves", () => {
  const sd = JSON.parse(resolveAndFormat(source, {}, "style-dictionary") as string);
  assert.equal(sd.color.brand.value, "#048bbb");
  assert.equal(sd.color.brand.type, "color");
  assert.equal(sd.radius.md.value, 8);
});

test("flattenResolved expands composites and keeps scalar leaves", () => {
  const resolved = resolveTokens(source, {});
  const entries = flattenResolved(resolved);
  const names = entries.map((e) => [...e.segments, ...e.suffix].join("-"));
  assert.ok(names.includes("color-brand"));
  assert.ok(names.includes("radius-md"));
});

test("serializeDtcgSource preserves references (no flattening)", () => {
  const refSource: DtcgSource = {
    schemaVersion: 1,
    axes,
    tokens: {
      base: { $type: "color", $value: "#111" },
      alias: { $type: "color", $value: "{base}" },
    },
  };
  const json = serializeDtcgSource(refSource);
  assert.match(json, /\{base\}/);
  // round-trips
  assert.deepEqual(JSON.parse(json), refSource);
});
