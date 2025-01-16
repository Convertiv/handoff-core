export * as Types from "./types";
export * as Providers from "./providers";
export * as Transformers from "./transformers";
export * as Integration from "./integration";
import extractComponents from "./extractor";
import executeTransform from "./transformer";
import {
  DocumentationObject,
  ILogger,
  IIntegration,
  IProvider,
  ITransformer,
  TransformerResult,
} from "./types";

export function Handoff(integration?: IIntegration, logger?: ILogger) {
  const extract = async (provider: IProvider): Promise<DocumentationObject> => {
    return extractComponents(provider, integration, logger);
  };

  const transform = (
    transformer: ITransformer,
    documentationObject: DocumentationObject
  ): TransformerResult => {
    return executeTransform(transformer, documentationObject, integration);
  };

  return { extract, transform };
}