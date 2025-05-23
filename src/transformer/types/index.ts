export type TokenType = "css" | "scss" | "json";

export type TokenDict = {
  [property: string]:
    | string
    | { value: string; isSupportedCssProperty: boolean }
    | undefined;
};

export type BackgroundTokenDict = {
  [K in "background"]: TokenDict[K];
};

export type SpacingTokenDict = {
  [K in
    | "padding-y"
    | "padding-x"
    | "padding-top"
    | "padding-right"
    | "padding-bottom"
    | "padding-left"
    | "padding-start"
    | "padding-end"
    | "spacing"]: TokenDict[K];
};

export type BorderTokenDict = {
  [K in
    | "border-width"
    | "border-radius"
    | "border-color"
    | "border-style"]: TokenDict[K];
};

export type TypographyTokenDict = {
  [K in
    | "font-family"
    | "font-size"
    | "font-weight"
    | "line-height"
    | "letter-spacing"
    | "text-align"
    | "text-decoration"
    | "text-transform"]: TokenDict[K];
};

export type FillTokenDict = {
  [K in "color"]: TokenDict[K];
};

export type EffectTokenDict = {
  [K in "box-shadow"]: TokenDict[K];
};

export type OpacityTokenDict = {
  [K in "opacity"]: TokenDict[K];
};

export type SizeTokenDict = {
  [K in "width" | "width-raw" | "height" | "height-raw"]: SizeTokenDict[K];
};