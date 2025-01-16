import {
  Color,
  ColorStop,
  Effect,
  Paint,
  PaintType,
  Vector2,
} from "../types/figma";
import { isShadowEffectType, isValidGradientType } from ".";
import { getIntersection, rotate, rotateElipse } from ".";

/**
 * Generate a CSS gradient from a color gradient object

 * @todo Support other kinds of gradients
 * @param color
 * @returns
 */
export function transformGradientToCss(
  color: GradientObject,
  paintType: PaintType = "GRADIENT_LINEAR"
): string {
  // generate the rgbs) {}
  let params: number[] = [];
  let colors: string[] = [];

  if (paintType === "SOLID") {
    params = getLinearGradientParamsFromGradientObject(color);
    colors = color.stops.map(
      (stop) =>
        `rgba(${figmaColorToWebRGB(stop.color)
          .map((val) => formatNumberForCss(val))
          .join(", ")})`
    );
    return `linear-gradient(${params[0]}deg, ${colors.join(", ")})`;
  }

  if (paintType === "GRADIENT_LINEAR") {
    params = getLinearGradientParamsFromGradientObject(color);
    colors = color.stops.map(
      (stop, i) =>
        `rgba(${figmaColorToWebRGB(stop.color)
          .map((val) => formatNumberForCss(val))
          .join(", ")}) ${params[i + 1]}%`
    );
    return `linear-gradient(${params[0]}deg, ${colors.join(", ")})`;
  }

  if (paintType === "GRADIENT_RADIAL") {
    const params = getRadialGradientParamsFromGradientObject(color);
    colors = color.stops.map(
      (stop) =>
        `rgba(${figmaColorToWebRGB(stop.color)
          .map((val) => formatNumberForCss(val))
          .join(", ")}) ${formatNumberForCss(
          Number(Number((stop.position ?? 0).toFixed(4)) * 100)
        )}%`
    );
    return `radial-gradient(${formatNumberForCss(
      params[0]
    )}% ${formatNumberForCss(params[1])}% at ${formatNumberForCss(
      params[2]
    )}% ${formatNumberForCss(params[3])}%, ${colors.join(", ")})`;
  }

  return ``;
}

export function transformFigmaPaintToGradient(
  paint: Paint
): GradientObject | null {
  if (paint.type === "SOLID") {
    // Process solid as gradient
    const gradientColor =
      paint.color && paint.opacity
        ? { ...paint.color, a: paint.opacity }
        : paint.color;
    return {
      blend: paint.blendMode,
      handles: [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ] as Vector2[],
      stops: [
        { color: gradientColor, position: null },
        { color: gradientColor, position: null },
      ] as ColorStop[],
    };
  }

  if (isValidGradientType(paint.type)) {
    return {
      blend: paint.blendMode,
      handles: (paint.gradientHandlePositions as Vector2[]) ?? [],
      stops: (paint.gradientStops as ColorStop[]) ?? [],
    };
  }

  return null;
}

/**
 * Converts figma color to a hex (string) value.
 *
 * @param {Color} color
 * @returns {string}
 *
 * @example
 * // returns #001aff
 * figmaRGBToHex({ r: 0, g: 0.1, b: 1, a: 1 })
 */
export function transformFigmaColorToHex(color: Color): string {
  let hex = "#";

  const rgb = figmaColorToWebRGB(color) as webRGB | webRGBA;
  hex += ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2])
    .toString(16)
    .slice(1);

  if (rgb[3] !== undefined) {
    const a = Math.round(rgb[3] * 255).toString(16);
    if (a.length == 1) {
      hex += "0" + a;
    } else {
      if (a !== "ff") hex += a;
    }
  }
  return hex;
}

export const transformFigmaColorToCssColor = (color: Color): string => {
  const { r, g, b, a } = color;
  if (a === 1) {
    // transform to hex
    return transformFigmaColorToHex(color);
  }

  return `rgba(${formatNumberForCss(r * 255)}, ${formatNumberForCss(
    g * 255
  )}, ${formatNumberForCss(b * 255)}, ${formatNumberForCss(a)})`;
};

export function transformFigmaPaintToCssColor(
  paint: Paint,
  asLinearGradient: boolean = false
): string | null {
  if (paint.type === "SOLID" && !asLinearGradient) {
    if (!paint.color) {
      return null;
    }

    const { r, g, b, a } = paint.color || { r: 0, g: 0, b: 0, a: 0 };
    return transformFigmaColorToCssColor({
      r,
      g,
      b,
      a: a * (paint.opacity ?? 1),
    });
  }

  const gradient = transformFigmaPaintToGradient(paint);
  return gradient ? transformGradientToCss(gradient, paint.type) : null;
}

