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
  public getCockpitBoundaryY(x: number, params: KayakParameters): number {
    const activeCpStart = params.cockpitStart;
    const cpLength = params.cockpitLength;
    const cpWidth = params.cockpitWidth;

    const xc = x - (activeCpStart + cpLength / 2);
    const a = cpLength / 2;
    const b = cpWidth / 2;
    const ratio = (xc * xc) / (a * a || 1);
    
    // Elliptical cockpit cutout
    return ratio < 1.0 ? b * Math.sqrt(1.0 - ratio) : 0.0;
  }

  /**
   * Generates mesh buffers for rendering the cockpit coaming wood rim in Three.js/Rhino.
   */
  public generateCoamingMesh(
    params: KayakParameters,
    sternDeckZ: number,
    slope: number,
    facetStartX: number,
    halfL: number,
    getGunwaleAndDeckHeight: (x: number) => { gunwaleY: number; gunwaleZ: number; deckZ: number }
  ): MeshData {
    const N = 40;
    const coamingVertices: number[] = [];
    const coamingIndices: number[] = [];
    const uvs: number[] = [];

    const activeCpStart = params.cockpitStart;
    const cpLength = params.cockpitLength;
    const cpWidth = params.cockpitWidth;
    const cpCenterX = activeCpStart + cpLength / 2;

    const getPlaneZ = (xVal: number) => {
      return sternDeckZ + xVal * slope;
    };

    // Calculate normal vector of the tilted deck facet plane in XZ
    // Tangent is (1, 0, slope), so normal is (-slope, 1, 0) in Three.js coordinates where X=length, Y=height
    const planeLen = Math.sqrt(1.0 + slope * slope);
    const nx = -slope / planeLen;
    const ny = 1.0 / planeLen;

    const coamingHeight = params.coamingHeight !== undefined ? params.coamingHeight : 0.75;

    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2;
      const xc = (cpLength / 2) * Math.cos(angle);
      const yc = (cpWidth / 2) * Math.sin(angle);

      const xVal = cpCenterX + xc;
      const zVal = getPlaneZ(xVal); // height of flat deck trimming plane at X

      // Fetch the gunwale boundaries at this longitudinal station
      const { gunwaleY } = getGunwaleAndDeckHeight(xVal);

      // Restrict cockpit width to stay inside the deck flat facet
      const yTarget = Math.min(params.cockpitWidth / 2 + 0.5, gunwaleY * 0.95);
      let yFlat = 0;
      if (xVal <= facetStartX) {
        if (xVal <= cpCenterX) {
          yFlat = xVal * (yTarget / (cpCenterX || 1));
        } else {
          yFlat = (facetStartX - xVal) * (yTarget / (facetStartX - cpCenterX || 1));
        }
      }
      const maxAllowedHalfWidth = Math.max(1.0, yFlat);
      const activeYc = Math.min(Math.abs(yc), maxAllowedHalfWidth) * Math.sign(yc);

      // Coordinates mapped to Three.js orientation: X = length, Y = height, Z = width
      const tx = xVal - halfL;
      const ty = zVal;
      const tz = activeYc;

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
