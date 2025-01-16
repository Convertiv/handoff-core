import * as FigmaTypes from "../../../types/figma";

export function filterByNodeType<Type extends FigmaTypes.Node["type"]>(
  type: Type
) {
  return (
    obj?: FigmaTypes.Node | null
  ): obj is Extract<FigmaTypes.Node, { type: Type }> => obj?.type === type;
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
