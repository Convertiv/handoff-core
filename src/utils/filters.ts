import { PaintType } from "../types/figma";

/**
 * Filters out null values
 * @param value
 * @returns
 */
export const filterOutNull = <T>(value: T): value is NonNullable<T> =>
  value !== null;

export const isValidGradientType = (gradientType: PaintType): boolean => {
  return ["GRADIENT_LINEAR", "GRADIENT_RADIAL"].includes(gradientType);
};

export const isShadowEffectType = (effect: Effect["type"]): boolean => {
  return ["DROP_SHADOW", "INNER_SHADOW"].includes(effect);
};

export const isValidEffectType = (effect: Effect["type"]): boolean => {
  return isShadowEffectType(effect);
};
