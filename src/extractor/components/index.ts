import * as ExportTypes from "./../../types";
import * as FigmaTypes from "../../types/figma";
import { interpolateTokens, slugify } from "../../utils";
import { isPluginNode, resolvePaint } from "./../utils";
import {
  extractComponentInstanceVariantProps,
  findChildNodeWithType,
  findChildNodeWithTypeAndName,
  isExportable,
  isValidNodeType,
} from "./utils";

type ExportPipeComponentInstance = Omit<
  ExportTypes.IComponentInstance,
  "variantProperties"
> & { variantProperties: Map<string, string> };

type SharedPipeComponentInstance = ExportPipeComponentInstance & {
  componentId: string;
};

export default function extract(
  componentSets: {
    name: string;
    componentSetNode: FigmaTypes.ComponentSet | ComponentSetNode;
    componentsMetadata: Map<string, FigmaTypes.ComponentMetadata>;
    definition: ExportTypes.IComponentDefinition;
  }[],
  designMap?: ExportTypes.IDesignMap,
  configuration?: ExportTypes.IHandoffConfiguration,
  logger?: ExportTypes.ILogger
) {
  const componentTokens: {
    [key: string]: ExportTypes.IFileComponentObject;
  } = {};

  for (const componentSet of componentSets) {
    const components = componentSet.componentSetNode.children.map(
      (component) => ({
        node: component,
        metadata: componentSet.componentsMetadata.get(component.id),
      })
    );

    if (!componentTokens[componentSet.definition.name]) {
      componentTokens[componentSet.definition.name] = {
        instances: [],
      };
    }

    componentTokens[componentSet.definition.name].instances = [
      ...componentTokens[componentSet.definition.name].instances,
      ...extractComponentInstances(
        components,
        componentSet.definition,
        configuration,
        designMap,
        logger
      ),
    ];
  }

  return componentTokens;
}

