import { test } from "node:test";
import assert from "node:assert/strict";
import type { FigmaFoundationsSnapshot } from "../types/figma-snapshot";
import { buildDtcgSourceFromFigmaSnapshot, AxisMappingConfig } from "./ingest-figma";
import { resolveTokens } from "./resolve";

/** A snapshot: Brand collection (2 modes) with primitives + a semantic collection. */
function snapshot(): FigmaFoundationsSnapshot {
  return {
    schemaVersion: 1,
    figmaFileKey: "abc",
    source: "figma-plugin",
    collections: [
      {
        id: "VariableCollectionId:brand",
        name: "Brand",
        modes: [
          { modeId: "m:resolvet", name: "Resolvet" },
          { modeId: "m:hagyard", name: "Hagyard" },
        ],
        variables: [
          {
            id: "VariableID:brand500",
            name: "color/brand/500",
            resolvedType: "COLOR",
            scopes: ["ALL_FILLS"],
            valuesByMode: {
              "m:resolvet": { type: "literal", value: { r: 0, g: 0.5, b: 0.7, a: 1 } },
              "m:hagyard": { type: "literal", value: { r: 0.5, g: 0, b: 0, a: 1 } },
            },
          },
          {
            id: "VariableID:radius",
            name: "radius/md",
            resolvedType: "FLOAT",
            scopes: ["CORNER_RADIUS"],
            valuesByMode: {
              // identical across modes → should collapse to invariant $value
              "m:resolvet": { type: "literal", value: 8 },
              "m:hagyard": { type: "literal", value: 8 },
            },
          },
        ],
      },
      {
        id: "VariableCollectionId:semantic",
        name: "Semantic",
        modes: [{ modeId: "m:default", name: "Default" }],
        variables: [
          {
            id: "VariableID:accent",
            name: "semantic/accent",
            resolvedType: "COLOR",
            scopes: ["ALL_FILLS"],
            valuesByMode: {
              "m:default": { type: "alias", variableId: "VariableID:brand500" },
            },
          },
        ],
      },
    ],
  };
}

const mapping: AxisMappingConfig = {
  axes: [{ axis: "brand", collection: "Brand" }],
};

test("projects the Brand collection into a brand axis with slugified mode values", () => {
  const { source } = buildDtcgSourceFromFigmaSnapshot(snapshot(), mapping);
  assert.deepEqual(source.axes, [
    { name: "brand", values: ["resolvet", "hagyard"], default: "resolvet" },
  ]);
});

test("varying variable populates $valuesByAxis sparsely; non-varying collapses to $value", () => {
  const { source } = buildDtcgSourceFromFigmaSnapshot(snapshot(), mapping);
  const brand500 = (source.tokens as any).color.brand["500"];
  assert.deepEqual(Object.keys(brand500.$valuesByAxis), ["brand=resolvet", "brand=hagyard"]);
  assert.ok(!("$value" in brand500));

  const radius = (source.tokens as any).radius.md;
  assert.equal(radius.$value, 8);
  assert.ok(!("$valuesByAxis" in radius));
});

test("preserves aliases as {group.path} instead of flattening", () => {
  const { source } = buildDtcgSourceFromFigmaSnapshot(snapshot(), mapping);
  const accent = (source.tokens as any).semantic.accent;
  assert.equal(accent.$value, "{color.brand.500}");
  assert.equal(accent.$extensions.handoff.tier, "semantic");
});

test("resolved output honors the projected axis end-to-end", () => {
  const { source } = buildDtcgSourceFromFigmaSnapshot(snapshot(), mapping);
  const hag = resolveTokens(source, { brand: "hagyard" });
  // brand/500 hagyard = rgb(128,0,0) → #800000
  assert.equal((hag.color as any).brand["500"].$value, "#800000");
  // accent aliases brand/500, so it resolves against the same selector
  assert.equal((hag.semantic as any).accent.$value, "#800000");
});

test("infers dimension/px for CORNER_RADIUS and stamps unit + provenance", () => {
  const { source } = buildDtcgSourceFromFigmaSnapshot(snapshot(), mapping);
  const radius = (source.tokens as any).radius.md;
  assert.equal(radius.$type, "dimension");
  assert.equal(radius.$extensions.handoff.unit, "px");
  assert.equal(radius.$extensions.handoff.originalId, "VariableID:radius");
  assert.equal(radius.$extensions.handoff.source, "figma");
  assert.equal(radius.$extensions.handoff.tier, "primitive");
});

test("emits an ambiguous-float diagnostic for scopeless FLOATs", () => {
  const snap = snapshot();
  snap.collections[0]!.variables.push({
    id: "VariableID:mystery",
    name: "misc/mystery",
    resolvedType: "FLOAT",
    scopes: [],
    valuesByMode: {
      "m:resolvet": { type: "literal", value: 3 },
      "m:hagyard": { type: "literal", value: 3 },
    },
  });
  const { diagnostics } = buildDtcgSourceFromFigmaSnapshot(snap, mapping);
  assert.ok(diagnostics.some((d) => d.code === "ambiguous-float" && d.originalId === "VariableID:mystery"));
});

test("assembles a composite typography token from a text style (not decomposed)", () => {
  const snap = snapshot();
  snap.styles = {
    text: [
      {
        id: "StyleID:body",
        name: "body/base",
        style: { fontFamily: "Inter", fontSize: 16, fontWeight: 400, lineHeightPx: 24, letterSpacing: 0 },
      },
    ],
  };
  const { source } = buildDtcgSourceFromFigmaSnapshot(snap, mapping);
  const body = (source.tokens as any).body.base;
  assert.equal(body.$type, "typography");
  assert.deepEqual(body.$value, {
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 24,
    letterSpacing: 0,
  });
});

test("assembles a structural shadow token from an effect style", () => {
  const snap = snapshot();
  snap.styles = {
    effect: [
      {
        id: "StyleID:sm",
        name: "shadow/sm",
        effects: [
          {
            type: "DROP_SHADOW",
            visible: true,
            radius: 4,
            spread: 0,
            offset: { x: 0, y: 2 },
            color: { r: 0, g: 0, b: 0, a: 0.25 },
          } as any,
        ],
      },
    ],
  };
  const { source } = buildDtcgSourceFromFigmaSnapshot(snap, mapping);
  const sm = (source.tokens as any).shadow.sm;
  assert.equal(sm.$type, "shadow");
  assert.equal(sm.$value.offsetY, 2);
  assert.equal(sm.$value.blur, 4);
  assert.equal(sm.$value.inset, false);
  assert.match(sm.$value.color, /^(#|rgba)/);
});

test("unmapped multi-mode collection produces a diagnostic and uses the first mode", () => {
  const snap = snapshot();
  // Drop the axis mapping so Brand (2 modes) is unmapped.
  const { source, diagnostics } = buildDtcgSourceFromFigmaSnapshot(snap, { axes: [] });
  assert.ok(diagnostics.some((d) => d.code === "unmapped-multimode-collection"));
  const brand500 = (source.tokens as any).color.brand["500"];
  assert.ok(!("$valuesByAxis" in brand500)); // invariant, first mode
});
