import {
  isShadowEffectType,
  isValidEffectType,
  isValidGradientType,
  transformFigmaColorToHex,
  transformFigmaEffectToCssBoxShadow,
  transformFigmaFillsToCssColor,
} from "../../utils";
import {
  IColorObject,
  IDocumentationObject,
  IEffectObject,
  LocalStyleNode,
  ReferenceObject,
  ITypographyObject,
  NodeStyleMap,
} from "../../types";
import { resolvePaint } from "../utils";

export default function extract(styles: LocalStyleNode[]): IDocumentationObject["localStyles"] {
  const result: IDocumentationObject["localStyles"] = {
    color: [],
    effect: [],
    typography: [],
    $map: { colors: {}, effects: {}, typography: {} },
  };

  styles.forEach((style) => {
    if (style.type === "RECTANGLE") {
      let { name, machine_name, group, groups, subgroup } = fieldData(style.name);
      if (isArray(style.effects) && style.effects.length > 0) {
        result.effect.push({
          id: style.id,
          reference: `effect-${group}-${machine_name}`,
          name,
          machineName: machine_name,
          group,
          effects: style.effects
            .filter(
              (effect) => isValidEffectType(effect.type) && effect.visible
            )
            .map((effect) => ({
              type: effect.type,
              value: isShadowEffectType(effect.type)
                ? transformFigmaEffectToCssBoxShadow(effect)
                : "",
            })),
        });
      } else if (
        isArray(style.fills) &&
        style.fills[0] &&
        (style.fills[0].type === "SOLID" ||
          isValidGradientType(style.fills[0].type))
      ) {
        const color = transformFigmaFillsToCssColor(style.fills);
        result.color.push({
          id: style.id,
          name,
          group,
          subgroup,
          groups,
          value: color.color,
          blend: color.blend,
          sass: `$color-${group}-${machine_name}`,
          reference: `color-${group}-${machine_name}`,
          machineName: machine_name,
        });
      }
    } else if (style.type === "EFFECT") {
      let { name, machine_name, group } = fieldData(style.name);
      const effects = style.effects.filter(
        (effect) => isValidEffectType(effect.type) && effect.visible
      );

      result.effect.push({
        id: style.id,
        reference: `effect-${group}-${machine_name}`,
        name,
        machineName: machine_name,
        group,
        effects: effects.map((effect) => {
          return {
            type: effect.type,
            value: isShadowEffectType(effect.type)
              ? transformFigmaEffectToCssBoxShadow({
                  ...effect,
                  spread: "spread" in effect ? effect.spread : 0,
                })
              : "",
          };
        }),
      });
    } else if (style.type === "PAINT") {
      let { name, machine_name, group, groups, subgroup } = fieldData(style.name);

      const colors = resolvePaint(style.paints);
      const cssColors = transformFigmaFillsToCssColor(colors);

      if ("color" in cssColors) {
        result.color.push({
          id: style.id,
          name,
          group,
          subgroup,
          groups,
          value: cssColors.color,
          blend: cssColors.blend,
          sass: `$color-${group}-${machine_name}`,
          reference: `color-${group}-${machine_name}`,
          machineName: machine_name,
        });
      }
    } else {
      if ("description" in style) {
        let { machine_name, group } = fieldData(style.name);
        const lineHeight =
          style.lineHeight.unit !== "AUTO"
            ? style.lineHeight.unit === "PIXELS"
              ? `${style.lineHeight.value}px`
              : `${style.lineHeight.value}%`
            : 1.5;
        const lineHeightPx =
          style.lineHeight.unit !== "AUTO"
            ? style.lineHeight.unit === "PIXELS"
              ? style.lineHeight.value
              : (style.lineHeight.value / 100) * style.fontSize
            : 1.25 * style.fontSize;
        const lineHeightPct =
          style.lineHeight.unit !== "AUTO"
            ? style.lineHeight.unit === "PERCENT"
              ? style.lineHeight.value
              : (style.lineHeight.value / style.fontSize) * 100
            : 125;
        const letterSpacing =
          style.letterSpacing.unit === "PERCENT"
            ? `${(style.letterSpacing.value / 100) * style.fontSize}`
            : `${style.letterSpacing.value}`;

        result.typography.push({
          id: style.id,
          reference: `typography-${group}-${machine_name}`,
          name: style.name,
          machine_name,
          group,
          values: {
            fontSize: style.fontSize,
            fontFamily: style.fontName.family,
            fontWeight: style.fontName.style,
            lineHeight,
            lineHeightPx: Math.round(lineHeightPx),
            lineHeightPct: Math.round(lineHeightPct),
            letterSpacing,
            textDecoration: style.textDecoration,
            textCase: style.textCase,
          },
        });
      } else {
        let { machine_name, group } = fieldData(style.name);
        let color: string | undefined;

        if (
          isArray(style.fills) &&
          style.fills[0] &&
          style.fills[0].type === "SOLID" &&
          style.fills[0].color
        ) {
          color = transformFigmaColorToHex(style.fills[0].color);
        }
        result.typography.push({
          id: style.id,
          reference: `typography-${group}-${machine_name}`,
          name: style.name,
          machine_name,
          group,
          values: {
            // @ts-ignore
            ...style.style,
            color,
          },
        });
      }
    }
  });

  result.$map = extractMap(result);

  return result;
}

function extractMap(localStylesData: IDocumentationObject["localStyles"]) {
  return {
    colors: localStylesData.color.reduce(
      (acc: NodeStyleMap, color: IColorObject) => {
        acc[color.id] = {
          reference: color.reference,
          type: "color",
          group: color.group,
          name: color.name,
        } as ReferenceObject;

        return acc;
      },
      {}
    ),
    effects: localStylesData.effect.reduce(
      (acc: NodeStyleMap, effect: IEffectObject) => {
        acc[effect.id] = {
          reference: effect.reference,
          group: effect.group,
          name: effect.name,
          type: "effect",
        } as ReferenceObject;
        return acc;
      },
      {}
    ),
    typography: localStylesData.typography.reduce(
      (acc: NodeStyleMap, typo: ITypographyObject) => {
        acc[typo.id] = {
          reference: typo.reference,
          type: "typography",
          group: typo.group,
          name: typo.name,
        } as ReferenceObject;
        return acc;
      },
      {}
    ),
  };
}

interface GroupNameData {
  name: string;
  machine_name: string;
  group: string;
  subgroup: string | null;
  groups: string[];
}

/**
 * Checks if input is an array
 * @param input
 * @returns boolean
 */
const isArray = (input: any): input is any[] | readonly any[] => {
  return Array.isArray(input);
};

/**
 * Extracts the group name and machine name from a string
 * @param name
 * @returns GroupNameData
 */
const fieldData = (name: string): GroupNameData => {
  let nameArray = name.split('/');
  const data = {
    name: '',
    machine_name: '',
    group: '',
    subgroup: null,
    groups: [...nameArray],
  };
  if (nameArray[1]) {
    data.group = toMachineName(nameArray[0]!);
    if(nameArray[2]) data.subgroup = toMachineName(nameArray[1]!);
    data.name = nameArray.splice(1).join(' ');
    data.machine_name = toMachineName(data.name);
  } else {
    data.name = nameArray[0]!;
    data.machine_name = toMachineName(data.name);
  }
  return data;
};
/**
 * Create a machine name from a string
 * @param name
 * @returns string
 */
const toMachineName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/gi, "")
    .replace(/\s\-\s|\s+/gi, "-");
};
