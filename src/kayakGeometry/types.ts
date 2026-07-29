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
  coamingHeight?: number;       // inches (default: 0.75)
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface MeshData {
  vertices: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  uvs: Float32Array;
}

export interface Hydrostatics {
  draft: number;               // inches
  displacementLbs: number;     // weight in lbs
  displacementVolume: number;  // cubic inches
  wettedSurfaceArea: number;   // square inches
  lcb: number;                 // Longitudinal Center of Buoyancy (inches from stern)
  vcb: number;                 // Vertical Center of Buoyancy (inches from bottom keel)
  waterplaneArea: number;      // square inches
  transverseMetacenterBM: number; // BM in inches
  gm: number;                  // Metacentric Height (GM) in inches
  stabilityStatus: string;     // Stability descriptor
}
