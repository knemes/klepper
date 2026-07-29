import type { KayakParameters } from "./types";
import { KayakGeometry } from "./KayakGeometry";
import { Bow } from "./Bow";
import { Stern } from "./Stern";

export class Keel extends KayakGeometry {
  public componentType = "Keel";
  public curve: any = null;

  constructor(rhino: any, params: KayakParameters, bow: Bow, stern: Stern) {
    super(rhino);
    this.buildCurve(params, bow, stern);
  }

  private buildCurve(params: KayakParameters, bow: Bow, stern: Stern) {
    const L = params.length * 12;
    const sl = params.sternLength;
    const bl = params.bowLength;

    const pts = new this.rhino.Point3dList();

    // 1. Add points from Stern curve (from X=0 to X=sl)
    const sternPts = stern.getPoints(6);
    // Add all except the last point (which is sl, 0, 0)
    for (let i = 0; i < sternPts.length - 1; i++) {
      pts.add(sternPts[i].x, sternPts[i].y, sternPts[i].z);
    }

    // 2. Add flat bottom transition points
    pts.add(sl, 0, 0);
    // Add midship keel point
    pts.add(L / 2, 0, 0);
    pts.add(L - bl, 0, 0);

    // 3. Add points from Bow curve (from X=0 to X=bl), translated to the bow position (X starts at L - bl)
    const bowPts = bow.getPoints(6);
    // The first point is (0,0,0) in Bow coordinates, which translates to (L-bl, 0, 0) - skip it since we added (L-bl, 0, 0)
    for (let i = 1; i < bowPts.length; i++) {
      pts.add(bowPts[i].x + (L - bl), bowPts[i].y, bowPts[i].z);
    }

    // Create cubic NURBS curve
    // Degree = 3
    this.curve = this.rhino.NurbsCurve.create(false, 3, pts);
  }

  /**
   * Evaluates the keel Z height at a given X coordinate by finding the point on the keel curve.
   * Uses simple bisection along the curve domain to find the point where X matches.
   */
  public getPointAtX(targetX: number): { x: number; y: number; z: number } {
    if (!this.curve) return { x: targetX, y: 0, z: 0 };
    
    const domain = this.curve.domain;
    let tMin = domain[0];
    let tMax = domain[1];
    let pt = this.curve.pointAt((tMin + tMax) / 2);

    // Bisection search (15 iterations is plenty for sub-millimeter precision)
    for (let i = 0; i < 15; i++) {
      const tMid = (tMin + tMax) / 2;
      pt = this.curve.pointAt(tMid);
      if (pt[0] < targetX) {
        tMin = tMid;
      } else {
        tMax = tMid;
      }
    }

    return { x: pt[0], y: pt[1], z: pt[2] };
  }
}
