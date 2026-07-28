// ꓘ-B Kayaks - Geometry and Calculations Engine
// Mathematically generates kayak curves, meshes, ribs, and performs hydrostatics calculations.

export interface KayakParameters {
  length: number;               // total length in feet (e.g., 14)
  beam: number;                 // max beam (width) in inches (e.g., 24)
  hullHeight: number;           // keel-to-gunwale height at midship in inches (e.g., 10)
  totalHeight: number;          // keel-to-deck total height at peak in inches (e.g., 16)
  beamPlacement: number;        // 0 to 1 (relative X position of max beam, e.g., 0.5)
  bowLength: number;            // length of bow stem curve in inches (e.g., 20)
  sternLength: number;          // length of stern stem curve in inches (e.g., 12)
  bowWidthFactor: number;       // 0 to 1 (scaling of bow shoulder width, e.g., 0.4)
  sternWidthFactor: number;     // 0 to 1 (scaling of stern shoulder width, e.g., 0.6)
  
  // Curvature Controls
  hullHorizontalCurvature: number; // 0 to 1 (0 = flat bottom, 1 = deep V / round)
  hullVerticalCurvature: number;   // 0 to 1 (shapes chine sharpness)
  deckVerticalCurvature: number;   // 0 to 1 (crown height of the deck)
  deckLongitudinalPeak: number;    // 0 to 1 (relative X position of max deck height)

  // Cockpit
  cockpitLength: number;        // inches (e.g., 34)
  cockpitWidth: number;         // inches (e.g., 19)
  cockpitStart: number;         // inches from stern (e.g., 78)

