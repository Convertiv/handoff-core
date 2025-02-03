import {
  IDocumentationObject,
  ILogger,
  IIntegration,
  IProvider,
  IAssetObject,
} from "../types";
import { startCase } from "../utils";
import componentsExtractor from "./components";
import localStylesExtractor from "./design";
import filesExtractor from "./files";

export async function extractAssets(
  provider: IProvider,
  name: string,
  _?: IIntegration,
  logger?: ILogger
): Promise<IAssetObject[]> {
  const assets = provider.getAssets
    ? await provider.getAssets(name, logger)
    : [];

  logger?.success(`${name} exported: ${assets.length}`);

  return assets ? filesExtractor(assets) : [];
}

export async function extractLocalStyles(
  provider: IProvider,
  _?: IIntegration,
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
  provider: IProvider,
  localStyles?: IDocumentationObject["localStyles"],
  integration?: IIntegration,
  logger?: ILogger
): Promise<IDocumentationObject["components"]> {
  const components = provider.getComponents
    ? componentsExtractor(
        await provider.getComponents(logger),
        integration,
        localStyles.$map,
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

export default async function extract(
  provider: IProvider,
  integration?: IIntegration,
  logger?: ILogger
): Promise<IDocumentationObject> {
  const localStyles = provider.getLocalStyles
    ? await provider.getLocalStyles(logger)
    : [];

  const design = localStyles
    ? localStylesExtractor(localStyles)
    : { $map: { colors: {}, effects: {}, typography: {} } };

  const iconAssets = provider.getAssets
    ? await provider.getAssets("Icons", logger)
    : [];

  const icons = iconAssets ? filesExtractor(iconAssets) : [];

  logger?.success(`Icons exported: ${icons.length}`);

  const logoAssets = provider.getAssets
    ? await provider.getAssets("Logo", logger)
    : [];

  const logos = logoAssets ? filesExtractor(logoAssets) : [];

  logger?.success(`Logo exported: ${logos.length}`);

  const components = provider.getComponents
    ? componentsExtractor(
        await provider.getComponents(logger),
        integration,
        design.$map,
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

  return {
    timestamp: new Date().toISOString(),
    localStyles: design,
    components,
    assets: {
      icons,
      logos,
    },
  };
}
