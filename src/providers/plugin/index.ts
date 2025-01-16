import * as ExportTypes from "../../types";
import * as FigmaTypes from "../../types/figma";
import { slugify } from "../../utils";
import { IComponentSetMetadata } from "../rest/types";

export function PluginProvider(
  node?: ComponentSetNode,
  metadata?: IComponentSetMetadata
): ExportTypes.IProvider {
  const getLocalStyles = async (_?: ExportTypes.ILogger) => {
    const [paintStyles, textStyles, effectStyles] = await Promise.all([
      figma.getLocalPaintStylesAsync(),
      figma.getLocalTextStylesAsync(),
      figma.getLocalEffectStylesAsync(),
    ]);

    return [...paintStyles, ...textStyles, ...effectStyles];
  };

  const getComponents = async (_?: ExportTypes.ILogger) => {
    if (!node) {
      return [];
    }

    let componentsMetadata = new Map<string, FigmaTypes.ComponentMetadata>();

    node.children.forEach((component) => {
      componentsMetadata.set(component.id, {
        key: component.id,
        name: component.name,
        description: "",
        documentationLinks: [],
      });
    });

    const definition = await getComponentSetComponentDefinition(node);

    return definition
      ? [
          {
            name: definition.name,
            componentSetNode: node,
            componentsMetadata: componentsMetadata,
            definition,
          },
        ]
      : [];
  };

  const getComponentSetComponentDefinition = async (
    componentSet: ComponentSetNode
  ): Promise<ExportTypes.IComponentDefinition | null> => {
    const id = componentSet.id;
    const name = slugify(metadata?.name ?? componentSet.name);

    if (!componentSet.componentPropertyDefinitions) {
      return null;
    }

    const variantProperties = Object.entries(
      componentSet.componentPropertyDefinitions
    )
      .map(([variantPropertyName, variantPropertyDefinition]) => {
        return {
          name: variantPropertyName,
          type: variantPropertyDefinition.type,
          default: variantPropertyDefinition.defaultValue,
          options: variantPropertyDefinition.variantOptions ?? [],
        };
      })
      .filter((variantProperty) => variantProperty.type === "VARIANT");

    return {
      id,
      name,
      group: "", // TODO
      options: {
        exporter: {
          variantProperties: variantProperties.map(
            (variantProp) => variantProp.name
          ),
          sharedComponentVariants: metadata?.sharedVariants || [],
        },
      },
      parts:
        metadata?.parts.map((part) => ({
          id: slugify(part.name),
          tokens: part.definitions.map((definition) => ({
            from: definition.from,
            export: definition.export,
          })),
        })) ?? [],
    };
  };

  return { getLocalStyles, getComponents };
}