function extractComponentInstances(
  components: {
    node: FigmaTypes.Component | BaseNode;
    metadata: FigmaTypes.ComponentMetadata;
  }[],
  definition: ExportTypes.IComponentDefinition,
  configuration?: ExportTypes.IHandoffConfiguration,
  designMap?: ExportTypes.IDesignMap,
  logger?: ExportTypes.ILogger
): ExportTypes.IComponentInstance[] {
  const options = definition.options;
  const sharedComponentVariantIds =
    options.exporter.sharedComponentVariants ?? [];

  const sharedInstances: SharedPipeComponentInstance[] = [];
  const componentInstances = components.map(
    (component): ExportPipeComponentInstance[] => {
      const variantProperties = extractComponentInstanceVariantProps(
        component.node.name,
        options.exporter.variantProperties
      );
      const id = generateComponentId(variantProperties);
      const name = slugify(definition.name);
      const description =
        component.metadata[component.node.id]?.description ?? "";

      let rootNode: FigmaTypes.Component | FigmaTypes.Instance | BaseNode =
        component.node;

      if (definition.legacyDefinitionOptions) {
        let isLayoutComponent = false;

        if (
          !!definition.legacyDefinitionOptions?.exporter?.supportedVariantProps?.layout
        ) {
          definition.legacyDefinitionOptions.exporter.supportedVariantProps.layout.forEach(
            (layoutVariantProp) => {
              if (
                !isLayoutComponent &&
                variantProperties.get(layoutVariantProp) !== undefined
              ) {
                isLayoutComponent = true;
              }
            }
          );

          if (!isLayoutComponent) {
            rootNode = findChildNodeWithType(component.node, "INSTANCE");
          }

          if (!rootNode) {
            logger?.err(
              `No instance node found for component ${component.node.name}`
            );
            return [];
          }
        }
      }

      if (!definition.parts || definition.parts.length === 0) {
        return [];
      }

      const parts = definition.parts.reduce((previous, current) => {
        return {
          ...previous,
          ...{
            [current.id || "$"]: extractComponentPartTokenSets(
              rootNode,
              current,
              variantProperties,
              designMap
            ),
          },
        };
      }, {});

      const instance = {
        id,
        name,
        description,
        variantProperties: variantProperties,
        parts,
      } as ExportPipeComponentInstance;

      const isSharedComponentVariant =
        (sharedComponentVariantIds.findIndex(
          (s) => s.componentId === component.node.id
        ) ?? -1) > -1;
      if (isSharedComponentVariant) {
        sharedInstances.push({ ...instance, componentId: component.node.id });
        return [];
      }

      const result: ExportPipeComponentInstance[] = [instance];

      sharedInstances
        .filter((sharedInstance) => {
          const sharedInstanceDefinition =
            options.exporter.sharedComponentVariants.find(
              (item) => item.componentId === sharedInstance.componentId
            );

          if (!sharedInstanceDefinition) {
            return false;
          }

          if (
            instance.variantProperties.get(
              sharedInstanceDefinition.sharedVariantProperty
            ) !==
            ((configuration?.options?.transformer ?? {})[sharedInstance.name]
              ?.defaults ?? {})[
              sharedInstanceDefinition.sharedVariantProperty.toLowerCase()
            ] // TODO: Remove when shared variant functionality gets removed
          ) {
            return false;
          }

          if (
            (sharedInstanceDefinition.distinctiveVariantProperties ?? [])
              .length > 0
          ) {
            for (const distinctiveVariantProperty of sharedInstanceDefinition.distinctiveVariantProperties) {
              if (
                instance.variantProperties.get(distinctiveVariantProperty) !==
                sharedInstance.variantProperties.get(distinctiveVariantProperty)
              ) {
                return false;
              }
            }
          }

          return true;
        })
        .forEach((sharedInstance) => {
          const sharedInstanceDefinition =
            options.exporter.sharedComponentVariants.find(
              (item) => item.componentId === sharedInstance.componentId
            );

          const additionalInstance: ExportPipeComponentInstance = {
            ...sharedInstance,
          };

          const additionalInstanceVariantProps = new Map(
            instance.variantProperties
          );
          additionalInstanceVariantProps.set(
            sharedInstanceDefinition.sharedVariantProperty,
            sharedInstance.variantProperties.get(
              sharedInstanceDefinition.sharedVariantProperty
            )
          );

          additionalInstance.id = generateComponentId(
            additionalInstanceVariantProps
          );
          additionalInstance.variantProperties = additionalInstanceVariantProps;

          result.push({
            id: additionalInstance.id,
            name: additionalInstance.name,
            description: additionalInstance.description,
            variantProperties: additionalInstanceVariantProps,
            parts: additionalInstance.parts,
          });
        });

      return result;
    }
  );

  const instances = componentInstances.reduce((result, current) => {
    return [
      ...result,
      ...current.map((component) => ({
        id: component.id,
        name: component.name,
        description: component.description,
        variantProperties: Array.from(component.variantProperties.entries()),
        parts: component.parts,
      })),
    ];
  }, [] as ExportTypes.IComponentInstance[]);

  return uniqBy(instances, "id");
}

/**
 * Given a component instance, a component definition, and a handoff object,
 * this function will extract the component instance's token sets
 * @param root
 * @param part
 * @param tokens
 * @returns ExportTypes.TokenSets
 */
function extractComponentPartTokenSets(
  root: FigmaTypes.Node | BaseNode,
  part: ExportTypes.IComponentPart,
  tokens: Map<string, string>,
  designMap: ExportTypes.IDesignMap
): ExportTypes.TTokenSets {
  if (!part.tokens || part.tokens.length === 0) {
    return [];
  }

  const tokenSets: ExportTypes.TTokenSets = [];

  for (const def of part.tokens) {
    if (!def.from || !def.export || def.export.length === 0) {
      continue;
    }

    const node = resolveNodeFromPath(root, def.from, tokens);

    if (!node) {
      continue;
    }

    for (const exportable of def.export) {
      if (!isExportable(exportable)) {
        continue;
      }

      const tokenSet = extractNodeExportable(node, exportable);
      if (!tokenSet) {
        continue;
      }
      if ("styles" in node && node.styles) {
        tokenSet.reference = getReferenceFromMap(node, tokenSet, designMap);
      }

      const conflictingTokenSetIdx = tokenSets
        .map((set) => set.name)
        .indexOf(exportable);

      if (conflictingTokenSetIdx > -1) {
        tokenSets[conflictingTokenSetIdx] = mergeTokenSets(
          tokenSets[conflictingTokenSetIdx],
          tokenSet
        );
      } else {
        tokenSets.push(tokenSet);
      }
    }
  }

  return tokenSets;
}

