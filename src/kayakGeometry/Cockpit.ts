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

    // Find tPeak of facetOutlineCurve using a ternary search to ensure monotonic X in the search interval
    const domain = facetOutlineCurve.domain;
    const tMin = domain[0];
    const tMax = domain[1];
    let lowT = tMin;
    let highT = tMax;
    for (let iter = 0; iter < 20; iter++) {
      const t1 = lowT + (highT - lowT) / 3;
      const t2 = highT - (highT - lowT) / 3;
      if (facetOutlineCurve.pointAt(t1)[0] < facetOutlineCurve.pointAt(t2)[0]) {
        lowT = t1;
      } else {
        highT = t2;
      }
    }
    const tPeak = (lowT + highT) / 2;

    const X_peak = facetOutlineCurve.pointAt(tPeak)[0];

    // Helper to evaluate normal offset point at t
    const getOffsetPointAtT = (tVal: number, offsetDist: number): { x: number, y: number } => {
      const pt = facetOutlineCurve.pointAt(tVal);
      const px = pt[0];
      const py = pt[2]; // Z is width

      const dt = (tMax - tMin) * 0.005;
      const t1 = Math.max(tMin, tVal - dt);
      const t2 = Math.min(tPeak, tVal + dt);
      const pt1 = facetOutlineCurve.pointAt(t1);
      const pt2 = facetOutlineCurve.pointAt(t2);

      const dx = pt2[0] - pt1[0];
      const dy = pt2[2] - pt1[2]; // Z is width
      const len = Math.sqrt(dx * dx + dy * dy) || 1.0;

      // Inward normal: since py < 0, inward means pointing in the positive Y direction
      const nx = -dy / len;
      const ny = dx / len;

      return {
        x: px + offsetDist * nx,
        y: py + offsetDist * ny
      };
    };

    const getCockpitBoundaryYAtX = (xVal: number): number => {
      // Peak offset is at X_peak - 1.0 (since tangent at peak is vertical)
      const coamingPeakX = X_peak - 1.0;
      if (xVal >= coamingPeakX) {
        return 0.0;
      }
      let low = tMin;
      let high = tPeak;
      for (let iter = 0; iter < 16; iter++) {
        const t = (low + high) / 2;
        const ptOff = getOffsetPointAtT(t, 1.0);
        if (ptOff.x < xVal) {
          low = t;
        } else {
          high = t;
        }
      }
      const t = (low + high) / 2;
      return Math.abs(getOffsetPointAtT(t, 1.0).y);
    };

    if (x >= cpCenterX) {
      return getCockpitBoundaryYAtX(x);
    } else {
      // Back half: rounded semi-ellipse closed out smoothly from the midpoint
      const xc = x - cpCenterX;
      const a = cpLength / 2;
      const b = Math.max(0.0, getCockpitBoundaryYAtX(cpCenterX));
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

    // Find the exact X where the coaming peak should be (offset 1" from the facet outline peak)
    let coamingMaxX = activeCpEnd - 1.0;
    if (facetOutlineCurve) {
      const domain = facetOutlineCurve.domain;
      const tMin = domain[0];
      const tMax = domain[1];
      let lowT = tMin;
      let highT = tMax;
      for (let iter = 0; iter < 20; iter++) {
        const t1 = lowT + (highT - lowT) / 3;
        const t2 = highT - (highT - lowT) / 3;
        if (facetOutlineCurve.pointAt(t1)[0] < facetOutlineCurve.pointAt(t2)[0]) {
          lowT = t1;
        } else {
          highT = t2;
        }
      }
      const tPeak = (lowT + highT) / 2;
      const X_peak = facetOutlineCurve.pointAt(tPeak)[0];
      coamingMaxX = X_peak - 1.0;
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
