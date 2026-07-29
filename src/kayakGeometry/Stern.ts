import type { KayakParameters, Point3D } from "./types";
import { KayakGeometry } from "./KayakGeometry";

export class Stern extends KayakGeometry {
  public componentType = "Stern";
  public curve: any = null;

  constructor(rhino: any, params: KayakParameters) {
    super(rhino);
    this.buildCurve(params);
  }

  private buildCurve(params: KayakParameters) {
    const sl = params.sternLength;
    const hh = params.hullHeight;

    const pts = new this.rhino.Point3dList();
    pts.add(0, 0, hh); // Top stern tip at X=0
    pts.add(sl * 0.1, 0, hh * 0.7);  // Curving down
    pts.add(sl * 0.5, 0, hh * 0.15); // Approaching the bottom
    pts.add(sl, 0, 0); // Bottom keel point at X=sl

    // Create cubic NURBS curve
    // Degree = 3
    this.curve = this.rhino.NurbsCurve.create(false, 3, pts);
  }

  /**
   * Helper to sample points along the stern curve.
   */
  public getPoints(count = 10): Point3D[] {
    const result: Point3D[] = [];
    if (!this.curve) return result;
    const domain = this.curve.domain;
    for (let i = 0; i <= count; i++) {
      const t = domain[0] + (domain[1] - domain[0]) * (i / count);
      const pt = this.curve.pointAt(t);
      result.push({ x: pt[0], y: pt[1], z: pt[2] });
    }
    return result;
  }
}
