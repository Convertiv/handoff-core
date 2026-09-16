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

// ── Paint styles: gradients and multi-layer fills ────────────────────────────
//
// Ingest used to read a paint style with a local "first SOLID paint" helper that
// returned the literal "transparent" for anything else, so every gradient style
// flattened to `transparent`. It now delegates to the package's own
// `transformFigmaFillsToCssColor` — the converter that produces the intact
// strings in the Figma export. The expected values below are the real ones
// measured on the SS&C registry.

/** A linear-gradient paint. Handles are Figma's three-point form. */
function gradientPaint(
  handles: { x: number; y: number }[],
  stops: { color: { r: number; g: number; b: number; a: number }; position: number }[],
  blendMode = "NORMAL"
): any {
  return {
    type: "GRADIENT_LINEAR",
    blendMode,
    gradientHandlePositions: handles,
    gradientStops: stops,
  };
}

function solidPaint(
  r: number,
  g: number,
  b: number,
  a = 1,
  blendMode = "NORMAL"
): any {
  return { type: "SOLID", blendMode, color: { r: r / 255, g: g / 255, b: b / 255, a } };
}

/** Bottom-to-top full-bleed handles → 0deg. */
const VERTICAL_HANDLES = [
  { x: 0.5, y: 1 },
  { x: 0.5, y: 0 },
  { x: 0, y: 1 },
];

/** Handles for the 104.25deg gradient on the SS&C file. */
const ANGLED_HANDLES = [
  { x: -0.088953, y: 0.350425 },
  { x: 1.088953, y: 0.649575 },
  { x: -0.21203, y: 0.83504 },
];

function stop(r: number, g: number, b: number, position: number, a = 1) {
  return { color: { r: r / 255, g: g / 255, b: b / 255, a }, position };
}

function paintStyleSnapshot(paints: any[], name = "Gradients/Primary"): FigmaFoundationsSnapshot {
  const snap = snapshot();
  snap.styles = { paint: [{ id: "StyleID:paint", name, paints }] };
  return snap;
}

test("a single-layer gradient paint style keeps its gradient, not `transparent`", () => {
  const snap = paintStyleSnapshot([
    gradientPaint(VERTICAL_HANDLES, [stop(0, 119, 200, 0), stop(19, 30, 88, 1)]),
  ]);
  const { source } = buildDtcgSourceFromFigmaSnapshot(snap, mapping);
  const token = (source.tokens as any).gradients.primary;
  assert.equal(
    token.$value,
    "linear-gradient(0deg, rgba(0, 119, 200) 0%, rgba(19, 30, 88) 100%)"
  );
});

test("a two-layer fill keeps both layers, top-first, and preserves the solid layer's alpha", () => {
  // Figma orders paints bottom-first; CSS orders layers top-first, so the
  // gradient (drawn on top) leads and the 5%-black wash sits underneath.
  const snap = paintStyleSnapshot([
    solidPaint(29, 29, 29, 0.05),
    gradientPaint(ANGLED_HANDLES, [stop(178, 214, 238, 0), stop(0, 119, 200, 1)]),
  ]);
  const { source } = buildDtcgSourceFromFigmaSnapshot(snap, mapping);
  const token = (source.tokens as any).gradients.primary;
  assert.equal(
    token.$value,
    "linear-gradient(104.25deg, rgba(178, 214, 238) 0%, rgba(0, 119, 200) 100%), " +
      "rgba(29, 29, 29, .05)"
  );
});

test("a plain solid paint style is unchanged — opaque hex and alpha rgba both", () => {
  const { source: opaque } = buildDtcgSourceFromFigmaSnapshot(
    paintStyleSnapshot([solidPaint(0, 119, 200)], "Color/SS&C Blue/500"),
    mapping
  );
  assert.equal((opaque.tokens as any).color["ss-c-blue"]["500"].$value, "#0077c8");

  const { source: translucent } = buildDtcgSourceFromFigmaSnapshot(
    paintStyleSnapshot([solidPaint(29, 29, 29, 0.05)], "Color/Wash"),
    mapping
  );
  assert.equal((translucent.tokens as any).color.wash.$value, "rgba(29, 29, 29, .05)");
});

test("carries the fill's blend modes into $extensions.handoff, omitting an all-normal one", () => {
  const { source: multiply } = buildDtcgSourceFromFigmaSnapshot(
    paintStyleSnapshot([
      solidPaint(29, 29, 29, 0.05, "MULTIPLY"),
      gradientPaint(VERTICAL_HANDLES, [stop(0, 119, 200, 0), stop(19, 30, 88, 1)]),
    ]),
    mapping
  );
  assert.equal(
    (multiply.tokens as any).gradients.primary.$extensions.handoff.blend,
    "normal, multiply"
  );

  const { source: plain } = buildDtcgSourceFromFigmaSnapshot(
    paintStyleSnapshot([solidPaint(0, 119, 200)]),
    mapping
  );
  assert.ok(!("blend" in (plain.tokens as any).gradients.primary.$extensions.handoff));
});

// ── Human names ─────────────────────────────────────────────────────────────
//
// Path segments are slugified and slugification is lossy: `SS&C Blue` becomes
// `ss-c-blue` and the ampersand cannot be recovered from it. `$description` is
// not available to carry the name — it already holds genuine Figma description
// text — so the name rides in `$extensions.handoff.name`, verbatim.

test("a variable's human name survives slugification via $extensions.handoff.name", () => {
  const snap = snapshot();
  snap.collections[0]!.variables.push({
    id: "VariableID:sscblue500",
    name: "Color/SS&C Blue/500",
    resolvedType: "COLOR",
    scopes: ["ALL_FILLS"],
    valuesByMode: {
      "m:resolvet": { type: "literal", value: { r: 0, g: 0.467, b: 0.784, a: 1 } },
      "m:hagyard": { type: "literal", value: { r: 0, g: 0.467, b: 0.784, a: 1 } },
    },
  });
  const { source } = buildDtcgSourceFromFigmaSnapshot(snap, mapping);
  const token = (source.tokens as any).color["ss-c-blue"]["500"];
  assert.equal(token.$extensions.handoff.name, "Color/SS&C Blue/500");
  // The slug on its own cannot get back to the human label; the name can.
  assert.ok(token.$extensions.handoff.name.includes("SS&C Blue"));
});

test("a paint style's human name is carried, and $description is left for real descriptions", () => {
  const snap = snapshot();
  snap.styles = {
    paint: [
      {
        id: "StyleID:muted",
        name: "Color/SS&C Blue/Muted",
        description: "Muted text.",
        paints: [solidPaint(0, 119, 200)],
      },
    ],
  };
  const { source } = buildDtcgSourceFromFigmaSnapshot(snap, mapping);
  const token = (source.tokens as any).color["ss-c-blue"].muted;
  assert.equal(token.$extensions.handoff.name, "Color/SS&C Blue/Muted");
  assert.equal(token.$description, "Muted text.");
});

test("text and effect styles carry their human names too", () => {
  const snap = snapshot();
  snap.styles = {
    text: [
      {
        id: "StyleID:body",
        name: "Body/SS&C Base",
        style: { fontFamily: "Inter", fontSize: 16 },
      },
    ],
    effect: [
      {
        id: "StyleID:sm",
        name: "Shadow/SS&C Small",
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
  assert.equal(
    (source.tokens as any).body["ss-c-base"].$extensions.handoff.name,
    "Body/SS&C Base"
  );
  assert.equal(
    (source.tokens as any).shadow["ss-c-small"].$extensions.handoff.name,
    "Shadow/SS&C Small"
  );
});
