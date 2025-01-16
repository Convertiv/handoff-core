import { Vector2 } from "../types/figma";

/**
 * Returns a Vector2 where 2 lines (represented by 4 Vector2) intersect.
 * Throws a error if the lines do not intersect.
 *
 * @param {Vector2} p1
 * @param {Vector2} p2
 * @param {Vector2} p3
 * @param {Vector2} p4
 * @returns {Vector2}
 */
export function getIntersection(
  p1: Vector2,
  p2: Vector2,
  p3: Vector2,
  p4: Vector2
): Vector2 {
  // usage: https://dirask.com/posts/JavaScript-how-to-calculate-intersection-point-of-two-lines-for-given-4-points-VjvnAj

  // down part of intersection point formula
  var d1 = (p1.x - p2.x) * (p3.y - p4.y); // (x1 - x2) * (y3 - y4)
  var d2 = (p1.y - p2.y) * (p3.x - p4.x); // (y1 - y2) * (x3 - x4)
  var d = d1 - d2;

  if (d === 0) {
    throw new Error("Number of intersection points is zero or infinity.");
  }

  // upper part of intersection point formula
  var u1 = p1.x * p2.y - p1.y * p2.x; // (x1 * y2 - y1 * x2)
  var u4 = p3.x * p4.y - p3.y * p4.x; // (x3 * y4 - y3 * x4)

  var u2x = p3.x - p4.x; // (x3 - x4)
  var u3x = p1.x - p2.x; // (x1 - x2)
  var u2y = p3.y - p4.y; // (y3 - y4)
  var u3y = p1.y - p2.y; // (y1 - y2)

  // intersection point formula
  var px = (u1 * u2x - u3x * u4) / d;
  var py = (u1 * u2y - u3y * u4) / d;

  return {
    x: px,
    y: py,
  };
}

/**
 * Returns the handle Vector2 when rotated around the pivot point (Vector2) by the given angle (in degrees).
 *
 * @param {Vector2} pivot
 * @param {Vector2} handle
 * @param {number} angle
 * @returns
 */
export function rotate(
  pivot: Vector2,
  handle: Vector2,
  angle: number
): Vector2 {
  const radians = (Math.PI / 180) * angle;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: cos * (handle.x - pivot.x) + sin * (handle.y - pivot.y) + pivot.x,
    y: cos * (handle.y - pivot.y) - sin * (handle.x - pivot.x) + pivot.y,
  };
}

/**
 * Returns a resulting Vector2 of a elipse rotation around a pivot Vector2 with the given angle and radius (x, y).
 *
 * @param {Vector2} pivot
 * @param {number} xRadius
 * @param {number} yRadius
 * @param {number} angle
 * @returns
 */
export function rotateElipse(
  pivot: Vector2,
  xRadius: number,
  yRadius: number,
  angle: number
): Vector2 {
  "https://www.desmos.com/calculator/aqlhivzbvs"; // -> rotated elipse equations
  "https://www.mathopenref.com/coordparamellipse.html"; // -> good explanation about elipse parametric equations
  "https://math.stackexchange.com/questions/941490/whats-the-parametric-equation-for-the-general-form-of-an-ellipse-rotated-by-any?noredirect=1&lq=1&newreg=fd8890e3dad245b0b6a0f182ba22f7f3"; // -> good explanation of rotated parametric elipse equations
  // rotates points[x, y] some degrees about an origin [cx, cy]
  xRadius = xRadius * 1.5;
  yRadius = yRadius * 1.5;

  const cosAngle = Math.cos((Math.PI / 180) * (angle + 180));
  const sinAngle = Math.sin((Math.PI / 180) * (angle + 180));

  return {
    x: -xRadius * cosAngle + pivot.x,
    y: -yRadius * sinAngle + pivot.y,
  };
}
