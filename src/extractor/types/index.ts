import { ReferenceObject } from "../../types";

export interface NodeStyleMap {
  [key: string]: ReferenceObject;
}

export interface DesignMap {
  colors: NodeStyleMap;
  effects: NodeStyleMap;
  typography: NodeStyleMap;
}