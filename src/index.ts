import * as extractor from "./extractor";
import executeTransform, {
  transformComponentInstance as getComponentInstanceTokens,
} from "./transformer";
import { formatTypeName, tokenReferenceFormat } from "./transformers/utils";
import {
  IDocumentationObject,
  ILogger,
  IHandoffConfiguration,
  IHandoffProvider,
  IHandoffTransformer,
  ITransformerResult,
  IAssetObject,
} from "./types";
import { toLowerCaseKeysAndValues } from "./utils";

const normalizeConfiguration = (
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
      transformer: normalizedTransformersOptions, // or merge it back as needed
    },
  };
};

export function Handoff(
  provider: IHandoffProvider,
  configuration?: IHandoffConfiguration,
  logger?: ILogger
) {
  const normalizedConfig = normalizeConfiguration(configuration);

  const extractAssets = async (name: string): Promise<IAssetObject[]> => {
    return extractor.extractAssets(provider, name, normalizedConfig, logger);
  };

  const extractLocalStyles = async (): Promise<
    IDocumentationObject["localStyles"]
  > => {
    return extractor.extractLocalStyles(provider, normalizedConfig, logger);
  };

  const extractComponents = async (
    localStyles?: IDocumentationObject["localStyles"]
  ): Promise<IDocumentationObject["components"]> => {
    return extractor.extractComponents(
      provider,
      localStyles,
      normalizedConfig,
      logger
    );
  };

  const transform = (
    transformer: IHandoffTransformer,
    documentationObject: Pick<
      IDocumentationObject,
      "components" | "localStyles"
    >
  ): ITransformerResult => {
    return executeTransform(transformer, documentationObject, normalizedConfig);
  };

  return {
    extractAssets,
    extractLocalStyles,
    extractComponents,
    transform,
  };
}

export * as Types from "./types";
export * as Providers from "./providers";
export * as Transformers from "./transformers";
export const TransformerUtils = {
  formatTypeName,
  getComponentInstanceTokens,
  tokenReferenceFormat,
};
