import { Node } from "../../../types/figma";
import { Exportable } from "../../../types";

export function isNodeType<Type extends Node["type"]>(
  obj: Node | BaseNode | null | undefined,
  type: Type
): obj is Extract<Node | BaseNode, { type: Type }> {
  return obj?.type === type;
}

export function findChildNodeWithType<Type extends Node["type"]>(
  node: Node | BaseNode,
  type: Type
): Extract<Node | BaseNode, { type: Type }> | null {
  if (isNodeType(node, type)) {
    return node;
  }

  if (!("children" in node) || !node.children.length) {
    return null;
  }

  if (node.children) {
    for (const child of node.children) {
      const foundNode = findChildNodeWithType(child, type);

      if (foundNode) {
        return foundNode;
      }
    }
  }

  return null;
}

export function findChildNodeWithTypeAndName<Type extends Node["type"]>(
  node: Node | BaseNode,
  type: Type,
  name: string
): Extract<Node | BaseNode, { type: Type }> | null {
  if (
    isNodeType(node, type) &&
    "name" in node &&
    node.name.toLowerCase() === name.toLowerCase()
  ) {
    return node;
  }

  if (!("children" in node) || !node.children.length) {
    return null;
  }

  if (node.children) {
    for (const child of node.children) {
      const foundNode = findChildNodeWithTypeAndName(child, type, name);

      if (foundNode) {
        return foundNode;
      }
    }
  }

  return null;
}

export function extractComponentInstanceVariantProps(
  componentInstanceName: string,
  supportedVariantProps: string[]
): Map<string, string> {
  const componentVariantProps = new Map<string, string>();
  const supportedVariantPropNames = supportedVariantProps;

  supportedVariantPropNames.forEach((supportedVariantPropName) => {
    componentVariantProps.set(
      supportedVariantPropName,
      normalizeNamePart(
        getComponentInstanceNamePart(
          componentInstanceName,
          supportedVariantPropName
        )
      )
    );
  });

  return componentVariantProps;
}

export function getComponentInstanceNamePart(
  componentInstanceName: string,
  partKey: string
) {
  return componentInstanceName
    .split(",")
    .find((part) => part.trim().startsWith(`${partKey}=`))
    ?.split("=")[1];
}

export const normalizeNamePart = (namePart: string) => {
  return namePart
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-/g, "")
    .replace(/-$/g, "")
    .toLowerCase();
};

export const isExportable = (exportable: string): exportable is Exportable => {
  return [
    "BACKGROUND",
    "BORDER",
    "SPACING",
    "TYPOGRAPHY",
    "FILL",
    "EFFECT",
    "OPACITY",
    "SIZE",
  ].includes(exportable);
};

export const isValidNodeType = (type: string): type is Node["type"] => {
  return [
    "DOCUMENT",
    "CANVAS",
    "FRAME",
    "GROUP",
    "VECTOR",
    "BOOLEAN_OPERATION",
    "STAR",
    "LINE",
    "ELLIPSE",
    "REGULAR_POLYGON",
    "RECTANGLE",
    "TEXT",
    "SLICE",
    "COMPONENT",
    "COMPONENT_SET",
    "INSTANCE",
  ].includes(type);
};
