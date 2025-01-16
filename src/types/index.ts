import * as FigmaTypes from "./figma";

//#region DOCUMENTATION

export interface ColorObject {
  id: string;
  name: string;
  machineName: string;
  value: string | null;
  blend: string | null;
  group: string;
  groupLabel: string;
  sass: string;
  reference: string;
}

export interface TypographyObject {
  id: string;
  name: string;
  machine_name: string;
  group: string;
  groupLabel: string;
  values: any;
  reference: string;
}

export interface EffectObject {
  id: string;
  name: string;
  machineName: string;
  group: string;
  groupLabel: string;
  effects: {
    type: FigmaTypes.Effect["type"];
    value: string;
  }[];
  reference: string;
}

export interface ComponentInstance {
  id: string;
  name: string;
  description?: string;
  variantProperties: [string, string][];
  parts?: { [key: string]: TokenSets };
}

export interface FileComponentObject {
  instances: ComponentInstance[];
}

export interface AssetObject {
  path: string;
  name: string;
  icon: string;
  index: string;
  size: number;
  data: string;
  description?: string;
}

export interface DocumentationObject {
  timestamp?: string;
  design?: {
    color?: ColorObject[];
    typography?: TypographyObject[];
    effect?: EffectObject[];
  };
  components?: {
    [key: string]: FileComponentObject;
  };
  assets?: {
    icons: AssetObject[];
    logos: AssetObject[];
  };
}

//#endregion

//#region INTERNAL

export interface ReferenceObject {
  reference: string;
  type: string;
  name: string;
  group: string;
}

export interface BaseTokenSet {
  name: Exportable;
  reference?: ReferenceObject;
}

export interface BackgroundTokenSet extends BaseTokenSet {
  name: "BACKGROUND";
  background: FigmaTypes.Paint[];
}

export interface SpacingTokenSet extends BaseTokenSet {
  name: "SPACING";
  padding: { [key in "TOP" | "RIGHT" | "BOTTOM" | "LEFT"]: number };
  spacing: number;
}

export interface BorderTokenSet extends BaseTokenSet {
  name: "BORDER";
  weight: number;
  radius: number;
  strokes: FigmaTypes.Paint[];
  dashes: number[];
}

export interface TypographyTokenSet extends BaseTokenSet {
  name: "TYPOGRAPHY";
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textAlignHorizontal: FigmaTypes.TypeStyle["textAlignHorizontal"];
  textDecoration: FigmaTypes.TypeStyle["textDecoration"];
  textCase: FigmaTypes.TypeStyle["textCase"];
  characters: string;
}

export interface FillTokenSet extends BaseTokenSet {
  name: "FILL";
  color: FigmaTypes.Paint[];
}

export interface EffectTokenSet extends BaseTokenSet {
  name: "EFFECT";
  effect: FigmaTypes.Effect[];
}

export interface OpacityTokenSet extends BaseTokenSet {
  name: "OPACITY";
  opacity: number;
}

export interface SizeTokenSet extends BaseTokenSet {
  name: "SIZE";
  width: number;
  height: number;
}

export type TokenSet =
  | BackgroundTokenSet
  | SpacingTokenSet
  | BorderTokenSet
  | TypographyTokenSet
  | FillTokenSet
  | EffectTokenSet
  | OpacityTokenSet
  | SizeTokenSet;

export type TokenSets = TokenSet[];

//#endregion

//#region API

export interface ILogger {
  log: (msg: string) => void;
  err: (msg: string) => void;
  warn: (msg: string) => void;
  success: (msg: string) => void;
}

export interface IIntegrationComponentOptions {
  cssRootClass?: string;
  tokenNameSegments?: string[];
  defaults: {
    [variantProperty: string]: string;
  };
  replace: { [variantProperty: string]: { [source: string]: string } };
}

export interface IIntegration {
  name: string;
  entries?: {
    integration?: string;
    templates?: string;
    bundle?: string;
  };
  options: {
    [key: string]: IIntegrationComponentOptions;
  };
}

export interface IProvider {
  getLocalStyles?: (logger?: ILogger) => Promise<LocalStyleNode[]>;
  getAssets?: (
    component: string,
    logger?: ILogger
  ) => Promise<
    { name: string; description: string; data: string; extension: string }[]
  >;
  getComponents?: (logger?: ILogger) => Promise<
    {
      name: string;
      componentSetNode: FigmaTypes.ComponentSet | ComponentSetNode;
      componentsMetadata: Map<string, FigmaTypes.ComponentMetadata>;
      definition: IComponentDefinition;
    }[]
  >;
}

export interface ITransformer {
  component?: (
    id: string,
    component: FileComponentObject,
    options?: IIntegrationComponentOptions
  ) => string;
  colors?: (colors: ColorObject[]) => string;
  effects?: (effects: EffectObject[]) => string;
  types?: (types: TypographyObject[]) => string;
}

export interface TransformerResult {
  components: Record<string, string>;
  design: Record<"colors" | "typography" | "effects", string>;
}

export interface IComponentDefinition {
  id: string;
  name: string;
  group?: string;
  parts: IComponentPart[];
  options?: IComponentDefinitionOptions;
}

export interface IComponentPart {
  id: string;
  tokens: { from: string; export: Exportable[] }[];
  condition?: string[][];
}

export interface IComponentDefinitionOptions {
  exporter?: {
    variantProperties: string[];
    sharedComponentVariants?: {
      componentId: string;
      sharedVariantProperty?: string;
      distinctiveVariantProperties?: string[];
    }[];
  };
}

/**
 * @deprecated Will be removed before 1.0.0 release.
 */
export interface ILegacyComponentDefinition {
  id: string;
  group?: string;
  options?: ILegacyComponentDefinitionOptions;
  parts: IComponentPart[];
}

/**
 * @deprecated Will be removed before 1.0.0 release.
 */
export interface ILegacyComponentDefinitionOptions {
  exporter?: {
    search: string;
    supportedVariantProps: {
      design: string[];
      layout: string[];
    };
  };
}

export interface IToken {
  name: string;
  value: string;
  metadata: {
    part: string;
    cssProperty: string;
    reference?: ReferenceObject;
    isSupportedCssProperty: boolean;
    nameSegments: string[];
  };
}

export type Exportable =
  | "BACKGROUND"
  | "BORDER"
  | "SPACING"
  | "TYPOGRAPHY"
  | "FILL"
  | "EFFECT"
  | "OPACITY"
  | "SIZE";

export type LocalStyleNode =
  | TextStyle
  | PaintStyle
  | EffectStyle
  | FigmaTypes.Text
  | FigmaTypes.Rectangle;

//#endregion
