import type { KayakParameters } from "./types";
import { KayakGeometry } from "./KayakGeometry";

export class DeckLine extends KayakGeometry {
  public componentType = "DeckLine";
  public curve: any = null; // Original cubic NURBS curve (untrimmed)
  public trimmedCurve: any = null; // Linear polyline curve (trimmed)
  public facetStartX: number = 0;
  public slope: number = 0;
  public sternDeckZ: number = 0;
  public totalHeight: number = 0;
  private L: number = 0;
  private bowDeckZ: number = 0;

  constructor(rhino: any, params: KayakParameters) {
    super(rhino);
    this.totalHeight = params.totalHeight;
    this.L = params.length * 12;
    this.sternDeckZ = params.hullHeight;
    this.bowDeckZ = params.hullHeight;
    this.buildCurve(params);
  }

  private buildCurve(params: KayakParameters) {
    const L = params.length * 12;
    const th = params.totalHeight;
    const peakX = L * params.deckLongitudinalPeak;
    const sternZ = params.hullHeight;
    const bowZ = params.hullHeight;

    const pts = new this.rhino.Point3dList();
    pts.add(0, 0, sternZ);
    pts.add(peakX * 0.5, 0, sternZ + (th - sternZ) * 0.65);
    pts.add(peakX, 0, th);
    pts.add(peakX + (L - peakX) * 0.5, 0, bowZ + (th - bowZ) * 0.65);
    pts.add(L, 0, bowZ);

    // Create cubic NURBS curve representing original untrimmed deck centerline shape
    this.curve = this.rhino.NurbsCurve.create(false, 3, pts);
  }

  /**
   * Updates the deck centerline geometry using the solved flat plane parameters.
   */
  public updateGeometry(params: KayakParameters, facetStartX: number, slope: number, sternDeckZ: number) {
    this.facetStartX = facetStartX;
    this.slope = slope;
    this.sternDeckZ = sternDeckZ;
    this.totalHeight = params.totalHeight;
    this.L = params.length * 12;
    this.bowDeckZ = params.hullHeight;

    const pts = new this.rhino.Point3dList();
    pts.add(0, 0, this.sternDeckZ);
    pts.add(this.facetStartX, 0, this.totalHeight);
    pts.add(this.L, 0, this.bowDeckZ);

    this.trimmedCurve = this.rhino.NurbsCurve.create(false, 1, pts);
  }

  public sectionsImporter: any = null;
  public hullHeight: number = 8.0;

  /**
   * Evaluates the trimmed Z height (two straight lines or trimmed scan curve).
   */
  public getPointAtX(targetX: number): { x: number; y: number; z: number } {
    const untrimmed = this.getUntrimmedPointAtX(targetX);
    const isTrimmedZone = targetX <= this.facetStartX;
    if (isTrimmedZone) {
      const planeZ = this.sternDeckZ + targetX * this.slope;
      return { x: targetX, y: 0, z: Math.min(untrimmed.z, planeZ) };
    }
    return untrimmed;
  }

  /**
   * Evaluates the original untrimmed Z height (scaled to totalHeight at facetStartX).
   * For targetX > facetStartX without sections data, returns the linear height to match the straight side profile.
   */
  public getUntrimmedPointAtX(targetX: number): { x: number; y: number; z: number } {
    const crownHeight = Math.max(0, this.totalHeight - this.sternDeckZ);
    const facetStartX = this.facetStartX || (this.L * 0.55);

    if (this.sectionsImporter && this.sectionsImporter.hasData()) {
      const rawZ = this.sectionsImporter.getDeckCenterlineZ(targetX);
      const rawPeakZ = this.sectionsImporter.getDeckCenterlineZ(facetStartX);
      const rawScanGunZ = 8.0;
      const rawPeakCrown = Math.max(0.01, rawPeakZ - rawScanGunZ);
      const rawCrown = Math.max(0, rawZ - rawScanGunZ);
      const normCrown = rawCrown / rawPeakCrown;
      const z = this.sternDeckZ + crownHeight * normCrown;
      return { x: targetX, y: 0, z };
    }

    if (targetX > this.facetStartX && this.facetStartX > 0) {
      let z = this.totalHeight;
      if (this.L > 0) {
        z = this.totalHeight - (targetX - this.facetStartX) * (this.totalHeight - this.bowDeckZ) / (this.L - this.facetStartX || 1);
      }
      return { x: targetX, y: 0, z };
    }

    if (!this.curve) return { x: targetX, y: 0, z: this.totalHeight };

    const domain = this.curve.domain;
    let tMin = domain[0];
    let tMax = domain[1];
    let pt = this.curve.pointAt((tMin + tMax) / 2);

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
