import type { KayakParameters, MeshData, Hydrostatics } from "./types";
import { RibStation } from "./RibStation";
import { Bow } from "./Bow";
import { Stern } from "./Stern";
import { Keel } from "./Keel";
import { DeckLine } from "./DeckLine";
import { Gunwale } from "./Gunwale";
import { Cockpit } from "./Cockpit";
import { SectionsImporter } from "./SectionsImporter";
import sectionsData from "../../kayak_sections.json";

export class KayakBuilder {
  private rhino: any;
  public params: KayakParameters;

  public bow: Bow;
  public stern: Stern;
  public keel: Keel;
  public deckLine: DeckLine;
  public gunwale: Gunwale;
  public cockpit: Cockpit;
  public sectionsImporter: SectionsImporter;
  public facetOutlineCurve: any = null;

  // Dynamic flat plane parameters
  public facetStartX: number = 0;
  public slope: number = 0;
  public sternDeckZ: number = 0;

  constructor(rhino: any, params: KayakParameters) {
    this.rhino = rhino;
    this.params = params;

    const L = params.length * 12;
    this.sectionsImporter = new SectionsImporter(sectionsData, L);

    // Instantiate all components
    this.bow = new Bow(this.rhino, this.params);
    this.stern = new Stern(this.rhino, this.params);
    this.keel = new Keel(this.rhino, this.params, this.bow, this.stern);
    this.deckLine = new DeckLine(this.rhino, this.params);
    this.gunwale = new Gunwale(this.rhino, this.params);
    this.cockpit = new Cockpit(this.rhino);

    // Pass sectionsImporter to the components
    this.keel.sectionsImporter = this.sectionsImporter;
    this.deckLine.sectionsImporter = this.sectionsImporter;
    this.gunwale.sectionsImporter = this.sectionsImporter;

    // Compute flat deck plane parameters based on crown point + facet offset relationship
    const peakX = L * this.params.deckLongitudinalPeak;
    const facetOffset = this.params.facetOffsetForward !== undefined ? this.params.facetOffsetForward : 24.0;
    this.facetStartX = Math.min(L - 4.0, peakX + facetOffset);
    this.sternDeckZ = this.params.hullHeight;
    this.deckLine.facetStartX = this.facetStartX;
    this.deckLine.peakX = peakX;

    // The trimming plane passes through top of stern stem (x=0, z=sternDeckZ) and facetOffset forward of crown point
    const untrimmedFrontPt = this.deckLine.getUntrimmedPointAtX(this.facetStartX);
    this.slope = (untrimmedFrontPt.z - this.sternDeckZ) / (this.facetStartX || 1);

    // Update the deckLine geometry with the solved facetStartX and slope
    this.deckLine.updateGeometry(this.params, this.facetStartX, this.slope, this.sternDeckZ);

    // Build the closed NURBS outline curve of the flat deck facet
    this.buildFacetOutline();
    this.cockpit.buildCurve(this.params, this.facetOutlineCurve, (xVal: number) => this.sternDeckZ + xVal * this.slope);
  }

  /**
   * Generates structural stations along the length of the boat.
   */
  public generateStations(draft = 0): RibStation[] {
    const L = this.params.length * 12;
    const spacing = this.params.ribSpacing;
    const stations: RibStation[] = [];

    // Place stations starting after stern and ending before bow
    const startX = spacing;
    const endX = L - spacing;

    for (let x = startX; x <= endX; x += spacing) {
      const keelPt = this.keel.getPointAtX(x);
      const deckPt = this.deckLine.getPointAtX(x);
      const deckPtUntrimmed = this.deckLine.getUntrimmedPointAtX(x);
      const gunLeft = this.gunwale.getLeftPointAtX(x);
      const gunRight = this.gunwale.getRightPointAtX(x);

      stations.push(
        new RibStation(
          this.rhino,
          x,
          this.params,
          keelPt,
          deckPt,
          gunLeft,
          gunRight,
          draft,
          this.facetStartX,
          this.slope,
          deckPtUntrimmed,
          this.sectionsImporter
        )
      );
    }

    return stations;
  }

