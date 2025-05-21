import * as FigmaTypes from "./figma";

export interface IColorObject {
  id: string;
  name: string;
  machineName: string;
  value: string | null;
  blend: string | null;
  group: string;
  subgroup: string | null;
  groups: string[];
  sass: string;
  reference: string;
}

export interface ITypographyObject {
  id: string;
  name: string;
  machine_name: string;
  group: string;
  values: any;
  reference: string;
}

export interface IEffectObject {
  id: string;
  name: string;
  machineName: string;
  group: string;
  effects: {
    type: FigmaTypes.Effect["type"];
    value: string;
  }[];
  reference: string;
}

export interface IAssetObject {
  path: string;
  name: string;
  icon: string;
  index: string;
  size: number;
  data: string;
  description?: string;
}

export interface IComponentInstance {
  id: string;
  name: string;
  description?: string;
  variantProperties: [string, string][];
  parts?: { [key: string]: TTokenSets };
}

export interface IFileComponentObject {
  instances: IComponentInstance[];
}

export interface IDocumentationObject {
  timestamp?: string;
  localStyles?: {
    color?: IColorObject[];
    typography?: ITypographyObject[];
    effect?: IEffectObject[];
    $map?: IDesignMap;
  };
  components?: {
    [key: string]: IFileComponentObject;
  };
  assets?: Record<string, IAssetObject[]>;
}

export interface ILogger {
  log: (msg: string) => void;
  err: (msg: string) => void;
  warn: (msg: string) => void;
  success: (msg: string) => void;
}

export interface IHandoffConfigurationComponentOptions {
  cssRootClass?: string;
  tokenNameSegments?: string[];
  defaults: {
    [variantProperty: string]: string;
  };
  replace: { [variantProperty: string]: { [source: string]: string } };
}

export interface IHandoffConfiguration {
  options?: {
    transformer?: {
      [key: string]: IHandoffConfigurationComponentOptions;
    }
  };
}

export interface IHandoffProvider {
  getLocalStyles?: (logger?: ILogger) => Promise<TLocalStyleNode[]>;
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

export interface IHandoffTransformerOptions {
  useVariables?: boolean;
}

export interface IHandoffTransformer {
  component?: (
    id: string,
    component: IFileComponentObject,
    options?: IHandoffConfigurationComponentOptions
  ) => string;
  colors?: (colors: IColorObject[]) => string;
  effects?: (effects: IEffectObject[]) => string;
  types?: (types: ITypographyObject[]) => string;
}

export interface ITransformerResult {
  components: Record<string, string>;
  design: Record<"colors" | "typography" | "effects", string>;
}

export interface IComponentDefinition {
  id: string;
  name: string;
  group?: string;
  parts: IComponentPart[];
  options?: IComponentDefinitionOptions;
  legacyDefinitionOptions?: ILegacyComponentDefinitionOptions;
}

export interface IComponentPart {
  id: string;
  tokens: { from: string; export: TExportable[] }[];
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

export interface ILegacyComponentDefinition {
  id: string;
  group?: string;
  options?: ILegacyComponentDefinitionOptions;
  parts: IComponentPart[];
}

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
    reference?: IReferenceObject;
    isSupportedCssProperty: boolean;
    nameSegments: string[];
  };
}

export type TExportable =
  | "BACKGROUND"
  | "BORDER"
  | "SPACING"
  | "TYPOGRAPHY"
  | "FILL"
  | "EFFECT"
  | "OPACITY"
  | "SIZE";

export type TLocalStyleNode =
  | TextStyle
  | PaintStyle
  | EffectStyle
  | FigmaTypes.Text
  | FigmaTypes.Rectangle;

export interface IReferenceObject {
  reference: string;
  type: string;
  name: string;
  group: string;
}

export interface INodeStyleMap {
  [key: string]: IReferenceObject;
}

export interface IDesignMap {
  colors: INodeStyleMap;
  effects: INodeStyleMap;
  typography: INodeStyleMap;
}

export interface IBaseTokenSet {
  name: TExportable;
  reference?: IReferenceObject;
}

export interface IBackgroundTokenSet extends IBaseTokenSet {
  name: "BACKGROUND";
  background: FigmaTypes.Paint[];
}

export interface ISpacingTokenSet extends IBaseTokenSet {
  name: "SPACING";
  padding: { [key in "TOP" | "RIGHT" | "BOTTOM" | "LEFT"]: number };
  spacing: number;
}

export interface IBorderTokenSet extends IBaseTokenSet {
  name: "BORDER";
  weight: number;
  radius: number;
  strokes: FigmaTypes.Paint[];
  dashes: number[];
}

export interface ITypographyTokenSet extends IBaseTokenSet {
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

export interface IFillTokenSet extends IBaseTokenSet {
  name: "FILL";
  color: FigmaTypes.Paint[];
}

export interface IEffectTokenSet extends IBaseTokenSet {
  name: "EFFECT";
  effect: FigmaTypes.Effect[];
}

export interface IOpacityTokenSet extends IBaseTokenSet {
  name: "OPACITY";
  opacity: number;
}

export interface ISizeTokenSet extends IBaseTokenSet {
  name: "SIZE";
  width: number;
  height: number;
}

export type TTokenSet =
  | IBackgroundTokenSet
  | ISpacingTokenSet
  | IBorderTokenSet
  | ITypographyTokenSet
  | IFillTokenSet
  | IEffectTokenSet
  | IOpacityTokenSet
  | ISizeTokenSet;

export type TTokenSets = TTokenSet[];
