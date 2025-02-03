import * as extractor from "./extractor";
import executeTransform from "./transformer";
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

const normalizeConfiguration = (configuration?: IHandoffConfiguration) => {
  const options = configuration?.options ?? {};

  if (!options || !options["*"]) {
    return configuration;
  }

  const wildcardOptions = options["*"];
  const mergedOptions: IHandoffConfiguration["options"] = {};

  for (const key of Object.keys(options)) {
    // if (key === '*') continue;

    const specificOptions = options[key];

    mergedOptions[key] = {
      cssRootClass:
        specificOptions.cssRootClass || wildcardOptions.cssRootClass || null,
      tokenNameSegments:
        specificOptions.tokenNameSegments ||
        wildcardOptions.tokenNameSegments ||
        null,
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
    ...configuration,
    options: mergedOptions,
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