  /**
   * Evaluates longitudinal station X coordinates with adaptive density around the cockpit and facet start.
   */
  private getMeshXVals(): number[] {
    const L = this.params.length * 12;
    const activeCpStart = this.params.cockpitStart;
    const activeCpEnd = activeCpStart + this.params.cockpitLength;
    const fStart = Math.max(activeCpEnd, Math.min(L - 1, this.facetStartX));

    const xVals: number[] = [];
    const uSegs1 = 20; // Stern to cockpit start
    const uSegs2 = 40; // Cockpit zone (high resolution)
    const uSegs3 = 15; // Cockpit end to facet start
    const uSegs4 = 25; // Facet start to bow

    // Zone 1: Stern to cockpit start
    for (let i = 0; i < uSegs1; i++) {
      xVals.push((i / uSegs1) * activeCpStart);
    }
    // Zone 2: Cockpit zone
    for (let i = 0; i < uSegs2; i++) {
      xVals.push(activeCpStart + (i / uSegs2) * (activeCpEnd - activeCpStart));
    }
    // Zone 3: Cockpit end to facet start
    if (fStart > activeCpEnd + 0.1) {
      for (let i = 0; i < uSegs3; i++) {
        xVals.push(activeCpEnd + (i / uSegs3) * (fStart - activeCpEnd));
      }
    }
    // Zone 4: Facet start to bow
    for (let i = 0; i <= uSegs4; i++) {
      xVals.push(fStart + (i / uSegs4) * (L - fStart));
    }

    return xVals;
  }

  /**
   * Generates a smooth hull mesh grid for Three.js rendering.
   */
  public generateHullMesh(): MeshData {
    const L = this.params.length * 12;
    const xVals = this.getMeshXVals();
    const uSegments = xVals.length - 1;
    const vSegments = 50;

    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    const evaluateBezier1D = (p0: number, p1: number, p2: number, t: number): number => {
      const mt = 1.0 - t;
      return mt * mt * p0 + 2.0 * mt * t * p1 + t * t * p2;
    };

    for (let u = 0; u <= uSegments; u++) {
      const x = xVals[u];
      const uPct = x / L;

      const keelPt = this.keel.getPointAtX(x);
      const gunLeft = this.gunwale.getLeftPointAtX(x);

      const keelZ = keelPt.z;
      const gunwaleY = Math.abs(gunLeft.y);
      const gunwaleZ = gunLeft.z;

      const hullCPY = -gunwaleY * (1.0 - this.params.hullHorizontalCurvature * 0.7);
      const hullCPZ = keelZ + (gunwaleZ - keelZ) * this.params.hullVerticalCurvature;

      for (let v = 0; v <= vSegments; v++) {
        const vPct = v / vSegments;
        let vy: number;
        let vz: number;

        if (vPct <= 0.5) {
          // Left side: sweeps from Port Gunwale (-gunwaleY) to Keel (0)
          const t = 1.0 - (vPct / 0.5);
          vy = evaluateBezier1D(0, hullCPY, -gunwaleY, t);
          vz = evaluateBezier1D(keelZ, hullCPZ, gunwaleZ, t);
        } else {
          // Right side: sweeps from Keel (0) to Starboard Gunwale (+gunwaleY)
          const t = (vPct - 0.5) / 0.5;
          vy = evaluateBezier1D(0, -hullCPY, gunwaleY, t);
          vz = evaluateBezier1D(keelZ, hullCPZ, gunwaleZ, t);
        }

        vertices.push(x, vz, vy); // X=length, Y=height, Z=width
        uvs.push(uPct, vPct);
      }
    }

    // Build indices (quads split into triangles)
    for (let u = 0; u < uSegments; u++) {
      for (let v = 0; v < vSegments; v++) {
        const row1 = u * (vSegments + 1);
        const row2 = (u + 1) * (vSegments + 1);

        const a = row1 + v;
        const b = row1 + v + 1;
        const c = row2 + v;
        const d = row2 + v + 1;

        indices.push(a, b, d);
        indices.push(a, d, c);
      }
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      normals: new Float32Array(vertices.length),
      uvs: new Float32Array(uvs)
    };
  }

