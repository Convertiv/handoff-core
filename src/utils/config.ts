import { IHandoffConfiguration } from "../types";
import { toLowerCaseKeysAndValues } from "./index";

export const normalizeHandoffConfig = (
  configuration?: IHandoffConfiguration
): IHandoffConfiguration => {
  const baseOptions = { transformer: {}, ...configuration?.options };

  const sharedTransformerOptions = baseOptions.transformer["*"];

  // Build normalized transformer settings
  const normalizedTransformersOptions = Object.keys(baseOptions.transformer).reduce(function (acc, key) {
    const specificOptions = baseOptions.transformer[key];

    const sharedDefaults = (sharedTransformerOptions && sharedTransformerOptions.defaults) || {};
    const sharedReplace = (sharedTransformerOptions && sharedTransformerOptions.replace) || {};

    acc[key] = {
      cssRootClass: specificOptions.cssRootClass || null,
      tokenNameSegments: specificOptions.tokenNameSegments || null,
      defaults: toLowerCaseKeysAndValues(
        Object.assign({}, sharedDefaults, specificOptions.defaults)
      ),
      replace: toLowerCaseKeysAndValues(
        Object.assign({}, sharedReplace, specificOptions.replace)
      )
    };

    return acc;
  }, {});

  return {
    ...configuration,
    options: {
      ...baseOptions,
      transformer: normalizedTransformersOptions,
    },
  };
};
