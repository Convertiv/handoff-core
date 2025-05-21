import {
  IColorObject,
  IEffectObject,
  IFileComponentObject,
  IHandoffConfigurationComponentOptions,
  IHandoffTransformer,
  IHandoffTransformerOptions,
  ITypographyObject,
} from "../../types";
import { formatTypographyTokenName } from "../utils";
import { getComponentInstanceTokens } from "../../transformer";

export function MapTransformer(_?: IHandoffTransformerOptions): IHandoffTransformer {
  const component = (
    _: string,
    component: IFileComponentObject,
    componentOptions?: IHandoffConfigurationComponentOptions
  ) => {
    const map = {} as Record<string, string>;

    component.instances.forEach((instance) => {
      const tokens = getComponentInstanceTokens("json", instance, componentOptions);

      tokens.forEach((token) => {
        map[token.name] = token.value;
      });
    });

    return JSON.stringify(map, null, 2);
  };

  const colors = (colors: IColorObject[]) => {
    const result: Record<string, string> = {};

    colors.forEach((color) => {
      result[`color-${color.group}-${color.machineName}`] = `${color.value}`;
    });

    return JSON.stringify(result, null, 2);
  };

  const effects = (effects: IEffectObject[]) => {
    const result: Record<string, string> = {};

    const validEffects = effects?.filter(
      (effect) => effect.effects && effect.effects.length > 0
    );

    if (validEffects) {
      validEffects.forEach((effect) => {
        result[`effect-${effect.group}-${effect.machineName}`] = `${
          effect.effects.map((effect) => effect.value).join(", ") || "none"
        }`;
      });
    }

    return JSON.stringify(result, null, 2);
  };

  const types = (types: ITypographyObject[]) => {
    const result: Record<string, string> = {};

    types.forEach((type) => {
      result[
        `typography-${formatTypographyTokenName(type)}-font-family`
      ] = `${type.values.fontFamily}`;
      result[
        `typography-${formatTypographyTokenName(type)}-font-size`
      ] = `${type.values.fontSize}px`;
      result[
        `typography-${formatTypographyTokenName(type)}-font-weight`
      ] = `${type.values.fontWeight}`;
      result[`typography-${formatTypographyTokenName(type)}-line-height`] = `${(
        type.values.lineHeightPx / type.values.fontSize
      ).toFixed(1)}`;
      result[
        `typography-${formatTypographyTokenName(type)}-letter-spacing`
      ] = `${type.values.letterSpacing}px`;
      result[`typography-${formatTypographyTokenName(type)}-paragraph-spacing`] = `${
        type.values.paragraphSpacing | 20
      }px`;
    });

    return JSON.stringify(result, null, 2);
  };

  return { component, colors, effects, types };
}
