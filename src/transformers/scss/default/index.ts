import {
  IColorObject,
  IEffectObject,
  IFileComponentObject,
  IHandoffConfigurationComponentOptions,
  IHandoffTransformer,
  IHandoffTransformerOptions,
  ITypographyObject,
} from "../../../types";
import {
  getComponentCommentBlock,
  formatTypographyTokenName,
  formatTokenValue,
} from "../../utils";
import { getComponentInstanceTokens } from "../../../transformer";

export function ScssTransformer(options?: IHandoffTransformerOptions): IHandoffTransformer {
  const component = (
    _: string,
    component: IFileComponentObject,
    componentOptions?: IHandoffConfigurationComponentOptions
  ) => {
    let result: string | null = null;

    for (const instance of component.instances) {
      const heading = getComponentCommentBlock(instance, "//");
      const tokens = getComponentInstanceTokens("scss", instance, componentOptions)
        .map(
          (token) =>
            `\t${token.name}: ${formatTokenValue(token, "scss", options?.useVariables)};`
        )
        .join("\n");

      if (!result) {
        result = `${heading}\n${tokens}`;
      } else {
        result += `\n\n${heading}\n${tokens}`;
      }
    }

    return result ?? "";
  };

  const colors = (colors: IColorObject[]) => {
    const stringBuilder: Array<string> = [];

    colors.forEach((color) => {
      stringBuilder.push(
        `$color-${color.group}-${color.machineName}: ${color.value};`
      );
    });

    return stringBuilder.join("\n");
  };

  const effects = (effects: IEffectObject[]) => {
    const stringBuilder: Array<string> = [];

    const validEffects = effects?.filter(
      (effect) => effect.effects && effect.effects.length > 0
    );

    if (validEffects) {
      validEffects.forEach((effect) => {
        stringBuilder.push(
          `$effect-${effect.group}-${effect.machineName}: ${
            effect.effects.map((effect) => effect.value).join(", ") || "none"
          };`
        );
      });
    }

    return stringBuilder.join("\n");
  };

  const types = (types: ITypographyObject[]) => {
    const stringBuilder: Array<string> = [];

    types.forEach((type) => {
      stringBuilder.push(
        [
          `$typography-${formatTypographyTokenName(type)}-font-family: '${
            type.values.fontFamily
          }';`,
          `$typography-${formatTypographyTokenName(type)}-font-size: ${
            type.values.fontSize
          }px;`,
          `$typography-${formatTypographyTokenName(type)}-font-weight: ${
            type.values.fontWeight
          };`,
          `$typography-${formatTypographyTokenName(type)}-line-height: ${(
            type.values.lineHeightPx / type.values.fontSize
          ).toFixed(1)};`,
          `$typography-${formatTypographyTokenName(type)}-letter-spacing: ${
            type.values.letterSpacing
          }px;`,
          `$typography-${formatTypographyTokenName(type)}-paragraph-spacing: ${
            type.values.paragraphSpacing | 20
          }px;`,
        ].join("\n")
      );
    });

    return stringBuilder.join("\n");
  };

  return { component, colors, effects, types };
}
