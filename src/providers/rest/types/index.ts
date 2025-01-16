import { Exportable } from "../../../types";

export interface IComponentSetMetadata {
  exposed: boolean;
  name: string;
  parts: IComponentPart[];
  tokenNameSegments: string[];
  defaults: { [variantProperty: string]: string };
  replacements: IVariantPropValueReplacement[];
  sharedVariants: ISharedComponentVariant[];
  cssRootClass?: string;
}

interface IComponentPart {
  name: string;
  definitions: IExportDefinition[];
}

interface IExportDefinition {
  from: string;
  export: Exportable[];
}

interface ISharedComponentVariant {
  componentId: string;
  sharedVariantProperty?: string;
  distinctiveVariantProperties?: string[];
}

type IVariantPropValueReplacement = [
  variantProperty: string,
  find: string,
  replace: string
];
