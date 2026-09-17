import { test } from "node:test";
import assert from "node:assert/strict";
import type { Axis, DtcgToken } from "../types/dtcg";
import { axisKey, parseAxisKey, matchAxisValue, tokenVaryingAxes } from "./axis-key";

const axes: Axis[] = [
  { name: "brand", values: ["resolvet", "hagyard"], default: "resolvet" },
  { name: "scheme", values: ["light", "dark"], default: "light" },
];

test("axisKey orders by axis order regardless of selector key order", () => {
  assert.equal(axisKey({ scheme: "dark", brand: "resolvet" }, axes), "brand=resolvet;scheme=dark");
  assert.equal(axisKey({ brand: "hagyard" }, axes), "brand=hagyard");
  assert.equal(axisKey({}, axes), "");
});

test("axisKey drops axes not declared in the source", () => {
  assert.equal(axisKey({ brand: "resolvet", density: "compact" }, axes), "brand=resolvet");
});

test("parseAxisKey is the inverse of axisKey", () => {
  assert.deepEqual(parseAxisKey("brand=resolvet;scheme=dark"), { brand: "resolvet", scheme: "dark" });
  assert.deepEqual(parseAxisKey(""), {});
});

test("tokenVaryingAxes reports only the axes present in keys, ordered", () => {
  const token: DtcgToken = {
    $type: "color",
    $valuesByAxis: { "brand=resolvet": "#a", "brand=hagyard": "#b" },
  };
  assert.deepEqual(tokenVaryingAxes(token, axes), ["brand"]);
});

test("matchAxisValue returns invariant $value when token does not vary", () => {
  const token: DtcgToken = { $type: "color", $value: "#fff" };
  assert.equal(matchAxisValue(token, { brand: "hagyard" }, axes), "#fff");
});

test("matchAxisValue picks the exact combo", () => {
  const token: DtcgToken = {
    $type: "color",
    $valuesByAxis: { "brand=resolvet": "#r", "brand=hagyard": "#h" },
  };
  assert.equal(matchAxisValue(token, { brand: "hagyard" }, axes), "#h");
});

test("matchAxisValue falls back to axis default for unspecified axes", () => {
  const token: DtcgToken = {
    $type: "color",
    $valuesByAxis: { "brand=resolvet": "#r", "brand=hagyard": "#h" },
  };
  // no brand specified → default brand = resolvet
  assert.equal(matchAxisValue(token, { scheme: "dark" }, axes), "#r");
});

test("matchAxisValue falls back to all-defaults combo when requested combo is missing", () => {
  const token: DtcgToken = {
    $type: "color",
    // only defines the light scheme
    $valuesByAxis: { "scheme=light": "#light" },
  };
  assert.equal(matchAxisValue(token, { scheme: "dark" }, axes), "#light");
});

test("matchAxisValue resolves multi-axis combos canonically", () => {
  const token: DtcgToken = {
    $type: "color",
    $valuesByAxis: {
      "brand=resolvet;scheme=light": "#rl",
      "brand=resolvet;scheme=dark": "#rd",
      "brand=hagyard;scheme=light": "#hl",
      "brand=hagyard;scheme=dark": "#hd",
    },
  };
  assert.equal(matchAxisValue(token, { scheme: "dark", brand: "hagyard" }, axes), "#hd");
});