export const transformFigmaFillsToCssColor = (
  fills: ReadonlyArray<Paint>,
  forceHexOrRgbaValue = false
): { color: string; blend: string } => {
  const count = fills?.length ?? 0;
  const hasLayers = count > 0;
  const hasMultipleLayers = count > 1;
  const shouldForceHexOrRgbaValue =
    forceHexOrRgbaValue && fills.filter((f) => f.type !== "SOLID").length === 0;

  let colorValue: string = "transparent";
  let blendValue: string = "normal";

  if (hasLayers) {
    if (shouldForceHexOrRgbaValue && hasMultipleLayers) {
      colorValue = transformFigmaColorToCssColor(
        blendFigmaColors(
          fills.map((fill) => ({
            r: fill.color.r,
            g: fill.color.g,
            b: fill.color.b,
            a: fill.color.a * (fill.opacity ?? 1),
          }))
        )
      );
    } else {
      fills = [...fills].reverse();
      colorValue = fills
        .map((fill, i) =>
          transformFigmaPaintToCssColor(
            fill,
            hasMultipleLayers && i !== count - 1
          )
        )
        .filter(Boolean)
        .join(", ");
      blendValue = fills
        .map((fill) => fill.blendMode.toLowerCase().split("_").join("-"))
        .filter(Boolean)
        .join(", ");
    }
  }

  return {
    color: colorValue,
    blend: blendValue,
  };
};

export const transformFigmaEffectToCssBoxShadow = (effect: Effect): string => {
  const { type, color, offset, radius, visible, spread } = effect;

  if (!visible) {
    return "";
  }

  if (isShadowEffectType(type) && color && offset) {
    const { x, y } = offset;

    return `${x}px ${y}px ${radius ?? 0}px ${
      spread ? spread + "px " : ""
    }${transformFigmaColorToCssColor(color)}${
      type === "INNER_SHADOW" ? " inset" : ""
    }`;
  }

  return "";
};

/**
 * Converts figma color to a RGB(A) in form of a array.
 *
 * @param {Color} color
 * @returns {string}
 *
 * @example
 * // returns [226, 18, 17]
 * figmaRGBToWebRGB({r: 0.887499988079071, g: 0.07058823853731155, b: 0.0665624737739563, a: 1})
 */
export function figmaColorToWebRGB(color: Color): webRGB | webRGBA {
  if ("a" in color && color.a !== 1) {
    return [
      Math.round(color.r * 255),
      Math.round(color.g * 255),
      Math.round(color.b * 255),
      Math.round(color.a * 100) / 100,
    ];
  }

  return [
    Math.round(color.r * 255),
    Math.round(color.g * 255),
    Math.round(color.b * 255),
  ];
}

/**
 * Returns the angle of the gradient
 *
 * @param {PositionObject[]} handles
 * @returns {number}
 */
export function getGradientAngle(handles: Vector2[]): number {
  if (handles.length < 3) {
    throw new Error(
      "Three handles are required to calculate the angle of the gradient"
    );
  }

  let [pivotPoint, directionGuidePoint, angleGuidePoint] = [...handles];

  const refSlope =
    (directionGuidePoint.y - pivotPoint.y) /
    (directionGuidePoint.x - pivotPoint.x);
  const refAngle = Number(((Math.atan(refSlope) * 180) / Math.PI).toFixed(2));

  const normalizedDirectionGuidePoint = rotate(
    pivotPoint,
    directionGuidePoint,
    refAngle
  );
  const normalizedAngleGuidePoint = rotate(
    pivotPoint,
    angleGuidePoint,
    refAngle
  );

  if (
    (normalizedDirectionGuidePoint.x - pivotPoint.x > 0 &&
      normalizedAngleGuidePoint.y - pivotPoint.y > 0) ||
    (normalizedDirectionGuidePoint.x - pivotPoint.x < 0 &&
      normalizedAngleGuidePoint.y - pivotPoint.y < 0)
  ) {
    // Since Figma allows the angle guide point to move to the either side
    // of the direction axis (defined by the pivot point and direction guide point)
    // we will swap angle guide point and the pivot point to compensate for the fact
    // that the direction of the angle guide point is on the opposite side of the direction axis
    pivotPoint = handles[2];
    angleGuidePoint = handles[0];
  }

  const slope =
    (angleGuidePoint.y - pivotPoint.y) / (angleGuidePoint.x - pivotPoint.x);
  const radians = Math.atan(slope);
  let degrees = (radians * 180) / Math.PI;

  if (pivotPoint.x < angleGuidePoint.x) {
    degrees = degrees + 180;
  } else if (pivotPoint.x > angleGuidePoint.x) {
    if (pivotPoint.y < angleGuidePoint.y) {
      degrees = 360 - Math.abs(degrees);
    }
  } else if (pivotPoint.x === angleGuidePoint.x) {
    // horizontal line
    if (pivotPoint.y < angleGuidePoint.y) {
      degrees = 360 - Math.abs(degrees); // on negative y-axis
    } else {
      degrees = Math.abs(degrees); // on positive y-axis
    }
  }

  return Number(degrees.toFixed(2));
}

