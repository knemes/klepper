import type { KayakParameters, MeshData, Hydrostatics } from "./types";
import { RibStation } from "./RibStation";
import { Bow } from "./Bow";
import { Stern } from "./Stern";
import { Keel } from "./Keel";
import { DeckLine } from "./DeckLine";
import { Gunwale } from "./Gunwale";
import { Cockpit } from "./Cockpit";

export class KayakBuilder {
  private rhino: any;
  public params: KayakParameters;

  public bow: Bow;
  public stern: Stern;
  public keel: Keel;
  public deckLine: DeckLine;
  public gunwale: Gunwale;
  public cockpit: Cockpit;

  // Dynamic flat plane parameters
  public facetStartX: number = 0;
  public slope: number = 0;
  public sternDeckZ: number = 0;

  constructor(rhino: any, params: KayakParameters) {
    this.rhino = rhino;
    this.params = params;

    // Instantiate all components
    this.bow = new Bow(this.rhino, this.params);
    this.stern = new Stern(this.rhino, this.params);
    this.keel = new Keel(this.rhino, this.params, this.bow, this.stern);
    this.deckLine = new DeckLine(this.rhino, this.params);
    this.gunwale = new Gunwale(this.rhino, this.params);
    this.cockpit = new Cockpit(this.rhino);

    // Compute flat deck plane parameters based directly on cockpit position
    this.sternDeckZ = this.deckLine.getUntrimmedPointAtX(0).z;
    this.facetStartX = this.params.cockpitStart + this.params.cockpitLength;
    this.slope = (this.params.totalHeight - this.sternDeckZ) / (this.facetStartX || 1);

    // Update the deckLine geometry with the solved facetStartX and slope
    this.deckLine.updateGeometry(this.params, this.facetStartX, this.slope, this.sternDeckZ);
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
          deckPtUntrimmed
        )
      );
    }

    return stations;
  }

  /**
   * Generates a smooth hull mesh grid for Three.js rendering.
   */
  public generateHullMesh(): MeshData {
    const L = this.params.length * 12;
    const uSegments = 50;
    const vSegments = 20;

    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    const evaluateBezier1D = (p0: number, p1: number, p2: number, t: number): number => {
      const mt = 1.0 - t;
      return mt * mt * p0 + 2.0 * mt * t * p1 + t * t * p2;
    };

    for (let u = 0; u <= uSegments; u++) {
      const uPct = u / uSegments;
      const x = uPct * L;

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
          // Left side
          const t = vPct / 0.5;
          vy = evaluateBezier1D(0, hullCPY, -gunwaleY, t);
          vz = evaluateBezier1D(keelZ, hullCPZ, gunwaleZ, t);
        } else {
          // Right side (mirror)
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
    const uSegments = 50;
    const vSegments = 20;

    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    const pPower = 1.0 + this.params.deckVerticalCurvature * 2.2;
    const facetStartX = this.facetStartX;

    const activeCpStart = this.params.cockpitStart;
    const activeCpEnd = activeCpStart + this.params.cockpitLength;

    const getPlaneZ = (xVal: number) => {
      return this.sternDeckZ + xVal * this.slope;
    };

    for (let u = 0; u <= uSegments; u++) {
      const uPct = u / uSegments;
      const x = uPct * L;

      const gunLeft = this.gunwale.getLeftPointAtX(x);
      const deckPt_untrimmed = this.deckLine.getUntrimmedPointAtX(x);

      const gunwaleY = Math.abs(gunLeft.y);
      const gunwaleZ = gunLeft.z;
      const deckZ_untrimmed = deckPt_untrimmed.z;

      const isTrimmedZone = x <= facetStartX;
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
          const boundaryY = this.cockpit.getCockpitBoundaryY(x, this.params);
          const planeZ = getPlaneZ(x);
          
          const yPctInt = Math.max(0, Math.min(1, (deckZ_untrimmed - planeZ) / (deckZ_untrimmed - gunwaleZ || 1)));
          const naturalFacetY = Math.pow(yPctInt, 1.0 / pPower) * gunwaleY;
          const maxAllowedHalfWidth = Math.max(1.0, naturalFacetY - 1.0);
          const activeBoundaryY = Math.min(boundaryY, maxAllowedHalfWidth);

          if (absY < activeBoundaryY) {
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
      const x = (u / uSegments) * L;
      const nextX = ((u + 1) / uSegments) * L;
      const isFullCockpitIndex = (x > activeCpStart && x < activeCpEnd) && (nextX > activeCpStart && nextX < activeCpEnd);

      for (let v = 0; v < vSegments; v++) {
        if (isFullCockpitIndex) {
          const vPct = v / vSegments;
          const nextVPct = (v + 1) / vSegments;
          // Skip drawing in the cockpit opening (middle 40% of grid)
          if (vPct > 0.3 && nextVPct < 0.7) {
            continue;
          }
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

    const dx = 2.0; // 2-inch integration slices

    for (let iter = 0; iter < 30; iter++) {
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
          deckPtUntrimmed
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

    // 2. Write all structural transverse rib curves
    const stations = this.generateStations(0);
    stations.forEach(st => {
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
}
