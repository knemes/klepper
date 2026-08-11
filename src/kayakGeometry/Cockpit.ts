import type { KayakParameters, MeshData } from "./types";
import { KayakGeometry } from "./KayakGeometry";

export class Cockpit extends KayakGeometry {
  public componentType = "Cockpit";

  constructor(rhino: any) {
    super(rhino);
  }

  public isInCockpitZone(x: number, params: KayakParameters): boolean {
    const activeCpStart = params.cockpitStart;
    const activeCpEnd = activeCpStart + params.cockpitLength;
    return x >= activeCpStart && x <= activeCpEnd;
  }

  /**
   * Evaluates the lateral boundary half-width (Y coordinate) of the cockpit opening at a given X.
   */
  public getCockpitBoundaryY(
    x: number,
    params: KayakParameters,
    facetOutlineCurve?: any
  ): number {
    const activeCpStart = params.cockpitStart;
    const cpLength = params.cockpitLength;
    const cpWidth = params.cockpitWidth;
    const cpCenterX = activeCpStart + cpLength / 2;
    const activeCpEnd = activeCpStart + cpLength;

    if (!facetOutlineCurve) {
      // Fallback if curve not available
      if (x >= cpCenterX) {
        return Math.max(0.0, cpWidth / 2 - 1.0);
      } else {
        const xc = x - cpCenterX;
        const a = cpLength / 2;
        const b = Math.max(0.0, cpWidth / 2 - 1.0);
        const ratio = (xc * xc) / (a * a || 1);
        return ratio < 1.0 ? b * Math.sqrt(1.0 - ratio) : 0.0;
      }
    }

    // Binary search helper to evaluate smooth facetOutlineCurve
    const getSmoothFacetYAtX = (xVal: number): number => {
      const domain = facetOutlineCurve.domain;
      const tMin = domain[0];
      const tMax = domain[1];
      const tMid = (tMin + tMax) / 2;

      let low = tMin;
      let high = tMid;

      for (let iter = 0; iter < 16; iter++) {
        const t = (low + high) / 2;
        const pt = facetOutlineCurve.pointAt(t);
        const px = pt[0];

        if (px < xVal) {
          low = t;
        } else {
          high = t;
        }
      }
      const finalT = (low + high) / 2;
      const pt = facetOutlineCurve.pointAt(finalT);
      return Math.abs(pt[2]);
    };

    // Find the exact X where the smooth facet width is 1.0 inch
    let lowX = cpCenterX;
    let highX = activeCpEnd;
    for (let iter = 0; iter < 12; iter++) {
      const midX = (lowX + highX) / 2;
      const yVal = getSmoothFacetYAtX(midX);
      if (yVal > 1.0) {
        lowX = midX;
      } else {
        highX = midX;
      }
    }
    const coamingMaxX = (lowX + highX) / 2;

    if (x >= cpCenterX) {
      // Front half: offset 1" inward from the smooth flat plane outline curve
      if (x >= coamingMaxX) {
        return 0.0;
      }
      const yVal = getSmoothFacetYAtX(x);
      return Math.max(0.0, yVal - 1.0);
    } else {
      // Back half: rounded semi-ellipse closed out smoothly from the midpoint
      const xc = x - cpCenterX;
      const a = cpLength / 2;
      const b = Math.max(0.0, getSmoothFacetYAtX(cpCenterX) - 1.0);
      const ratio = (xc * xc) / (a * a || 1);
      return ratio < 1.0 ? b * Math.sqrt(1.0 - ratio) : 0.0;
    }
  }

