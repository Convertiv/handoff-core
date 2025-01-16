import * as FigmaTypes from "../../types/figma";
import { Matrix } from "ts-matrix";

export function isPluginNode(
  value: FigmaTypes.Node | BaseNode
): value is BaseNode {
  return value !== null && "removed" in value;
}

export function resolvePaint(paint: readonly Paint[]): FigmaTypes.Paint[] {
  return paint.map((p) => {
    if (p.type === "SOLID") {
      return {
        blendMode: p.blendMode,
        color: p.type === "SOLID" ? { ...p.color, a: 1 } : null, // Plugin API does not have alpha in solid color
        opacity: p.opacity,
        type: p.type,
        visible: p.visible,
      };
    } else if (p.type === "GRADIENT_LINEAR") {
      return {
        blendMode: p.blendMode,
        opacity: p.opacity,
        gradientStops: p.gradientStops,
        type: p.type,
        visible: p.visible,
        gradientHandlePositions: convertTransformToLinearGradientHandles(
          p.gradientTransform
        ),
      };
    } else if (p.type === "GRADIENT_RADIAL" || p.type === "GRADIENT_DIAMOND") {
      return {
        blendMode: p.blendMode,
        opacity: p.opacity,
        gradientStops: p.gradientStops,
        type: p.type,
        visible: p.visible,
        gradientHandlePositions: convertTransformToRadialGradientHandles(
          p.gradientTransform
        ),
      };
    }
    // TODO: Handle other paint types
  });
}

// get the Figma gradient handles from the affine transform matrix
// https://gist.github.com/yagudaev/0c2b89674c6aee8b38cd379752ef58d0
// https://github.com/figma-plugin-helper-functions/figma-plugin-helpers/blob/5f3a767212da804054dbb97e0c39c161c5b03f22/src/helpers/extractLinearGradientStartEnd.ts
// https://github.com/figma-plugin-helper-functions/figma-plugin-helpers/blob/5f3a767212da804054dbb97e0c39c161c5b03f22/src/helpers/extractRadialOrDiamondGradientParams.ts
// TODO: implement readial/diamon gradient handles
function convertTransformToLinearGradientHandles(transform: number[][]) {
  const transformMatrix = new Matrix(
    3,
    3,
    transform.length === 2 ? [...transform, [0, 0, 1]] : transform
  );
  const inverseTransform = transformMatrix.inverse();

  const identityMatrixHandlePositions = new Matrix(3, 3, [
    [0, 1, 0],
    [0.5, 0.5, 1],
    [1, 1, 1],
  ]);

  const mp = inverseTransform.multiply(identityMatrixHandlePositions).values;

  return [
    { x: mp[0][0], y: mp[1][0] },
    { x: mp[0][1], y: mp[1][1] },
    { x: mp[0][2], y: mp[1][2] },
  ];
}

function convertTransformToRadialGradientHandles(transform: number[][]) {
  const transformMatrix = new Matrix(
    3,
    3,
    transform.length === 2 ? [...transform, [0, 0, 1]] : transform
  );
  const inverseTransform = transformMatrix.inverse();

  const identityMatrixHandlePositions = new Matrix(3, 3, [
    [0.5, 1, 0.5],
    [0.5, 0.5, 1],
    [1, 1, 1],
  ]);

  const mp = inverseTransform.multiply(identityMatrixHandlePositions).values;

  return [
    { x: mp[0][0], y: mp[1][0] },
    { x: mp[0][1], y: mp[1][1] },
    { x: mp[0][2], y: mp[1][2] },
  ];
}
