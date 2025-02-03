import {
  IColorObject,
  IEffectObject,
  IFileComponentObject,
  IHandoffConfigurationComponentOptions,
  IHandoffTransformer,
  ITypographyObject,
} from "../../../types";
import {
  formatComponentCodeBlockComment,
  formatTypeName,
  tokenReferenceFormat,
} from "../../utils";
import { transformComponentInstance } from "../../../transformer";

export function ScssTransformer(): IHandoffTransformer {
  const component = (
    _: string,
    component: IFileComponentObject,
    options?: IHandoffConfigurationComponentOptions
  ) => {
    let result: string | null = null;

    for (const instance of component.instances) {
      const heading = formatComponentCodeBlockComment(instance, "//");
      const tokens = transformComponentInstance("scss", instance, options)
        .map(
          (token) =>
            `\t${token.name}: ${tokenReferenceFormat(token, "scss", true)};`
        ) // TODO: Introduce option for references to be optional
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
          `$typography-${formatTypeName(type)}-font-family: '${
            type.values.fontFamily
          }';`,
          `$typography-${formatTypeName(type)}-font-size: ${
            type.values.fontSize
          }px;`,
          `$typography-${formatTypeName(type)}-font-weight: ${
            type.values.fontWeight
          };`,
          `$typography-${formatTypeName(type)}-line-height: ${(
            type.values.lineHeightPx / type.values.fontSize
          ).toFixed(1)};`,
          `$typography-${formatTypeName(type)}-letter-spacing: ${
            type.values.letterSpacing
          }px;`,
          `$typography-${formatTypeName(type)}-paragraph-spacing: ${
            type.values.paragraphSpacing | 20
          }px;`,
        ].join("\n")
      );
    });

    return stringBuilder.join("\n");
  };

  return { component, colors, effects, types };
}
