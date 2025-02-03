import axios from "axios";
import * as ExportTypes from "../../types";
import * as FigmaTypes from "../../types/figma";
import { AxiosResponse } from "axios";
import {
  getAssetURL,
  getComponentSetNodes,
  getComponentSets,
  getFileComponent,
  getFileNodes,
  getFileStyles,
} from "./api";
import { filterByNodeType, getComponentInstanceNamePart } from "./utils";
import { filterOutNull, slugify } from "../../utils";

const defaultExtension: string = "svg";

export function RestApiLegacyDefinitionsProvider(
  auth: { projectId: string; accessToken: string },
  legacyDefinitions: ExportTypes.ILegacyComponentDefinition[]
): ExportTypes.IProvider {
  const getLocalStyles = async (logger?: ExportTypes.ILogger) => {
    try {
      const apiResponse = await getFileStyles(auth.projectId, auth.accessToken);
      const file = apiResponse.data;
      const styles = file.meta.styles;
      const nodeMeta = styles.map((item) => ({
        node_id: item.node_id,
        sort_position: item.sort_position,
      }));
      const nodeIds = nodeMeta
        .sort((a, b) => {
          if (a.sort_position < b.sort_position) {
            return -1;
          }
          if (a.sort_position > b.sort_position) {
            return 1;
          }
          return 0;
        })
        .map((item) => item.node_id);

      const childrenApiResponse = await getFileNodes(
        auth.projectId,
        nodeIds,
        auth.accessToken
      );

      const nodes: ExportTypes.LocalStyleNode[] = [];

      Object.entries(childrenApiResponse.data.nodes).forEach(([_, node]) => {
        if (!node) {
          return;
        }

        if (node.document.type === "RECTANGLE") {
          nodes.push(node.document);
        }
        if (node.document.type === "TEXT") {
          nodes.push(node.document);
        }
      });

      return nodes;
    } catch (err) {
      logger?.err(
        `An error occurred while fetching local styles: \nThis typically happens when the library cannot be read from Handoff. \n\nDetails: \n${
          err instanceof Error ? err.message : String(err)
        }\nStack Trace:\n${
          err instanceof Error && err.stack
            ? err.stack
            : "No stack trace available"
        }`
      );
    }
  };

  const getAssets = async (component: string, logger?: ExportTypes.ILogger) => {
    try {
      const parent_response = await getFileComponent(
        auth.projectId,
        auth.accessToken
      );

      const assetsUrlsRes = await getAssetURL(
        auth.projectId,
        Object.entries(parent_response.data.meta.components)
          .filter(
            ([_, value]) => value.containing_frame.name?.indexOf(component) > -1
          )
          .sort(([a_key, a_val], [b_key, b_val]) => {
            // Fetch node ids
            a_key;
            b_key;
            const a_parts = a_val.node_id.split(":");
            const b_parts = b_val.node_id.split(":");
            let a_sort = 0,
              b_sort = 0;
            if (a_parts[1]) {
              a_sort = parseInt(a_parts[0]) + parseInt(a_parts[1]);
            }
            if (b_parts[1]) {
              b_sort = parseInt(b_parts[0]) + parseInt(b_parts[1]);
            }
            return a_sort - b_sort;
          })
          .map(([_, value]) => {
            return value.node_id;
          }),
        defaultExtension,
        auth.accessToken
      );

      const assetsList = await Promise.all(
        Object.entries(assetsUrlsRes.data.images).map(
          async ([assetId, assetUrl]) => {
            const componentData = parent_response.data.meta.components
              .filter((value) => value.node_id === assetId)
              .shift();

            if (!componentData) {
              return null;
            }

            const assetData = await axios.get<string>(assetUrl);

            return {
              name: componentData.name,
              description: componentData.description,
              data: assetData.data,
              extension: defaultExtension,
            };
          }
        )
      );

      return assetsList.filter(filterOutNull);
    } catch (e) {
      if (typeof e === "string") {
        logger?.err(e);
      } else if (e instanceof Error) {
        logger?.err(e.message);
      }

      return [];
    }
  };

  const getComponents = async (logger?: ExportTypes.ILogger) => {
    let fileComponentSetsRes: AxiosResponse<
      FigmaTypes.FileComponentSetsResponse,
      any
    >;

    try {
      fileComponentSetsRes = await getComponentSets(
        auth.projectId,
        auth.accessToken
      );
    } catch (err) {
      logger?.err(
        `Handoff could not access the figma file. \n - Check your file id, dev token, and permissions. \n - For more information on permissions, see https://www.handoff.com/docs/guide \n\nDetails:\n${
          err instanceof Error ? err.message : String(err)
        }\nStack Trace:\n${
          err instanceof Error && err.stack
            ? err.stack
            : "No stack trace available"
        }`
      );
    }

    const fullComponentMetadataArray =
      fileComponentSetsRes.data.meta.component_sets;

    if (fullComponentMetadataArray.length === 0) {
      logger?.err(
        "Handoff could not find any published components.\n  - If you expected components, please check to make sure you published them.\n  - You must have a paid license to publish components.\n - For more information, see https://www.handoff.com/docs/guide"
      );

      logger?.warn(
        "Continuing fetch with only colors and typography design foundations"
      );

      return [];
    }

    const componentSetNodesResult = await getComponentSetNodes(
      auth.projectId,
      fullComponentMetadataArray.map((item) => item.node_id),
      auth.accessToken
    );

    return processFigmaNodesForLegacyDefinitions(
      componentSetNodesResult.data,
      fullComponentMetadataArray,
      logger
    );
  };

  const processFigmaNodesForLegacyDefinitions = (
    fileNodesResponse: FigmaTypes.FileNodesResponse,
    fullComponentMetadataArray: readonly FigmaTypes.FullComponentMetadata[],
    logger?: ExportTypes.ILogger
  ) => {
    logger?.warn("!!! Using legacy fetch flow !!!");

    const result: {
      name: string;
      componentSetNode: FigmaTypes.ComponentSet | ComponentSetNode;
      componentsMetadata: Map<string, FigmaTypes.ComponentMetadata>;
      definition: ExportTypes.IComponentDefinition;
    }[] = [];

    const componentsMetadata = new Map(
      Object.entries(
        Object.values(fileNodesResponse.nodes)
          .map((node) => {
            return node?.components;
          })
          .reduce((acc, cur) => {
            return { ...acc, ...cur };
          }) ?? {}
      )
    );

    const figmaComponentSetNodes = Object.values(fileNodesResponse.nodes)
      .map((node) => node?.document)
      .filter(filterByNodeType("COMPONENT_SET"));

    for (const legacyDefinition of legacyDefinitions) {
      if (!legacyDefinition.id) {
        logger?.err(
          "Handoff could not process exportable component without a id.\n  - Please update the exportable definition to include the name of the component.\n - For more information, see https://www.handoff.com/docs/guide"
        );
        continue;
      }

      if (!legacyDefinition.options.exporter.search) {
        logger?.err(
          "Handoff could not process exportable component without search.\n  - Please update the exportable definition to include the search property.\n - For more information, see https://www.handoff.com/docs/guide"
        );
        continue;
      }

      const componentSets = getComponentSetsForLegacyComponentDefinition(
        figmaComponentSetNodes,
        fullComponentMetadataArray,
        legacyDefinition,
        logger
      );

      for (const componentSet of componentSets) {
        const definition = getComponentDefinitionForLegacyComponentDefinition(
          componentSet,
          legacyDefinition
        );

        result.push({
          name: definition.name,
          componentSetNode: componentSet,
          componentsMetadata: componentsMetadata,
          definition,
        });
      }
    }

    return result;
  };

  const getComponentSetsForLegacyComponentDefinition = (
    componentSets: ReadonlyArray<FigmaTypes.ComponentSet>,
    componentSetsMetadata: ReadonlyArray<FigmaTypes.FullComponentMetadata>,
    legacyDefinition: ExportTypes.ILegacyComponentDefinition,
    logger?: ExportTypes.ILogger
  ) => {
    // Retrieve the component set with the given name (search)
    const primaryComponentSet = componentSets.find(
      (componentSet) =>
        componentSet.name === legacyDefinition.options.exporter.search
    );

    // Check if the component set exists
    if (!primaryComponentSet) {
      logger?.err(
        `No component set found for ${legacyDefinition.options.exporter.search}`
      );
    }

    // Locate component set metadata
    const primaryComponentSetMetadata = componentSetsMetadata.find(
      (metadata) => metadata.node_id === primaryComponentSet.id
    );

    // Find other component sets located within the same containing frame of the found component set
    const releavantComponentSets = primaryComponentSetMetadata
      ? componentSetsMetadata
          .filter(
            (metadata) =>
              metadata.node_id !== primaryComponentSetMetadata.node_id &&
              metadata.containing_frame.nodeId ===
                primaryComponentSetMetadata.containing_frame.nodeId
          )
          .map((meta) =>
            componentSets.find(
              (componentSet) => componentSet.id === meta.node_id
            )
          )
      : [];

    // Return the result
    return [primaryComponentSet, ...releavantComponentSets];
  };

  const getComponentDefinitionForLegacyComponentDefinition = (
    componentSet: FigmaTypes.ComponentSet,
    legacyDefinition: ExportTypes.ILegacyComponentDefinition
  ): ExportTypes.IComponentDefinition => {
    const supportedVariantProps = [
      ...(legacyDefinition?.options?.exporter?.supportedVariantProps?.design ??
        []),
      ...(legacyDefinition?.options?.exporter?.supportedVariantProps?.layout ??
        []),
    ];

    const definitionSupportedVariantProperties = supportedVariantProps.map(
      (variantProp) => variantProp.replace(/ *\([^)]*\) */g, "")
    );
    const definitionSupportedVariantPropertiesWithShareParams =
      supportedVariantProps.filter((variantProperty) =>
        variantProperty.match(/ *\([^)]*\) */g)
      );

    const variantProperties = Object.entries(
      componentSet.componentPropertyDefinitions
    )
      .map(([variantPropertyName, variantPropertyDefinition]) => {
        return {
          name: variantPropertyName,
          type: variantPropertyDefinition.type,
          default: variantPropertyDefinition.defaultValue,
          options: variantPropertyDefinition.variantOptions ?? [],
        };
      })
      .filter(
        (variantProperty) =>
          variantProperty.type === "VARIANT" &&
          definitionSupportedVariantProperties.includes(variantProperty.name)
      );

    const sharedComponentVariants: ExportTypes.IComponentDefinitionOptions["exporter"]["sharedComponentVariants"] =
      [];

    if (definitionSupportedVariantPropertiesWithShareParams.length > 0) {
      definitionSupportedVariantPropertiesWithShareParams.forEach((item) => {
        const shareDefinition = getComponentPropertyWithParams(item);
        shareDefinition.params.forEach(
          ([searchValue, distinctiveVariantPropertiesStr]) => {
            componentSet.children
              .filter((component) => {
                return (
                  slugify(
                    getComponentInstanceNamePart(
                      component.name,
                      shareDefinition.variantProperty
                    ) ?? ""
                  ) === slugify(searchValue)
                );
              })
              .forEach((component) =>
                sharedComponentVariants.push({
                  componentId: component.id,
                  distinctiveVariantProperties:
                    distinctiveVariantPropertiesStr.split(","),
                  sharedVariantProperty: shareDefinition.variantProperty,
                })
              );
          }
        );
      });
    }

    return {
      id: componentSet.id,
      name: legacyDefinition.id,
      group: legacyDefinition.group,
      options: {
        exporter: {
          variantProperties: variantProperties.map(
            (variantProp) => variantProp.name
          ),
          sharedComponentVariants,
        },
      },
      parts: legacyDefinition.parts,
      legacyDefinitionOptions: legacyDefinition.options,
    };
  };

  const getComponentPropertyWithParams = (variantProperty: string) => {
    const regex = /^([^:]+)(?:\(([^)]+)\))?$/;
    const matches = variantProperty.match(regex);

    if (!matches || matches.length !== 3) {
      return null; // ignore if format is invalid
    }

    const key = matches[1].trim();
    const value = matches[2]?.trim();

    return {
      variantProperty: key,
      params: value
        ? value
            .substring(1)
            .split(":")
            .map(
              (param) =>
                param.split(/\/([\s\S]*)/).slice(0, 2) as [string, string]
            )
        : undefined,
    };
  };

  return { getLocalStyles, getAssets, getComponents };
}
