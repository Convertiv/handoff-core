import { toLowerCaseKeysAndValues } from "../utils";
import { IIntegration } from "../types";

export const init = (integrationObject: IIntegration) => {
  const options = integrationObject.options ?? {};

  if (!options || !options['*']) {
    return integrationObject;
  }

  const wildcardOptions = options['*'];
  const mergedOptions: IIntegration['options'] = {};

  for (const key of Object.keys(options)) {
    // if (key === '*') continue;

    const specificOptions = options[key];

    mergedOptions[key] = {
      cssRootClass: specificOptions.cssRootClass || wildcardOptions.cssRootClass || null,
      tokenNameSegments: specificOptions.tokenNameSegments || wildcardOptions.tokenNameSegments || null,
      defaults: toLowerCaseKeysAndValues({
        ...wildcardOptions.defaults,
        ...specificOptions.defaults,
      }),
      replace: toLowerCaseKeysAndValues({
        ...wildcardOptions.replace,
        ...specificOptions.replace,
      }),
    };
  }

  return {
    ...integrationObject,
    options: mergedOptions,
  };
}