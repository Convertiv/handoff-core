import {
  IColorObject,
  IEffectObject,
  IFileComponentObject,
  IIntegrationComponentOptions,
  ITransformer,
  ITypographyObject,
} from "../../types";
import { formatTypeName } from "../utils";
import { transformComponentInstance } from "../../transformer";

export function MapTransformer(): ITransformer {
  const component = (
    _: string,
    component: IFileComponentObject,
    options?: IIntegrationComponentOptions
  ) => {
    const map = {} as Record<string, string>;

    component.instances.forEach((instance) => {
      const tokens = transformComponentInstance("map", instance, options);

      tokens.forEach((token) => {
        map[token.name] = token.value;
      });
    });

    return JSON.stringify(map);
  };

  const colors = (colors: IColorObject[]) => {
    const result: Record<string, string> = {};

    colors.forEach((color) => {
      result[`color-${color.group}-${color.machineName}`] = `${color.value}`;
    });

    return JSON.stringify(result);
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

    return JSON.stringify(result);
  };

  const types = (types: ITypographyObject[]) => {
    const result: Record<string, string> = {};

    types.forEach((type) => {
      result[
        `typography-${formatTypeName(type)}-font-family`
      ] = `${type.values.fontFamily}`;
      result[
        `typography-${formatTypeName(type)}-font-size`
      ] = `${type.values.fontSize}px`;
      result[
        `typography-${formatTypeName(type)}-font-weight`
      ] = `${type.values.fontWeight}`;
      result[`typography-${formatTypeName(type)}-line-height`] = `${(
        type.values.lineHeightPx / type.values.fontSize
      ).toFixed(1)}`;
      result[
        `typography-${formatTypeName(type)}-letter-spacing`
      ] = `${type.values.letterSpacing}px`;
      result[`typography-${formatTypeName(type)}-paragraph-spacing`] = `${
        type.values.paragraphSpacing | 20
      }px`;
    });

    return JSON.stringify(result);
  };

  return { component, colors, effects, types };
}
