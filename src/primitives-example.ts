export const PRIMITIVES_CODE = `// In model.js, for example:
// import { sphere } from "./primitives.js";
// scene.add(sphere({ radius: 5 }));
//
// All primitives are centered at the world origin. Cylinders run along Z.
// Use .rotate() and .displace() on the returned solids to place them in your scene.

export function cuboid({ width = 10, depth = 10, height = 10 } = {}) {
  const s = sketch({ plane: XY.displace([0, 0, -height / 2]) });
  s.add(rectangle({ center, width, height: depth }));
  return s.extrude(height);
}

export function cylinder({ radius = 5, height = 10 } = {}) {
  const s = sketch({ plane: XY.displace([0, 0, -height / 2]) });
  s.add(circle(radius));
  return s.extrude(height);
}

export function cylinderElliptic({ radiusX = 5, radiusY = 3, height = 10 } = {}) {
  const s = sketch({ plane: XY.displace([0, 0, -height / 2]) });
  s.add(ellipse({ center, radiusX, radiusY }));
  return s.extrude(height);
}

export function sphere({ radius = 5 } = {}) {
  return cylinder({ radius, height: 2 * radius }).round(radius);
}

export function torus({ majorRadius = 10, minorRadius = 2 } = {}) {
  const s = sketch({ plane: XY.displace([0, 0, -minorRadius]) });
  s.add(
    circle(majorRadius + minorRadius),
    circle(majorRadius - minorRadius),
  );
  return s.extrude(2 * minorRadius).round(minorRadius);
}
`;