  /**
   * Generates a smooth deck mesh grid, cutting out the cockpit opening.
   */
  public generateDeckMesh(): MeshData {
    const L = this.params.length * 12;
    const vSegments = 51; // Odd number prevents centerline vertex crossover clamping

    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    const pPower = 1.0 + this.params.deckVerticalCurvature * 2.2;
    const activeCpStart = this.params.cockpitStart;
    const activeCpEnd = activeCpStart + this.params.cockpitLength;

    const xVals = this.getMeshXVals();
    const uSegments = xVals.length - 1;

    const getPlaneZ = (xVal: number) => {
      return this.sternDeckZ + xVal * this.slope;
    };

    for (let u = 0; u <= uSegments; u++) {
      const x = xVals[u];
      const uPct = x / L;

      const gunLeft = this.gunwale.getLeftPointAtX(x);
      const deckPt_untrimmed = this.deckLine.getUntrimmedPointAtX(x);

      const gunwaleY = Math.abs(gunLeft.y);
      const gunwaleZ = gunLeft.z;
      const deckZ_untrimmed = deckPt_untrimmed.z;

      const isTrimmedZone = x <= this.facetStartX;
      const isInCockpitZone = x >= activeCpStart && x <= activeCpEnd;

      for (let v = 0; v <= vSegments; v++) {
        const vPct = v / vSegments;
        let vy = -gunwaleY + 2.0 * gunwaleY * vPct;
        const absY = Math.abs(vy);

        // Evaluate the original untrimmed deck height
        const yPct = absY / (gunwaleY || 1.0);
        let vz = deckZ_untrimmed - (deckZ_untrimmed - gunwaleZ) * Math.pow(yPct, pPower);

        // Trim the top of the rib/deck with the plane (leaves side arcs untouched)
        if (isTrimmedZone) {
          const planeZ = getPlaneZ(x);
          vz = Math.min(vz, planeZ);
        }

        // Apply cockpit cutout
        if (isInCockpitZone) {
          const planeZ = getPlaneZ(x);
          const boundaryY = this.cockpit.getCockpitBoundaryY(x, this.params, this.facetOutlineCurve);
          const activeBoundaryY = boundaryY;

          const centerlineOffset = gunwaleY / (vSegments || 1);
          const clampThreshold = Math.max(activeBoundaryY, centerlineOffset * 1.1);

          if (absY < clampThreshold) {
            vy = vy < 0 ? -activeBoundaryY : activeBoundaryY;
            vz = planeZ; // boundaries sit on flat trim plane
          }
        }

        vertices.push(x, vz, vy);
        uvs.push(uPct, vPct);
      }
    }

    // Build indices (skipping faces inside the cockpit opening)
    for (let u = 0; u < uSegments; u++) {
      const x = xVals[u];
      const nextX = xVals[u + 1];
      const inCpU = x >= activeCpStart && x <= activeCpEnd;
      const inCpNextU = nextX >= activeCpStart && nextX <= activeCpEnd;

      const boundaryY = inCpU ? this.cockpit.getCockpitBoundaryY(x, this.params, this.facetOutlineCurve) : 0.0;
      const nextBoundaryY = inCpNextU ? this.cockpit.getCockpitBoundaryY(nextX, this.params, this.facetOutlineCurve) : 0.0;

      const gunLeft = this.gunwale.getLeftPointAtX(x);
      const gunwaleY = Math.abs(gunLeft.y);
      const nextGunLeft = this.gunwale.getLeftPointAtX(nextX);
      const nextGunwaleY = Math.abs(nextGunLeft.y);

      for (let v = 0; v < vSegments; v++) {
        const vPct = v / vSegments;
        const nextVPct = (v + 1) / vSegments;

        const vy = -gunwaleY + 2.0 * gunwaleY * vPct;
        const nextVy = -gunwaleY + 2.0 * gunwaleY * nextVPct;

        const nextXvy = -nextGunwaleY + 2.0 * nextGunwaleY * vPct;
        const nextXnextVy = -nextGunwaleY + 2.0 * nextGunwaleY * nextVPct;

        // Evaluate the vertices AFTER clamping to see if the quad's center is inside the cockpit curve
        let yA = vy;
        let yB = nextVy;
        let yC = nextXvy;
        let yD = nextXnextVy;

        const centerlineOffset = gunwaleY / (vSegments || 1);
        const clampThresholdU = Math.max(boundaryY, centerlineOffset * 1.1);
        const nextCenterlineOffset = nextGunwaleY / (vSegments || 1);
        const clampThresholdNextU = Math.max(nextBoundaryY, nextCenterlineOffset * 1.1);

        if (inCpU) {
          if (Math.abs(yA) < clampThresholdU) yA = yA < 0 ? -boundaryY : boundaryY;
          if (Math.abs(yB) < clampThresholdU) yB = yB < 0 ? -boundaryY : boundaryY;
        }
        if (inCpNextU) {
          if (Math.abs(yC) < clampThresholdNextU) yC = yC < 0 ? -nextBoundaryY : nextBoundaryY;
          if (Math.abs(yD) < clampThresholdNextU) yD = yD < 0 ? -nextBoundaryY : nextBoundaryY;
        }

        const xCenter = (x + nextX) / 2;
        const yCenter = (yA + yB + yC + yD) / 4;
        const inCpCenter = xCenter >= activeCpStart && xCenter <= activeCpEnd;
        const boundaryYCenter = inCpCenter ? this.cockpit.getCockpitBoundaryY(xCenter, this.params, this.facetOutlineCurve) : 0.0;

        const isInsideCenter = inCpCenter && (Math.abs(yCenter) < boundaryYCenter);

        if (isInsideCenter) {
          continue; // Skip drawing in the cockpit opening
        }

        const row1 = u * (vSegments + 1);
        const row2 = (u + 1) * (vSegments + 1);

        const a = row1 + v;
        const b = row1 + v + 1;
        const c = row2 + v;
        const d = row2 + v + 1;

        indices.push(a, b, d);
        indices.push(a, d, c);
      }
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      normals: new Float32Array(vertices.length),
      uvs: new Float32Array(uvs)
    };
  }