/**
 * Get the reference from a node
 * @param node
 * @param handoff
 * @returns
 */
function getReferenceFromMap(
  node: FigmaTypes.Node,
  tokenSet: any,
  designMap: ExportTypes.IDesignMap
): ExportTypes.IReferenceObject | undefined {
  const styles = node.styles;
  if (!styles) {
    return undefined;
  }
  switch (tokenSet.name) {
    case "BACKGROUND":
      if (styles.fills) {
        return designMap?.colors[styles.fills]
          ? designMap.colors[styles.fills]
          : undefined;
      } else if (styles.fill) {
        return designMap?.colors[styles.fill]
          ? designMap.colors[styles.fill]
          : undefined;
      }
      break;
    case "FILL":
      if (styles.fills) {
        return designMap?.colors[styles.fills]
          ? designMap.colors[styles.fills]
          : undefined;
      } else if (styles.fill) {
        return designMap?.colors[styles.fill]
          ? designMap.colors[styles.fill]
          : undefined;
      }
      break;
    case "BORDER":
      if (styles.strokes) {
        return designMap?.colors[styles.strokes]
          ? designMap.colors[styles.strokes]
          : undefined;
      } else if (styles.stroke) {
        return designMap?.colors[styles.stroke]
          ? designMap.colors[styles.stroke]
          : undefined;
      }
      break;
    case "TYPOGRAPHY":
      if (styles.text) {
        return designMap?.typography[styles.text]
          ? designMap.typography[styles.text]
          : undefined;
      }
      break;

    case "EFFECT":
      if (styles.effect) {
        return designMap?.effects[styles.effect]
          ? designMap.effects[styles.effect]
          : undefined;
      }
      break;
  }
  return undefined;
}

/**
 * Find the node from a path provided by the schema
 * @param root
 * @param path
 * @param tokens
 * @returns FigmaTypes.Node
 */
function resolveNodeFromPath(
  root: FigmaTypes.Node | BaseNode,
  path: string,
  tokens: Map<string, string>
) {
  const pathArr = path
    .split(">")
    .filter((part) => part !== "$")
    .map((part) => part.trim());
  let currentNode: FigmaTypes.Node | BaseNode | null = root;

  for (const path of pathArr) {
    const nodeDef = parsePathNodeParams(path);

    if (!nodeDef.type) {
      continue;
    }

    if (nodeDef.name) {
      nodeDef.name = interpolateTokens(nodeDef.name, tokens);
    }

    currentNode = nodeDef.name
      ? findChildNodeWithTypeAndName(currentNode, nodeDef.type, nodeDef.name)
      : findChildNodeWithType(currentNode, nodeDef.type);

    if (!currentNode) {
      return null;
    }
  }

  return currentNode;
}

/**
 * Given a schema path, this function will parse the node type and name
 * @param path
 * @returns
 */