/**
 * Returns params (angle and stops) necessary for a linear gradient to be constructed.
 * @param {GradientObject} gradient
 * @returns {number[]}
 */
export function getLinearGradientParamsFromGradientObject(
  gradient: GradientObject
): number[] {
  const gradientAngle = getGradientAngle(gradient.handles);

  // this next section finds the linear gradient line segment -> https://stackoverflow.com/questions/51881307 creating-a-css-linear-gradient-based-on-two-points-relative-to-a-rectangle
  // calculating gradient line size (scalar) and change in x, y direction (coords)

  const lineChangeCoords = [
    gradient.handles[1].x - gradient.handles[0].x,
    1 - gradient.handles[1].y - (1 - gradient.handles[0].y),
  ];
  const currentLineSize = Math.sqrt(
    lineChangeCoords[0] ** 2 + lineChangeCoords[1] ** 2
  );

  // creating arbitrary gradient line
  const desiredLength = 1;
  const scaleFactor = (desiredLength - currentLineSize) / 2 / currentLineSize;

  const scaleCoords = {
    x: lineChangeCoords[0] * scaleFactor,
    y: lineChangeCoords[1] * scaleFactor,
  };

  const scaledArbGradientLine = [
    {
      x: gradient.handles[0].x - scaleCoords.x,
      y: gradient.handles[0].y + scaleCoords.y,
    },
    {
      x: gradient.handles[1].x + scaleCoords.x,
      y: gradient.handles[1].y - scaleCoords.y,
    },
  ];

  // getting relevant corners
  const topCenter =
    (gradientAngle > 90 && gradientAngle <= 180) ||
    (gradientAngle > 270 && gradientAngle <= 360)
      ? { x: 0, y: 0 }
      : { x: 1, y: 0 };
  const bottomCenter =
    (gradientAngle >= 0 && gradientAngle <= 90) ||
    (gradientAngle > 180 && gradientAngle <= 270)
      ? { x: 0, y: 1 }
      : { x: 1, y: 1 };

  const topLine = [
    { x: topCenter.x - desiredLength / 2, y: topCenter.y },
    { x: topCenter.x + desiredLength / 2, y: topCenter.y },
  ];
  const rotatedTopLine = [
    rotateElipse(
      topCenter,
      topCenter.x - topLine[0].x,
      topCenter.x - topLine[0].x,
      gradientAngle
    ),
    rotateElipse(
      topCenter,
      topCenter.x - topLine[1].x,
      topCenter.x - topLine[1].x,
      gradientAngle
    ),
  ];
  const bottomLine = [
    { x: bottomCenter.x - desiredLength / 2, y: bottomCenter.y },
    { x: bottomCenter.x + desiredLength / 2, y: bottomCenter.y },
  ];
  const rotatedBottomLine = [
    rotateElipse(
      bottomCenter,
      bottomCenter.x - bottomLine[0].x,
      bottomCenter.x - bottomLine[0].x,
      gradientAngle
    ),
    rotateElipse(
      bottomCenter,
      bottomCenter.x - bottomLine[1].x,
      bottomCenter.x - bottomLine[1].x,
      gradientAngle
    ),
  ];

  // calculating relevant portion of gradient line (the actual gradient line -> taking POI of perpendicular lines w/ arbitrary gradient line)
  const topLineIntersection = getIntersection(
    rotatedTopLine[0],
    rotatedTopLine[1],
    scaledArbGradientLine[0],
    scaledArbGradientLine[1]
  );
  const bottomLineIntersection = getIntersection(
    rotatedBottomLine[0],
    rotatedBottomLine[1],
    scaledArbGradientLine[0],
    scaledArbGradientLine[1]
  );

  const gradientLineDistance = Math.sqrt(
    (bottomLineIntersection.y - topLineIntersection.y) ** 2 +
      (bottomLineIntersection.x - topLineIntersection.x) ** 2
  );

  let params = [gradientAngle] as number[];

  gradient.stops.map((stop: any) => {
    let gradientStartPoint = { x: 0, y: 0 } as Vector2;

    if (gradient.handles[0].y < gradient.handles[1].y) {
      gradientStartPoint =
        topLineIntersection.y < bottomLineIntersection.y
          ? topLineIntersection
          : bottomLineIntersection;
    } else {
      gradientStartPoint =
        topLineIntersection.y > bottomLineIntersection.y
          ? topLineIntersection
          : bottomLineIntersection;
    }

    const stopX = stop.position * lineChangeCoords[0] + gradient.handles[0].x;
    const stopY = gradient.handles[0].y - stop.position * lineChangeCoords[1];

    let colorDistance = Math.sqrt(
      (stopY - gradientStartPoint.y) ** 2 + (stopX - gradientStartPoint.x) ** 2
    );

    let actualPercentage = colorDistance / gradientLineDistance;

    params.push(Number((Number(actualPercentage.toFixed(4)) * 100).toFixed(2)));
  });

  return params;
}