  /**
   * Performs numerical hydrostatic calculations by solving for the draft using bisection.
   */
  public calculateHydrostatics(cargoWeightLbs = 180, kayakWeightLbs = 45): Hydrostatics {
    const totalWeightLbs = cargoWeightLbs + kayakWeightLbs;
    const densityWaterLbsCuIn = 0.03611; // 62.4 lbs/cu.ft = 0.03611 lbs/cu.in
    const targetDisplacementVolume = totalWeightLbs / densityWaterLbsCuIn;

    const L = this.params.length * 12;

    let minDraft = 0;
    let maxDraft = this.params.hullHeight * 1.5;
    let draft = this.params.hullHeight / 2.0;

    let displacementVolume = 0;
    let lcb = L / 2.0;
    let vcb = 0;
    let waterplaneArea = 0;
    let waterplaneMomentOfInertia = 0;
    let wettedSurfaceArea = 0;

    const dx = 3.0; // 3-inch integration slices

    for (let iter = 0; iter < 16; iter++) {
      displacementVolume = 0;
      let volumeMomentX = 0;
      let volumeMomentZ = 0;
      waterplaneArea = 0;
      waterplaneMomentOfInertia = 0;
      wettedSurfaceArea = 0;

      for (let x = 0; x <= L; x += dx) {
        // Create an ephemeral station to compute submerged metrics at draft
        const keelPt = this.keel.getPointAtX(x);
        const deckPt = this.deckLine.getPointAtX(x);
        const deckPtUntrimmed = this.deckLine.getUntrimmedPointAtX(x);
        const gunLeft = this.gunwale.getLeftPointAtX(x);
        const gunRight = this.gunwale.getRightPointAtX(x);

        const station = new RibStation(
          this.rhino,
          x,
          this.params,
          keelPt,
          deckPt,
          gunLeft,
          gunRight,
          draft,
          this.facetStartX,
          this.slope,
          deckPtUntrimmed,
          this.sectionsImporter,
          true // skipRhinoCurves = true
        );

        const area = station.areaSubmerged;
        displacementVolume += area * dx;
        volumeMomentX += area * x * dx;

        const keelZ = keelPt.z;
        if (draft > keelZ) {
          const sliceCentroidZ = keelZ + (draft - keelZ) * 0.4;
          volumeMomentZ += area * sliceCentroidZ * dx;

          const subPts = station.hullCurveLeft.filter((p: any) => p.z < draft);
          const halfBeamAtWL = subPts.length > 0 ? Math.abs(subPts[subPts.length - 1].y) : 0;
          const wlWidth = halfBeamAtWL * 2.0;
          waterplaneArea += wlWidth * dx;

          waterplaneMomentOfInertia += (2.0 / 3.0) * Math.pow(halfBeamAtWL, 3) * dx;

          // Wetted perimeter
          let wettedPerimeter = 0;
          const subHullPts = station.hullCurveLeft.filter((p: any) => p.z <= draft);
          for (let j = 0; j < subHullPts.length - 1; j++) {
            const dy = subHullPts[j + 1].y - subHullPts[j].y;
            const dz = subHullPts[j + 1].z - subHullPts[j].z;
            wettedPerimeter += Math.sqrt(dy * dy + dz * dz);
          }
          wettedSurfaceArea += wettedPerimeter * 2.0 * dx;
        }
      }

      if (Math.abs(displacementVolume - targetDisplacementVolume) < 5.0) {
        lcb = volumeMomentX / (displacementVolume || 1.0);
        vcb = volumeMomentZ / (displacementVolume || 1.0);
        break;
      }

      if (displacementVolume < targetDisplacementVolume) {
        minDraft = draft;
      } else {
        maxDraft = draft;
      }
      draft = (minDraft + maxDraft) / 2.0;
    }

    const BM = waterplaneMomentOfInertia / (displacementVolume || 1.0);

    // Approximate KG (Center of Gravity)
    const occupantKG = 2.0;
    const kayakKG = this.params.hullHeight * 0.6;
    const CG = (cargoWeightLbs * occupantKG + kayakWeightLbs * kayakKG) / totalWeightLbs;

    // GM = KB + BM - KG  (where KB = VCB)
    const GM = vcb + BM - CG;

    let stabilityStatus = "Stable";
    if (GM < 0.5) stabilityStatus = "Tippy / Poor Initial Stability";
    else if (GM < 1.5) stabilityStatus = "Moderate / Sporty Initial Stability";
    else if (GM >= 1.5) stabilityStatus = "Very Stable / High Initial Stability";

    return {
      draft,
      displacementLbs: totalWeightLbs,
      displacementVolume,
      wettedSurfaceArea,
      lcb,
      vcb,
      waterplaneArea,
      transverseMetacenterBM: BM,
      gm: GM,
      stabilityStatus
    };
  }

