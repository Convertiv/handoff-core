import {
  IColorObject,
  IEffectObject,
  IFileComponentObject,
  IHandoffConfigurationComponentOptions,
  IHandoffTransformer,
  IHandoffTransformerOptions,
  ITypographyObject,
} from "../../types";
import {
  getComponentCommentBlock,
  formatTypographyTokenName,
  formatTokenValue,
} from "../utils";
import { getComponentInstanceTokens } from "../../transformer";

export function CssTransformer(options?: IHandoffTransformerOptions): IHandoffTransformer {
  const component = (
    id: string,
    component: IFileComponentObject,
    componentOptions?: IHandoffConfigurationComponentOptions
  ) => {
    const lines = [];
    const componentCssClass = componentOptions?.cssRootClass ?? id;

    lines.push(`.${componentCssClass} {`);
    const cssVars = component.instances.map(
      (instance) =>
        `\t${getComponentCommentBlock(
          instance,
          "/**/"
        )}\n${getComponentInstanceTokens("css", instance, componentOptions)
          .map(
            (token) =>
              `\t${token.name}: ${formatTokenValue(token, "css", options?.useVariables)};`
          )
          .join("\n")}`
    );

    return lines.concat(cssVars).join("\n\n") + "\n}\n";
  };

  const colors = (colors: IColorObject[]) => {
    const stringBuilder: Array<string> = [];

    colors.forEach((color) => {
      stringBuilder.push(
        `	--color-${color.group}-${color.machineName}: ${color.value};`
      );
    });

    return `:root {\n${stringBuilder.join("\n")}\n}\n`;
  };

  const effects = (effects: IEffectObject[]) => {
    const stringBuilder: Array<string> = [];

    const validEffects = effects?.filter(
      (effect) => effect.effects && effect.effects.length > 0
    );

    if (validEffects) {
      validEffects.forEach((effect) => {
        stringBuilder.push(
          `	--effect-${effect.group}-${effect.machineName}: ${
            effect.effects.map((effect) => effect.value).join(", ") || "none"
          };`
        );
      });
    }

    return `:root {\n${stringBuilder.join("\n")}\n}\n`;
  };

  const types = (types: ITypographyObject[]) => {
    const stringBuilder: Array<string> = [];

    types.forEach((type) => {
      stringBuilder.push(
        [
          `	--typography-${formatTypographyTokenName(type)}-font-family: '${
            type.values.fontFamily
          }';`,
          `	--typography-${formatTypographyTokenName(type)}-font-size: ${
            type.values.fontSize
          }px;`,
          `	--typography-${formatTypographyTokenName(type)}-font-weight: ${
            type.values.fontWeight
          };`,
          `	--typography-${formatTypographyTokenName(type)}-line-height: ${(
            type.values.lineHeightPx / type.values.fontSize
          ).toFixed(1)};`,
          `	--typography-${formatTypographyTokenName(type)}-letter-spacing: ${
            type.values.letterSpacing
          }px;`,
          `	--typography-${formatTypographyTokenName(type)}-paragraph-spacing: ${
            type.values.paragraphSpacing | 20
          }px;`,
        ].join("\n")
      );
    });
    // Get a unique list of font families
    const fontFamilies = types.map((type) => type.values.fontFamily);
    const uniqueFontFamilies = Array.from(new Set(fontFamilies));
    // Add the font families to the top of the typography
    uniqueFontFamilies.forEach((fontFamily) => {
      stringBuilder.unshift(
        `	--font-family-${fontFamily
          .replace(/ /g, "-")
          .toLowerCase()}: '${fontFamily}';`
      );
    });

    return `:root {\n${stringBuilder.join("\n")}\n}\n`;
  };

  return { component, colors, effects, types };
}
