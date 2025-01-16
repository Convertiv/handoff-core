import { TokenType } from "../types";
import { TypeStyle } from "../../types/figma";

export const formatTokenName = (
  tokenType: TokenType,
  tokenNameSegments: string[]
): string => {
  const prefix = tokenType === "css" ? "--" : tokenType === "scss" ? "$" : "";
  return `${prefix}${tokenNameSegments.join("-")}`;
};

export const transformFigmaTextAlignToCss = (
  textAlign: TypeStyle["textAlignHorizontal"]
): string => {
  return ["left", "center", "right", "justify"].includes(
    textAlign.toLowerCase()
  )
    ? textAlign.toLowerCase()
    : "left";
};

export const transformFigmaTextDecorationToCss = (
  textDecoration: TypeStyle["textDecoration"]
): string => {
  if (textDecoration === "UNDERLINE") {
    return "underline";
  }

  if (textDecoration === "STRIKETHROUGH") {
    return "line-through";
  }

  return "none";
};

export const transformFigmaTextCaseToCssTextTransform = (
  textCase: TypeStyle["textCase"]
): string => {
  if (textCase === "UPPER") {
    return "uppercase";
  }

  if (textCase === "LOWER") {
    return "lowercase";
  }

  if (textCase === "TITLE") {
    return "capitalize";
  }

  return "none";
};
