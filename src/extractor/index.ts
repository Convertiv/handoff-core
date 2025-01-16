import {
  DocumentationObject,
  ILogger,
  IIntegration,
  IProvider,
} from "../types";
import extractComponents from "./components";
import extractLocalStyles from "./design";
import extractFiles from "./files";
import { startCase } from "../utils";

export default async function extract(
  provider: IProvider,
  integration?: IIntegration,
  logger?: ILogger
): Promise<DocumentationObject> {
  const localStyles = provider.getLocalStyles
    ? await provider.getLocalStyles(logger)
    : [];

  const design = localStyles
    ? extractLocalStyles(localStyles)
    : { data: {}, map: { colors: {}, effects: {}, typography: {} } };

  const iconAssets = provider.getAssets
    ? await provider.getAssets("Icons", logger)
    : [];

  const icons = iconAssets ? extractFiles(iconAssets) : [];

  logger?.success(`Icons exported: ${icons.length}`);

  const logoAssets = provider.getAssets
    ? await provider.getAssets("Logo", logger)
    : [];

  const logos = logoAssets ? extractFiles(logoAssets) : [];

  logger?.success(`Logo exported: ${logos.length}`);

  const components = provider.getComponents
    ? extractComponents(
        await provider.getComponents(logger),
        integration,
        design.map,
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
    design: design.data,
    components,
    assets: {
      icons,
      logos,
    },
  };
}