/**
 * Returns the values (shape and position) necessary for a radial gradient to be constructed.
 *
 * @param {PositionObject[]} handles
 * @returns {number[]}
 */
export function getRadialGradientParamsFromGradientObject(
  gradient: GradientObject
): number[] {
  return [
    Math.abs(
      Number((gradient.handles[1].x - gradient.handles[0].x).toFixed(4))
    ) * 100,
    Math.abs(
      Number((gradient.handles[2].y - gradient.handles[0].y).toFixed(4))
    ) * 100,
    Number(gradient.handles[0].x.toFixed(4)) * 100,
    Number(gradient.handles[0].y.toFixed(4)) * 100,
  ];
}

/**
 * Blends multiple Figma colors into a single Figma color.
 * Based on the JordanDelcros's JavaScript implementation https://gist.github.com/JordanDelcros/518396da1c13f75ee057
 *
 * @param {Color[]} figmaColors
 * @returns
 */
function blendFigmaColors(figmaColors: Color[]): Color {
  let base: webRGBA = [0, 0, 0, 0];
  let mix: webRGBA, added: webRGB | webRGBA;
  const colors = figmaColors.map((color) => figmaColorToWebRGB(color));

  while ((added = colors.shift())) {
    added[3] ??= 1;

    if (base[3] && added[3]) {
      mix = [0, 0, 0, 0];
      mix[3] = 1 - (1 - added[3]) * (1 - base[3]); // A
      mix[0] = Math.round(
        (added[0] * added[3]) / mix[3] +
          (base[0] * base[3] * (1 - added[3])) / mix[3]
      ); // R
      mix[1] = Math.round(
        (added[1] * added[3]) / mix[3] +
          (base[1] * base[3] * (1 - added[3])) / mix[3]
      ); // G
      mix[2] = Math.round(
        (added[2] * added[3]) / mix[3] +
          (base[2] * base[3] * (1 - added[3])) / mix[3]
      ); // B
    } else if (added) {
      mix = added as webRGBA;
    } else {
      mix = base;
    }

    base = mix;
  }

  return {
    r: mix[0] / 255,
    g: mix[1] / 255,
    b: mix[2] / 255,
    a: mix[3],
  };
}

/**
 * Formats a number for CSS usage by removing unnecessary trailing zeros and simplifying small decimal values.
 *
 * The function performs the following:
 * - If the number is an integer, it returns the number as a string without modifications.
 * - For floating-point numbers, it rounds to three decimal places and removes trailing zeros.
 * - Simplifies small numbers near zero (e.g., `0.001` becomes `.001` or `-.001`).
 *
 * This utility ensures numbers are presented in a compact and CSS-compatible format.
 *
 * @param {number} input - The number to format for CSS usage.
 * @returns {string} - The formatted number as a string.
 *
 * @example
 * formatNumberForCss(42);        // "42"
 * formatNumberForCss(0.123456);  // ".123"
 * formatNumberForCss(-0.0001);   // "-.000"
 * formatNumberForCss(0);         // "0"
 */
const formatNumberForCss = (input: number): string => {
  if (input % 1 === 0) {
    return input.toString();
  }

  let rounded = parseFloat(input.toFixed(3));
  let roundedStr = rounded.toFixed(3);

  if (rounded === 0) {
    return "0";
  }

  // Remove trailing zeros
  roundedStr = parseFloat(roundedStr).toString();

  if (Math.abs(rounded) < 1) {
    return rounded < 0 ? "-" + roundedStr.slice(2) : roundedStr.slice(1);
  }

  return roundedStr;
};

interface GradientObject {
  blend: BlendMode;
  handles: Vector2[];
  stops: ColorStop[];
}

type webRGB = [number, number, number];
type webRGBA = [number, number, number, number];
