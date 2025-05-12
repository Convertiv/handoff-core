import { interpolateTokens, processValueWithRules } from "../utils";
import * as Types from "../types";
import * as TransformerTypes from "./types";
import {
  formatTokenName,
  transformFigmaTextAlignToCss,
  transformFigmaTextCaseToCssTextTransform,
  transformFigmaTextDecorationToCss,
} from "./utils";
import { asCssNumber } from "../utils";
import {
  transformFigmaEffectToCssBoxShadow,
  transformFigmaFillsToCssColor,
} from "../utils";

export default function transform(
  transformer: Types.IHandoffTransformer,
  documentationObject: Pick<Types.IDocumentationObject, "components" | "localStyles">,
  configuration?: Types.IHandoffConfiguration,
  _?: Types.ILogger
): Types.ITransformerResult {
  const componentDict: Record<string, string> = {};

  if (documentationObject.components) {
    for (const componentId in documentationObject.components) {
      if (
        transformer.component &&
        documentationObject.components[componentId]
      ) {
        componentDict[componentId] = transformer.component(
          componentId,
          documentationObject.components[componentId],
          !!configuration?.options?.transformer
            ? configuration.options.transformer[componentId] ?? configuration.options.transformer["*"]
            : undefined
        );
      }
    }
  }

  return {
    components: componentDict,
    design: {
      colors:
        documentationObject.localStyles?.color && transformer.colors
          ? transformer.colors(documentationObject.localStyles.color)
          : "",
      effects:
        documentationObject.localStyles?.effect && transformer.effects
          ? transformer.effects(documentationObject.localStyles.effect)
          : "",
      typography:
        documentationObject.localStyles?.typography && transformer.types
          ? transformer.types(documentationObject.localStyles.typography)
          : "",
    },
  };
}

export const transformComponentInstance = (
  tokenType: TransformerTypes.TokenType,
  component: Types.IComponentInstance,
  options?: Types.IHandoffConfigurationComponentOptions
) => {
  let tokens: Types.IToken[] = [];

  for (const part in component.parts) {
    const tokenSets = component.parts[part];

    if (!tokenSets || tokenSets.length === 0) {
      continue;
    }

    tokenSets.forEach((tokenSet) =>
      tokens.push(
        ...transformComponentInstanceTokens(
          getTokenSetTokens(tokenSet),
          tokenType,
          component,
          part,
          options,
          tokenSet.reference
        )
      )
    );
  }

  return tokens;
};

const transformComponentInstanceTokens = (
  tokens: TransformerTypes.TokenDict | undefined,
  tokenType: TransformerTypes.TokenType,
  component: Types.IComponentInstance,
  part: string,
  options?: Types.IHandoffConfigurationComponentOptions,
  reference?: Types.ReferenceObject
) => {
  return tokens
    ? Object.entries(tokens).map(([cssProperty, value]) => {
        const tokenNameSegments = getTokenNameSegments(
          component.name,
          component.variantProperties,
          part,
          cssProperty,
          options
        );

        return {
          name: formatTokenName(tokenType, tokenNameSegments),
          value: typeof value === "string" ? value : value?.value ?? "",
          metadata: {
            part,
            cssProperty,
            reference,
            isSupportedCssProperty:
              typeof value === "string"
                ? true
                : value?.isSupportedCssProperty ?? true,
            nameSegments: tokenNameSegments,
          },
        };
      })
    : [];
};

const getTokenNameSegments = (
  componentName: string,
  componentVariantProps: [string, string][],
  part: string,
  property: string,
  options?: Types.IHandoffConfigurationComponentOptions
) => {
  if (options?.tokenNameSegments) {
    return options.tokenNameSegments
      .map((tokenNamePart) => {
        const initialValue = tokenNamePart;
        tokenNamePart = interpolateTokens(
          tokenNamePart,
          new Map([
            ["component", componentName],
            ["part", normalizeComponentPartName(part)],
            ["property", property],
          ]),
          (token, _, value) => (value === "" ? token : value)
        );

        tokenNamePart = interpolateTokens(
          tokenNamePart,
          new Map(
            componentVariantProps.map(([k, v]) => [
              ("Variant." + k).toLowerCase(),
              v.toLowerCase(),
            ])
          ),
          (_, variantProp, value) =>
            processValueWithRules(
              variantProp.replace("variant.", ""),
              value,
              options
            )
        );

        // Backward compatibility (remove before 1.0 release)
        if (tokenNamePart === "") {
          tokenNamePart = interpolateTokens(
            initialValue,
            new Map(
              componentVariantProps.map(([k, v]) => [
                k.toLowerCase(),
                v.toLowerCase(),
              ])
            ),
            (_, variantProp, value) =>
              processValueWithRules(variantProp, value, options)
          );
        }

        return tokenNamePart;
      })
      .filter((part) => part !== "");
  }

  const parts: string[] = [componentName, normalizeComponentPartName(part)];

  componentVariantProps.forEach(([variantProp, value]) => {
    parts.push(processValueWithRules(variantProp, value, options));
  });

  parts.push(property);

  return parts.filter((part) => part !== "");
};

const normalizeComponentPartName = (part: string) => {
  return part === "$"
    ? ""
    : part.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
};

