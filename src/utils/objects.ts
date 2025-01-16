/**
 * Converts all keys and string values of an object to lowercase.
 *
 * This function recursively traverses the input object and performs the following:
 * - Converts all keys to lowercase.
 * - Converts all string values to lowercase.
 * - Retains the original structure of the object, including nested objects.
 * - Leaves non-string values unchanged.
 *
 * @param {Record<string, any>} obj - The input object with string keys and any type of values.
 * @returns {Record<string, any>} - A new object with all keys and string values converted to lowercase.
 */
export const toLowerCaseKeysAndValues = (
  obj: Record<string, any>
): Record<string, any> => {
  const loweredObj: Record<string, any> = {};
  for (const key in obj) {
    const lowerKey = key.toLowerCase();
    const value = obj[key];

    if (typeof value === "string") {
      loweredObj[lowerKey] = value.toLowerCase();
    } else if (typeof value === "object" && value !== null) {
      loweredObj[lowerKey] = toLowerCaseKeysAndValues(value);
    } else {
      loweredObj[lowerKey] = value; // For non-string values
    }
  }
  return loweredObj;
};
