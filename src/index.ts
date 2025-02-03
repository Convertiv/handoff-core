export * as Types from "./types";
export * as Providers from "./providers";
export * as Transformers from "./transformers";
export * as Integration from "./integration";
import * as Extractor from "./extractor";
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

export function Handoff(
  provider: IHandoffProvider,
  configuration?: IHandoffConfiguration,
  logger?: ILogger
) {
  const extractAssets = async (name: string): Promise<IAssetObject[]> => {
    return Extractor.extractAssets(provider, name, configuration, logger);
  };

  const extractLocalStyles = async (): Promise<
    IDocumentationObject["localStyles"]
  > => {
    return Extractor.extractLocalStyles(provider, configuration, logger);
  };

  const extractComponents = async (
    localStyles?: IDocumentationObject["localStyles"]
  ): Promise<IDocumentationObject["components"]> => {
    return Extractor.extractComponents(
      provider,
      localStyles,
      configuration,
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
    return executeTransform(transformer, documentationObject, configuration);
  };

  return {
    extractAssets,
    extractLocalStyles,
    extractComponents,
    transform,
  };
}
