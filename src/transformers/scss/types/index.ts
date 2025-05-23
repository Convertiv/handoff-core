import {
  IColorObject,
  IEffectObject,
  IFileComponentObject,
  IHandoffConfigurationComponentOptions,
  IHandoffTransformer,
  IHandoffTransformerOptions,
  ITypographyObject,
} from "../../../types";
import { formatTypographyTokenName } from "../../utils";
import { processValueWithRules, slugify } from "../../../utils";

export function ScssTypesTransformer(options?: IHandoffTransformerOptions): IHandoffTransformer {
  const component = (
    id: string,
    component: IFileComponentObject,
    componentOptions?: IHandoffConfigurationComponentOptions
  ) => {
    const result: { [variantProp: string]: Set<string> } = {};

    component.instances.forEach((instance) => {
      instance.variantProperties.forEach(([variantProp, value]) => {
        if (value) {
          result[variantProp] ??= new Set<string>();
          result[variantProp].add(
            processValueWithRules(variantProp, value, componentOptions, options?.useVariables)
          );
        }
      });
    });

    return (
      Object.keys(result)
        .map((variantProp) => {
          const mapValsStr = Array.from(result[variantProp] ?? [])
            .map((val) => `"${val}"`)
            .join(", ");
          return `$${id}-${slugify(variantProp)}-map: ( ${mapValsStr} );`;
        })
        .join("\n\n") + "\n"
    );
  };

  const colors = (colors: IColorObject[]) => {
    const stringBuilder: Array<string> = [];

    stringBuilder.push(
      `$color-groups: ( ${Array.from(
        new Set(colors.map((color) => `"${color.group}"`))
      ).join(", ")} );`
    );
    stringBuilder.push(
      `$color-names: ( ${colors
        .map((color) => `"${color.group}-${color.machineName}"`)
        .join(", ")} );`
    );
    stringBuilder.push(``);

    return stringBuilder.join("\n");
  };

  const effects = (effects: IEffectObject[]) => {
    const stringBuilder: Array<string> = [];

    const validEffects = effects?.filter(
      (effect) => effect.effects && effect.effects.length > 0
    );

    if (validEffects) {
      stringBuilder.push(
        `$effects: ( ${validEffects
          .map((effect) => `"${effect.group}-${effect.machineName}"`)
          .join(", ")} );`
      );
      stringBuilder.push(``);
    }

    return stringBuilder.join("\n");
  };

  const types = (types: ITypographyObject[]) => {
    const stringBuilder: Array<string> = [];

    stringBuilder.push(
      `$type-sizes: ( ${types
        .map((type) => `"${formatTypographyTokenName(type)}"`)
        .join(", ")} );`
    );

    return stringBuilder.join("\n");
  };

  return { component, colors, effects, types };
}