  // Ribs / Stations
  ribSpacing: number;           // spacing in inches (e.g., 12)
  plywoodThickness: number;     // inches (default: 0.75)
  coamingHeight?: number;       // inches (default: 0.75, max: 1.0)
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface RibStation {
  x: number;
  keelPt: Point3D;
  deckPt: Point3D;
  gunwaleLeft: Point3D;
  gunwaleRight: Point3D;
  hullCurveLeft: Point3D[];
  hullCurveRight: Point3D[];
  deckCurveLeft: Point3D[];
  deckCurveRight: Point3D[];
  areaSubmerged: number; // For hydrodynamics
}

// 1D Quadratic Bezier Evaluator
function evaluateBezier1D(p0: number, p1: number, p2: number, t: number): number {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

/**
 * Evaluates the keel profile Z height at a given X.
 * The keel is flat in the middle, and curves upward at the stern (X=0) and bow (X=L).
 */
export function getKeelZ(x: number, params: KayakParameters): number {
  const L = params.length * 12; // Length in inches
  const sl = params.sternLength;
  const bl = params.bowLength;
  const hh = params.hullHeight;

  if (x < sl) {
    // Stern curve: from (0, hh) to (sl, 0)
    const t = x / sl;
    // We want Z to start at hh (stern tip) and curve down to 0 at sl.
    // Control point Z is shaped by stern curvature parameters.
    return evaluateBezier1D(hh, hh * 0.1, 0, t);
  } else if (x > L - bl) {
    // Bow curve: from (L - bl, 0) to (L, hh + 2) [bows are usually slightly higher]
    const t = (x - (L - bl)) / bl;
    return evaluateBezier1D(0, hh * 0.1, hh + 2, t);
  } else {
    // Flat keel bottom
    return 0;
  }
}

/**
 * Evaluates the deck profile Z height at a given X.
 * The deck has a peak height at deckLongitudinalPeak, tapering down to the bow and stern tips.
 */
export function getDeckZ(x: number, params: KayakParameters): number {
  const L = params.length * 12;
  const th = params.totalHeight;
  const peakX = L * params.deckLongitudinalPeak;
  const sternZ = params.hullHeight;
  const bowZ = params.hullHeight + 2;

  if (x < peakX) {
    // Stern to Peak curve - smoothly rising to peak with no humping
    const t = x / (peakX || 1);
    return evaluateBezier1D(sternZ, th, th, t);
  } else {
    // Peak to Bow curve - smoothly sloping down to bow with no bulbous overshoot
    const t = (x - peakX) / (L - peakX || 1);
    return evaluateBezier1D(th, th, bowZ, t);
  }
}

/**
 * Evaluates the half-beam (Y coordinate) of the gunwale at a given X.
 * The gunwale starts at 0, flares to max beam/2 at beamPlacement, and tapers to 0 at the bow.
 */
export function getGunwaleY(x: number, params: KayakParameters): number {
  const L = params.length * 12;
  const maxHalfBeam = params.beam / 2;
  const peakX = L * params.beamPlacement;

  // Let's establish shoulder points
  const sternShY = maxHalfBeam * params.sternWidthFactor;
  const bowShY = maxHalfBeam * params.bowWidthFactor;

  // Simple multi-segment Bezier or hermite spline for smooth envelope
  if (x <= 0 || x >= L) return 0;

  if (x < peakX) {
    // Stern to Max Beam
    // We interpolate through (0, 0) -> (sternShX, sternShY) -> (peakX, maxHalfBeam)
    const t = x / peakX;
    // Control points to enforce max beam tangency at peakX
    const cp0 = 0;
    const cp1 = sternShY * 1.1; // push out slightly
    const cp2 = maxHalfBeam;
    return evaluateBezier1D(cp0, cp1, cp2, t);
  } else {
    // Max Beam to Bow
    const t = (x - peakX) / (L - peakX);
    const cp0 = maxHalfBeam;
    const cp1 = bowShY * 1.1;
    const cp2 = 0;
    return evaluateBezier1D(cp0, cp1, cp2, t);
  }
}

/**
 * Evaluates the Z height of the gunwale at a given X.
 * Typically gunwales curve slightly down in the middle (sheer line).
 */
export function getGunwaleZ(x: number, params: KayakParameters): number {
  const L = params.length * 12;

  
  // Gunwale height is typically a fraction between keel and deck, forming the sheer line.
  // We can model it with a sheer profile curve.
  const sternSheer = params.hullHeight;
  const midSheer = params.hullHeight * 0.9; // sheer dip in the middle
  const bowSheer = params.hullHeight + 1.5;

  const t = x / L;
  return evaluateBezier1D(sternSheer, midSheer, bowSheer, t);
}

/**
 * Computes a rib's cross section curves at a specific X coordinate.
 */
export function getRibStation(x: number, params: KayakParameters, draft = 0): RibStation {
  
  const keelZ = getKeelZ(x, params);
  const deckZ = getDeckZ(x, params);
  const gunwaleY = getGunwaleY(x, params);
  const gunwaleZ = getGunwaleZ(x, params);

  const keelPt: Point3D = { x, y: 0, z: keelZ };
  const deckPt: Point3D = { x, y: 0, z: deckZ };
  const gunwaleLeft: Point3D = { x, y: -gunwaleY, z: gunwaleZ };
  const gunwaleRight: Point3D = { x, y: gunwaleY, z: gunwaleZ };

  // Create curves by sampling Bezier points
  const segments = 16;
  const hullCurveLeft: Point3D[] = [];
  const hullCurveRight: Point3D[] = [];
  const deckCurveLeft: Point3D[] = [];
  const deckCurveRight: Point3D[] = [];

  // Hull Curve Control Point (Keel to Gunwale)
  // hullHorizontalCurvature controls how flat the bottom is (how far out the bilge goes)
  // hullVerticalCurvature controls the height of the bilge turn
  const hullCPY = -gunwaleY * (1 - params.hullHorizontalCurvature * 0.7);
  const hullCPZ = keelZ + (gunwaleZ - keelZ) * params.hullVerticalCurvature;

  // Deck Curve Power Parameter (controls V-peak vs. rounded dome flatness, prevents saddle humps)
  const pPower = 1.0 + params.deckVerticalCurvature * 2.2;
  
  // Calculate tapered flat trimming plane starting from the highest rib peak to stern tip
  const L_in = params.length * 12;
  const facetStartX = L_in * params.deckLongitudinalPeak;
  const isTrimmedZone = x <= facetStartX;
  
  let planeZ = 0;
  if (isTrimmedZone) {
    const sternDeckZ = getDeckZ(0, params);
    const peakDeckZ = params.totalHeight;
    planeZ = sternDeckZ + (peakDeckZ - sternDeckZ) * (x / (facetStartX || 1));
  }

  // Generate left side, then mirror for right side
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;

    // Hull point
    const hY = evaluateBezier1D(0, hullCPY, -gunwaleY, t);
    const hZ = evaluateBezier1D(keelZ, hullCPZ, gunwaleZ, t);
    hullCurveLeft.push({ x, y: hY, z: hZ });
    hullCurveRight.push({ x, y: -hY, z: hZ });

    // Deck point (continuous power-curve dome evaluation with flat plane trim)
    const dY = -gunwaleY + gunwaleY * t;
    const yPct = Math.abs(dY) / (gunwaleY || 1);
    let dZ = deckZ - (deckZ - gunwaleZ) * Math.pow(yPct, pPower);
    if (isTrimmedZone) {
      dZ = Math.min(dZ, planeZ);
    }
    
    deckCurveLeft.push({ x, y: dY, z: dZ });
    deckCurveRight.push({ x, y: -dY, z: dZ });
  }

  // Calculate submerged cross-sectional area for physics (using trapezoidal rule below draft line)
  let areaSubmerged = 0;
  if (draft > 0) {
    // Only calculate for points below water line
    // We integrate the left + right hull curve points that have z < draft
    const submergedPointsLeft = hullCurveLeft.filter(p => p.z < draft);
    if (submergedPointsLeft.length > 1) {
      // Add the draft intersection points at the edges
      const pts = [...submergedPointsLeft];
      if (pts[pts.length - 1].z < draft && hullCurveLeft.length > pts.length) {
        // Linearly interpolate intersection point at Z=draft
        const nextPt = hullCurveLeft[pts.length];
        const prevPt = pts[pts.length - 1];
        const fraction = (draft - prevPt.z) / (nextPt.z - prevPt.z);
        const intersectY = prevPt.y + fraction * (nextPt.y - prevPt.y);
        pts.push({ x, y: intersectY, z: draft });
      }

      // Calculate area of polygon: keel to waterline level
      // Using trapezoid area integration on absolute Y coordinates
      for (let j = 0; j < pts.length - 1; j++) {
        const y1 = Math.abs(pts[j].y);
        const y2 = Math.abs(pts[j + 1].y);
        const dz = pts[j + 1].z - pts[j].z;
        // Area of trapezoid = (y1 + y2) / 2 * dz
        areaSubmerged += ((y1 + y2) / 2) * dz;
      }
      // Multiply by 2 for both sides
      areaSubmerged *= 2;
    }
  }

  return {
    x,
    keelPt,
    deckPt,
    gunwaleLeft,
    gunwaleRight,
    hullCurveLeft,
    hullCurveRight,
    deckCurveLeft,
    deckCurveRight,
    areaSubmerged
  };
}

/**
 * Computes all structural station coordinates along the length of the boat.
 */
export function generateRibStations(params: KayakParameters, draft = 0): RibStation[] {
  const L = params.length * 12;
  const spacing = params.ribSpacing;
  const stations: RibStation[] = [];

  // Always place stations at regular intervals, starting a bit after stern and ending before bow
  const startX = spacing;
  const endX = L - spacing;

  for (let x = startX; x <= endX; x += spacing) {
    stations.push(getRibStation(x, params, draft));
  }

  return stations;
}

/**
 * Computes full hydrostatic properties for the kayak:
 * - Displacement Volume & Weight (lbs of water)
 * - Center of Buoyancy (LCB along length, VCB vertically)
 * - Metacentric Height (GM) & Stability
 */
export interface Hydrostatics {
  draft: number;               // inches
  displacementLbs: number;     // weight in lbs
  displacementVolume: number;  // cubic inches
  wettedSurfaceArea: number;   // square inches
  lcb: number;                 // Longitudinal Center of Buoyancy (inches from stern)
  vcb: number;                 // Vertical Center of Buoyancy (inches from bottom keel)
  waterplaneArea: number;      // square inches
  transverseMetacenterBM: number; // BM in inches
  gm: number;                  // Metacentric Height (GM) in inches (indicator of initial stability)
  stabilityStatus: string;     // Stability descriptor
}

export function calculateHydrostatics(params: KayakParameters, cargoWeightLbs = 180, kayakWeightLbs = 45): Hydrostatics {
  const totalWeightLbs = cargoWeightLbs + kayakWeightLbs;
  const densityWaterLbsCuIn = 0.03611; // 62.4 lbs/cu.ft = 0.03611 lbs/cu.in
  const targetDisplacementVolume = totalWeightLbs / densityWaterLbsCuIn; // cubic inches needed

  const L = params.length * 12;

  // We solve for the correct draft (waterline height) using a simple bisection solver
  let minDraft = 0;
  let maxDraft = params.hullHeight * 1.5;
  let draft = params.hullHeight / 2; // initial guess
  let displacementVolume = 0;
  let lcb = L / 2;
  let vcb = 0;
  let waterplaneArea = 0;
  let waterplaneMomentOfInertia = 0;
  let wettedSurfaceArea = 0;

  const dx = 2.0; // 2-inch integration slices

  // Max 30 iterations for draft solver
  for (let iter = 0; iter < 30; iter++) {
    displacementVolume = 0;
    let volumeMomentX = 0;
    let volumeMomentZ = 0;
    waterplaneArea = 0;
    waterplaneMomentOfInertia = 0;
    wettedSurfaceArea = 0;

    // Numerical integration along length
    for (let x = 0; x <= L; x += dx) {
      const station = getRibStation(x, params, draft);
      const area = station.areaSubmerged;

      // Integrate volume: Simpson's or Trapezoidal rule
      displacementVolume += area * dx;
      volumeMomentX += area * x * dx;
      
      // Calculate average Z centroid of submerged slice
      // Approximate centroid as 0.4 * (draft - keelZ) + keelZ
      const keelZ = station.keelPt.z;
      if (draft > keelZ) {
        const sliceCentroidZ = keelZ + (draft - keelZ) * 0.4;
        volumeMomentZ += area * sliceCentroidZ * dx;

        // Calculate waterplane properties
        const halfBeamAtWL = Math.abs(station.hullCurveLeft.filter(p => p.z < draft).pop()?.y || 0);
        const wlWidth = halfBeamAtWL * 2;
        waterplaneArea += wlWidth * dx;
        
        // Transverse moment of inertia of waterplane: Integral of (2/3 * y^3 * dx)
        waterplaneMomentOfInertia += (2/3) * Math.pow(halfBeamAtWL, 3) * dx;

        // Wetted perimeter calculation
        let wettedPerimeter = 0;
        const subPts = station.hullCurveLeft.filter(p => p.z <= draft);
        for (let j = 0; j < subPts.length - 1; j++) {
          const dy = subPts[j+1].y - subPts[j].y;
          const dz = subPts[j+1].z - subPts[j].z;
          wettedPerimeter += Math.sqrt(dy*dy + dz*dz);
        }
        wettedSurfaceArea += wettedPerimeter * 2 * dx; // both sides
      }
    }

    if (Math.abs(displacementVolume - targetDisplacementVolume) < 5) {
      // Converged! Now calculate LCB and VCB
      lcb = volumeMomentX / (displacementVolume || 1);
      vcb = volumeMomentZ / (displacementVolume || 1);
      break;
    }

    if (displacementVolume < targetDisplacementVolume) {
      minDraft = draft;
    } else {
      maxDraft = draft;
    }
    draft = (minDraft + maxDraft) / 2;
  }

  // Calculate Metacentric Height
  // BM = I_T / V (Inertia of Waterplane / Volume of Displacement)
  const BM = waterplaneMomentOfInertia / (displacementVolume || 1);

  // Center of Gravity (KG) approximation
  // Assume boat center of gravity is at 0.5 * totalHeight, occupant is sitting low (e.g. 2.0 inches above keel)
  // Weighted center of gravity:
  const occupantKG = 2.0; // sitting in cockpit bottom
  const kayakKG = params.hullHeight * 0.6;
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
 * Generates 3D mesh vertex and index buffers for Three.js.
 * This represents the smooth hull surface by lofting across stations.
 */
export interface MeshData {
  vertices: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  uvs: Float32Array;
}

export function generateHullMesh(params: KayakParameters): MeshData {
  const L = params.length * 12;
  const uSegments = 50; // along length
  const vSegments = 20; // around girth (cross-section)

  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];

  // Generate grid of vertices
  for (let u = 0; u <= uSegments; u++) {
    const uPct = u / uSegments;
    const x = uPct * L;

    const keelZ = getKeelZ(x, params);
    const gunwaleY = getGunwaleY(x, params);
    const gunwaleZ = getGunwaleZ(x, params);
    
    const hullCPY = -gunwaleY * (1 - params.hullHorizontalCurvature * 0.7);
    const hullCPZ = keelZ + (gunwaleZ - keelZ) * params.hullVerticalCurvature;

    for (let v = 0; v <= vSegments; v++) {
      const vPct = v / vSegments;
      let vy: number;
      let vz: number;

      if (vPct <= 0.5) {
        // Left side: Keel (t=0) to Gunwale Left (t=1)
        const t = vPct / 0.5;
        vy = evaluateBezier1D(0, hullCPY, -gunwaleY, t);
        vz = evaluateBezier1D(keelZ, hullCPZ, gunwaleZ, t);
      } else {
        // Right side: Keel (t=0) to Gunwale Right (t=1)
        const t = (vPct - 0.5) / 0.5;
        vy = evaluateBezier1D(0, -hullCPY, gunwaleY, t);
        vz = evaluateBezier1D(keelZ, hullCPZ, gunwaleZ, t);
      }

      vertices.push(x, vz, vy); // Three.js coordinate mapping: X=length, Y=height (vz), Z=width (vy)
      uvs.push(uPct, vPct);
    }
  }

  // Generate indices (quads split into triangles)
  for (let u = 0; u < uSegments; u++) {
    for (let v = 0; v < vSegments; v++) {
      const row1 = u * (vSegments + 1);
      const row2 = (u + 1) * (vSegments + 1);

      const a = row1 + v;
      const b = row1 + v + 1;
      const c = row2 + v;
      const d = row2 + v + 1;

      // Triangle 1: a-b-d
      indices.push(a, b, d);
      // Triangle 2: a-d-c
      indices.push(a, d, c);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
    normals: new Float32Array(vertices.length), // Will compute normals in Three.js
    uvs: new Float32Array(uvs)
  };
}

export function generateDeckMesh(params: KayakParameters): MeshData {
  const L = params.length * 12;
  const uSegments = 50;
  const vSegments = 20;

  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];

  // Generate deck mesh grid
  for (let u = 0; u <= uSegments; u++) {
    const uPct = u / uSegments;
    const x = uPct * L;

    const gunwaleY = getGunwaleY(x, params);
    const gunwaleZ = getGunwaleZ(x, params);
    const deckZ = getDeckZ(x, params);
    
    const pPower = 1.0 + params.deckVerticalCurvature * 2.2;
    const facetStartX = L * params.deckLongitudinalPeak;
    const isTrimmedZone = x <= facetStartX;
    
    let planeZ = 0;
    if (isTrimmedZone) {
      const sternDeckZ = getDeckZ(0, params);
      const peakDeckZ = params.totalHeight;
      planeZ = sternDeckZ + (peakDeckZ - sternDeckZ) * (x / (facetStartX || 1));
    }

    // Procedurally cap cockpitStart to remain at least 1.0 inch aft of the highest rib peak
    const activeCpStart = Math.min(params.cockpitStart, facetStartX - 1.0 - params.cockpitLength);
    const activeCpEnd = activeCpStart + params.cockpitLength;
    const isInCockpitZone = x >= activeCpStart && x <= activeCpEnd;

    for (let v = 0; v <= vSegments; v++) {
      const vPct = v / vSegments;
      
      // Map vPct linearly across width from -gunwaleY to +gunwaleY
      let vy = -gunwaleY + 2 * gunwaleY * vPct;
      const yPct = Math.abs(vy) / (gunwaleY || 1);
      let vz = deckZ - (deckZ - gunwaleZ) * Math.pow(yPct, pPower);

      if (isTrimmedZone) {
        vz = Math.min(vz, planeZ);
      }

      // Simple cockpit cutout logic:
      if (isInCockpitZone) {
        const xc = x - (activeCpStart + params.cockpitLength / 2);
        const a = params.cockpitLength / 2;
        const b = params.cockpitWidth / 2;
        const ratio = (xc * xc) / (a * a || 1);
        const boundaryY = ratio < 1 ? b * Math.sqrt(1 - ratio) : 0;
        
        // Capped to stay 1.0 inch offset inside the flat facet
        const yPctInt = Math.max(0, Math.min(1, (deckZ - planeZ) / (deckZ - gunwaleZ || 1)));
        const naturalFacetY = Math.pow(yPctInt, 1 / pPower) * gunwaleY;
        const maxAllowedHalfWidth = Math.max(1.0, naturalFacetY - 1.0);
        const activeBoundaryY = Math.min(boundaryY, maxAllowedHalfWidth);

        if (Math.abs(vy) < activeBoundaryY) {
          vy = vy < 0 ? -activeBoundaryY : activeBoundaryY;
          vz = planeZ; // Cockpit boundary rests flat on the trimming plane
        }
      }

      vertices.push(x, vz, vy); // Three.js coordinate mapping: X=length, Y=height (vz), Z=width (vy)
      uvs.push(uPct, vPct);
    }
  }

  // Generate indices
  for (let u = 0; u < uSegments; u++) {
    const cpStart = params.cockpitStart;
    const cpEnd = params.cockpitStart + params.cockpitLength;
    const x = (u / uSegments) * L;
    const nextX = ((u + 1) / uSegments) * L;
    // Skip creating faces inside the cockpit opening
    const isFullCockpitIndex = (x > cpStart && x < cpEnd) && (nextX > cpStart && nextX < cpEnd);

    for (let v = 0; v < vSegments; v++) {
      // If we are inside the cockpit hole, don't generate the middle faces
      if (isFullCockpitIndex) {
        const vPct = v / vSegments;
        const nextVPct = (v + 1) / vSegments;
        // The middle 40% of deck width is cut out
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
 * Formats a 2D rib pattern (outer contours and notches) into SVG path data.
 */
export function generateRibSVG(station: RibStation, params: KayakParameters): string {
  // Plywood thickness is 0.75"
  const pt = params.plywoodThickness;
  
  // We offset the contour slightly inward by the thickness of the cedar strips (0.25")
  // because the ribs act as internal forms inside the strips!
  const stripThickness = 0.25;

  // Let's create an SVG boundary path
  // Find min/max bounds to fit coordinate translation
  // We translate so keel point is near bottom-middle
  const pointsLeft = station.hullCurveLeft.map(p => {
    // Offset along normal direction by stripThickness
    // For simplicity, we just scale Y slightly inward
    const scale = (Math.abs(p.y) - stripThickness) / (Math.abs(p.y) || 1);
    const y = p.y * Math.max(0, scale);
    const z = p.z;
    return { y, z };
  });

  const pointsRight = station.hullCurveRight.map(p => {
    const scale = (Math.abs(p.y) - stripThickness) / (Math.abs(p.y) || 1);
    const y = p.y * Math.max(0, scale);
    const z = p.z;
    return { y, z };
  });

  const deckPtsLeft = station.deckCurveLeft.map(p => {
    const scale = (Math.abs(p.y) - stripThickness) / (Math.abs(p.y) || 1);
    const y = p.y * Math.max(0, scale);
    const z = p.z;
    return { y, z };
  });

  const deckPtsRight = station.deckCurveRight.map(p => {
    const scale = (Math.abs(p.y) - stripThickness) / (Math.abs(p.y) || 1);
    const y = p.y * Math.max(0, scale);
    const z = p.z;
    return { y, z };
  });

  // Calculate width and height of the rib
  const minY = -params.beam / 2 - 2;
  const maxY = params.beam / 2 + 2;
  const minZ = station.keelPt.z - 2;
  const maxZ = station.deckPt.z + 2;

  const width = maxY - minY;
  const height = maxZ - minZ;

  // Transform coordinates for SVG viewbox (Y becomes horizontal, Z vertical inverted)
  // Keel is at Y = 0, so in SVG it will be in the middle: width/2
  const svgX = (y: number) => (y - minY).toFixed(2);
  const svgY = (z: number) => (maxZ - z).toFixed(2); // flip Z axis for screen

  // Write SVG path commands
  // 1. Draw outer hull profile: gunwale left -> keel -> gunwale right
  let dHull = `M ${svgX(pointsLeft[0].y)} ${svgY(pointsLeft[0].z)}`;
  for (let i = 1; i < pointsLeft.length; i++) {
    dHull += ` L ${svgX(pointsLeft[i].y)} ${svgY(pointsLeft[i].z)}`;
  }
  for (let i = 0; i < pointsRight.length; i++) {
    dHull += ` L ${svgX(pointsRight[i].y)} ${svgY(pointsRight[i].z)}`;
  }

  // 2. Draw outer deck profile: gunwale right -> deck top -> gunwale left
  let dDeck = `M ${svgX(deckPtsRight[0].y)} ${svgY(deckPtsRight[0].z)}`;
  for (let i = 1; i < deckPtsRight.length; i++) {
    dDeck += ` L ${svgX(deckPtsRight[i].y)} ${svgY(deckPtsRight[i].z)}`;
  }
  for (let i = 0; i < deckPtsLeft.length; i++) {
    dDeck += ` L ${svgX(deckPtsLeft[i].y)} ${svgY(deckPtsLeft[i].z)}`;
  }

  // 3. Inject notches (e.g. 3/4" wide x 3/4" deep slots for strongback or gunwale rails)
  // Draw centerline and waterline reference marks
  const centerlinePath = `M ${svgX(0)} ${svgY(minZ)} L ${svgX(0)} ${svgY(maxZ)}`;
  const waterlinePath = `M ${svgX(minY)} ${svgY(params.hullHeight)} L ${svgX(maxY)} ${svgY(params.hullHeight)}`;

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(1)} ${height.toFixed(1)}" width="100%" height="100%">
      <rect width="100%" height="100%" fill="#F4F6F0" />
      <!-- Grid Lines -->
      <line x1="${svgX(minY)}" y1="${svgY(0)}" x2="${svgX(maxY)}" y2="${svgY(0)}" stroke="#EAE7DF" stroke-width="0.5" stroke-dasharray="2,2" />
      <line x1="${svgX(-12)}" y1="${svgY(minZ)}" x2="${svgX(-12)}" y2="${svgY(maxZ)}" stroke="#EAE7DF" stroke-width="0.5" stroke-dasharray="2,2" />
      <line x1="${svgX(12)}" y1="${svgY(minZ)}" x2="${svgX(12)}" y2="${svgY(maxZ)}" stroke="#EAE7DF" stroke-width="0.5" stroke-dasharray="2,2" />

      <!-- Centerline & Waterline Reference Marks (Engrave) -->
      <path d="${centerlinePath}" stroke="#2C4A3E" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.6" />
      <path d="${waterlinePath}" stroke="#8FBC8F" stroke-width="0.5" stroke-dasharray="5,5" opacity="0.8" />
      <text x="${svgX(0)}" y="${svgY(maxZ - 0.5)}" font-family="monospace" font-size="1.2" fill="#2C4A3E" text-anchor="middle">CL</text>
      <text x="${svgX(maxY - 1)}" y="${svgY(params.hullHeight - 0.2)}" font-family="monospace" font-size="1" fill="#8FBC8F" text-anchor="end">WATERLINE (WL)</text>

      <!-- Outer Profile Cuts (Cut) -->
      <path d="${dHull}" fill="none" stroke="#14231A" stroke-width="1.5" />
      <path d="${dDeck}" fill="none" stroke="#14231A" stroke-width="1.5" />

      <!-- Strongback cut-out notch (Usually in the center of the frame for mounting) -->
      <rect x="${svgX(-1.5)}" y="${svgY(station.deckPt.z - 4)}" width="3" height="3" fill="none" stroke="#FF7A5C" stroke-width="1" />
      <text x="${svgX(0)}" y="${svgY(station.deckPt.z - 2.5)}" font-family="monospace" font-size="0.8" fill="#FF7A5C" text-anchor="middle">3" STRONGBACK NOTCH</text>

      <!-- Station Label -->
      <text x="${svgX(0)}" y="${svgY(station.keelPt.z + 3)}" font-family="serif" font-size="2" fill="#14231A" text-anchor="middle" font-style="italic">Station ${((station.x)/12).toFixed(1)}'</text>
      <text x="${svgX(0)}" y="${svgY(station.keelPt.z + 1.5)}" font-family="monospace" font-size="1" fill="#2C4A3E" text-anchor="middle">X: ${station.x.toFixed(1)}" | ply: ${pt}"</text>
    </svg>
  `;

  return svgContent;
}
