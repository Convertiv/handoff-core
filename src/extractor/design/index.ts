import {
  isShadowEffectType,
  isValidEffectType,
  isValidGradientType,
  transformFigmaColorToHex,
  transformFigmaEffectToCssBoxShadow,
  transformFigmaFillsToCssColor,
} from "../../utils";
import {
  ColorObject,
  DocumentationObject,
  EffectObject,
  LocalStyleNode,
  ReferenceObject,
  TypographyObject,
} from "../../types";
import { resolvePaint } from "../utils";
import { DesignMap, NodeStyleMap } from "../types";

export default function extract(styles: LocalStyleNode[]): {
  data: DocumentationObject["design"];
  map: DesignMap;
} {
  const data: DocumentationObject["design"] = {
    color: [],
    effect: [],
    typography: [],
  };

  styles.forEach((style) => {
    if (style.type === "RECTANGLE") {
      let { name, machine_name, group, groupLabel } = fieldData(style.name);
      if (isArray(style.effects) && style.effects.length > 0) {
        data.effect.push({
          id: style.id,
          reference: `effect-${group}-${machine_name}`,
          name,
          machineName: machine_name,
          group,
          groupLabel,
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
        data.color.push({
          id: style.id,
          name,
          group,
          groupLabel,
          value: color.color,
          blend: color.blend,
          sass: `$color-${group}-${machine_name}`,
          reference: `color-${group}-${machine_name}`,
          machineName: machine_name,
        });
      }
    } else if (style.type === "EFFECT") {
      const { name, machine_name, group, groupLabel } = fieldData(style.name);
      const effects = style.effects.filter(
        (effect) => isValidEffectType(effect.type) && effect.visible
      );

      data.effect.push({
        id: style.id,
        reference: `effect-${group}-${machine_name}`,
        name,
        machineName: machine_name,
        group,
        groupLabel,
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
      const { name, machine_name, group, groupLabel } = fieldData(style.name);

      const colors = resolvePaint(style.paints);
      const cssColors = transformFigmaFillsToCssColor(colors);

      if ("color" in cssColors) {
        data.color.push({
          id: style.id,
          name,
          machineName: machine_name,
          group,
          groupLabel,
          value: cssColors.color,
          blend: cssColors.blend,
          sass: `$color-${group}-${machine_name}`,
          reference: `color-${group}-${machine_name}`,
        });
      }
    } else {
      if ("description" in style) {
        const { name, machine_name, group, groupLabel } = fieldData(style.name);
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

        data.typography.push({
          id: style.id,
          reference: `typography-${group}-${machine_name}`,
          name,
          machine_name,
          group,
          groupLabel,
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
        let { machine_name, group, groupLabel } = fieldData(style.name);
        let color: string | undefined;

        if (
          isArray(style.fills) &&
          style.fills[0] &&
          style.fills[0].type === "SOLID" &&
          style.fills[0].color
        ) {
          color = transformFigmaColorToHex(style.fills[0].color);
        }
        data.typography.push({
          id: style.id,
          reference: `typography-${group}-${machine_name}`,
          name: style.name,
          machine_name,
          group,
          groupLabel,
          values: {
            // @ts-ignore
            ...style.style,
            color,
          },
        });
      }
    }
  });

  return {
    data,
    map: extractMap(data),
  };
}

function extractMap(localStylesData: DocumentationObject["design"]) {
  return {
    colors: localStylesData.color.reduce(
      (acc: NodeStyleMap, color: ColorObject) => {
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
      (acc: NodeStyleMap, effect: EffectObject) => {
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
      (acc: NodeStyleMap, typo: TypographyObject) => {
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
  groupLabel: string;
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
  let nameArray = name.split("/");
  const data = {
    name: "",
    machine_name: "",
    group: "",
    groupLabel: "",
  };
  if (nameArray[1]) {
    data.group = toMachineName(nameArray[0]!);
    data.groupLabel = nameArray[0]!;
    data.name = nameArray[1];
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
