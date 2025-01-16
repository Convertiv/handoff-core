/**
 * Processes a value based on transformation rules and default settings.
 *
 * - If a replacement rule is defined for the key in the `config.replace` map, the value is replaced accordingly.
 * - If the value matches a default value in `config.defaults` and `preserveDefaults` is `false`,
 *   the value is replaced with an empty string.
 * - If no replacement or default match is found, the original value is returned.
 *
 * @param {string} key - The key for which the value is being processed.
 * @param {string} [value] - The value to process.
 * @param {TransformationConfig} [config] - Configuration object defining replacement and default rules.
 * @param {boolean} [preserveDefaults=false] - If `true`, default values are not replaced with an empty string.
 * @returns {string} - The processed value, or an empty string if a default or replacement rule applies.
 */
export const processValueWithRules = (
  key: string,
  value?: string,
  config?: {
    replace?: Record<string, Record<string, string>>;
    defaults?: Record<string, string>;
  },
  preserveDefaults: boolean = false
): string => {
  const normalizedKey = key.toLowerCase();
  const normalizedValue = value?.toLowerCase();

  const replaceRules = config?.replace ?? {};
  const defaultValues = config?.defaults ?? {};

  if (
    normalizedKey in replaceRules &&
    normalizedValue &&
    normalizedValue in (replaceRules[normalizedKey] ?? {})
  ) {
    return replaceRules[normalizedKey]
      ? replaceRules[normalizedKey][normalizedValue] ?? ""
      : "";
  }

  if (
    !preserveDefaults &&
    normalizedKey in defaultValues &&
    normalizedValue ===
      (defaultValues[normalizedKey as keyof typeof defaultValues] ?? "")
  ) {
    return "";
  }

  return normalizedValue ?? "";
};

/**
 * Converts a string to start case, where each word is capitalized and separated by spaces.
 *
 * Example:
 * - Input: "hello-world_example"
 * - Output: "Hello World Example"
 *
 * @param {string} str - The string to convert to start case.
 * @returns {string} - The start case formatted string.
 */
export const startCase = (str: string): string => {
  return (
    str
      // Replace non-alphanumeric separators with spaces
      .replace(/[_-]+/g, " ")
      // Add spaces before capital letters that are not at the start
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      // Split into words, trim, and capitalize each word
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ")
  );
};

export const slugify = (str: string): string =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^\$\w\s-]/g, "-")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const toSDMachineName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/gi, "-")
    .replace(/\s\-\s|\s+/gi, "-")
    .replace(/-+/gi, "-")
    .replace(/(^,)|(,$)/g, "");
};
