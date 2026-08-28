import type { KayakParameters } from "./types";
import { KayakGeometry } from "./KayakGeometry";

export class DeckLine extends KayakGeometry {
  public componentType = "DeckLine";
  public curve: any = null; // Original cubic NURBS curve (untrimmed)
  public trimmedCurve: any = null; // Polyline / NURBS curve (trimmed)
  public facetStartX: number = 0;
  public slope: number = 0;
  public sternDeckZ: number = 0;
  public totalHeight: number = 0;
  public peakX: number = 0;
  public params: KayakParameters;
  private L: number = 0;
  private bowDeckZ: number = 0;

  constructor(rhino: any, params: KayakParameters) {
    super(rhino);
    this.params = params;
    this.totalHeight = params.totalHeight;
    this.L = params.length * 12;
    this.peakX = this.L * params.deckLongitudinalPeak;
    this.sternDeckZ = params.hullHeight;
    this.bowDeckZ = params.hullHeight;
    this.buildCurve(params);
  }

  public buildCurve(params: KayakParameters) {
    this.params = params;
    const L = params.length * 12;
    this.L = L;
    const th = params.totalHeight;
    this.totalHeight = th;
    const peakX = L * params.deckLongitudinalPeak;
    this.peakX = peakX;
    const sternZ = params.hullHeight;
    this.sternDeckZ = sternZ;
    const bowZ = params.hullHeight;
    this.bowDeckZ = bowZ;

    const pts = new this.rhino.Point3dList();
    pts.add(0, 0, sternZ);
    pts.add(peakX * 0.5, 0, sternZ + (th - sternZ) * 0.65);
    pts.add(peakX, 0, th);
    pts.add(peakX + (L - peakX) * 0.5, 0, bowZ + (th - bowZ) * 0.65);
    pts.add(L, 0, bowZ);

    // Create cubic NURBS curve representing original untrimmed deck centerline shape
    this.curve = this.rhino.NurbsCurve.create(false, 3, pts);
    pts.delete();
  }

  /**
   * Updates the deck centerline geometry using the solved flat plane parameters.
   */
  public updateGeometry(params: KayakParameters, facetStartX: number, slope: number, sternDeckZ: number) {
    this.params = params;
    this.facetStartX = facetStartX;
    this.slope = slope;
    this.sternDeckZ = sternDeckZ;
    this.totalHeight = params.totalHeight;
    this.L = params.length * 12;
    this.peakX = this.L * params.deckLongitudinalPeak;
    this.bowDeckZ = params.hullHeight;

    this.buildCurve(params);

    const pts = new this.rhino.Point3dList();
    pts.add(0, 0, this.sternDeckZ);
    const facetFrontZ = this.sternDeckZ + this.facetStartX * this.slope;
    pts.add(this.facetStartX, 0, facetFrontZ);
    pts.add(this.L, 0, this.bowDeckZ);

    this.trimmedCurve = this.rhino.NurbsCurve.create(false, 1, pts);
    pts.delete();
  }

  public sectionsImporter: any = null;
  public hullHeight: number = 8.0;

  /**
   * Evaluates the trimmed Z height (trimmed by flat facet plane for x <= facetStartX).
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
   * Evaluates the original untrimmed Z height (peaking at peakX with totalHeight).
   */
  public getUntrimmedPointAtX(targetX: number): { x: number; y: number; z: number } {
    const crownHeight = Math.max(0, this.totalHeight - this.sternDeckZ);
    const peakX = this.peakX || (this.L * (this.params?.deckLongitudinalPeak ?? 0.55));

    if (this.sectionsImporter && this.sectionsImporter.hasData()) {
      // Scale and warp scanned section coordinate so scan peak (at 93" on 168" boat) lands exactly at peakX
      const scanPeakX = 93.0;
      const scanTotalL = 168.0;
      let mappedScanX = targetX;
      if (targetX <= peakX) {
        const ratio = targetX / (peakX || 1.0);
        mappedScanX = ratio * scanPeakX;
      } else {
        const ratio = (targetX - peakX) / (this.L - peakX || 1.0);
        mappedScanX = scanPeakX + ratio * (scanTotalL - scanPeakX);
      }

      const rawZ = this.sectionsImporter.getDeckCenterlineZ(mappedScanX);
      const rawPeakZ = this.sectionsImporter.getDeckCenterlineZ(scanPeakX);
      const rawScanGunZ = 8.0;
      const rawPeakCrown = Math.max(0.01, rawPeakZ - rawScanGunZ);
      const rawCrown = Math.max(0, rawZ - rawScanGunZ);
      const normCrown = Math.min(1.0, rawCrown / rawPeakCrown);
      const z = this.sternDeckZ + crownHeight * normCrown;
      return { x: targetX, y: 0, z };
    }

    if (!this.curve) {
      // Analytical fallback
      let z = this.totalHeight;
      if (targetX <= peakX) {
        const t = targetX / (peakX || 1);
        z = this.sternDeckZ + (this.totalHeight - this.sternDeckZ) * Math.sin(t * Math.PI * 0.5);
      } else {
        const t = (targetX - peakX) / (this.L - peakX || 1);
        z = this.totalHeight - (this.totalHeight - this.bowDeckZ) * Math.sin(t * Math.PI * 0.5);
      }
      return { x: targetX, y: 0, z };
    }

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

