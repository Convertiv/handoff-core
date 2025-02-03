export * as Types from "./types";
export * as Providers from "./providers";
export * as Transformers from "./transformers";
export * as Integration from "./integration";
import * as Extractor from "./extractor";
import executeTransform from "./transformer";
import {
  IDocumentationObject,
  ILogger,
  IIntegration,
  IProvider,
  ITransformer,
  ITransformerResult,
  IAssetObject,
} from "./types";

export function Handoff(
  provider: IProvider,
  integration?: IIntegration,
  logger?: ILogger
) {
  const extractAssets = async (name: string): Promise<IAssetObject[]> => {
    return Extractor.extractAssets(provider, name, integration, logger);
  };

  const extractLocalStyles = async (): Promise<
    IDocumentationObject["localStyles"]
  > => {
    return Extractor.extractLocalStyles(provider, integration, logger);
  };

  const extractComponents = async (
    localStyles?: IDocumentationObject["localStyles"]
  ): Promise<IDocumentationObject["components"]> => {
    return Extractor.extractComponents(
      provider,
      localStyles,
      integration,
      logger
    );
  };

  const transform = (
    transformer: ITransformer,
    documentationObject: Pick<
      IDocumentationObject,
      "components" | "localStyles"
    >
  ): ITransformerResult => {
    return executeTransform(transformer, documentationObject, integration);
  };

  return {
    extractAssets,
    extractLocalStyles,
    extractComponents,
    transform,
  };
}
