import {
  IColorObject,
  IEffectObject,
  IFileComponentObject,
  IHandoffConfigurationComponentOptions,
  IHandoffTransformer,
  IHandoffTransformerOptions,
  ITypographyObject,
} from "../../types";
import { formatTypographyTokenName, formatTokenValue } from "../utils";
import { getComponentInstanceTokens } from "../../transformer";

export function StyleDictionaryTransformer(options?: IHandoffTransformerOptions): IHandoffTransformer {
  const component = (
    id: string,
    component: IFileComponentObject,
    componentOptions?: IHandoffConfigurationComponentOptions
  ) => {
    const sd = {} as any;

    component.instances.forEach((instance) => {
      const tokens = getComponentInstanceTokens("json", instance, componentOptions);

      tokens.forEach((token) => {
        const tokenNameSegments = token.metadata.nameSegments;
        const lastIdx = tokenNameSegments.length - 1;
        let ref = sd;

        tokenNameSegments.forEach((tokenNameSegment, idx) => {
          if (idx === lastIdx) {
            return;
          }

          ref[tokenNameSegment] ??= {};
          ref = ref[tokenNameSegment];
        });

        const propParts = (tokenNameSegments[lastIdx] ?? "").split("-");

        propParts.forEach((el) => {
          ref[el] ??= {};
          ref = ref[el];
        });

        ref["value"] = formatTokenValue(token, "json", options?.useVariables);
      });
    });

    return JSON.stringify(sd, null, 2);
  };

  const colors = (colors: IColorObject[]) => {
    const sd = {} as any;

    colors.forEach((color) => {
      sd[color.group] ??= {};
      sd[color.group][color.machineName] = {
        value: color.value,
      };
    });

    return JSON.stringify({ color: sd }, null, 2);
  };

  const effects = (effects: IEffectObject[]) => {
    const sd = {} as any;
    const validEffects = effects?.filter(
      (effect) => effect.effects && effect.effects.length > 0
    );

    if (validEffects) {
      validEffects.forEach((effect) => {
        sd[effect.group] ??= {};
        sd[effect.group][effect.machineName] = {
          value:
            effect.effects.map((effect) => effect.value).join(", ") || "none",
        };
      });
    }

    return JSON.stringify({ effect: sd }, null, 2);
  };

  const types = (types: ITypographyObject[]) => {
    return JSON.stringify(
      {
        typography: types.reduce(
          (obj, type) => ({
            ...obj,
            [formatTypographyTokenName(type)]: {
              font: {
                family: { value: type.values.fontFamily },
                size: { value: `${type.values.fontSize}px` },
                weight: { value: type.values.fontWeight },
              },
              line: {
                height: {
                  value: (
                    type.values.lineHeightPx / type.values.fontSize
                  ).toFixed(1),
                },
              },
              letter: {
                spacing: { value: `${type.values.letterSpacing}px` },
              },
              paragraph: {
                spacing: { value: `${type.values.paragraphSpacing | 20}px` },
              },
            },
          }),
          {} as any
        ),
      },
      null,
      2
    );
  };

  return { component, colors, effects, types };
}
