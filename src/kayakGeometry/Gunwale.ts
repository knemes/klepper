import type { KayakParameters } from "./types";
import { KayakGeometry } from "./KayakGeometry";

export class Gunwale extends KayakGeometry {
  public componentType = "Gunwale";
  public leftCurve: any = null;
  public rightCurve: any = null;

  constructor(rhino: any, params: KayakParameters) {
    super(rhino);
    this.buildCurves(params);
  }

  private buildCurves(params: KayakParameters) {
    const L = params.length * 12;
    const maxHalfBeam = params.beam / 2;
    const peakX = L * params.beamPlacement;

    // Define sheer line heights (fully planar at hullHeight)
    const sternSheer = params.hullHeight;
    const midSheer = params.hullHeight;
    const bowSheer = params.hullHeight;

    // Longitudinal positions for shoulders
    const sternShoulderX = peakX * 0.5;
    const bowShoulderX = peakX + (L - peakX) * 0.5;

    // Half-width factors
    const sternShoulderY = maxHalfBeam * params.sternWidthFactor;
    const bowShoulderY = maxHalfBeam * params.bowWidthFactor;

    // Interpolation heights for the shoulders
    const sternShoulderZ = params.hullHeight;
    const bowShoulderZ = params.hullHeight;

    // 1. Construct left gunwale (negative Y values)
    const leftPts = new this.rhino.Point3dList();
    leftPts.add(0, 0, sternSheer);
    leftPts.add(sternShoulderX, -sternShoulderY, sternShoulderZ);
    leftPts.add(peakX, -maxHalfBeam, midSheer);
    leftPts.add(bowShoulderX, -bowShoulderY, bowShoulderZ);
    leftPts.add(L, 0, bowSheer);

    // Create left cubic NURBS curve
    this.leftCurve = this.rhino.NurbsCurve.create(false, 3, leftPts);

    // 2. Construct right gunwale (positive Y values - mirrored)
    const rightPts = new this.rhino.Point3dList();
    rightPts.add(0, 0, sternSheer);
    rightPts.add(sternShoulderX, sternShoulderY, sternShoulderZ);
    rightPts.add(peakX, maxHalfBeam, midSheer);
    rightPts.add(bowShoulderX, bowShoulderY, bowShoulderZ);
    rightPts.add(L, 0, bowSheer);

    // Create right cubic NURBS curve
    this.rightCurve = this.rhino.NurbsCurve.create(false, 3, rightPts);
  }

  public sectionsImporter: any = null;

  /**
   * Evaluates the gunwale point on the left side at a given X.
   */
  public getLeftPointAtX(targetX: number): { x: number; y: number; z: number } {
    if (this.sectionsImporter && this.sectionsImporter.hasData()) {
      const y = -this.sectionsImporter.getGunwaleY(targetX);
      return { x: targetX, y, z: this.sectionsImporter.getHullZ(targetX, y) };
    }
    return this.getPointAtX(this.leftCurve, targetX);
  }

  /**
   * Evaluates the gunwale point on the right side at a given X.
   */
  public getRightPointAtX(targetX: number): { x: number; y: number; z: number } {
    if (this.sectionsImporter && this.sectionsImporter.hasData()) {
      const y = this.sectionsImporter.getGunwaleY(targetX);
      return { x: targetX, y, z: this.sectionsImporter.getHullZ(targetX, y) };
    }
    return this.getPointAtX(this.rightCurve, targetX);
  }

  private getPointAtX(curve: any, targetX: number): { x: number; y: number; z: number } {
    if (!curve) return { x: targetX, y: 0, z: 0 };

    const domain = curve.domain;
    let tMin = domain[0];
    let tMax = domain[1];
    let pt = curve.pointAt((tMin + tMax) / 2);

    for (let i = 0; i < 15; i++) {
      const tMid = (tMin + tMax) / 2;
      pt = curve.pointAt(tMid);
      if (pt[0] < targetX) {
        tMin = tMid;
      } else {
        tMax = tMid;
      }
    }

    return { x: pt[0], y: pt[1], z: pt[2] };
  }
}