  /**
   * Exports the entire 3D model (NURBS curves, station frames, and surface meshes)
   * into a native Rhino .3dm file using the WebAssembly rhino3dm API.
   */
  public export3dm(): Uint8Array {
    const file = new this.rhino.File3dm();

    // 1. Write the core longitudinal curves
    if (this.keel.curve) file.objects().addCurve(this.keel.curve);
    if (this.deckLine.curve) file.objects().addCurve(this.deckLine.curve);
    if (this.gunwale.leftCurve) file.objects().addCurve(this.gunwale.leftCurve);
    if (this.gunwale.rightCurve) file.objects().addCurve(this.gunwale.rightCurve);
    if (this.facetOutlineCurve) file.objects().addCurve(this.facetOutlineCurve);
    if (this.cockpit.curve) file.objects().addCurve(this.cockpit.curve);

    // 2. Write all structural transverse rib curves
    const stations = this.generateStations(0);
    stations.forEach(st => {
      if (st.rhinoClosedCurve) file.objects().addCurve(st.rhinoClosedCurve);
      if (st.rhinoHullCurveLeft) file.objects().addCurve(st.rhinoHullCurveLeft);
      if (st.rhinoHullCurveRight) file.objects().addCurve(st.rhinoHullCurveRight);
      if (st.rhinoDeckCurveLeft) file.objects().addCurve(st.rhinoDeckCurveLeft);
      if (st.rhinoDeckCurveRight) file.objects().addCurve(st.rhinoDeckCurveRight);
    });

    // 3. Write Hull Mesh
    const hullData = this.generateHullMesh();
    const rhinoHull = new this.rhino.Mesh();
    for (let i = 0; i < hullData.vertices.length; i += 3) {
      rhinoHull.vertices().add(hullData.vertices[i], hullData.vertices[i + 1], hullData.vertices[i + 2]);
    }
    for (let i = 0; i < hullData.indices.length; i += 3) {
      rhinoHull.faces().addFace(hullData.indices[i], hullData.indices[i + 1], hullData.indices[i + 2]);
    }
    rhinoHull.normals().computeVertexNormals();
    file.objects().addMesh(rhinoHull);

    // 4. Write Deck Mesh
    const deckData = this.generateDeckMesh();
    const rhinoDeck = new this.rhino.Mesh();
    for (let i = 0; i < deckData.vertices.length; i += 3) {
      rhinoDeck.vertices().add(deckData.vertices[i], deckData.vertices[i + 1], deckData.vertices[i + 2]);
    }
    for (let i = 0; i < deckData.indices.length; i += 3) {
      rhinoDeck.faces().addFace(deckData.indices[i], deckData.indices[i + 1], deckData.indices[i + 2]);
    }
    rhinoDeck.normals().computeVertexNormals();
    file.objects().addMesh(rhinoDeck);

    // Serialize to binary buffer
    const buffer = file.toByteArray();

    // Dispose the Native objects to prevent WASM memory leaks
    file.delete();
    rhinoHull.delete();
    rhinoDeck.delete();

    return buffer;
  }

