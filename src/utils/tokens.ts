/**
 * Replaces token placeholders in a string with corresponding values from a map.
 *
 * Tokens are defined as `${token}` and are case-insensitive. Each token is replaced
 * by its corresponding value from the `tokenValMap`. If a token does not exist in the map,
 * it is replaced with an empty string. Optionally, a custom `pipe` function can transform the
 * replacement value.
 *
 * @param {string} str - The input string containing tokens to be replaced.
 * @param {Map<string, string>} tokenValMap - A map where keys represent token names (case-insensitive) and values are the replacement strings.
 * @param {(token: string, key: string, value: string) => string} [pipe] - An optional callback function that receives the original token, its lowercase key, and its mapped value, allowing for custom transformation of the replacement value.
 * @returns {string} - The input string with all matching tokens replaced by their respective values.
 */
export function interpolateTokens(
  str: string,
  tokenValMap: Map<string, string>,
  pipe?: (token: string, key: string, value: string) => string
): string {
  return str.replace(/\$\{(.*?)\}/g, (token) => {
    const key = token.substring(2, token.length - 1).toLowerCase();
    const val = tokenValMap.get(key) ?? "";
    return pipe ? pipe(token, key, val) : val;
  });
}