function parsePathNodeParams(path: string): {
  type?: FigmaTypes.Node["type"];
  name?: string;
} {
  const type = path.split("[")[0];
  const selectors = new Map<string, string>();

  const selectorsMatch = path.match(/\[(.*?)\]/);

  if (selectorsMatch) {
    selectorsMatch[1].split(",").forEach((selector) => {
      const [key, value] = selector.split("=");

      if (!(key && value)) {
        return;
      }

      selectors.set(key, value.replace(/['"]/g, ""));
    });
  }

  return {
    type: isValidNodeType(type) ? type : undefined,
    name: selectors.get("name"),
  };
}

function mergeTokenSets(
  first: ExportTypes.TTokenSet,
  second: ExportTypes.TTokenSet
): ExportTypes.TTokenSet {
  return mergeWith({}, first, second, (a, b) => (b === null ? a : undefined));
}

function generateComponentId(variantProperties: Map<string, string>) {
  const parts = [];

  variantProperties.forEach((val, variantProp) => {
    parts.push(`${variantProp}-${val}`);
  });

  return parts.join("-");
}

/**
 * Extract the exportable from a node.  Given a node and an exportable
 * identifier, this function will return the token set
 * @param node
 * @param exportable
 * @returns
 */
function extractNodeExportable(
  node: FigmaTypes.Node | BaseNode,
  exportable: ExportTypes.TExportable
): ExportTypes.TTokenSet | null {
  switch (exportable) {
    case "BACKGROUND":
      return extractNodeBackground(node);
    case "SPACING":
      return extractNodeSpacing(node);
    case "BORDER":
      return extractNodeBorder(node);
    case "EFFECT":
      return extractNodeEffect(node);
    case "TYPOGRAPHY":
      return extractNodeTypography(node);
    case "FILL":
      return extractNodeFill(node);
    case "OPACITY":
      return extractNodeOpacity(node);
    case "SIZE":
      return extractNodeSize(node);
    default:
      return null;
  }
}

function extractNodeFill(
  node: FigmaTypes.Node | BaseNode
): ExportTypes.IFillTokenSet | null {
  if (isPluginNode(node)) {
    let color: FigmaTypes.Paint[] = [];

    if ("fills" in node) {
      if (node.fills !== figma.mixed) {
        color = resolvePaint(node.fills);
      } else {
        // TODO: Handle mixed fills
        color = [];
      }
    } else {
      color = [];
    }

    return {
      name: "FILL",
      color,
    };
  }

  return {
    name: "FILL",
    color: "fills" in node ? node.fills.slice() : [],
  };
}

function extractNodeTypography(
  node: FigmaTypes.Node | BaseNode
): ExportTypes.ITypographyTokenSet | null {
  if (isPluginNode(node)) {
    if (node.type === "TEXT") {
      const fontSize = node.fontSize !== figma.mixed ? node.fontSize : 16;
      const lineHeight =
        node.lineHeight !== figma.mixed && "value" in node.lineHeight
          ? node.lineHeight.value
          : fontSize;
      const lineHeightPercentFontSize = lineHeight / fontSize; // Handoff expects line height as a percentage of font size

      // TODO: Handle mixed typography
      return {
        name: "TYPOGRAPHY",
        fontFamily: node.fontName !== figma.mixed ? node.fontName.family : "",
        fontSize,
        fontWeight: node.fontWeight !== figma.mixed ? node.fontWeight : 100,
        lineHeight: lineHeightPercentFontSize,
        letterSpacing:
          node.letterSpacing !== figma.mixed ? node.letterSpacing.value : 0,
        textAlignHorizontal: node.textAlignHorizontal
          ? node.textAlignHorizontal
          : "LEFT",
        textDecoration:
          node.textDecoration !== figma.mixed
            ? node.textDecoration ?? "NONE"
            : "NONE",
        textCase:
          node.textCase !== figma.mixed
            ? node.textCase ?? "ORIGINAL"
            : "ORIGINAL",
        characters: node.characters ?? "",
      };
    }

    return null;
  }

  const styleInNode = "style" in node;
  const charactersInNode = "style" in node;

  return {
    name: "TYPOGRAPHY",
    fontFamily: styleInNode ? node.style.fontFamily : "",
    fontSize: styleInNode ? node.style.fontSize : 16,
    fontWeight: styleInNode ? node.style.fontWeight : 100,
    lineHeight: styleInNode
      ? (node.style.lineHeightPercentFontSize ?? 100) / 100
      : 1,
    letterSpacing: styleInNode ? node.style.letterSpacing : 0,
    textAlignHorizontal: styleInNode ? node.style.textAlignHorizontal : "LEFT",
    textDecoration: styleInNode ? node.style.textDecoration ?? "NONE" : "NONE",
    textCase: styleInNode ? node.style.textCase ?? "ORIGINAL" : "ORIGINAL",
    characters: charactersInNode ? node.characters : "",
  };
}

function extractNodeEffect(
  node: FigmaTypes.Node | BaseNode
): ExportTypes.IEffectTokenSet | null {
  if (isPluginNode(node)) {
    return {
      name: "EFFECT",
      effect:
        "effects" in node
          ? node.effects.map((effect) => {
              return {
                ...effect,
                spread: "spread" in effect ? effect.spread : 0,
              };
            })
          : [],
    };
  }

  return {
    name: "EFFECT",
    effect: "effects" in node ? [...node.effects] : [],
  };
}

function extractNodeBorder(
  node: FigmaTypes.Node | BaseNode
): ExportTypes.IBorderTokenSet | null {
  if (isPluginNode(node)) {
    return {
      name: "BORDER",
      weight:
        "strokeWeight" in node && node.strokeWeight !== figma.mixed
          ? node.strokeWeight ?? 0
          : 0,
      radius:
        "cornerRadius" in node && node.cornerRadius !== figma.mixed
          ? node.cornerRadius ?? 0
          : 0,
      strokes: "strokes" in node ? resolvePaint(node.strokes) : [],
      dashes: "dashPattern" in node ? [...node.dashPattern] : [0, 0],
    };
  }

  return {
    name: "BORDER",
    weight: "strokeWeight" in node ? node.strokeWeight ?? 0 : 0,
    radius: "cornerRadius" in node ? node.cornerRadius ?? 0 : 0,
    strokes: "strokes" in node ? node.strokes.slice() : [],
    dashes: "strokeDashes" in node ? node.strokeDashes.concat() : [0, 0],
  };
}

function extractNodeSpacing(
  node: FigmaTypes.Node | BaseNode
): ExportTypes.ISpacingTokenSet | null {
  return {
    name: "SPACING",
    padding: {
      TOP: "paddingTop" in node ? node.paddingTop ?? 0 : 0,
      RIGHT: "paddingRight" in node ? node.paddingRight ?? 0 : 0,
      BOTTOM: "paddingBottom" in node ? node.paddingBottom ?? 0 : 0,
      LEFT: "paddingLeft" in node ? node.paddingLeft ?? 0 : 0,
    },
    spacing: "itemSpacing" in node ? node.itemSpacing ?? 0 : 0,
  };
}

function extractNodeBackground(
  node: FigmaTypes.Node | BaseNode
): ExportTypes.IBackgroundTokenSet | null {
  if (isPluginNode(node)) {
    return {
      name: "BACKGROUND",
      background:
        "backgrounds" in node ? resolvePaint(node.backgrounds) ?? [] : [],
    };
  }

  return {
    name: "BACKGROUND",
    background: "background" in node ? node.background.slice() : [],
  };
}

function extractNodeOpacity(
  node: FigmaTypes.Node | BaseNode
): ExportTypes.IOpacityTokenSet | null {
  return {
    name: "OPACITY",
    opacity: "opacity" in node ? node.opacity ?? 1 : 1,
  };
}

/**
 * Get the size bounding box size from a node
 * @param node
 * @returns ExportTypes.SizeTokenSet | null
 */
function extractNodeSize(
  node: FigmaTypes.Node | BaseNode
): ExportTypes.ISizeTokenSet | null {
  return {
    name: "SIZE",
    width:
      "absoluteBoundingBox" in node ? node.absoluteBoundingBox.width ?? 0 : 0,
    height:
      "absoluteBoundingBox" in node ? node.absoluteBoundingBox.height ?? 0 : 0,
  };
}

function mergeWith<TObject, TSource1, TSource2>(
  object: TObject,
  source1: TSource1,
  source2: TSource2,
  customizer: (
    objValue: any,
    srcValue: any,
    key: string,
    obj: TObject,
    src: TSource1 | TSource2
  ) => any
): TObject & TSource1 & TSource2 {
  if (typeof object !== "object" || !object) {
    return object as TObject & TSource1 & TSource2;
  }

  const mergeSource = (target: any, source: any) => {
    if (typeof source !== "object" || !source) {
      return;
    }

    Object.keys(source).forEach((key) => {
      const objValue = target[key];
      const srcValue = source[key];

      const customValue = customizer(objValue, srcValue, key, object, source);

      if (customValue !== undefined) {
        target[key] = customValue;
      } else if (
        typeof srcValue === "object" &&
        srcValue &&
        !Array.isArray(srcValue)
      ) {
        target[key] = mergeSource(
          objValue && typeof objValue === "object" ? objValue : {},
          srcValue
        );
      } else {
        target[key] = srcValue;
      }
    });
  };

  mergeSource(object, source1);
  mergeSource(object, source2);

  return object as TObject & TSource1 & TSource2;
}

function uniqBy<T>(
  array: T[] | null | undefined,
  iteratee: ((item: T) => any) | string
): T[] {
  if (!array) {
    return [];
  }

  const seen = new Map<any, boolean>();
  const getKey =
    typeof iteratee === "string"
      ? (item: T) => (item as any)[iteratee]
      : iteratee;

  return array.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.set(key, true);
    return true;
  });
}
