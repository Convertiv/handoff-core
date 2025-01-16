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
import { filterByNodeType } from "./utils";
import { filterOutNull, slugify } from "../../utils";
import { IComponentSetMetadata } from "./types";

const defaultExtension: string = "svg";

export function RestApiProvider(auth: {
  projectId: string;
  accessToken: string;
}): ExportTypes.IProvider {
  const getLocalStyles = async (logger?: ExportTypes.ILogger) => {
    try {
      const apiResponse = await getFileStyles(auth.projectId, auth.accessToken);

      const nodeMeta = apiResponse.data.meta.styles.map((item) => ({
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

      return [];
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
              a_sort = parseInt(a_parts[0]!) + parseInt(a_parts[1]);
            }
            if (b_parts[1]) {
              b_sort = parseInt(b_parts[0]!) + parseInt(b_parts[1]);
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
      fileComponentSetsRes!.data.meta.component_sets;

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

    return processFigmaNodes(componentSetNodesResult.data);
  };

  const processFigmaNodes = (
    fileNodesResponse: FigmaTypes.FileNodesResponse
  ) => {
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

    const componentSets = Object.values(fileNodesResponse.nodes)
      .map((node) => node?.document)
      .filter(filterByNodeType("COMPONENT_SET"))
      .filter((componentSet) => {
        try {
          if (
            !componentSet.sharedPluginData ||
            !componentSet.sharedPluginData[`convertiv_handoff_app`]
          ) {
            return false;
          }
          const settings = JSON.parse(
            componentSet.sharedPluginData[`convertiv_handoff_app`][
              `node_${componentSet.id}_settings`
            ]
          ) as IComponentSetMetadata;
          return !!settings.exposed;
        } catch {
          return false;
        }
      });

    for (const componentSet of componentSets) {
      const definition = getComponentSetComponentDefinition(componentSet);

      if (!definition) {
        continue;
      }

      result.push({
        name: definition.name,
        componentSetNode: componentSet,
        componentsMetadata: componentsMetadata,
        definition,
      });
    }

    return result;
  };

  const getComponentSetComponentDefinition = (
    componentSet: FigmaTypes.ComponentSet
  ): ExportTypes.IComponentDefinition | null => {
    const metadata = JSON.parse(
      componentSet.sharedPluginData[`convertiv_handoff_app`][
        `node_${componentSet.id}_settings`
      ]
    ) as IComponentSetMetadata;

    const id = componentSet.id;
    const name = slugify(metadata.name);

    if (!componentSet.componentPropertyDefinitions) {
      return null;
    }

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
      .filter((variantProperty) => variantProperty.type === "VARIANT");

    return {
      id,
      name,
      group: "", // TODO
      options: {
        exporter: {
          variantProperties: variantProperties.map(
            (variantProp) => variantProp.name
          ),
          sharedComponentVariants: metadata.sharedVariants,
        },
      },
      parts: metadata.parts.map((part) => ({
        id: slugify(part.name),
        tokens: part.definitions,
      })),
    };
  };

  return { getLocalStyles, getAssets, getComponents };
}
