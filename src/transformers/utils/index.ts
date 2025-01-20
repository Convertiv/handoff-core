import { toSDMachineName } from "../../utils";
import { IComponentInstance, IToken, ITypographyObject } from "../../types";

/**
 * Capitalizes the first letter of the input string and converts the rest of the string to lowercase.
 * If the input is an empty string or falsy, an empty string is returned.
 *
 * @param {string} input - The string to be capitalized.
 * @returns {string} - The input string with the first letter capitalized and the rest in lowercase, or an empty string if the input is falsy.
 *
 * @example
 * capitalize("hello") // Output: "Hello"
 * capitalize("WORLD") // Output: "World"
 * capitalize("")      // Output: ""
 */
export const capitalize = (input: string): string => {
  if (!input) return "";
  return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
};

export const tokenReferenceFormat = (
  token: IToken,
  type: "css" | "scss" | "sd",
  useVariableRefs?: boolean
) => {
  if (!useVariableRefs) {
    return token.value;
  }

  let referenceObject = token.metadata.reference;

  if (!referenceObject) {
    return token.value;
  }

  let wrapped = "";
  let reference: string | undefined = "";

  if (type === "sd") {
    // build reference for style dictionary
    if (referenceObject.type === "color") {
      reference = `color.${referenceObject.group}.${toSDMachineName(
        referenceObject.name
      )}`;
    } else if (referenceObject.type === "effect") {
      reference = `effect.${referenceObject.group}.${toSDMachineName(
        referenceObject.name
      )}`;
    } else if (referenceObject.type === "typography") {
      switch (token.metadata.cssProperty) {
        case "font-size":
          reference = `typography.${toSDMachineName(
            referenceObject.name
          )}.font.size`;
          break;
        case "font-weight":
          reference = `typography.${toSDMachineName(
            referenceObject.name
          )}.font.weight`;
          break;
        case "font-family":
          reference = `typography.${toSDMachineName(
            referenceObject.name
          )}.font.family`;
          break;
        case "line-height":
          reference = `typography.${toSDMachineName(
            referenceObject.name
          )}.line.height`;
          break;
        case "letter-spacing":
          reference = `typography.${toSDMachineName(
            referenceObject.name
          )}.letter.spacing`;
          break;
      }
    }
    return reference ? `{${reference}}` : token.value;
  } else {
    reference = referenceObject.reference;
    // There are some values that we can't yet tokenize because of the data out of figma
    if (
      [
        "border-width",
        "border-radius",
        "border-style",
        "text-align",
        "text-decoration",
        "text-transform",
      ].includes(token.metadata.cssProperty)
    ) {
      reference = undefined;
      // Some values should be suffixed with the css property
      // Everything on this list shouldn't, everything else should
    } else if (
      !["box-shadow", "background", "color", "border-color"].includes(
        token.metadata.cssProperty
      )
    ) {
      reference += `-${token.metadata.cssProperty}`;
    }
    wrapped = type === "css" ? `var(--${reference})` : `$${reference}`;
  }

  return reference ? wrapped : token.value;
};

export const formatComponentCodeBlockComment = (
  component: IComponentInstance,
  format: "/**/" | "//"
): string => {
  const parts = [capitalize(component.name)];

  component.variantProperties.forEach(([variantProp, val]) => {
    parts.push(`${variantProp.toLowerCase()}: ${val}`);
  });

  const str = parts.join(", ");

  return format === "/**/" ? `/* ${str} */` : `// ${str}`;
};

export const formatTypeName = (type: ITypographyObject) =>
  type.group ? `${type.group}-${type.machine_name}` : `${type.machine_name}`;
