import type { KayakParameters, Point3D } from "./types";
import { KayakGeometry } from "./KayakGeometry";

export class Bow extends KayakGeometry {
  public componentType = "Bow";
  public curve: any = null;

  constructor(rhino: any, params: KayakParameters) {
    super(rhino);
    this.buildCurve(params);
  }

  private buildCurve(params: KayakParameters) {
    const bl = params.bowLength;
    const hh = params.hullHeight;
    const bowHeight = hh + 2.0; // The bow stem tip rises slightly higher than the hull sheer line.

    const pts = new this.rhino.Point3dList();
    pts.add(0, 0, 0); // Start of stem at keel bottom
    pts.add(bl * 0.5, 0, bowHeight * 0.15); // Bilge transition curve
    pts.add(bl * 0.9, 0, bowHeight * 0.7);  // Steep curve upward
    pts.add(bl, 0, bowHeight); // Top bow tip

    // Create cubic NURBS curve
    // Degree = 3
    this.curve = this.rhino.NurbsCurve.create(false, 3, pts);
  }

  /**
   * Helper to sample points along the bow curve for UI/Three.js rendering.
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
