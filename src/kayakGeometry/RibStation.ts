import type { KayakParameters, Point3D } from "./types";
import { KayakGeometry } from "./KayakGeometry";

export class RibStation extends KayakGeometry {
  public componentType = "RibStation";

  public x: number;
  public keelPt: Point3D;
  public deckPt: Point3D;
  public gunwaleLeft: Point3D;
  public gunwaleRight: Point3D;

  public hullCurveLeft: Point3D[] = [];
  public hullCurveRight: Point3D[] = [];
  public deckCurveLeft: Point3D[] = [];
  public deckCurveRight: Point3D[] = [];
  public closedProfile: Point3D[] = [];

  public rhinoHullCurveLeft: any = null;
  public rhinoHullCurveRight: any = null;
  public rhinoDeckCurveLeft: any = null;
  public rhinoDeckCurveRight: any = null;
  public rhinoClosedCurve: any = null;

  public areaSubmerged = 0;
  public facetStartX: number = 0;
  public slope: number = 0;
  public deckPtUntrimmed: Point3D;
  public sectionsImporter: any = null;

  constructor(
    rhino: any,
    x: number,
    params: KayakParameters,
    keelPt: Point3D,
    deckPt: Point3D,
    gunwaleLeft: Point3D,
    gunwaleRight: Point3D,
    draft = 0,
    facetStartX = 0,
    slope = 0,
    deckPtUntrimmed?: Point3D,
    sectionsImporter?: any,
    skipRhinoCurves = false
  ) {
    super(rhino);
    this.x = x;
    this.keelPt = keelPt;
    this.deckPt = deckPt;
    this.gunwaleLeft = gunwaleLeft;
    this.gunwaleRight = gunwaleRight;
    this.facetStartX = facetStartX;
    this.slope = slope;
    this.deckPtUntrimmed = deckPtUntrimmed || deckPt;
    this.sectionsImporter = sectionsImporter;

    this.buildSectionCurves(params, skipRhinoCurves);
    if (draft > 0) {
      this.calculateSubmergedArea(draft);
    }
  }

  private buildSectionCurves(params: KayakParameters, skipRhinoCurves = false) {
    const segments = 32;
    const gY = Math.abs(this.gunwaleLeft.y); // half-beam width
    const keelZ = this.keelPt.z;
    const gunwaleZ = this.gunwaleLeft.z;

    // Hull curve control point parameters (from Bézier formula)
    const hullCPY = -gY * (1.0 - params.hullHorizontalCurvature * 0.7);
    const hullCPZ = keelZ + (gunwaleZ - keelZ) * params.hullVerticalCurvature;

    const pPower = 1.0 + params.deckVerticalCurvature * 2.2;
    const L = params.length * 12;
    const facetStartX = this.facetStartX || L * params.deckLongitudinalPeak;

    const evaluateBezier1D = (p0: number, p1: number, p2: number, t: number): number => {
      const mt = 1.0 - t;
      return mt * mt * p0 + 2.0 * mt * t * p1 + t * t * p2;
    };

    // 1. Evaluate hull curves
    // Hull Left: starts at Keel (y=0) and goes to Port Gunwale (y=-gY)
    const leftHullList = new this.rhino.Point3dList();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const hY = evaluateBezier1D(0, hullCPY, -gY, t);
      const hZ = evaluateBezier1D(keelZ, hullCPZ, gunwaleZ, t);

      this.hullCurveLeft.push({ x: this.x, y: hY, z: hZ });
      leftHullList.add(this.x, hY, hZ);
    }

    // 2. Evaluate deck curves
    // Deck Left: starts at Port Gunwale (y=-gY) and goes to Deck Peak (y=0)
    const leftDeckList = new this.rhino.Point3dList();
    const rightDeckList = new this.rhino.Point3dList();
    const deckZ_untrimmed = this.deckPtUntrimmed.z;

    const isTrimmedZone = this.x <= facetStartX;
    const sternDeckZ = params.hullHeight;
    const currentPlaneZ = sternDeckZ + this.x * this.slope;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const dY = -gY + gY * t;
      const absY = Math.abs(dY);
      const yPct = absY / (gY || 1.0);
      let dZ = deckZ_untrimmed - (deckZ_untrimmed - gunwaleZ) * Math.pow(yPct, pPower);