  /**
   * Generates mesh buffers for rendering the cockpit coaming wood rim in Three.js/Rhino.
   */
  public generateCoamingMesh(
    params: KayakParameters,
    sternDeckZ: number,
    slope: number,
    halfL: number,
    getGunwaleAndDeckHeight: (x: number) => { gunwaleY: number; gunwaleZ: number; deckZ: number; yFlat: number },
    facetOutlineCurve?: any
  ): MeshData {
    const N = 40;
    const coamingVertices: number[] = [];
    const coamingIndices: number[] = [];
    const uvs: number[] = [];

    const activeCpStart = params.cockpitStart;
    const cpLength = params.cockpitLength;
    const cpCenterX = activeCpStart + cpLength / 2;
    const activeCpEnd = activeCpStart + cpLength;

    const getPlaneZ = (xVal: number) => {
      return sternDeckZ + xVal * slope;
    };

    // Calculate normal vector of the tilted deck facet plane in XZ
    const planeLen = Math.sqrt(1.0 + slope * slope);
    const nx = -slope / planeLen;
    const ny = 1.0 / planeLen;

    const coamingHeight = params.coamingHeight !== undefined ? params.coamingHeight : 0.75;

    // Helper to evaluate smooth facetOutlineCurve
    const getSmoothFacetYAtX = (xVal: number): number => {
      if (!facetOutlineCurve) return getGunwaleAndDeckHeight(xVal).yFlat;
      const domain = facetOutlineCurve.domain;
      const tMin = domain[0];
      const tMax = domain[1];
      const tMid = (tMin + tMax) / 2;

      let low = tMin;
      let high = tMid;
      for (let iter = 0; iter < 16; iter++) {
        const t = (low + high) / 2;
        const pt = facetOutlineCurve.pointAt(t);
        const px = pt[0];
        if (px < xVal) {
          low = t;
        } else {
          high = t;
        }
      }
      const finalT = (low + high) / 2;
      const pt = facetOutlineCurve.pointAt(finalT);
      return Math.abs(pt[2]);
    };

    // Find the exact X where the smooth facet width is 1.0 inch
    let coamingMaxX = activeCpEnd;
    if (facetOutlineCurve) {
      let lowX = cpCenterX;
      let highX = activeCpEnd;
      for (let iter = 0; iter < 12; iter++) {
        const midX = (lowX + highX) / 2;
        const yVal = getSmoothFacetYAtX(midX);
        if (yVal > 1.0) {
          lowX = midX;
        } else {
          highX = midX;
        }
      }
      coamingMaxX = (lowX + highX) / 2;
    }

    const L_front = coamingMaxX - cpCenterX;
    const L_back = cpCenterX - activeCpStart;

    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2;
      const cosA = Math.cos(angle);

      let xVal = cpCenterX;
      if (cosA >= 0) {
        // Front half: spans from cpCenterX to coamingMaxX
        xVal = cpCenterX + L_front * cosA;
      } else {
        // Back half: spans from cpCenterX to activeCpStart
        xVal = cpCenterX + L_back * cosA;
      }

      const zVal = getPlaneZ(xVal); // height of flat deck trimming plane at X

      // Evaluate the smooth cockpit boundary half-width using getCockpitBoundaryY
      const activeYc = this.getCockpitBoundaryY(xVal, params, facetOutlineCurve);

      // Mirror the sign of the angle
      const finalY = Math.sign(Math.sin(angle)) * activeYc;

      // Coordinates mapped to Three.js orientation: X = length, Y = height, Z = width
      const tx = xVal - halfL;
      const ty = zVal;
      const tz = finalY;

      // Extrude along the sloping deck facet normal
      const txTop = tx + coamingHeight * nx;
      const tyTop = ty + coamingHeight * ny;
      const tzTop = tz;

      // Add bottom vertex
      coamingVertices.push(tx, ty, tz);
      uvs.push(i / N, 0.0);

      // Add top vertex
      coamingVertices.push(txTop, tyTop, tzTop);
      uvs.push(i / N, 1.0);
    }

    // Connect vertices with triangles
    for (let i = 0; i < N; i++) {
      const b1 = i * 2;
      const t1 = b1 + 1;
      const b2 = ((i + 1) % N) * 2;
      const t2 = b2 + 1;

      // Triangle 1: bottom1 -> bottom2 -> top1
      coamingIndices.push(b1, b2, t1);
      // Triangle 2: bottom2 -> top2 -> top1
      coamingIndices.push(b2, t2, t1);
    }

    return {
      vertices: new Float32Array(coamingVertices),
      indices: new Uint32Array(coamingIndices),
      normals: new Float32Array(coamingVertices.length), // calculated inside Three.js
      uvs: new Float32Array(uvs)
    };
  }
}
