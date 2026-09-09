import type { KayakParameters, MeshData } from "./types";
import { KayakGeometry } from "./KayakGeometry";

export class Cockpit extends KayakGeometry {
  public componentType = "Cockpit";
  public curve: any = null;

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
    const activeCpEnd = activeCpStart + cpLength;
    const cpCenterX = activeCpStart + cpLength * 0.48; // Slightly aft for ergonomic seating

    if (x < activeCpStart || x > activeCpEnd) return 0.0;

    // Width factor as percentage of maximum flat facet width (0.20 to 1.0, default 1.0 = 100%)
    const widthFactor = Math.max(0.20, Math.min(1.0, params.cockpitWidth ?? 1.0));

    // Evaluate normalized longitudinal curve profile (teardrop / keyhole)
    let shape = 0.0;
    if (x <= cpCenterX) {
      // Aft half: smoothly blends between a pure interpolated ellipse (0.0)
      // and a touring keyhole cockpit with two rounded corners and straighter sides (1.0).
      // Uses superellipse formulation: (1 - u^p)^(1/p) where p varies from 2.0 (ellipse) to 7.0 (rounded corners & straight sides).
      // Guarantees:
      //  1. At x = cpCenterX (u = 0): shape = 1.0 and d(shape)/dx = 0, exactly matching the forward curve tangent.
      //  2. At x = activeCpStart (u = 1): shape = 0.0 and dx/d(shape) = 0, joining symmetrically across the centerline.
      const aftSquareness = Math.max(0.0, Math.min(1.0, params.cockpitAftShape ?? 0.0));
      const a = cpCenterX - activeCpStart;
      const dx = Math.max(0.0, cpCenterX - x);
      const u = Math.min(1.0, dx / (a || 1.0));

      const p = 2.0 + aftSquareness * 5.0; // 2.0 (pure ellipse) to 7.0 (rounded corners & straight sides)
      shape = Math.pow(Math.max(0.0, 1.0 - Math.pow(u, p)), 1.0 / p);
    } else {
      // Forward half: tapered egg/hoop shape
      const a = activeCpEnd - cpCenterX;
      const dx = x - cpCenterX;
      const ratio = Math.min(1.0, (dx * dx) / (a * a || 1.0));
      const taper = 1.0 - 0.22 * (dx / (a || 1.0));
      shape = Math.sqrt(Math.max(0.0, 1.0 - ratio)) * taper;
    }

    // Determine max available flat facet half-width
    let maxAllowedHalfW = 10.0; // fallback if curve is not yet generated
    if (facetOutlineCurve) {
      const facetCenterHalfW = Math.max(1.0, this.getFacetHalfWidthAtX(cpCenterX, facetOutlineCurve) - 0.75);
      const facetLocalHalfW = Math.max(0.0, this.getFacetHalfWidthAtX(x, facetOutlineCurve) - 0.75);
      maxAllowedHalfW = Math.min(facetLocalHalfW, facetCenterHalfW * shape);
    } else {
      maxAllowedHalfW = (params.beam * 0.35) * shape;
    }

