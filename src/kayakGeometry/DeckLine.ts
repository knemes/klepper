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

  /**
   * Evaluates the trimmed Z height (two straight lines).
   */
  public getPointAtX(targetX: number): { x: number; y: number; z: number } {
    if (this.sectionsImporter && this.sectionsImporter.hasData()) {
      const z_offset = this.sternDeckZ - 8.0;
      const z_untrimmed = this.sectionsImporter.getDeckCenterlineZ(targetX) + z_offset;
      const isTrimmedZone = targetX <= this.facetStartX;
      if (isTrimmedZone) {
        const planeZ = this.sternDeckZ + targetX * this.slope;
        return { x: targetX, y: 0, z: Math.min(z_untrimmed, planeZ) };
      }
      return { x: targetX, y: 0, z: z_untrimmed };
    }

    let z = this.totalHeight;
    if (this.L > 0) {
      if (targetX <= this.facetStartX) {
        z = this.sternDeckZ + targetX * this.slope;
      } else {
        z = this.totalHeight - (targetX - this.facetStartX) * (this.totalHeight - this.bowDeckZ) / (this.L - this.facetStartX || 1);
      }
    }
    return { x: targetX, y: 0, z };
  }

  /**
   * Evaluates the original untrimmed Z height (NURBS curve).
   * For targetX > facetStartX, returns the linear height to match the straight side profile.
   */
  public getUntrimmedPointAtX(targetX: number): { x: number; y: number; z: number } {
    if (this.sectionsImporter && this.sectionsImporter.hasData()) {
      const z_offset = this.sternDeckZ - 8.0;
      return { x: targetX, y: 0, z: this.sectionsImporter.getDeckCenterlineZ(targetX) + z_offset };
    }

    if (targetX > this.facetStartX) {
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
