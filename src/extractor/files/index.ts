import { slugify } from "../../utils";
import { IAssetObject } from "../../types";

export default function extract(
  files: {
    name: string;
    description: string;
    data: string;
    extension: string;
  }[]
): IAssetObject[] {
  return files.map((asset) => {
    const assetName = slugify(asset.name ?? "");
    const filename = assetName + "." + asset.extension;

    return {
      path: filename,
      name: assetName,
      icon: assetName,
      description: asset.description,
      index: assetName.toLowerCase().replace(/[\W_]+/g, " "),
      size: asset.data.length,
      data: asset.data.replace(/(\r\n|\n|\r)/gm, ""),
    };
  });
}