    return widthFactor * maxAllowedHalfW;
  }

  /**
   * Helper to look up the lateral boundary half-width of the flat facet at X.
   */
  private getFacetHalfWidthAtX(xVal: number, facetOutlineCurve: any): number {
    if (!facetOutlineCurve) return 999.0;

    const domain = facetOutlineCurve.domain;
    const tMin = domain[0];
    const tMax = domain[1];

    // Ternary search for tPeak
    let lowT = tMin;
    let highT = tMax;
    for (let iter = 0; iter < 16; iter++) {
      const t1 = lowT + (highT - lowT) / 3;
      const t2 = highT - (highT - lowT) / 3;
      if (facetOutlineCurve.pointAt(t1)[0] < facetOutlineCurve.pointAt(t2)[0]) {
        lowT = t1;
      } else {
        highT = t2;
      }
    }
    const tPeak = (lowT + highT) / 2;
    const xPeak = facetOutlineCurve.pointAt(tPeak)[0];

    if (xVal >= xPeak) return 0.0;

    let low = tMin;
    let high = tPeak;
    for (let iter = 0; iter < 16; iter++) {
      const t = (low + high) / 2;
      const px = facetOutlineCurve.pointAt(t)[0];
      if (px < xVal) {
        low = t;
      } else {
        high = t;
      }
    }
    const finalT = (low + high) / 2;
    return Math.abs(facetOutlineCurve.pointAt(finalT)[2]);
  }

  /**
   * Generates mesh buffers for rendering the cockpit coaming wood rim in Three.js/Rhino.
   */
  public generateCoamingMesh(
    params: KayakParameters,
    sternDeckZ: number,
    slope: number,
    halfL: number,
    _getGunwaleAndDeckHeight?: (x: number) => { gunwaleY: number; gunwaleZ: number; deckZ: number; yFlat: number },
    facetOutlineCurve?: any
  ): MeshData {
    const N = 64;
    const coamingVertices: number[] = [];
    const coamingIndices: number[] = [];
    const uvs: number[] = [];

    const activeCpStart = params.cockpitStart;
    const cpLength = params.cockpitLength;
    const cpCenterX = activeCpStart + cpLength / 2;
    const halfCpL = cpLength / 2;

    const getPlaneZ = (xVal: number) => {
      return sternDeckZ + xVal * slope;
    };

    // Calculate normal vector of the tilted deck facet plane in XZ
    const planeLen = Math.sqrt(1.0 + slope * slope);
    const nx = -slope / planeLen;
    const ny = 1.0 / planeLen;

    const coamingHeight = params.coamingHeight !== undefined ? params.coamingHeight : 0.75;

    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2;
      const cosA = Math.cos(angle);

      const xVal = cpCenterX + halfCpL * cosA;
      const zVal = getPlaneZ(xVal); // height of flat deck trimming plane at X

      // Evaluate the smooth cockpit boundary half-width
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
      normals: new Float32Array(coamingVertices.length),
      uvs: new Float32Array(uvs)
    };
  }

  /**
   * Constructs the closed 3D NURBS curve outlining the cockpit opening.
   * Lies exactly on the tilted deck facet plane.
   */
  public buildCurve(
    params: KayakParameters,
    facetOutlineCurve: any,
    getPlaneZ: (x: number) => number
  ) {
    const activeCpStart = params.cockpitStart;
    const activeCpEnd = activeCpStart + params.cockpitLength;

    const pts = new this.rhino.Point3dList();
    const numPoints = 80;

    // 1. Left boundary points (stepping forward, y < 0)
    for (let i = 0; i <= numPoints; i++) {
      const pct = i / numPoints;
      // Cosine spacing to cluster points near ends
      const t = (1.0 - Math.cos(pct * Math.PI)) / 2.0;
      const x = activeCpStart + t * (activeCpEnd - activeCpStart);
      const planeZ = getPlaneZ(x);
      const yVal = this.getCockpitBoundaryY(x, params, facetOutlineCurve);
      pts.add(x, planeZ, -yVal);
    }

    // 2. Right boundary points (stepping backward, y > 0)
    for (let i = numPoints; i >= 0; i--) {
      const pct = i / numPoints;
      const t = (1.0 - Math.cos(pct * Math.PI)) / 2.0;
      const x = activeCpStart + t * (activeCpEnd - activeCpStart);
      const planeZ = getPlaneZ(x);
      const yVal = this.getCockpitBoundaryY(x, params, facetOutlineCurve);
      pts.add(x, planeZ, yVal);
    }

    // 3. Close the curve by adding the start point
    const startPlaneZ = getPlaneZ(activeCpStart);
    pts.add(activeCpStart, startPlaneZ, 0.0);

    // Create closed cubic NURBS curve
    this.curve = this.rhino.NurbsCurve.create(false, 3, pts);
    pts.delete();
  }
}