      if (isTrimmedZone) {
        dZ = Math.min(dZ, currentPlaneZ);
      }

      this.deckCurveLeft.push({ x: this.x, y: dY, z: dZ });
      leftDeckList.add(this.x, dY, dZ);
    }

    // Deck Right: starts at Deck Peak (y=0) and goes to Starboard Gunwale (y=+gY)
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const dY = gY * t;
      const absY = Math.abs(dY);
      const yPct = absY / (gY || 1.0);
      let dZ = deckZ_untrimmed - (deckZ_untrimmed - gunwaleZ) * Math.pow(yPct, pPower);

      if (isTrimmedZone) {
        dZ = Math.min(dZ, currentPlaneZ);
      }

      this.deckCurveRight.push({ x: this.x, y: dY, z: dZ });
      rightDeckList.add(this.x, dY, dZ);
    }

    // Hull Right: starts at Starboard Gunwale (y=+gY) and goes back to Keel (y=0)
    const rightHullList = new this.rhino.Point3dList();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const hY = evaluateBezier1D(gY, -hullCPY, 0, t);
      const hZ = evaluateBezier1D(gunwaleZ, hullCPZ, keelZ, t);

      this.hullCurveRight.push({ x: this.x, y: hY, z: hZ });
      rightHullList.add(this.x, hY, hZ);
    }

    // 3. Assemble unified continuous closed profile loop
    // Order: Keel -> Hull Left -> Gunwale Left -> Deck Left -> Deck Peak -> Deck Right -> Gunwale Right -> Hull Right -> Keel
    this.closedProfile = [
      ...this.hullCurveLeft,
      ...this.deckCurveLeft.slice(1),
      ...this.deckCurveRight.slice(1),
      ...this.hullCurveRight.slice(1)
    ];

    // Create Rhino NURBS curves if requested (skipped during high-frequency calculations to prevent WASM leaks)
    if (!skipRhinoCurves && this.rhino) {
      this.rhinoHullCurveLeft = this.rhino.NurbsCurve.create(false, 3, leftHullList);
      this.rhinoDeckCurveLeft = this.rhino.NurbsCurve.create(false, 3, leftDeckList);
      this.rhinoDeckCurveRight = this.rhino.NurbsCurve.create(false, 3, rightDeckList);
      this.rhinoHullCurveRight = this.rhino.NurbsCurve.create(false, 3, rightHullList);

      // Create a single closed Rhino NURBS curve for the rib station
      const closedList = new this.rhino.Point3dList();
      for (const p of this.closedProfile) {
        closedList.add(p.x, p.y, p.z);
      }
      // Add start point to close the NURBS loop
      closedList.add(this.closedProfile[0].x, this.closedProfile[0].y, this.closedProfile[0].z);
      this.rhinoClosedCurve = this.rhino.NurbsCurve.create(false, 3, closedList);
    }
  }

  private calculateSubmergedArea(draft: number) {
    // Trapezoidal rule integration below the waterline
    const submergedPointsLeft = this.hullCurveLeft.filter(p => p.z < draft);
    if (submergedPointsLeft.length > 1) {
      const pts = [...submergedPointsLeft];

      // Interpolate the exact intersection point at the waterline (Z = draft)
      if (pts[pts.length - 1].z < draft && this.hullCurveLeft.length > pts.length) {
        const nextPt = this.hullCurveLeft[pts.length];
        const prevPt = pts[pts.length - 1];
        const fraction = (draft - prevPt.z) / (nextPt.z - prevPt.z || 1);
        const intersectY = prevPt.y + fraction * (nextPt.y - prevPt.y);
        pts.push({ x: this.x, y: intersectY, z: draft });
      }

      let area = 0;
      for (let j = 0; j < pts.length - 1; j++) {
        const y1 = Math.abs(pts[j].y);
        const y2 = Math.abs(pts[j + 1].y);
        const dz = pts[j + 1].z - pts[j].z;
        area += ((y1 + y2) / 2.0) * dz;
      }

      this.areaSubmerged = area * 2.0; // mirror for both sides
    }
  }

  /**
   * Generates a 2D SVG template representation of this station frame.
   * Subtracts the cedar strip planking thickness (0.25") and adds structural notches.
   */
  public generateSVG(params: KayakParameters): string {
    const pt = params.plywoodThickness;
    const stripThickness = 0.25;

    const offsetPoints = (pts: Point3D[]) => {
      return pts.map(p => {
        // Offset Y slightly inward for cedar strip thickness
        const scale = (Math.abs(p.y) - stripThickness) / (Math.abs(p.y) || 1);
        const y = p.y * Math.max(0, scale);
        return { y, z: p.z };
      });
    };

    const profilePts = offsetPoints(this.closedProfile);

    // Calculate dimensions
    const minY = -params.beam / 2.0 - 2.0;
    const maxY = params.beam / 2.0 + 2.0;
    const minZ = this.keelPt.z - 2.0;
    const maxZ = this.deckPt.z + 2.0;

    const width = maxY - minY;
    const height = maxZ - minZ;

    // SVG coordinates mapping (flip Z for vertical inverted screen coordinate)
    const svgX = (y: number) => (y - minY).toFixed(2);
    const svgY = (z: number) => (maxZ - z).toFixed(2);

    // Outer continuous closed frame path
    let dClosed = `M ${svgX(profilePts[0].y)} ${svgY(profilePts[0].z)}`;
    for (let i = 1; i < profilePts.length; i++) {
      dClosed += ` L ${svgX(profilePts[i].y)} ${svgY(profilePts[i].z)}`;
    }
    dClosed += " Z";

    const centerlinePath = `M ${svgX(0)} ${svgY(minZ)} L ${svgX(0)} ${svgY(maxZ)}`;
    const waterlinePath = `M ${svgX(minY)} ${svgY(params.hullHeight)} L ${svgX(maxY)} ${svgY(params.hullHeight)}`;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(1)} ${height.toFixed(1)}" width="100%" height="100%">
        <rect width="100%" height="100%" fill="#F4F6F0" />
        <!-- CAD grids -->
        <line x1="${svgX(minY)}" y1="${svgY(0)}" x2="${svgX(maxY)}" y2="${svgY(0)}" stroke="#EAE7DF" stroke-width="0.5" stroke-dasharray="2,2" />
        <line x1="${svgX(-12)}" y1="${svgY(minZ)}" x2="${svgX(-12)}" y2="${svgY(maxZ)}" stroke="#EAE7DF" stroke-width="0.5" stroke-dasharray="2,2" />
        <line x1="${svgX(12)}" y1="${svgY(minZ)}" x2="${svgX(12)}" y2="${svgY(maxZ)}" stroke="#EAE7DF" stroke-width="0.5" stroke-dasharray="2,2" />

        <!-- Reference Marks -->
        <path d="${centerlinePath}" stroke="#2C4A3E" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.6" />
        <path d="${waterlinePath}" stroke="#8FBC8F" stroke-width="0.5" stroke-dasharray="5,5" opacity="0.8" />
        <text x="${svgX(0)}" y="${svgY(maxZ - 0.5)}" font-family="monospace" font-size="1.2" fill="#2C4A3E" text-anchor="middle">CL</text>
        <text x="${svgX(maxY - 1)}" y="${svgY(params.hullHeight - 0.2)}" font-family="monospace" font-size="1" fill="#8FBC8F" text-anchor="end">WATERLINE (WL)</text>

        <!-- Outer Closed Frame Cut -->
        <path d="${dClosed}" fill="none" stroke="#14231A" stroke-width="1.5" />

        <!-- Strongback Alignment Notch -->
        <rect x="${svgX(-1.5)}" y="${svgY(this.deckPt.z - 4)}" width="3" height="3" fill="none" stroke="#FF7A5C" stroke-width="1" />
        <text x="${svgX(0)}" y="${svgY(this.deckPt.z - 2.5)}" font-family="monospace" font-size="0.8" fill="#FF7A5C" text-anchor="middle">3" STRONGBACK NOTCH</text>

        <!-- Labels -->
        <text x="${svgX(0)}" y="${svgY(this.keelPt.z + 3)}" font-family="serif" font-size="2" fill="#14231A" text-anchor="middle" font-style="italic">Station ${((this.x) / 12).toFixed(1)}'</text>
        <text x="${svgX(0)}" y="${svgY(this.keelPt.z + 1.5)}" font-family="monospace" font-size="1" fill="#2C4A3E" text-anchor="middle">X: ${this.x.toFixed(1)}" | ply: ${pt}"</text>
      </svg>
    `;
  }
}
