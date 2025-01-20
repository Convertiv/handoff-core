export * as Types from "./types";
export * as Providers from "./providers";
export * as Transformers from "./transformers";
export * as Integration from "./integration";
import extractComponents from "./extractor";
import executeTransform from "./transformer";
import {
  IDocumentationObject,
  ILogger,
  IIntegration,
  IProvider,
  ITransformer,
  ITransformerResult,
} from "./types";

export function Handoff(integration?: IIntegration, logger?: ILogger) {
  const extract = async (provider: IProvider): Promise<IDocumentationObject> => {
    return extractComponents(provider, integration, logger);
  };

  const transform = (
    transformer: ITransformer,
    documentationObject: IDocumentationObject
  ): ITransformerResult => {
    return executeTransform(transformer, documentationObject, integration);
  };

  return { extract, transform };
}