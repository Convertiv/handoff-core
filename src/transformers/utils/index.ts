import { toSDMachineName } from "../../utils";
import { IComponentInstance, IToken, ITypographyObject } from "../../types";

/**
 * Capitalizes the first letter of a string and converts the rest to lowercase
 * 
 * @param {string} input - The string to capitalize
 * @returns {string} The capitalized string, or empty string if input is falsy
 * 
 * @example
 * capitalize("hello") // Returns "Hello"
 * capitalize("WORLD") // Returns "World"
 * capitalize("") // Returns ""
 */
const capitalize = (input: string): string =>
  input ? input.charAt(0).toUpperCase() + input.slice(1).toLowerCase() : "";

/**
 * Formats a typography token name by combining group and machine name if group exists
 * @param {ITypographyObject} type - The typography object containing group and machine_name properties
 * @returns {string} The formatted typography token name
 */
export const formatTypographyTokenName = (type: ITypographyObject) =>
  type.group ? `${type.group}-${type.machine_name}` : `${type.machine_name}`;

/**
 * Formats a token value based on the specified format type and whether to use variable references.
 *
 * @param {IToken} token - The token object containing value and metadata
 * @param {("css" | "scss" | "json")} formatType - The desired output format type
 * @param {boolean} [useVariableRefs] - Whether to use variable references instead of direct values
 * @returns {string} The formatted token value
 *
 * @example
 * // For CSS format with variable references
 * formatTokenValue(token, "css", true) // Returns "var(--token-name)"
 *
 * @example
 * // For Style Dictionary format
 * formatTokenValue(token, "json", true) // Returns "{color.primary.base}"
 */
export const formatTokenValue = (
  token: IToken,
  formatType: "css" | "scss" | "json",
  useVariableRefs?: boolean
) => {
  if (!useVariableRefs) {
    return token.value;
  }

  getComponentCommentBlock

  let referenceObject = token.metadata.reference;

  if (!referenceObject) {
    return token.value;
  }

  let wrapped = "";
  let reference: string | undefined = "";

  if (formatType === "json") {
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
    wrapped = formatType === "css" ? `var(--${reference})` : `$${reference}`;
  }

  return reference ? wrapped : token.value;
};

/**
 * Formats a component instance into a comment block with its name and variant properties
 * 
 * @param component - The component instance to format
 * @param format - The comment format to use, either "\/\*\*\/" for CSS-style comments or "\/\/" for single-line comments
 * @returns A formatted comment string
 */
export const getComponentCommentBlock = (
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