  /**
   * Calculates the half-width of the flat deck trimming plane at a given longitudinal coordinate X.
   * If sections data is loaded, uses bisection to find the exact intersection of the flat plane and the deck.
   * Otherwise, falls back to the parametric curve equation.
   */
  public getFlatPlaneWidth(x: number, planeZ: number, gunwaleY: number, deckZ_untrimmed: number): number {
    const gunwaleZ = this.gunwale.getLeftPointAtX(x).z;
    if (planeZ >= deckZ_untrimmed) return 0.0;
    if (planeZ <= gunwaleZ) return gunwaleY;

    const pPower = 1.0 + this.params.deckVerticalCurvature * 2.2;
    const yPctInt = Math.max(0, Math.min(1, (deckZ_untrimmed - planeZ) / (deckZ_untrimmed - gunwaleZ || 1)));
    return Math.pow(yPctInt, 1.0 / pPower) * gunwaleY;
  }

  public getSmoothFacetYAtX(xVal: number): number {
    if (!this.facetOutlineCurve) return 0.0;

    const curve = this.facetOutlineCurve;
    const domain = curve.domain;
    const tMin = domain[0];
    const tMax = domain[1];

    // Find tPeak of facetOutlineCurve using a ternary search to ensure monotonic X in the search interval
    let lowT = tMin;
    let highT = tMax;
    for (let iter = 0; iter < 20; iter++) {
      const t1 = lowT + (highT - lowT) / 3;
      const t2 = highT - (highT - lowT) / 3;
      if (curve.pointAt(t1)[0] < curve.pointAt(t2)[0]) {
        lowT = t1;
      } else {
        highT = t2;
      }
    }
    const tPeak = (lowT + highT) / 2;

    // Search on the left half of the closed curve (where t goes from tMin to tPeak)
    let low = tMin;
    let high = tPeak;

    for (let iter = 0; iter < 16; iter++) {
      const t = (low + high) / 2;
      const pt = curve.pointAt(t);
      const px = pt[0];

      if (px < xVal) {
        low = t;
      } else {
        high = t;
      }
    }
    const finalT = (low + high) / 2;
    const pt = curve.pointAt(finalT);
    return Math.abs(pt[2]); // Y is the lateral half-width coordinate
  }

  /**
   * Constructs a closed cubic NURBS curve outlining the boundary of the flat trimmed deck facet.
   * Runs forward along the left edge, loops at the peak, and returns along the right edge.
   * Samples only at the actual station intervals to allow the cubic spline solver to generate a fair, smooth arc.
   */
  public buildFacetOutline() {
    const pts = new this.rhino.Point3dList();

    // Generate smooth sampling coordinates along the facet length
    const xVals: number[] = [];
    const numSteps = 40;
    for (let i = 0; i < numSteps; i++) {
      xVals.push((i / numSteps) * this.facetStartX);
    }

    // 1. Left boundary points
    for (let i = 0; i < xVals.length; i++) {
      const x = xVals[i];
      const planeZ = this.sternDeckZ + x * this.slope;
      const gunLeft = this.gunwale.getLeftPointAtX(x);
      const dPtUntrimmed = this.deckLine.getUntrimmedPointAtX(x);
      const yFlat = this.getFlatPlaneWidth(x, planeZ, Math.abs(gunLeft.y), dPtUntrimmed.z);
      pts.add(x, planeZ, -yFlat);
    }

    // Peak vertex
    const peakZ = this.sternDeckZ + this.facetStartX * this.slope;
    pts.add(this.facetStartX, peakZ, 0.0);

    // 2. Right boundary points (stepping backward)
    for (let i = xVals.length - 1; i >= 0; i--) {
      const x = xVals[i];
      const planeZ = this.sternDeckZ + x * this.slope;
      const gunLeft = this.gunwale.getLeftPointAtX(x);
      const dPtUntrimmed = this.deckLine.getUntrimmedPointAtX(x);
      const yFlat = this.getFlatPlaneWidth(x, planeZ, Math.abs(gunLeft.y), dPtUntrimmed.z);
      pts.add(x, planeZ, yFlat);
    }

    // 3. Close the curve by adding the start point
    const startPlaneZ = this.sternDeckZ;
    const startGunLeft = this.gunwale.getLeftPointAtX(0);
    const startDPtUntrimmed = this.deckLine.getUntrimmedPointAtX(0);
    const startYFlat = this.getFlatPlaneWidth(0, startPlaneZ, Math.abs(startGunLeft.y), startDPtUntrimmed.z);
    pts.add(0, startPlaneZ, -startYFlat);

    // Create cubic NURBS curve
    this.facetOutlineCurve = this.rhino.NurbsCurve.create(false, 3, pts);
    pts.delete();
  }
}
