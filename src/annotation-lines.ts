import * as compass from "libcompass";
import type { ReadonlyVec3 } from "gl-matrix";

export interface AnnotationLines {
  positions: Float32Array;
  color: `#${string}`;
}

/** Preview extents: plane axes are 10 units; infinite lines span 100 units. */
export function annotationLines(geometry: compass.AnnotationGeometry, color: `#${string}`, plane = compass.XY): AnnotationLines[] {
  const segments = (points: readonly ReadonlyVec3[], tint = color): AnnotationLines[] => {
    const positions = new Float32Array(Math.max(0, points.length - 1) * 6);
    for (let i = 1; i < points.length; i++) {
      positions.set(points[i - 1], (i - 1) * 6);
      positions.set(points[i], (i - 1) * 6 + 3);
    }
    if (!positions.every(Number.isFinite)) throw new RangeError("Annotation geometry must have finite coordinates");
    return positions.length ? [{ positions, color: tint }] : [];
  };
  if (geometry instanceof compass.SpatialLine) {
    const direction = geometry, scale = 50 / Math.hypot(...direction);
    return segments([-1, 1].map(sign => [0, 1, 2].map(i => direction.origin[i] + sign * scale * direction[i]) as [number, number, number]));
  }
  if (Array.isArray(geometry)) return geometry.flatMap(item => annotationLines(item, color, plane));
  if (geometry instanceof compass.Plane) {
    return [geometry.xAxis, geometry.yAxis, geometry.normal].flatMap((axis, i) => segments([
      geometry.origin, [0, 1, 2].map(j => geometry.origin[j] + axis[j] * 10) as [number, number, number],
    ], [compass.colors.red, compass.colors.green, compass.colors.blue][i]));
  }
  if (geometry instanceof compass.Sketch) return geometry.elements.flatMap(element => annotationLines(element, color, geometry.plane));
  if (geometry instanceof compass.SpatialCurve) return segments(geometry.sample().map(vertex => vertex.position));
  const world = (point: compass.Point) => plane.toWorld(point).position;
  if (geometry instanceof compass.PlanarCurve) return segments(geometry.sample().map(world));
  if (geometry instanceof compass.LineSegment) return segments([world(geometry.start), world(geometry.end)]);
  if (geometry instanceof compass.Line) {
    const scale = 50 / Math.hypot(...geometry.direction);
    return segments([world(geometry.at(-scale)), world(geometry.at(scale))]);
  }
  if (geometry && typeof geometry === "object" && "x" in geometry && "y" in geometry) {
    const { x, y } = geometry;
    return [...segments([world({ x: x - 0.25, y }), world({ x: x + 0.25, y })]),
      ...segments([world({ x, y: y - 0.25 }), world({ x, y: y + 0.25 })])];
  }
  throw new TypeError("Unsupported annotation geometry");
}
