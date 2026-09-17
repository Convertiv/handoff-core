/**
 * The faithful "foundations snapshot" the Figma plugin emits (RFC-001 §3b).
 *
 * It is a raw superset of Figma: every collection, mode, variable, alias edge and
 * scope is preserved — the plugin does NO normalization. All Figma→DTCG mapping
 * happens server-side in {@link ../dtcg/ingest-figma}. In particular, alias values
 * are kept as `{ type:"alias", variableId }` across *all* modes (never flattened),
 * fixing the plugin's historical first-mode-only behavior.
 */

import type { Effect, Paint, LayoutGrid, TypeStyle } from "./figma";

/** Figma's resolved variable data types. */
export type FigmaResolvedType = "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";

/** A literal variable value for a single mode (shape depends on `resolvedType`). */
export interface FigmaLiteralValue {
  type: "literal";
  /** COLOR → {r,g,b,a}; FLOAT → number; STRING → string; BOOLEAN → boolean. */
  value: unknown;
}

/** An alias edge to another variable, preserved unflattened. */
export interface FigmaAliasValue {
  type: "alias";
  variableId: string;
}

export type FigmaVariableModeValue = FigmaLiteralValue | FigmaAliasValue;

export interface FigmaVariable {
  id: string;
  /** Slash-delimited Figma name, e.g. `"color/brand/500"`. */
  name: string;
  resolvedType: FigmaResolvedType;
  /** Preserved verbatim — drives `$type`/unit inference. */
  scopes: string[];
  codeSyntax?: Record<string, string>;
  description?: string;
  hiddenFromPublishing?: boolean;
  /** modeId → value. Aliases are NOT resolved. */
  valuesByMode: Record<string, FigmaVariableModeValue>;
}

export interface FigmaMode {
  modeId: string;
  name: string;
}

export interface FigmaVariableCollection {
  id: string;
  name: string;
  modes: FigmaMode[];
  variables: FigmaVariable[];
}

export interface FigmaPaintStyle {
  id: string;
  name: string;
  description?: string;
  paints: Paint[];
}

export interface FigmaTextStyle {
  id: string;
  name: string;
  description?: string;
  /** Full text properties (font family/size/weight, line height, spacing, …). */
  style: Partial<TypeStyle> & {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    lineHeightPx?: number;
    lineHeightPercent?: number;
    letterSpacing?: number;
    paragraphSpacing?: number;
  };
}

export interface FigmaEffectStyle {
  id: string;
  name: string;
  description?: string;
  effects: Effect[];
}

export interface FigmaGridStyle {
  id: string;
  name: string;
  description?: string;
  layoutGrids: LayoutGrid[];
}

export interface FigmaFoundationsSnapshotStyles {
  paint?: FigmaPaintStyle[];
  text?: FigmaTextStyle[];
  effect?: FigmaEffectStyle[];
  grid?: FigmaGridStyle[];
}

export interface FigmaFoundationsSnapshot {
  schemaVersion: 1;
  figmaFileKey: string;
  source: "figma-plugin" | string;
  collections: FigmaVariableCollection[];
  styles?: FigmaFoundationsSnapshotStyles;
}
