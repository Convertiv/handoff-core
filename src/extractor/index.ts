import {
  IDocumentationObject,
  ILogger,
  IHandoffConfiguration,
  IHandoffProvider,
  IAssetObject,
} from "../types";
import { startCase } from "../utils";
import componentsExtractor from "./components";
import localStylesExtractor from "./design";
import filesExtractor from "./files";

export async function extractAssets(
  provider: IHandoffProvider,
  name: string,
  _?: IHandoffConfiguration,
  logger?: ILogger
): Promise<IAssetObject[]> {
  const assets = provider.getAssets
    ? await provider.getAssets(name, logger)
    : [];

  logger?.success(`${name} exported: ${assets.length}`);

  return assets ? filesExtractor(assets) : [];
}

export async function extractLocalStyles(
  provider: IHandoffProvider,
  _?: IHandoffConfiguration,
  logger?: ILogger
): Promise<IDocumentationObject["localStyles"]> {
  const localStyles = provider.getLocalStyles
    ? await provider.getLocalStyles(logger)
    : [];

  const result = localStyles
    ? localStylesExtractor(localStyles)
    : { $map: { colors: {}, effects: {}, typography: {} } };

  logger?.success(`Color local styles exported: ${result.color?.length ?? 0}`);
  logger?.success(
    `Effect local styles exported: ${result.effect?.length ?? 0}`
  );
  logger?.success(
    `Typography local styles exported: ${result.typography?.length ?? 0}`
  );

  return result;
}

export async function extractComponents(
  provider: IHandoffProvider,
  localStyles?: IDocumentationObject["localStyles"],
  configuration?: IHandoffConfiguration,
  logger?: ILogger
): Promise<IDocumentationObject["components"]> {
  const components = provider.getComponents
    ? componentsExtractor(
        await provider.getComponents(logger),
        localStyles?.$map,
        configuration,
        logger
      )
    : {};

  Object.keys(components).map((component: string) => {
    if (components[component].instances.length === 0) {
      logger?.err(
        `Skipping "${startCase(
          component
        )}". Reason: No matching component instances were found.`
      );
    } else {
      logger?.success(
        `${startCase(component)} exported: ${
          components[component].instances.length
        }`
      );
    }
  });

  return components;
}