const getTokenSetTokens = (
  tokenSet: Types.TokenSet
): TransformerTypes.TokenDict | undefined => {
  switch (tokenSet.name) {
    case "BACKGROUND":
      return getBackgroundTokenSetTokens(tokenSet);
    case "SPACING":
      return getSpacingTokenSetTokens(tokenSet);
    case "BORDER":
      return getBorderTokenSetTokens(tokenSet);
    case "TYPOGRAPHY":
      return getTypographyTokenSetTokens(tokenSet);
    case "FILL":
      return getFillTokenSetTokens(tokenSet);
    case "EFFECT":
      return getEffectTokenSetTokens(tokenSet);
    case "OPACITY":
      return getOpacityTokenSetTokens(tokenSet);
    case "SIZE":
      return getSizeTokenSetTokens(tokenSet);
    default:
      return undefined;
  }
};

const getBackgroundTokenSetTokens = (
  tokenSet: Types.BackgroundTokenSet
): TransformerTypes.BackgroundTokenDict => ({
  background: {
    value: transformFigmaFillsToCssColor(tokenSet.background).color,
    isSupportedCssProperty: true,
  },
});

const getSpacingTokenSetTokens = (
  tokenSet: Types.SpacingTokenSet
): TransformerTypes.SpacingTokenDict => ({
  "padding-y": {
    value: `${asCssNumber(
      (tokenSet.padding.TOP + tokenSet.padding.BOTTOM) / 2
    )}px`,
    isSupportedCssProperty: false,
  },
  "padding-x": {
    value: `${asCssNumber(
      (tokenSet.padding.LEFT + tokenSet.padding.RIGHT) / 2
    )}px`,
    isSupportedCssProperty: false,
  },
  "padding-top": `${asCssNumber(tokenSet.padding.TOP)}px`,
  "padding-right": `${asCssNumber(tokenSet.padding.RIGHT)}px`,
  "padding-bottom": `${asCssNumber(tokenSet.padding.BOTTOM)}px`,
  "padding-left": {
    value: `${asCssNumber(tokenSet.padding.LEFT)}px`,
    isSupportedCssProperty: false,
  },
  "padding-start": {
    value: `${asCssNumber(tokenSet.padding.LEFT)}px`,
    isSupportedCssProperty: false,
  },
  "padding-end": `${asCssNumber(tokenSet.padding.RIGHT)}px`,
  spacing: {
    value: `${asCssNumber(tokenSet.spacing)}px`,
    isSupportedCssProperty: false,
  },
});

const getBorderTokenSetTokens = (
  tokenSet: Types.BorderTokenSet
): TransformerTypes.BorderTokenDict => ({
  "border-width": `${asCssNumber(tokenSet.weight)}px`,
  "border-radius": `${asCssNumber(tokenSet.radius)}px`,
  "border-color": transformFigmaFillsToCssColor(tokenSet.strokes, true).color,
  "border-style": (tokenSet.dashes[0] ?? 0) === 0 ? "solid" : "dashed",
});

const getTypographyTokenSetTokens = (
  tokenSet: Types.TypographyTokenSet
): TransformerTypes.TypographyTokenDict => ({
  "font-family": `'${tokenSet.fontFamily}'`,
  "font-size": `${asCssNumber(tokenSet.fontSize)}px`,
  "font-weight": `${asCssNumber(tokenSet.fontWeight)}`,
  "line-height": `${asCssNumber(tokenSet.lineHeight)}`,
  "letter-spacing": `${asCssNumber(tokenSet.letterSpacing)}px`,
  "text-align": transformFigmaTextAlignToCss(tokenSet.textAlignHorizontal),
  "text-decoration": transformFigmaTextDecorationToCss(tokenSet.textDecoration),
  "text-transform": transformFigmaTextCaseToCssTextTransform(tokenSet.textCase),
});

const getFillTokenSetTokens = (
  tokenSet: Types.FillTokenSet
): TransformerTypes.FillTokenDict => ({
  color: transformFigmaFillsToCssColor(tokenSet.color, true).color,
});

const getEffectTokenSetTokens = (
  tokenSet: Types.EffectTokenSet
): TransformerTypes.EffectTokenDict => ({
  "box-shadow":
    tokenSet.effect
      .map(transformFigmaEffectToCssBoxShadow)
      .filter(Boolean)
      .join(", ") || "none",
});

const getOpacityTokenSetTokens = (
  tokenSet: Types.OpacityTokenSet
): TransformerTypes.OpacityTokenDict => ({
  opacity: `${asCssNumber(tokenSet.opacity)}`,
});

const getSizeTokenSetTokens = (
  tokenSet: Types.SizeTokenSet
): TransformerTypes.TokenDict => ({
  width: `${asCssNumber(tokenSet.width) ?? "0"}px`,
  "width-raw": {
    value: `${asCssNumber(tokenSet.width) ?? "0"}`,
    isSupportedCssProperty: false,
  },
  height: `${asCssNumber(tokenSet.height) ?? "0"}px`,
  "height-raw": {
    value: `${asCssNumber(tokenSet.height) ?? "0"}`,
    isSupportedCssProperty: false,
  },
});
