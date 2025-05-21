import {
  IDocumentationObject,
  ILogger,
  IHandoffConfiguration,
  IHandoffProvider,
  IHandoffTransformer,
  ITransformerResult,
  IAssetObject,
} from "./types";

import * as extractor from "./extractor";
import executeTransform, { getComponentInstanceTokens } from "./transformer";
import { formatTypographyTokenName, formatTokenValue } from "./transformers/utils";
import { normalizeHandoffConfig } from "./utils/config";

export function Handoff(
  provider: IHandoffProvider,
  configuration?: IHandoffConfiguration,
  logger?: ILogger
) {
  const normalizedConfig = normalizeHandoffConfig(configuration);

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
  formatTokenValue,
  formatTypographyTokenName,
  getComponentInstanceTokens,
};
